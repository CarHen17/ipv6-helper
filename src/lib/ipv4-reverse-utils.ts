export interface IPv4ReverseZone {
  prefix: number;
  zone: string;
  onOctet: boolean; // prefix is a multiple of 8 (exact octet boundary)
  rfc2317?: string; // CLASSLESS in-addr.arpa delegation (RFC 2317) for non-octet prefixes
}

export interface IPv4ReverseResult {
  input: string;
  address: string;   // network address (octets)
  fullReverse: string; // full PTR name
  prefix?: number;
  zones: IPv4ReverseZone[];
}

const DEFAULT_ZONE_PREFIXES = [8, 16, 24];

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function applyMask(octets: number[], prefix: number): number[] {
  const result = [...octets];
  for (let i = 0; i < 4; i++) {
    const bitStart = i * 8;
    const bitEnd = bitStart + 8;
    if (prefix <= bitStart) {
      result[i] = 0;
    } else if (prefix < bitEnd) {
      const keep = prefix - bitStart;
      result[i] = octets[i] & (0xff << (8 - keep));
    }
  }
  return result;
}

function zoneForPrefix(octets: number[], prefix: number): string {
  const octetCount = Math.floor(prefix / 8);
  return octets.slice(0, octetCount).reverse().join('.') + '.in-addr.arpa';
}

export function reverseIPv4(input: string): IPv4ReverseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let addrStr = trimmed;
  let prefix: number | undefined;

  if (trimmed.includes('/')) {
    const slash = trimmed.indexOf('/');
    addrStr = trimmed.slice(0, slash);
    prefix = parseInt(trimmed.slice(slash + 1), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  }

  const octets = parseIPv4(addrStr);
  if (!octets) return null;

  const networkOctets = prefix !== undefined ? applyMask(octets, prefix) : octets;
  const address = networkOctets.join('.');
  const fullReverse = [...networkOctets].reverse().join('.') + '.in-addr.arpa';

  const prefixList = prefix !== undefined ? [prefix] : DEFAULT_ZONE_PREFIXES;
  const zones: IPv4ReverseZone[] = [];

  for (const p of prefixList) {
    const onOctet = p % 8 === 0;
    if (onOctet) {
      zones.push({ prefix: p, zone: zoneForPrefix(networkOctets, p), onOctet: true });
    } else {
      // Non-octet: show RFC 2317 CLASSLESS delegation
      const octetCount = Math.floor(p / 8);
      const parentZone = zoneForPrefix(networkOctets, octetCount * 8);
      const lastOctet = networkOctets[octetCount];
      const rfc2317 = `${lastOctet}/${p}.` + networkOctets.slice(0, octetCount).reverse().join('.') + '.in-addr.arpa';
      zones.push({ prefix: p, zone: parentZone, onOctet: false, rfc2317 });
    }
  }

  // Add reference zones if CIDR given
  if (prefix !== undefined) {
    for (const p of DEFAULT_ZONE_PREFIXES) {
      if (!zones.find(z => z.prefix === p)) {
        const onOctet = p % 8 === 0;
        zones.push({ prefix: p, zone: zoneForPrefix(networkOctets, p), onOctet });
      }
    }
    zones.sort((a, b) => a.prefix - b.prefix);
  }

  return { input: trimmed, address, fullReverse, prefix, zones };
}

export const REVERSE_IPV4_EXAMPLES = [
  { label: '192.168.1.1',     value: '192.168.1.1' },
  { label: '10.0.0.0/8',     value: '10.0.0.0/8' },
  { label: '172.16.0.0/16',  value: '172.16.0.0/16' },
  { label: '192.168.1.0/24', value: '192.168.1.0/24' },
  { label: '192.168.1.0/25', value: '192.168.1.0/25' },
];
