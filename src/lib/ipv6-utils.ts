/**
 * IPv6 Utilities Module - Pure TypeScript port
 * All BigInt calculations preserved exactly from the original
 */

export const IPV6_CONFIG = {
  MAX_SUBNETS_GENERATION: 100_000,
  CHUNK_SIZE: 1000,
  PROGRESS_UPDATE_INTERVAL: 500,
  /** Threshold above which user confirmation is requested */
  LARGE_SUBNET_THRESHOLD: 1_000_000n,
};

export interface ValidationError {
  code: string;
  message: string;
  suggestion: string | null;
}

export interface SubnetData {
  subnet: string;
  initial: string;
  final: string;
  network: string;
}

export interface BlockData {
  network: string;
  prefix: number;
  subnet?: string;
  initial?: string;
  final?: string;
  index?: number;
}

export interface AggregationResult {
  canAggregate: boolean;
  reason: string;
  aggregatedBlock?: {
    network: string;
    prefix: number;
    subnet: string;
    blockCount: number;
    originalBlocks: string[];
  };
}

export interface ComparisonResult {
  relationship: 'identical' | 'b2_in_b1' | 'b1_in_b2' | 'overlap' | 'disjoint' | 'error';
  net1?: bigint;
  net2?: bigint;
  end1?: bigint;
  end2?: bigint;
  size1?: bigint;
  size2?: bigint;
  error?: string;
}

export function formatNumber(num: number | bigint): string {
  try {
    if (typeof num === 'bigint') return formatBigInt(num);
    if (num <= 99999) return num.toLocaleString('pt-BR');
    if (num < 1e6) return `${Math.round(num / 1000)}K`;
    if (num < 1e9) return `${(num / 1e6).toFixed(1)}M`;
    if (num < 1e12) return `${(num / 1e9).toFixed(1)}B`;
    return `${(num / 1e12).toFixed(1)}T`;
  } catch {
    return num.toString();
  }
}

export function formatBigInt(n: bigint): string {
  if (n < 1000n) return n.toLocaleString('pt-BR');
  // For values that fit safely in Number (< 2^53), use Number formatting
  if (n < 9007199254740992n) {
    const num = Number(n);
    if (num < 1e6) return `${(num / 1000).toFixed(1)}K`;
    if (num < 1e9) return `${(num / 1e6).toFixed(1)}M`;
    if (num < 1e12) return `${(num / 1e9).toFixed(1)}B`;
    if (num < 1e15) return `${(num / 1e12).toFixed(1)}T`;
  }
  // For values beyond Number.MAX_SAFE_INTEGER, use string-based formatting
  const s = n.toString();
  const exp = s.length - 1;
  const mantissa = (Number(s.slice(0, 5)) / 10000).toFixed(2);
  return `${mantissa}×10^${exp}`;
}

export function validateIPv6(addressCIDR: string): ValidationError | null {
  if (!addressCIDR || typeof addressCIDR !== 'string' || addressCIDR.trim() === '') {
    return {
      code: 'EMPTY',
      message: 'Por favor, insira um endereço IPv6 válido no formato CIDR.',
      suggestion: 'Exemplo: 2001:db8::/41',
    };
  }

  const trimmed = addressCIDR.trim();

  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d+)?$/.test(trimmed)) {
    return {
      code: 'IPV4_DETECTED',
      message: 'Endereço IPv4 detectado. Esta calculadora é para IPv6.',
      suggestion: 'Para usar IPv4 mapeado em IPv6, use o prefixo ::ffff: (ex: ::ffff:192.0.2.1/128)',
    };
  }

  const parts = trimmed.split('/');
  if (parts.length !== 2 || !parts[1]) {
    return {
      code: 'MISSING_PREFIX',
      message: 'Prefixo CIDR ausente ou formato inválido.',
      suggestion: 'Adicione o prefixo após "/". Exemplo: 2001:db8::/48',
    };
  }

  const [addr, prefix] = parts;
  if (!addr || isNaN(Number(prefix))) {
    return {
      code: 'MISSING_PREFIX',
      message: 'Por favor, insira um endereço IPv6 válido no formato CIDR.',
      suggestion: 'Exemplo: 2001:db8::/41',
    };
  }

  const prefixNum = parseInt(prefix);
  if (prefixNum < 1 || prefixNum > 128) {
    return {
      code: 'PREFIX_RANGE',
      message: `Prefixo /${prefix} fora do intervalo válido (1–128).`,
      suggestion: 'Use um prefixo entre /1 e /128. Prefixos comuns: /48, /56, /64',
    };
  }

  if (!isValidIPv6Format(addr)) {
    return {
      code: 'WRONG_FORMAT',
      message: 'Formato de endereço IPv6 inválido.',
      suggestion: 'IPv6 usa 8 grupos hexadecimais separados por ":". Zeros consecutivos podem ser abreviados com "::"',
    };
  }

  return null;
}

