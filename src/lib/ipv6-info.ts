// IPv6 address type classification and BGP/RDAP lookup utilities

export interface IPv6TypeInfo {
  type: string;
  description: string;
  rfc: string;
  scope: string;
  routable: boolean;
  color: string; // semantic color hint
}

export interface BGPInfo {
  asn: string;
  asName: string;
  prefix: string;
  country?: string;
  rir?: string;
  description?: string;
}

export interface RDAPInfo {
  name?: string;
  handle?: string;
  country?: string;
  startAddress?: string;
  endAddress?: string;
  type?: string;
  parentHandle?: string;
  status?: string[];
  events?: { action: string; date: string }[];
  entities?: { name: string; roles: string[] }[];
}

export interface BlockValidation {
  isAligned: boolean;
  networkAddress: string;
  inputAddress: string;
  prefix: number;
  message: string;
  announcedPrefix?: string; // from BGP
  announcedPrefixLen?: number; // numeric prefix length from BGP
  prefixMismatch?: boolean;
  prefixMismatchType?: 'longer' | 'shorter'; // BGP prefix longer = more specific; shorter = you're inside a larger block
}

export interface IPv6LookupResult {
  input: string;
  isValid: boolean;
  typeInfo: IPv6TypeInfo;
  bgpInfo?: BGPInfo;
  rdapInfo?: RDAPInfo;
  validation?: BlockValidation;
  error?: string;
}

// Classification based on prefix patterns
const IPV6_TYPES: { test: (bigint: bigint) => boolean; info: IPv6TypeInfo }[] = [
  {
    test: (n) => n === 0n,
    info: { type: 'Não especificado', description: 'Endereço não especificado (::)', rfc: 'RFC 4291', scope: 'N/A', routable: false, color: 'muted' },
  },
  {
    test: (n) => n === 1n,
    info: { type: 'Loopback', description: 'Endereço de loopback (::1)', rfc: 'RFC 4291', scope: 'Host', routable: false, color: 'yellow' },
  },
  {
    // ::ffff:0:0/96 - IPv4-mapped
    test: (n) => (n >> 32n) === 0xffffn,
    info: { type: 'IPv4-Mapped', description: 'Endereço IPv6 mapeado de IPv4 (::ffff:x.x.x.x)', rfc: 'RFC 4291', scope: 'Global', routable: false, color: 'orange' },
  },
  {
    // 64:ff9b::/96 - IPv4/IPv6 translation
    test: (n) => (n >> 32n) === 0x0064_ff9b_0000_0000_0000_0000n,
    info: { type: 'NAT64', description: 'Prefixo de tradução IPv4/IPv6 (64:ff9b::/96)', rfc: 'RFC 6052', scope: 'Global', routable: true, color: 'orange' },
  },
  {
    // 2001:db8::/32 - Documentation
    test: (n) => (n >> 96n) === 0x2001_0db8n,
    info: { type: 'Documentação', description: 'Reservado para documentação e exemplos', rfc: 'RFC 3849', scope: 'N/A', routable: false, color: 'blue' },
  },
  {
    // 2001::/32 - Teredo
    test: (n) => (n >> 96n) === 0x2001_0000n,
    info: { type: 'Teredo', description: 'Tunelamento Teredo', rfc: 'RFC 4380', scope: 'Global', routable: true, color: 'purple' },
  },
  {
    // 2002::/16 - 6to4
    test: (n) => (n >> 112n) === 0x2002n,
    info: { type: '6to4', description: 'Tunelamento automático 6to4', rfc: 'RFC 3056', scope: 'Global', routable: true, color: 'purple' },
  },
  {
    // fe80::/10 - Link-local
    test: (n) => (n >> 118n) === 0x3fan,
    info: { type: 'Link-Local', description: 'Endereço local de enlace, usado para comunicação no mesmo segmento de rede', rfc: 'RFC 4291', scope: 'Link', routable: false, color: 'green' },
  },
  {
    // fc00::/7 - Unique Local (ULA)
    test: (n) => (n >> 121n) === 0x7en,
    info: { type: 'Unique Local (ULA)', description: 'Endereço local único, equivalente ao IPv4 privado (10.x, 172.x, 192.168.x)', rfc: 'RFC 4193', scope: 'Organização', routable: false, color: 'green' },
  },
  {
    // ff00::/8 - Multicast
    test: (n) => (n >> 120n) === 0xffn,
    info: { type: 'Multicast', description: 'Endereço multicast para envio a múltiplos destinos', rfc: 'RFC 4291', scope: 'Variável', routable: true, color: 'red' },
  },
  {
    // 2000::/3 - Global Unicast
    test: (n) => (n >> 125n) === 0x1n,
    info: { type: 'Global Unicast (GUA)', description: 'Endereço unicast global, roteável na Internet', rfc: 'RFC 4291', scope: 'Global', routable: true, color: 'primary' },
  },
];

