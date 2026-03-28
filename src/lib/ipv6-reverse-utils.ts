import { expandIPv6Address } from './ipv6-utils';

export interface ReverseZone {
  prefix: number;
  zone: string;
  onNibble: boolean; // prefix is a multiple of 4 (exact nibble boundary)
}

export interface ReverseResult {
  input: string;
  expanded: string;
  fullReverse: string;   // 32-nibble PTR name for a host
  prefix?: number;       // from CIDR input
  zones: ReverseZone[];  // useful reverse-zone names
}

/** Common prefix lengths to show when no CIDR is given. */
const DEFAULT_ZONE_PREFIXES = [32, 48, 56, 64];

/**
 * Convert an IPv6 address or CIDR block to its reverse DNS notation.
 *
 * - Host address  → full 32-nibble PTR record name
 * - CIDR (e.g. /48) → zone delegation name (12-nibble for /48)
 */
export function reverseIPv6(input: string): ReverseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let addr = trimmed;
  let prefix: number | undefined;

  if (trimmed.includes('/')) {
    const slash = trimmed.indexOf('/');
    addr = trimmed.slice(0, slash);
    prefix = parseInt(trimmed.slice(slash + 1), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 128) return null;
  }

  const expanded = expandIPv6Address(addr + '/128');
  if (expanded.startsWith('Erro')) return null;

  const expandedAddr = expanded.split('/')[0];
  const hex = expandedAddr.replace(/:/g, '');
  if (hex.length !== 32) return null;

  const nibbles = hex.split('');
  const fullReverse = [...nibbles].reverse().join('.') + '.ip6.arpa';

  const prefixList = prefix !== undefined ? [prefix] : DEFAULT_ZONE_PREFIXES;
  const zones: ReverseZone[] = prefixList.map(p => {
    const nibbleCount = Math.floor(p / 4);
    const onNibble = p % 4 === 0;
    const zone = [...nibbles.slice(0, nibbleCount)].reverse().join('.') + '.ip6.arpa';
    return { prefix: p, zone, onNibble };
  });

  // If a specific CIDR was given, also include common reference zones
  if (prefix !== undefined) {
    for (const p of DEFAULT_ZONE_PREFIXES) {
      if (p !== prefix && !zones.find(z => z.prefix === p)) {
        const nibbleCount = Math.floor(p / 4);
        const onNibble = p % 4 === 0;
        const zone = [...nibbles.slice(0, nibbleCount)].reverse().join('.') + '.ip6.arpa';
        zones.push({ prefix: p, zone, onNibble });
      }
    }
    zones.sort((a, b) => a.prefix - b.prefix);
  }

  return { input: trimmed, expanded: expandedAddr, fullReverse, prefix, zones };
}

export const REVERSE_EXAMPLES = [
  { label: '::1 (loopback)',        value: '::1' },
  { label: '2001:db8::1 (host)',    value: '2001:db8::1' },
  { label: '2001:db8::/32 (bloco)', value: '2001:db8::/32' },
  { label: '2001:db8:1::/48',       value: '2001:db8:1::/48' },
  { label: '2001:db8:1:2::/64',     value: '2001:db8:1:2::/64' },
];