export function isValidIPv6Format(addr: string): boolean {
  addr = addr.replace(/^\[|\]$/g, '');

  if (addr.includes(':::') || addr.split('::').length > 2) return false;

  const parts = addr.split('::');
  const beforeDouble = parts[0] ? parts[0].split(':') : [];
  const afterDouble = parts[1] ? parts[1].split(':') : [];

  if (parts.length === 2 && beforeDouble.length + afterDouble.length > 8) return false;
  if (parts.length === 1 && beforeDouble.length !== 8) return false;

  const allGroups = [...beforeDouble, ...afterDouble];
  return allGroups.every(group => group === '' || /^[0-9a-fA-F]{1,4}$/.test(group));
}

export function expandIPv6Address(addressCIDR: string): string {
  try {
    let [addr] = addressCIDR.split('/');
    if (!addr) return "Erro: Endereço inválido.";

    addr = addr.replace(/^\[|\]$/g, '');
    const parts = addr.split("::");
    if (parts.length > 2) return "Erro: Não pode haver mais de um '::'.";

    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
    let missing = 8 - (head.length + tail.length);

    if (parts.length === 1) {
      if (head.length !== 8) return "Erro: Endereço deve ter 8 grupos ou usar notação '::'.";
      missing = 0;
    }
    if (missing < 0) return "Erro: Muitos grupos de hexadecimais.";

    const zeros = new Array(missing).fill("0000");
    const fullParts = head.concat(zeros).concat(tail);

    for (let i = 0; i < fullParts.length; i++) {
      if (!/^[0-9a-fA-F]{0,4}$/.test(fullParts[i])) {
        return `Erro: Grupo ${i + 1} contém caracteres inválidos.`;
      }
      fullParts[i] = fullParts[i].padStart(4, '0');
    }

    return fullParts.join(':');
  } catch {
    return "Erro: Falha ao processar o endereço.";
  }
}

export function shortenIPv6(address: string): string {
  if (!address || typeof address !== 'string') return address || "";
  if (address.includes('::')) return address;

  const groups = address.split(':').map(g => g.replace(/^0+/, '') || '0');
  if (groups.length !== 8) return address;

  let bestStart = -1, bestLen = 0;
  let curStart = -1, curLen = 0;

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0') {
      if (curStart === -1) { curStart = i; curLen = 1; }
      else { curLen++; }
    } else {
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      curStart = -1; curLen = 0;
    }
  }
  if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
  if (bestLen < 2) return groups.join(':');

  const prefix = groups.slice(0, bestStart);
  const suffix = groups.slice(bestStart + bestLen);

  if (prefix.length === 0 && suffix.length === 0) return '::';
  if (prefix.length === 0) return '::' + suffix.join(':');
  if (suffix.length === 0) return prefix.join(':') + '::';
  return prefix.join(':') + '::' + suffix.join(':');
}

