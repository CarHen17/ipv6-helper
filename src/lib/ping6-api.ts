// ping6.net API client — https://ping6.net/pt/api-docs
// Base URL: https://ping6.net/api/v1

const BASE_URL = 'https://ping6.net/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tempo de resposta esgotado')), ms)
    ),
  ]);
}

// ── Types ────────────────────────────────────────────────────────────────────

export type DNSRecordType = 'AAAA' | 'A' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA' | 'PTR';
export type DNSResolver = 'cloudflare' | 'google' | 'quad9';

export interface MyIPResult {
  ip: string;
  version: number;
  isIPv6: boolean;
}

export interface Ping6ValidateResult {
  valid: boolean;
  type: string;
  compressed: string;
  expanded: string;
}

export interface DNSRecord {
  type: string;
  value: string;
  ttl: number;
}

export interface DNSResult {
  hostname: string;
  records: DNSRecord[];
  resolver: string;
  queryTime: number;
}

export interface PingHop {
  seq: number;
  ttl: number;
  rtt: number;
}

export interface PingStats {
  transmitted: number;
  received: number;
  loss: number;
  min: number;
  avg: number;
  max: number;
}

export interface PingResult {
  target: string;
  ip: string;
  results: PingHop[];
  stats: PingStats;
}

export interface TracerouteHop {
  hop: number;
  ip: string;
  hostname?: string;
  rtt: number;
}

export interface TracerouteResult {
  target: string;
  ip: string;
  hops: TracerouteHop[];
}

// ── API Key storage ──────────────────────────────────────────────────────────

const API_KEY_STORAGE_KEY = 'ping6_api_key';

export function getPing6ApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPing6ApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
  apiKey?: string
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {};
  const key = apiKey ?? getPing6ApiKey();
  if (key) headers['X-API-Key'] = key;

  const res = await withTimeout(
    fetch(url.toString(), { headers }),
    DEFAULT_TIMEOUT_MS
  );

  const data = await res.json();

  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(message ?? `Erro HTTP ${res.status}`);
  }

  return data as T;
}

// ── Public API functions ─────────────────────────────────────────────────────

/** Returns the caller's public IP address. */
export function fetchMyIP(): Promise<MyIPResult> {
  return apiFetch<MyIPResult>('/myip');
}

/** Validates an IPv6 address and returns compressed/expanded forms. */
export function validateIPv6(address: string): Promise<Ping6ValidateResult> {
  return apiFetch<Ping6ValidateResult>('/validate', { address });
}

/** Queries DNS records for a hostname. */
export function lookupDNS(
  hostname: string,
  type: DNSRecordType = 'AAAA',
  resolver: DNSResolver = 'cloudflare'
): Promise<DNSResult> {
  return apiFetch<DNSResult>(`/dns/${encodeURIComponent(hostname)}`, {
    type,
    resolver,
  });
}

/** Sends ICMP echo requests to a target (requires API key). */
export function pingTarget(
  target: string,
  count = 4,
  apiKey?: string
): Promise<PingResult> {
  return apiFetch<PingResult>(
    `/ping/${encodeURIComponent(target)}`,
    { count: String(Math.min(Math.max(count, 1), 10)) },
    apiKey
  );
}

/** Traces the network path to a target (requires API key). */
export function tracerouteTarget(
  target: string,
  maxHops = 30,
  apiKey?: string
): Promise<TracerouteResult> {
  return apiFetch<TracerouteResult>(
    `/traceroute/${encodeURIComponent(target)}`,
    { maxHops: String(Math.min(Math.max(maxHops, 1), 64)) },
    apiKey
  );
}
