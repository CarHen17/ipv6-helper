// IPv4 → IPv6 conversion utilities
// Implements the most common transition/translation mechanisms.

export interface IPv4to6Result {
  mechanism: string;
  description: string;
  rfc: string;
  ipv6: string;
  ipv6Expanded: string;
  cidr?: string;
  note?: string;
}

/** Validates an IPv4 address (dotted-decimal, 0-255 per octet). */
export function validateIPv4(ip: string): string | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 'IPv4 deve ter 4 octetos (ex: 192.0.2.1)';
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return `Octeto inválido: "${p}"`;
    if (parseInt(p, 10) > 255) return `Octeto fora do intervalo: "${p}" (máx 255)`;
  }
  return null;
}

/** Returns each octet as a 2-char hex string. */
function octetsToHex(ip: string): string[] {
  return ip.trim().split('.').map(o => parseInt(o, 10).toString(16).padStart(2, '0'));
}

/** Formats 8 groups of 4 hex digits into the full expanded IPv6 form. */
function expandGroups(groups: string[]): string {
  return groups.map(g => g.padStart(4, '0')).join(':');
}

/** Compresses an expanded IPv6 address (RFC 5952 longest-run rule). */
function compressIPv6(expanded: string): string {
  const groups = expanded.split(':');
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0000') {
      if (curStart === -1) { curStart = i; curLen = 1; } else curLen++;
    } else {
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      curStart = -1; curLen = 0;
    }
  }
  if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }

  const stripped = groups.map(g => g.replace(/^0+/, '') || '0');
  if (bestLen < 2) return stripped.join(':');

  const pre = stripped.slice(0, bestStart);
  const suf = stripped.slice(bestStart + bestLen);
  if (!pre.length && !suf.length) return '::';
  if (!pre.length) return '::' + suf.join(':');
  if (!suf.length) return pre.join(':') + '::';
  return pre.join(':') + '::' + suf.join(':');
}

/** Converts an IPv4 address to all relevant IPv6 representations. */
export function convertIPv4toIPv6(ipv4: string): IPv4to6Result[] {
  const hex = octetsToHex(ipv4.trim());
  const [h0, h1, h2, h3] = hex; // each is 2 hex chars

  const results: IPv4to6Result[] = [];

  // ── 1. IPv4-mapped (::ffff:W.X.Y.Z) ─────────────────────────────────────
  // Used internally by dual-stack sockets to represent IPv4 connections.
  {
    const expanded = expandGroups(['0000','0000','0000','0000','0000','ffff',`${h0}${h1}`,`${h2}${h3}`]);
    results.push({
      mechanism: 'IPv4-Mapped',
      description: 'Representa um endereço IPv4 dentro do espaço IPv6. Usado por sockets dual-stack.',
      rfc: 'RFC 4291 §2.5.5.2',
      ipv6: `::ffff:${ipv4.trim()}`,
      ipv6Expanded: expanded,
    });
  }

  // ── 2. NAT64 / 64:ff9b::/96 ──────────────────────────────────────────────
  // Used by NAT64 gateways to translate between IPv6 clients and IPv4 servers.
  {
    const expanded = expandGroups(['0064','ff9b','0000','0000','0000','0000',`${h0}${h1}`,`${h2}${h3}`]);
    const compressed = compressIPv6(expanded);
    results.push({
      mechanism: 'NAT64 (Well-Known)',
      description: 'Prefixo NAT64 padrão. Permite que clientes IPv6 acessem servidores IPv4 via gateway NAT64.',
      rfc: 'RFC 6052 §2.2',
      ipv6: compressed,
      ipv6Expanded: expanded,
      note: `Gateway NAT64 converte tráfego de ${compressed} para ${ipv4.trim()}`,
    });
  }

  // ── 3. 6to4 (2002::/16) ──────────────────────────────────────────────────
  // Encapsulates IPv6 packets inside IPv4 for automatic tunneling.
  {
    const g1 = `${h0}${h1}`;
    const g2 = `${h2}${h3}`;
    const expanded = expandGroups(['2002', g1, g2, '0000','0000','0000','0000','0001']);
    const compressed = compressIPv6(expanded);
    const networkExpanded = expandGroups(['2002', g1, g2, '0000','0000','0000','0000','0000']);
    const network = compressIPv6(networkExpanded);
    results.push({
      mechanism: '6to4',
      description: 'Tunelamento automático que encapsula pacotes IPv6 em IPv4. Prefixo derivado do endereço IPv4 público.',
      rfc: 'RFC 3056',
      ipv6: compressed,
      ipv6Expanded: expanded,
      cidr: `${network}/48`,
      note: `Bloco /48 alocado: ${network}/48 · Requer IP público roteável`,
    });
  }

  // ── 4. IPv4-compatible (deprecated) ──────────────────────────────────────
  // Kept for reference — spec deprecated in RFC 4291.
  {
    const expanded = expandGroups(['0000','0000','0000','0000','0000','0000',`${h0}${h1}`,`${h2}${h3}`]);
    const compressed = compressIPv6(expanded);
    results.push({
      mechanism: 'IPv4-Compatible (obsoleto)',
      description: 'Formato antigo para transição automática IPv4/IPv6. Depreciado — não use em novas implementações.',
      rfc: 'RFC 4291 §2.5.5.1 (depreciado)',
      ipv6: compressed,
      ipv6Expanded: expanded,
      note: 'Depreciado pela RFC 4291. Use IPv4-Mapped ou NAT64 em seu lugar.',
    });
  }

  return results;
}

/** Returns true if the IPv4 address is a private/special range. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 169 && b === 254)
  );
}
