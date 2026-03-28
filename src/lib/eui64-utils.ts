/**
 * EUI-64 / SLAAC calculation utilities.
 *
 * Given a 48-bit MAC address and a /64 prefix the module produces:
 *   - Modified EUI-64 identifier
 *   - Full SLAAC (GUA) address
 *   - Link-local address (fe80::)
 */

/** Validate a MAC address (accepts : - . separators or none). */
export function isValidMAC(mac: string): boolean {
  const cleaned = mac.replace(/[:\-.\s]/g, '');
  return /^[0-9a-fA-F]{12}$/.test(cleaned);
}

/** Normalise MAC to an array of 6 hex bytes. */
function macToBytes(mac: string): string[] {
  const cleaned = mac.replace(/[:\-.\s]/g, '').toLowerCase();
  const bytes: string[] = [];
  for (let i = 0; i < 12; i += 2) {
    bytes.push(cleaned.slice(i, i + 2));
  }
  return bytes;
}

/** Convert MAC → Modified EUI-64 (8 bytes, colon-separated). */
export function macToEUI64(mac: string): string {
  const bytes = macToBytes(mac);
  // Insert FF:FE in the middle
  const eui = [bytes[0], bytes[1], bytes[2], 'ff', 'fe', bytes[3], bytes[4], bytes[5]];
  // Flip the 7th bit (U/L) of the first byte
  const firstByte = parseInt(eui[0], 16) ^ 0x02;
  eui[0] = firstByte.toString(16).padStart(2, '0');
  return eui.join(':');
}

/** Convert 8-byte EUI-64 to an IPv6 interface identifier (4 hextets). */
export function eui64ToInterfaceId(eui64: string): string {
  const bytes = eui64.split(':');
  const hextets = [
    bytes[0] + bytes[1],
    bytes[2] + bytes[3],
    bytes[4] + bytes[5],
    bytes[6] + bytes[7],
  ];
  return hextets.map(h => h.replace(/^0+/, '') || '0').join(':');
}

/** Validate a /64 prefix (e.g. 2001:db8:: or 2001:0db8:1234:5678::). */
export function isValidPrefix64(prefix: string): boolean {
  // Remove trailing :: if present, allow shortened forms
  const cleaned = prefix.replace(/::?$/, '');
  const parts = cleaned.split(':');
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every(p => /^[0-9a-fA-F]{1,4}$/.test(p));
}

/** Expand a /64 prefix to exactly 4 hextets. */
function expandPrefix(prefix: string): string[] {
  const cleaned = prefix.replace(/::?$/, '');
  const parts = cleaned.split(':').map(p => p.padStart(4, '0'));
  while (parts.length < 4) parts.push('0000');
  return parts.slice(0, 4);
}

/** Shorten an IPv6 address (RFC 5952). */
function shortenAddress(full: string): string {
  const parts = full.split(':');
  // Find longest run of consecutive 0000 groups
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '0000') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  const shortened = parts.map(p => p.replace(/^0+/, '') || '0');
  if (bestLen > 1) {
    const before = shortened.slice(0, bestStart);
    const after = shortened.slice(bestStart + bestLen);
    const middle = bestStart === 0 && bestStart + bestLen === 8 ? ['', '', ''] :
                   bestStart === 0 ? ['', ''] :
                   bestStart + bestLen === 8 ? ['', ''] : [''];
    // Actually, let's just build with ::
    const left = shortened.slice(0, bestStart).join(':');
    const right = shortened.slice(bestStart + bestLen).join(':');
    return `${left}::${right}`;
  }
  return shortened.join(':');
}

export interface EUI64Result {
  macNormalised: string;
  eui64: string;
  interfaceId: string;
  slaacAddress: string;
  slaacAddressFull: string;
  linkLocal: string;
  linkLocalFull: string;
}

/** Compute full EUI-64 / SLAAC results. */
export function computeEUI64(mac: string, prefix: string): EUI64Result {
  const bytes = macToBytes(mac);
  const macNormalised = bytes.join(':');
  const eui64 = macToEUI64(mac);
  const ifId = eui64ToInterfaceId(eui64);

  // SLAAC address
  const prefixParts = expandPrefix(prefix);
  const ifIdParts = ifId.split(':').map(h => h.padStart(4, '0'));
  const fullParts = [...prefixParts, ...ifIdParts];
  const slaacFull = fullParts.join(':');
  const slaacShort = shortenAddress(slaacFull);

  // Link-local
  const llParts = ['fe80', '0000', '0000', '0000', ...ifIdParts];
  const llFull = llParts.join(':');
  const llShort = shortenAddress(llFull);

  return {
    macNormalised,
    eui64,
    interfaceId: ifId,
    slaacAddress: `${slaacShort}/64`,
    slaacAddressFull: `${slaacFull}/64`,
    linkLocal: `${llShort}/64`,
    linkLocalFull: `${llFull}/64`,
  };
}