export function classifyIPv6(address: string): IPv6TypeInfo {
  try {
    // Remove prefix length
    const addr = address.split('/')[0];
    // Expand and convert to bigint
    const expanded = expandToFullForm(addr);
    const n = BigInt('0x' + expanded.replace(/:/g, ''));
    
    for (const entry of IPV6_TYPES) {
      if (entry.test(n)) return entry.info;
    }
  } catch {
    // fallthrough
  }
  
  return {
    type: 'Desconhecido',
    description: 'Tipo de endereço IPv6 não identificado',
    rfc: 'N/A',
    scope: 'N/A',
    routable: false,
    color: 'muted',
  };
}

function expandToFullForm(addr: string): string {
  // Handle :: expansion
  let parts = addr.split('::');
  let groups: string[];
  
  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill('0000');
    groups = [...left, ...middle, ...right];
  } else {
    groups = addr.split(':');
  }
  
  return groups.map(g => g.padStart(4, '0')).join(':');
}

// Lookup BGP info via hackertarget API
export async function lookupBGP(ip: string): Promise<BGPInfo | null> {
  try {
    const addr = ip.split('/')[0];
    const res = await fetch(`https://api.hackertarget.com/aslookup/?q=${encodeURIComponent(addr)}&output=json`);
    
    if (!res.ok) return null;
    
    const text = await res.text();
    
    // Check for API error/limit messages
    if (text.startsWith('error') || text.includes('API count exceeded')) {
      return null;
    }
    
    try {
      const data = JSON.parse(text);
      const entry = Array.isArray(data) ? data[0] : data;
      if (entry && (entry.asn || entry.AS)) {
        return {
          // hackertarget may return asn as "264023" or "AS264023"
          asn: String(entry.asn || entry.AS || '').replace(/^AS/i, ''),
          // field name varies by API version
          asName: entry.as_description || entry.as_name || entry.description || entry.org || '',
          // may come back as "prefix", "bgp_prefix", or "network"
          prefix: entry.prefix || entry.bgp_prefix || entry.network || '',
          country: entry.country_code || entry.country || '',
        };
      }
    } catch {
      // Parse as plain-text CSV: "IP","ASN","PREFIX","AS_NAME"
      // Tolerate 2-4 fields so at least ASN is returned even when prefix is missing
      const parts = text.split(',').map((s: string) => s.replace(/"/g, '').trim());
      if (parts.length >= 2 && parts[1]) {
        return {
          asn: parts[1].replace(/^AS/i, ''),
          prefix: parts[2] || '',
          // join remaining parts in case the AS name contained a comma
          asName: parts.slice(3).join(', ') || '',
        };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Validate block alignment - checks if the address is properly aligned with the prefix
export function validateBlock(input: string): BlockValidation {
  try {
    const parts = input.split('/');
    const addr = parts[0];
    const prefix = parts[1] ? parseInt(parts[1], 10) : -1;

    if (!addr || prefix < 0 || prefix > 128) {
      return { isAligned: false, networkAddress: '', inputAddress: input, prefix: 0, message: 'Formato CIDR inválido' };
    }

    const expanded = expandToFullForm(addr);
    const ipBigInt = BigInt('0x' + expanded.replace(/:/g, ''));
    
    // Calculate network mask and apply
    const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << (128n - BigInt(prefix));
    const networkBigInt = ipBigInt & mask;
    
    const isAligned = ipBigInt === networkBigInt;
    
    // Format network address
    const networkHex = networkBigInt.toString(16).padStart(32, '0');
    const networkGroups = networkHex.match(/.{1,4}/g)!.join(':');
    
    // Shorten for display
    const shortenAddr = (full: string) => {
      const groups = full.split(':').map(g => g.replace(/^0+/, '') || '0');
      let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] === '0') { if (curStart === -1) { curStart = i; curLen = 1; } else curLen++; }
        else { if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } curStart = -1; curLen = 0; }
      }
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      if (bestLen < 2) return groups.join(':');
      const pre = groups.slice(0, bestStart);
      const suf = groups.slice(bestStart + bestLen);
      if (!pre.length && !suf.length) return '::';
      if (!pre.length) return '::' + suf.join(':');
      if (!suf.length) return pre.join(':') + '::';
      return pre.join(':') + '::' + suf.join(':');
    };
    
    const networkShort = shortenAddr(networkGroups);
    
    if (!isAligned) {
      return {
        isAligned: false,
        networkAddress: `${networkShort}/${prefix}`,
        inputAddress: input,
        prefix,
        message: `O endereço não está alinhado com o prefixo /${prefix}. O endereço de rede correto seria ${networkShort}/${prefix}`,
      };
    }
    
    return {
      isAligned: true,
      networkAddress: `${networkShort}/${prefix}`,
      inputAddress: input,
      prefix,
      message: 'Bloco válido e corretamente alinhado',
    };
  } catch {
    return { isAligned: false, networkAddress: '', inputAddress: input, prefix: 0, message: 'Erro ao validar o bloco' };
  }
}

// Lookup RDAP info
export async function lookupRDAP(ip: string): Promise<RDAPInfo | null> {
  try {
    // Use CIDR notation if available, otherwise just the address
    // Note: do NOT use encodeURIComponent on the full CIDR — it encodes '/' as '%2F'
    // which breaks RDAP path routing. Encode only the address part.
    const addr = ip.split('/')[0];
    const prefixLen = ip.includes('/') ? ip.split('/')[1] : '128';
    const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(addr)}/${prefixLen}`, {
      headers: { 'Accept': 'application/rdap+json' },
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    
    const info: RDAPInfo = {
      name: data.name,
      handle: data.handle,
      country: data.country,
      startAddress: data.startAddress,
      endAddress: data.endAddress,
      type: data.type,
      parentHandle: data.parentHandle,
      status: data.status,
    };
    
    if (data.events) {
      info.events = data.events.map((e: any) => ({
        action: e.eventAction,
        date: e.eventDate,
      }));
    }
    
    if (data.entities) {
      info.entities = data.entities
        .filter((e: any) => e.vcardArray || e.handle)
        .map((e: any) => {
          let name = e.handle || '';
          if (e.vcardArray && Array.isArray(e.vcardArray[1])) {
            const fn = e.vcardArray[1].find((v: any) => v[0] === 'fn');
            if (fn) name = fn[3] || name;
          }
          return { name, roles: e.roles || [] };
        });
    }
    
    return info;
  } catch {
    return null;
  }
}

// Full lookup combining all sources
export async function fullIPv6Lookup(input: string): Promise<IPv6LookupResult> {
  const typeInfo = classifyIPv6(input);
  const validation = validateBlock(input);
  const result: IPv6LookupResult = {
    input,
    // isValid = input parsed as a valid IPv6 CIDR (not just whether host bits are zero)
    isValid: validation.message !== 'Formato CIDR inválido' && validation.message !== 'Erro ao validar o bloco',
    typeInfo,
    validation,
  };
  
  // Only do network lookups for routable/global addresses
  if (typeInfo.routable && typeInfo.type !== 'Documentação') {
    const [bgpInfo, rdapInfo] = await Promise.all([
      lookupBGP(input).catch(() => null),
      lookupRDAP(input).catch(() => null),
    ]);
    
    result.bgpInfo = bgpInfo || undefined;
    result.rdapInfo = rdapInfo || undefined;
    
    // Check if BGP announced prefix differs from input prefix
    if (bgpInfo?.prefix && validation.prefix) {
      const bgpParts = bgpInfo.prefix.split('/');
      const bgpPrefix = bgpParts[1] ? parseInt(bgpParts[1], 10) : 0;
      if (bgpPrefix !== validation.prefix) {
        validation.announcedPrefix = bgpInfo.prefix;
        validation.announcedPrefixLen = bgpPrefix;
        validation.prefixMismatch = true;
        // BGP prefix shorter (e.g. /32) means the user's /20 is inside a larger block
        // BGP prefix longer (e.g. /48) means BGP announces a more specific sub-block
        validation.prefixMismatchType = bgpPrefix < validation.prefix ? 'shorter' : 'longer';
      }
    }
  }
  
  return result;
}