export function formatIPv6Address(ipv6BigInt: bigint): string {
  try {
    const hexStr = ipv6BigInt.toString(16).padStart(32, '0');
    const groups = hexStr.match(/.{1,4}/g);
    return groups ? groups.join(':') : "0000:0000:0000:0000:0000:0000:0000:0000";
  } catch {
    return "0000:0000:0000:0000:0000:0000:0000:0000";
  }
}

export function ipv6ToBigInt(ipv6Address: string): bigint {
  let expandedAddress = ipv6Address;
  if (ipv6Address.includes('::') || ipv6Address.split(':').length < 8) {
    expandedAddress = expandIPv6Address(ipv6Address + '/128');
    if (expandedAddress.startsWith('Erro')) {
      throw new Error('Endereço IPv6 inválido: ' + ipv6Address);
    }
  }
  const hexString = expandedAddress.replace(/:/g, '');
  return BigInt('0x' + hexString);
}

export function calculateNetworkMask(prefix: number): bigint {
  if (prefix < 0 || prefix > 128) throw new Error('Prefixo deve estar entre 0 e 128');
  return ((1n << BigInt(prefix)) - 1n) << (128n - BigInt(prefix));
}

export function getNetworkAddress(network: string, prefix: number): bigint {
  const networkBigInt = ipv6ToBigInt(network);
  const mask = calculateNetworkMask(prefix);
  return networkBigInt & mask;
}

export function areConsecutiveBlocks(block1: BlockData, block2: BlockData): boolean {
  try {
    if (block1.prefix !== block2.prefix) return false;
    const net1 = getNetworkAddress(block1.network, block1.prefix);
    const net2 = getNetworkAddress(block2.network, block2.prefix);
    const blockSize = 1n << (128n - BigInt(block1.prefix));
    return (net1 + blockSize === net2) || (net2 + blockSize === net1);
  } catch {
    return false;
  }
}

export function canAggregateBlocks(blocks: BlockData[]): AggregationResult {
  try {
    if (!blocks || blocks.length < 2) {
      return { canAggregate: false, reason: 'Selecione pelo menos 2 sub-redes para agregação' };
    }

    const firstPrefix = blocks[0].prefix;
    if (!blocks.every(b => b.prefix === firstPrefix)) {
      return { canAggregate: false, reason: 'Todos os blocos devem ter o mesmo prefixo para agregação' };
    }

    const sortedBlocks = blocks.slice().sort((a, b) => {
      const netA = getNetworkAddress(a.network, a.prefix);
      const netB = getNetworkAddress(b.network, b.prefix);
      return netA < netB ? -1 : (netA > netB ? 1 : 0);
    });

    const blockCount = blocks.length;
    if ((blockCount & (blockCount - 1)) !== 0) {
      return { canAggregate: false, reason: `Número inválido de blocos (${blockCount}). Para agregação, selecione 2, 4, 8, 16... blocos consecutivos` };
    }

    for (let i = 0; i < sortedBlocks.length - 1; i++) {
      if (!areConsecutiveBlocks(sortedBlocks[i], sortedBlocks[i + 1])) {
        return { canAggregate: false, reason: 'Os blocos selecionados não são consecutivos' };
      }
    }

    const firstBlock = sortedBlocks[0];
    const firstNetwork = getNetworkAddress(firstBlock.network, firstPrefix);
    const newPrefix = firstPrefix - Math.log2(blockCount);

    if (newPrefix < 1 || !Number.isInteger(newPrefix)) {
      return { canAggregate: false, reason: 'Agregação resultaria em prefixo inválido' };
    }

    const newBlockSize = 1n << (128n - BigInt(newPrefix));
    if (firstNetwork % newBlockSize !== 0n) {
      return { canAggregate: false, reason: 'Os blocos selecionados não estão corretamente alinhados para agregação' };
    }

    const aggregatedNetwork = shortenIPv6(formatIPv6Address(firstNetwork));
    return {
      canAggregate: true,
      reason: `${blockCount} blocos /${firstPrefix} podem ser agregados em 1 bloco /${newPrefix}`,
      aggregatedBlock: {
        network: aggregatedNetwork,
        prefix: newPrefix,
        subnet: `${aggregatedNetwork}/${newPrefix}`,
        blockCount,
        originalBlocks: sortedBlocks.map(b => b.subnet || `${b.network}/${b.prefix}`),
      },
    };
  } catch (error: unknown) {
    return { canAggregate: false, reason: 'Erro ao processar blocos: ' + (error instanceof Error ? error.message : String(error)) };
  }
}

