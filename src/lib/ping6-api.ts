// External API integrations for network tools
// - DNS    : DNS over HTTPS (Cloudflare / Google / Quad9) — no auth required
// - /myip  : ping6.net — no auth required
// - /validate : ping6.net — no auth required
// - Ping / Traceroute : Globalping API — free, no auth (500 tests/hour)

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
export type DNSResolver   = 'cloudflare' | 'google' | 'quad9';

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
  raw: string;
  results: PingHop[];
  stats: PingStats;
}

export interface TracerouteHop {
  hop: number;
  ip: string;
  hostname?: string;
  rtt: number;
  timeout?: boolean;
}

export interface TracerouteResult {
  target: string;
  ip: string;
  raw: string;
  hops: TracerouteHop[];
}

// ── ping6.net — /myip & /validate (no auth) ──────────────────────────────────

const PING6_BASE = 'https://ping6.net/api/v1';

async function ping6Fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PING6_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await withTimeout(fetch(url.toString()), DEFAULT_TIMEOUT_MS);
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: { message?: string } })?.error?.message ?? `Erro HTTP ${res.status}`);
  }
  return data as T;
}

/** Returns the caller's public IP address. */
export function fetchMyIP(): Promise<MyIPResult> {
  return ping6Fetch<MyIPResult>('/myip');
}

/** Validates an IPv6 address and returns compressed/expanded forms. */
export function validateIPv6(address: string): Promise<Ping6ValidateResult> {
  return ping6Fetch<Ping6ValidateResult>('/validate', { address });
}

// ── DNS over HTTPS (DoH) — Cloudflare / Google / Quad9 ───────────────────────

const DNS_TYPE_CODES: Record<DNSRecordType, number> = {
  A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28,
};

const DNS_TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(DNS_TYPE_CODES).map(([k, v]) => [v, k])
);

// DNS status codes
const DNS_STATUS: Record<number, string> = {
  1: 'Formato inválido (FORMERR)',
  2: 'Falha no servidor (SERVFAIL)',
  3: 'Domínio não encontrado (NXDOMAIN)',
  4: 'Não implementado (NOTIMP)',
  5: 'Consulta recusada (REFUSED)',
};

const DOH_ENDPOINTS: Record<DNSResolver, string> = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google:     'https://dns.google/resolve',
  quad9:      'https://dns.quad9.net/dns-query',
};

interface DoHResponse {
  Status: number;
  Answer?: { name: string; type: number; TTL: number; data: string }[];
}

/** Queries DNS records via DNS over HTTPS — no API key required. */
export async function lookupDNS(
  hostname: string,
  type: DNSRecordType = 'AAAA',
  resolver: DNSResolver = 'cloudflare'
): Promise<DNSResult> {
  const start = Date.now();
  const url   = new URL(DOH_ENDPOINTS[resolver]);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', String(DNS_TYPE_CODES[type]));

  const res = await withTimeout(
    fetch(url.toString(), { headers: { Accept: 'application/dns-json' } }),
    DEFAULT_TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`Erro HTTP ${res.status} ao consultar ${resolver}`);

  const data: DoHResponse = await res.json();
  const queryTime = Date.now() - start;

  if (data.Status !== 0) {
    throw new Error(DNS_STATUS[data.Status] ?? `Erro DNS: código ${data.Status}`);
  }

  const records: DNSRecord[] = (data.Answer ?? []).map(a => ({
    type:  DNS_TYPE_NAMES[a.type] ?? String(a.type),
    // Remove trailing dot from FQDNs (Google DoH adds them)
    value: a.data.replace(/\.$/, ''),
    ttl:   a.TTL,
  }));

  return { hostname, records, resolver, queryTime };
}

// ── Globalping API — Ping & Traceroute (free, no auth) ───────────────────────
// https://api.globalping.io — community-powered global network testing
// Free tier: 500 tests/hour unauthenticated

const GP_BASE = 'https://api.globalping.io/v1';

