export interface IPv4ValidationError {
  message: string;
  suggestion: string | null;
}

export interface IPv4SubnetData {
  subnet: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  index: number;
}

export interface IPv4BlockData {
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  prefix: number;
  totalHosts: number;
  totalAddresses: number;
  subnetMask: string;
  wildcardMask: string;
  ipClass: string;
  isPrivate: boolean;
  privateRange?: string;
}

export const IPV4_COMMON_PREFIXES = [
  { value: 8,  label: '/8  — 16M hosts (Classe A)' },
  { value: 16, label: '/16 — 65K hosts (Classe B)' },
  { value: 24, label: '/24 — 254 hosts (Classe C)' },
  { value: 25, label: '/25 — 126 hosts' },
  { value: 26, label: '/26 — 62 hosts' },
  { value: 27, label: '/27 — 30 hosts' },
  { value: 28, label: '/28 — 14 hosts' },
  { value: 29, label: '/29 — 6 hosts' },
  { value: 30, label: '/30 — 2 hosts (ponto-a-ponto)' },
];

export function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function numberToIPv4(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join('.');
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToWildcard(mask: number): number {
  return (~mask) >>> 0;
}

function getIPClass(firstOctet: number): string {
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (Multicast)';
  return 'E (Reservado)';
}

function getPrivateRange(n: number): string | undefined {
  // Use >>> 0 on mask results to ensure unsigned comparison
  // 10.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0x0a000000) return '10.0.0.0/8';
  // 172.16.0.0/12
  if ((n & 0xfff00000) >>> 0 === 0xac100000) return '172.16.0.0/12';
  // 192.168.0.0/16
  if ((n & 0xffff0000) >>> 0 === 0xc0a80000) return '192.168.0.0/16';
  // 100.64.0.0/10 (shared address space)
  if ((n & 0xffc00000) >>> 0 === 0x64400000) return '100.64.0.0/10';
  // 169.254.0.0/16 (link-local)
  if ((n & 0xffff0000) >>> 0 === 0xa9fe0000) return '169.254.0.0/16';
  // 127.0.0.0/8 (loopback)
  if ((n & 0xff000000) >>> 0 === 0x7f000000) return '127.0.0.0/8 (Loopback)';
  return undefined;
}

export function validateIPv4(cidr: string): IPv4ValidationError | null {
  if (!cidr || !cidr.trim()) {
    return { message: 'Insira um endereço IPv4 em formato CIDR.', suggestion: 'Exemplo: 192.168.0.0/24' };
  }
  const trimmed = cidr.trim();
  const parts = trimmed.split('/');
  if (parts.length !== 2) {
    return { message: 'Formato CIDR inválido.', suggestion: 'Use o formato: 192.168.0.0/24' };
  }
  const [ip, prefixStr] = parts;
  const octets = ip.split('.');
  if (octets.length !== 4) {
    return { message: 'Endereço IPv4 inválido.', suggestion: 'O endereço deve ter 4 octetos separados por ponto.' };
  }
  for (const octet of octets) {
    const n = Number(octet);
    if (!/^\d+$/.test(octet) || n < 0 || n > 255) {
      return { message: `Octeto inválido: "${octet}".`, suggestion: 'Cada octeto deve ser um número entre 0 e 255.' };
    }
  }
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return { message: 'Prefixo inválido.', suggestion: 'O prefixo deve ser um número entre 0 e 32.' };
  }
  return null;
}

export function parseIPv4Block(cidr: string): IPv4BlockData {
  const [ip, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);
  const mask = prefixToMask(prefix);
  const ipNum = ipv4ToNumber(ip);
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | maskToWildcard(mask)) >>> 0;
  const totalAddresses = prefix === 32 ? 1 : (1 << (32 - prefix)) >>> 0;
  const totalHosts = prefix >= 31 ? totalAddresses : Math.max(0, totalAddresses - 2);
  const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
  const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
  const firstOctet = (network >>> 24) & 0xff;
  const privateRange = getPrivateRange(network);

  return {
    network: numberToIPv4(network),
    broadcast: numberToIPv4(broadcast),
    firstHost: numberToIPv4(firstHost),
    lastHost: numberToIPv4(lastHost),
    prefix,
    totalHosts,
    totalAddresses,
    subnetMask: numberToIPv4(mask),
    wildcardMask: numberToIPv4(maskToWildcard(mask)),
    ipClass: getIPClass(firstOctet),
    isPrivate: privateRange !== undefined,
    privateRange,
  };
}

export function generateIPv4Subnets(
  cidr: string,
  subnetPrefix: number,
): IPv4SubnetData[] {
  const [ip, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);
  const mask = prefixToMask(prefix);
  const ipNum = ipv4ToNumber(ip);
  const networkBase = (ipNum & mask) >>> 0;

  const subnetMask = prefixToMask(subnetPrefix);
  const subnetSize = subnetPrefix === 32 ? 1 : (1 << (32 - subnetPrefix)) >>> 0;
  const count = 1 << (subnetPrefix - prefix);
  const hostsPerSubnet = subnetPrefix >= 31 ? subnetSize : Math.max(0, subnetSize - 2);

  const subnets: IPv4SubnetData[] = [];
  for (let i = 0; i < count; i++) {
    const netNum = (networkBase + i * subnetSize) >>> 0;
    const bcast = (netNum | maskToWildcard(subnetMask)) >>> 0;
    const first = subnetPrefix >= 31 ? netNum : (netNum + 1) >>> 0;
    const last = subnetPrefix >= 31 ? bcast : (bcast - 1) >>> 0;
    subnets.push({
      subnet: `${numberToIPv4(netNum)}/${subnetPrefix}`,
      network: numberToIPv4(netNum),
      broadcast: numberToIPv4(bcast),
      firstHost: numberToIPv4(first),
      lastHost: numberToIPv4(last),
      totalHosts: hostsPerSubnet,
      index: i,
    });
  }
  return subnets;
}

export function getSubnetCountIPv4(prefix: number, subnetPrefix: number): number {
  if (subnetPrefix <= prefix) return 0;
  return 1 << (subnetPrefix - prefix);
}

export function formatHostCount(n: number): string {
  if (n < 1000) return n.toLocaleString('pt-BR');
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}