export function compareBlocks(b1: BlockData, b2: BlockData): ComparisonResult {
  try {
    const net1 = getNetworkAddress(b1.network, b1.prefix);
    const net2 = getNetworkAddress(b2.network, b2.prefix);
    const size1 = 1n << (128n - BigInt(b1.prefix));
    const size2 = 1n << (128n - BigInt(b2.prefix));
    const end1 = net1 + size1 - 1n;
    const end2 = net2 + size2 - 1n;

    const b2InB1 = net1 <= net2 && end2 <= end1;
    const b1InB2 = net2 <= net1 && end1 <= end2;
    const hasOverlap = !(end1 < net2 || end2 < net1);

    let relationship: ComparisonResult['relationship'];
    if (b1InB2 && b2InB1) relationship = 'identical';
    else if (b2InB1) relationship = 'b2_in_b1';
    else if (b1InB2) relationship = 'b1_in_b2';
    else if (hasOverlap) relationship = 'overlap';
    else relationship = 'disjoint';

    return { relationship, net1, net2, end1, end2, size1, size2 };
  } catch (error: unknown) {
    return { relationship: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

export function findSubnetForIP(ip: string, subnets: SubnetData[]): { found: boolean; subnet?: SubnetData; index?: number; error?: string } {
  try {
    const expandedIp = expandIPv6Address(ip.includes('/') ? ip : ip + '/128');
    if (expandedIp.startsWith('Erro')) return { found: false, error: 'Endereço IP inválido: ' + expandedIp };
    const ipPart = expandedIp.split('/')[0];
    if (!ipPart) return { found: false, error: 'Endereço IP inválido' };
    const ipBigInt = ipv6ToBigInt(ipPart);

    for (let i = 0; i < subnets.length; i++) {
      const s = subnets[i];
      const parts = s.subnet.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) continue;
      const prefix = parseInt(parts[1], 10);
      const networkBigInt = getNetworkAddress(s.network || parts[0], prefix);
      const blockSize = 1n << (128n - BigInt(prefix));
      const endBigInt = networkBigInt + blockSize - 1n;

      if (ipBigInt >= networkBigInt && ipBigInt <= endBigInt) {
        return { found: true, subnet: s, index: i };
      }
    }
    return { found: false };
  } catch (error: unknown) {
    return { found: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function isValidIPv6Address(ip: string): boolean {
  const addr = ip.split('/')[0];
  if (!addr || !/^[0-9a-fA-F:]+$/.test(addr)) return false;
  if (!addr.includes(':')) return false;
  if ((addr.match(/::/g) || []).length > 1) return false;
  const expanded = addr.replace('::', ':EXPAND:');
  const groups = expanded.split(':').filter(g => g !== 'EXPAND');
  return !groups.some(g => g.length > 4 || (g.length > 0 && !/^[0-9a-fA-F]+$/.test(g)));
}

/**
 * Build BlockData array from selected subnet indices.
 * Validates subnet format before creating blocks.
 */
export function buildBlocksFromIndices(subnets: SubnetData[], indices: Iterable<number>): BlockData[] {
  const blocks: BlockData[] = [];
  for (const i of indices) {
    const subnet = subnets[i];
    if (!subnet) continue;
    const parts = subnet.subnet.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) continue;
    blocks.push({ network: parts[0], prefix: parseInt(parts[1]), subnet: subnet.subnet });
  }
  return blocks;
}

/**
 * Generate subnets asynchronously with chunked yielding to keep the UI responsive.
 * Yields the event loop every CHUNK_SIZE iterations via setTimeout(0).
 * Pass a `signal` object to cancel mid-generation (e.g. on reset or new input).
 */
export async function generateSubnets(
  ipv6BigInt: bigint,
  initialMask: bigint,
  prefix: number,
  numSubRedes: bigint,
  onProgress?: (percent: number) => void,
  signal?: { cancelled: boolean }
): Promise<SubnetData[]> {
  const maxSubRedes = numSubRedes > BigInt(IPV6_CONFIG.MAX_SUBNETS_GENERATION)
    ? BigInt(IPV6_CONFIG.MAX_SUBNETS_GENERATION)
    : numSubRedes;

  const result: SubnetData[] = [];
  const CHUNK = BigInt(IPV6_CONFIG.CHUNK_SIZE); // yield every 1000 items

  for (let i = 0n; i < maxSubRedes; i++) {
    if (signal?.cancelled) return result; // early exit on cancellation

    const subnetBigInt = (ipv6BigInt & initialMask) + (i << (128n - BigInt(prefix)));
    const subnetHex = subnetBigInt.toString(16).padStart(32, '0');
    const subnetGroups = subnetHex.match(/.{1,4}/g);
    const subnetFormatada = subnetGroups ? subnetGroups.join(':') : '';

    const subnetInitial = subnetBigInt;
    const subnetFinal = subnetBigInt + (1n << (128n - BigInt(prefix))) - 1n;

    const subnetInitialHex = subnetInitial.toString(16).padStart(32, '0');
    const subnetFinalHex = subnetFinal.toString(16).padStart(32, '0');

    const initialGroups = subnetInitialHex.match(/.{1,4}/g);
    const finalGroups = subnetFinalHex.match(/.{1,4}/g);

    result.push({
      subnet: `${subnetFormatada}/${prefix}`,
      initial: shortenIPv6(initialGroups ? initialGroups.join(':') : ''),
      final: shortenIPv6(finalGroups ? finalGroups.join(':') : ''),
      network: subnetFormatada,
    });

    // At the end of each chunk: report progress and yield the event loop
    if (i % CHUNK === CHUNK - 1n) {
      onProgress?.(Math.min(99, Math.floor(Number((i * 100n) / maxSubRedes))));
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  return result;
}

/**
 * Generate IPs from a network address
 */
export function generateIPs(networkAddress: string, offset: number, count: number): { ip: string; number: number }[] {
  const redeCompleta = expandIPv6Address(networkAddress.includes('/') ? networkAddress : networkAddress + '/128');
  const cleanAddr = redeCompleta.startsWith('Erro') ? networkAddress : redeCompleta;
  const redeHex = cleanAddr.replace(/:/g, '');
  const redeBigInt = BigInt("0x" + redeHex);

  const ips: { ip: string; number: number }[] = [];
  for (let i = offset; i < offset + count; i++) {
    const ipBigInt = redeBigInt + BigInt(i);
    const ipFormatado = formatIPv6Address(ipBigInt);
    ips.push({ ip: shortenIPv6(ipFormatado), number: i + 1 });
  }
  return ips;
}

/**
 * Calculate gateway for a network address
 */
export function calculateGateway(networkAddress: string): string {
  try {
    const networkBigInt = ipv6ToBigInt(networkAddress);
    const gatewayBigInt = networkBigInt + 1n;
    return shortenIPv6(formatIPv6Address(gatewayBigInt));
  } catch {
    return '-';
  }
}

export const COMMON_PREFIXES: Record<number, string> = {
  48: 'Alocação típica para sites',
  56: 'Sub-rede por cliente/dep.',
  64: 'Sub-rede padrão',
  80: 'Sub-rede SOHO/Home',
  96: 'Unidade operacional',
  112: 'Ponto-a-ponto',
  128: 'Host único',
};