async function gpCreateMeasurement(
  type: 'ping' | 'traceroute',
  target: string,
  options?: Record<string, unknown>
): Promise<string> {
  const body: Record<string, unknown> = {
    target,
    type,
    locations: [{ country: 'BR' }],
  };
  if (options) body.measurementOptions = options;

  const res = await withTimeout(
    fetch(`${GP_BASE}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    DEFAULT_TIMEOUT_MS
  );

  if (res.status === 429) {
    throw new Error('Limite de requisições atingido. Aguarde alguns minutos e tente novamente.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `Erro HTTP ${res.status}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

interface GPPingResult {
  result: {
    status: string;
    rawOutput: string;
    resolvedAddress: string;
    resolvedHostname: string;
    timings: { ttl: number; rtt: number }[];
    stats: { min: number; avg: number; max: number; total: number; rcv: number; drop: number; loss: number };
  };
}

interface GPTracerouteResult {
  result: {
    status: string;
    rawOutput: string;
    resolvedAddress: string;
    resolvedHostname: string;
    hops: {
      resolvedHostname: string | null;
      resolvedAddress: string | null;
      timings: { rtt: number }[];
    }[];
  };
}

interface GPMeasurement<T> {
  id: string;
  type: string;
  status: string;
  target: string;
  results: T[];
}

async function gpGetResult<T>(id: string): Promise<GPMeasurement<T>> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, i === 0 ? 1000 : 2000));
    const res = await fetch(`${GP_BASE}/measurements/${id}`);
    if (!res.ok) throw new Error(`Erro ao buscar resultado: HTTP ${res.status}`);
    const data = await res.json() as GPMeasurement<T>;
    if (data.status === 'finished') return data;
  }
  throw new Error('Tempo esgotado aguardando resultado da medição.');
}

/** Sends ICMP echo requests to a target via Globalping (free, no auth). */
export async function pingTarget(target: string): Promise<PingResult> {
  const id = await gpCreateMeasurement('ping', target, { packets: 4 });
  const measurement = await gpGetResult<GPPingResult>(id);

  if (!measurement.results.length || measurement.results[0].result.status !== 'finished') {
    throw new Error('Medição falhou. O destino pode estar inacessível.');
  }

  const r = measurement.results[0].result;
  const results: PingHop[] = r.timings.map((t, i) => ({
    seq: i + 1,
    ttl: t.ttl,
    rtt: t.rtt,
  }));

  const stats: PingStats = r.stats
    ? {
        transmitted: r.stats.total,
        received: r.stats.rcv,
        loss: r.stats.loss,
        min: r.stats.min,
        avg: +r.stats.avg.toFixed(2),
        max: r.stats.max,
      }
    : {
        transmitted: results.length,
        received: results.length,
        loss: 0,
        min: results.length ? Math.min(...results.map(x => x.rtt)) : 0,
        avg: results.length ? +(results.reduce((a, b) => a + b.rtt, 0) / results.length).toFixed(2) : 0,
        max: results.length ? Math.max(...results.map(x => x.rtt)) : 0,
      };

  return {
    target,
    ip: r.resolvedAddress || target,
    raw: r.rawOutput,
    results,
    stats,
  };
}

/** Traces the network path to a target via Globalping (free, no auth). */
export async function tracerouteTarget(target: string): Promise<TracerouteResult> {
  const id = await gpCreateMeasurement('traceroute', target);
  const measurement = await gpGetResult<GPTracerouteResult>(id);

  if (!measurement.results.length || measurement.results[0].result.status !== 'finished') {
    throw new Error('Medição falhou. O destino pode estar inacessível.');
  }

  const r = measurement.results[0].result;
  const hops: TracerouteHop[] = r.hops.map((h, i) => {
    const isTimeout = !h.resolvedAddress && h.timings.length === 0;
    const avgRtt = h.timings.length
      ? h.timings.reduce((a, b) => a + b.rtt, 0) / h.timings.length
      : 0;

    return {
      hop: i + 1,
      ip: h.resolvedAddress || '*',
      hostname: h.resolvedHostname || undefined,
      rtt: +avgRtt.toFixed(2),
      timeout: isTimeout || undefined,
    };
  });

  return {
    target,
    ip: r.resolvedAddress || target,
    raw: r.rawOutput,
    hops,
  };
}
