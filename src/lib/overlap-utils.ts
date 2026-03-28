/**
 * IPv6 Block Overlap Checker utilities.
 *
 * Parses a list of CIDR blocks and detects:
 *   - Exact duplicates
 *   - Containment (block A contains block B)
 *   - Partial overlaps
 */

import { ipv6ToBigInt, getNetworkAddress, expandIPv6Address, shortenIPv6, isValidIPv6Address } from './ipv6-utils';

export interface ParsedBlock {
  original: string;
  network: string;
  prefix: number;
  netStart: bigint;
  netEnd: bigint;
  size: bigint;
  index: number;
}

export type OverlapType = 'duplicate' | 'contains' | 'contained' | 'overlap';

export interface OverlapFinding {
  type: OverlapType;
  blockA: ParsedBlock;
  blockB: ParsedBlock;
}

export interface OverlapReport {
  blocks: ParsedBlock[];
  findings: OverlapFinding[];
  errors: { line: number; text: string; reason: string }[];
  stats: {
    total: number;
    valid: number;
    duplicates: number;
    containments: number;
    overlaps: number;
    clean: number;
  };
}

/** Parse a single CIDR string into a ParsedBlock. */
function parseCIDR(cidr: string, index: number): ParsedBlock | null {
  const trimmed = cidr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('/');
  if (parts.length !== 2) return null;

  const prefixNum = parseInt(parts[1], 10);
  if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 128) return null;

  // Validate and expand the address
  const expanded = expandIPv6Address(trimmed);
  if (expanded.startsWith('Erro')) return null;

  const addr = expanded.split('/')[0];
  if (!addr) return null;

  try {
    const netStart = getNetworkAddress(addr, prefixNum);
    const size = 1n << BigInt(128 - prefixNum);
    const netEnd = netStart + size - 1n;
    const shortened = shortenIPv6(addr);

    return {
      original: trimmed,
      network: shortened,
      prefix: prefixNum,
      netStart,
      netEnd,
      size,
      index,
    };
  } catch {
    return null;
  }
}

/** Run full overlap analysis on a list of CIDR strings. */
export function analyzeOverlaps(lines: string[]): OverlapReport {
  const blocks: ParsedBlock[] = [];
  const errors: { line: number; text: string; reason: string }[] = [];

  // Parse all lines
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    const parsed = parseCIDR(trimmed, i + 1);
    if (parsed) {
      blocks.push(parsed);
    } else {
      errors.push({ line: i + 1, text: trimmed, reason: 'Formato inválido ou endereço IPv6 inválido' });
    }
  });

  // Sort by netStart then by prefix (broader first)
  const sorted = [...blocks].sort((a, b) => {
    if (a.netStart < b.netStart) return -1;
    if (a.netStart > b.netStart) return 1;
    return a.prefix - b.prefix; // broader (smaller prefix) first
  });

  const findings: OverlapFinding[] = [];
  const seenDuplicates = new Set<string>();

  // Compare all pairs (O(n²) but fine for typical IPAM lists of <1000 blocks)
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // If b starts after a ends, no overlap and no further j can overlap with a
      // (since sorted by netStart) — but containment can still happen, so we check
      if (b.netStart > a.netEnd) break;

      // Check relationship
      const dupKey = [Math.min(a.index, b.index), Math.max(a.index, b.index)].join('-');

      if (a.netStart === b.netStart && a.netEnd === b.netEnd) {
        // Exact duplicate
        if (!seenDuplicates.has(dupKey)) {
          seenDuplicates.add(dupKey);
          findings.push({ type: 'duplicate', blockA: a, blockB: b });
        }
      } else if (a.netStart <= b.netStart && a.netEnd >= b.netEnd) {
        // A contains B
        findings.push({ type: 'contains', blockA: a, blockB: b });
      } else if (b.netStart <= a.netStart && b.netEnd >= a.netEnd) {
        // B contains A
        findings.push({ type: 'contained', blockA: a, blockB: b });
      } else if (a.netStart <= b.netEnd && a.netEnd >= b.netStart) {
        // Partial overlap
        findings.push({ type: 'overlap', blockA: a, blockB: b });
      }
    }
  }

  // For containment findings, keep only the most-specific (immediate) parent per child.
  // Transitive containments (e.g. /32 → /64 when /32 → /48 → /64 exists) add noise
  // without new information, so we suppress them.
  const childMaxParentPrefix = new Map<number, number>();
  for (const f of findings) {
    if (f.type === 'contains') {
      const prev = childMaxParentPrefix.get(f.blockB.index) ?? -1;
      if (f.blockA.prefix > prev) childMaxParentPrefix.set(f.blockB.index, f.blockA.prefix);
    }
  }
  const filteredFindings = findings.filter(f => {
    if (f.type !== 'contains') return true;
    return childMaxParentPrefix.get(f.blockB.index) === f.blockA.prefix;
  });

  const duplicates = filteredFindings.filter(f => f.type === 'duplicate').length;
  const containments = filteredFindings.filter(f => f.type === 'contains' || f.type === 'contained').length;
  const overlaps = filteredFindings.filter(f => f.type === 'overlap').length;

  // Count clean blocks (not involved in any filtered finding)
  const involvedIndices = new Set<number>();
  filteredFindings.forEach(f => {
    involvedIndices.add(f.blockA.index);
    involvedIndices.add(f.blockB.index);
  });
  const clean = blocks.filter(b => !involvedIndices.has(b.index)).length;

  return {
    blocks: sorted,
    findings: filteredFindings,
    errors,
    stats: {
      total: lines.filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length,
      valid: blocks.length,
      duplicates,
      containments,
      overlaps,
      clean,
    },
  };
}
