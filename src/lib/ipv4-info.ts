import { lookupBGP, lookupRDAP, type BGPInfo, type RDAPInfo } from './ipv6-info';
import { lookupGeo, type GeoInfo } from './geo-utils';

export { type BGPInfo, type RDAPInfo, type GeoInfo };

export interface IPv4TypeInfo {
  type: string;
  description: string;
  scope: string;
  routable: boolean;
  color: 'primary' | 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue' | 'muted';
  rfc: string;
}

export interface IPv4LookupResult {
  input: string;          // original CIDR (e.g. "10.0.0.0/8")
  typeInfo: IPv4TypeInfo;
  bgpInfo?: BGPInfo;
  rdapInfo?: RDAPInfo;
}

const RANGES: Array<{ cidr: string; prefix: number; base: number; mask: number; info: IPv4TypeInfo }> = (() => {
  function toNum(a: number, b: number, c: number, d: number) {
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  }
  function entry(cidr: string, prefix: number, base: [number,number,number,number], info: IPv4TypeInfo) {
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return { cidr, prefix, base: toNum(...base), mask, info };
  }
  return [
    entry('0.0.0.0/8',      8,  [0,0,0,0],       { type: 'Atual (this)', description: 'Endereços reservados para a rede local atual.', scope: 'Local', routable: false, color: 'muted', rfc: 'RFC 1122' }),
    entry('10.0.0.0/8',     8,  [10,0,0,0],       { type: 'Privado Classe A', description: 'Rede privada classe A, uso interno.', scope: 'Privado', routable: false, color: 'yellow', rfc: 'RFC 1918' }),
    entry('100.64.0.0/10',  10, [100,64,0,0],     { type: 'Shared Address', description: 'Espaço compartilhado para operadoras (CGN/CGNAT).', scope: 'Operadora', routable: false, color: 'orange', rfc: 'RFC 6598' }),
    entry('127.0.0.0/8',    8,  [127,0,0,0],      { type: 'Loopback', description: 'Endereço de loopback, nunca sai da interface.', scope: 'Host', routable: false, color: 'purple', rfc: 'RFC 1122' }),
    entry('169.254.0.0/16', 16, [169,254,0,0],    { type: 'Link-Local', description: 'Auto-configuração quando DHCP não está disponível (APIPA).', scope: 'Link', routable: false, color: 'blue', rfc: 'RFC 3927' }),
    entry('172.16.0.0/12',  12, [172,16,0,0],     { type: 'Privado Classe B', description: 'Rede privada classe B, uso interno.', scope: 'Privado', routable: false, color: 'yellow', rfc: 'RFC 1918' }),
    entry('192.0.0.0/24',   24, [192,0,0,0],      { type: 'IETF Protocol', description: 'Reservado pela IETF para uso em protocolos.', scope: 'Especial', routable: false, color: 'muted', rfc: 'RFC 6890' }),
    entry('192.0.2.0/24',   24, [192,0,2,0],      { type: 'Documentação', description: 'Reservado para documentação e exemplos (TEST-NET-1).', scope: 'Especial', routable: false, color: 'muted', rfc: 'RFC 5737' }),
    entry('192.88.99.0/24', 24, [192,88,99,0],    { type: '6to4 Relay (dep.)', description: 'Anycast relay 6to4 — depreciado.', scope: 'Global', routable: false, color: 'muted', rfc: 'RFC 7526' }),
    entry('192.168.0.0/16', 16, [192,168,0,0],    { type: 'Privado Classe C', description: 'Rede privada classe C, uso doméstico e comercial.', scope: 'Privado', routable: false, color: 'yellow', rfc: 'RFC 1918' }),
    entry('198.18.0.0/15',  15, [198,18,0,0],     { type: 'Benchmark', description: 'Reservado para testes de desempenho de rede.', scope: 'Especial', routable: false, color: 'muted', rfc: 'RFC 2544' }),
    entry('198.51.100.0/24',24, [198,51,100,0],   { type: 'Documentação', description: 'Reservado para documentação (TEST-NET-2).', scope: 'Especial', routable: false, color: 'muted', rfc: 'RFC 5737' }),
    entry('203.0.113.0/24', 24, [203,0,113,0],    { type: 'Documentação', description: 'Reservado para documentação (TEST-NET-3).', scope: 'Especial', routable: false, color: 'muted', rfc: 'RFC 5737' }),
    entry('224.0.0.0/4',    4,  [224,0,0,0],      { type: 'Multicast', description: 'Endereços de multicast IPv4.', scope: 'Global', routable: false, color: 'orange', rfc: 'RFC 5771' }),
    entry('240.0.0.0/4',    4,  [240,0,0,0],      { type: 'Reservado', description: 'Faixa reservada para uso futuro.', scope: 'Especial', routable: false, color: 'red', rfc: 'RFC 1112' }),
    entry('255.255.255.255/32', 32, [255,255,255,255], { type: 'Broadcast', description: 'Endereço de broadcast limitado.', scope: 'Link', routable: false, color: 'red', rfc: 'RFC 919' }),
  ];
})();

function ipToNum(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function classifyIPv4(cidr: string): IPv4TypeInfo {
  const addr = cidr.split('/')[0];
  const num = ipToNum(addr);
  for (const r of RANGES) {
    if (((num & r.mask) >>> 0) === r.base) return r.info;
  }
  return {
    type: 'Global Unicast',
    description: 'Endereço IPv4 público, roteável na Internet.',
    scope: 'Global',
    routable: true,
    color: 'green',
    rfc: 'RFC 791',
  };
}

export async function fullIPv4Lookup(cidr: string): Promise<IPv4LookupResult> {
  const typeInfo = classifyIPv4(cidr);
  const result: IPv4LookupResult = { input: cidr, typeInfo };
  if (!typeInfo.routable) return result;

  const addr = cidr.split('/')[0];
  const [bgpInfo, rdapInfo] = await Promise.all([
    lookupBGP(addr).catch(() => null),
    lookupRDAP(cidr).catch(() => null),
  ]);
  if (bgpInfo) result.bgpInfo = bgpInfo;
  if (rdapInfo) result.rdapInfo = rdapInfo;
  return result;
}

export { lookupGeo };
