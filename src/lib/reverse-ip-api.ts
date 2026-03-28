// Reverse IP Lookup utilities
// - PTR lookup via DNS over HTTPS (Cloudflare)
// - Domain list via HackerTarget public API (free, no auth, ~100 req/day)

import { lookupDNS } from './ping6-api';
import { reverseIPv6 } from './ipv6-reverse-utils';
import { expandIPv6Address, shortenIPv6 } from './ipv6-utils';

const TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tempo de resposta esgotado')), ms)
    ),
  ]);
}

export interface PTRResult {
  hostname: string | null;
  ptrName: string;
  queryTime: number;
}

export interface HackerTargetResult {
  domains: string[];
  limited: boolean;   // true = rate-limit hit
  error: boolean;
}

/**
 * Normalise an IPv6 input to a canonical compressed form.
 * Returns null if the address is invalid.
 */
export function normaliseIPv6(input: string): string | null {
  try {
    const addr = input.trim().split('/')[0];
    const expanded = expandIPv6Address(addr + '/128');
    return shortenIPv6(expanded.split('/')[0]);
  } catch {
    return null;
  }
}

/** Do a PTR (reverse DNS) lookup for an IPv6 address via DoH. */
export async function lookupPTR(ip: string): Promise<PTRResult> {
  const result = reverseIPv6(ip);
  if (!result) throw new Error('Endereço IPv6 inválido');

  const ptrName = result.fullReverse;
  const start = Date.now();

  try {
    const dns = await withTimeout(
      lookupDNS(ptrName, 'PTR', 'cloudflare'),
      TIMEOUT_MS
    );
    const hostname = dns.records.length > 0 ? dns.records[0].value : null;
    return { hostname, ptrName, queryTime: Date.now() - start };
  } catch {
    return { hostname: null, ptrName, queryTime: Date.now() - start };
  }
}

/** Query HackerTarget reverse-IP API for a list of hosted domains. */
export async function lookupHostedDomains(ip: string): Promise<HackerTargetResult> {
  try {
    const res = await withTimeout(
      fetch(`https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(ip)}`, {
        headers: { Accept: 'text/plain' },
      }),
      TIMEOUT_MS
    );

    if (!res.ok) return { domains: [], limited: false, error: true };

    const text = (await res.text()).trim();

    if (text.includes('API count exceeded')) return { domains: [], limited: true, error: false };
    if (!text || text.startsWith('error') || text === 'no records found') {
      return { domains: [], limited: false, error: false };
    }

    const domains = text
      .split('\n')
      .map(d => d.trim())
      .filter(d => d && !d.startsWith('error') && d.includes('.'));

    return { domains, limited: false, error: false };
  } catch {
    return { domains: [], limited: false, error: true };
  }
}
