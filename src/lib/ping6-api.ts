// External API integrations for network tools
// - DNS    : DNS over HTTPS (Cloudflare / Google / Quad9) — no auth required
// - /myip  : ping6.net — no auth required
// - /validate : ping6.net — no auth required
// - Ping / Traceroute : HackerTarget free API — no auth required (100 req/day)

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

// ── HackerTarget — Ping & Traceroute (free, no auth) ─────────────────────────
// Same provider used for BGP/ASN lookups in ipv6-info.ts.
// Free tier: 100 requests/day per IP.

const HT_BASE = 'https://api.hackertarget.com';

async function htFetch(path: string, target: string): Promise<string> {
  const url = `${HT_BASE}${path}?q=${encodeURIComponent(target)}`;
  const res  = await withTimeout(fetch(url), DEFAULT_TIMEOUT_MS);
  const text = await res.text();

  // HackerTarget returns plain-text errors starting with "error"
  if (/^error\b/i.test(text.trim())) {
    const msg = text.trim().replace(/^error\s*/i, '');
    throw new Error(
      msg.toLowerCase().includes('api count')
        ? 'Limite diário de 100 requisições atingido. Tente novamente amanhã.'
        : msg || 'Erro no servidor HackerTarget'
    );
  }

  return text;
}

// ── Ping parser ───────────────────────────────────────────────────────────────
// HackerTarget uses BusyBox ping — output format:
//   PING host (ip): N data bytes
//   N bytes from ip: seq=N ttl=N time=N.N ms
//   --- host ping statistics ---
//   N packets transmitted, N packets received, N% packet loss
//   round-trip min/avg/max = N/N/N ms

function parsePingOutput(raw: string, target: string): PingResult {
  const results: PingHop[] = [];

  for (const line of raw.split('\n')) {
    // BusyBox:  "seq=N ttl=N time=N.N ms"
    // Standard: "icmp_seq=N ... ttl=N ... time=N.N ms"
    const m = line.match(/(?:icmp_seq|seq)=(\d+).*?ttl=(\d+).*?time=([\d.]+)/i);
    if (m) results.push({ seq: +m[1], ttl: +m[2], rtt: +m[3] });
  }

  // "3 packets transmitted, 3 packets received, 0% packet loss"
  const statsM = raw.match(/(\d+) packets? transmitted,\s*(\d+) packets? received,\s*([\d.]+)%/);
  // "round-trip min/avg/max = 1.5/2.0/2.5 ms" or "rtt min/avg/max/mdev = ..."
  const rttM   = raw.match(/(?:round-trip|rtt)\s+min\/avg\/max[^\s]*\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i);
  // Extract resolved IP: "PING host (IP):" or "PING IP ("
  const ipM    = raw.match(/PING\s+\S+\s+\(([^\)]+)\)/i);

  const rtts         = results.map(r => r.rtt);
  const transmitted  = statsM ? +statsM[1] : results.length;
  const received     = statsM ? +statsM[2] : results.length;
  const loss         = statsM ? +statsM[3] : (results.length === 0 ? 100 : 0);
  const min          = rttM ? +rttM[1] : (rtts.length ? Math.min(...rtts) : 0);
  const avg          = rttM ? +rttM[2] : (rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : 0);
  const max          = rttM ? +rttM[3] : (rtts.length ? Math.max(...rtts) : 0);

  return {
    target,
    ip: ipM?.[1] ?? target,
    raw,
    results,
    stats: { transmitted, received, loss, min, avg: +avg.toFixed(2), max },
  };
}

// ── Traceroute parser ─────────────────────────────────────────────────────────
// HackerTarget output format (BusyBox traceroute):
//   traceroute to host (IP), 30 hops max, N byte packets
//    1  10.0.0.1 (10.0.0.1)  1.2 ms  1.3 ms  1.2 ms
//    2  hostname (IP)  2.1 ms  2.0 ms  2.2 ms
//    3  * * *

function parseTracerouteOutput(raw: string, target: string): TracerouteResult {
  // "traceroute to HOST (IP),"
  const ipM  = raw.match(/traceroute to \S+\s+\(([^\)]+)\)/i);
  const hops: TracerouteHop[] = [];

  for (const line of raw.split('\n')) {
    // Timeout: " N  * * *"
    if (/^\s*(\d+)\s+\*\s+\*\s+\*/.test(line)) {
      const n = line.match(/^\s*(\d+)/);
      if (n) hops.push({ hop: +n[1], ip: '*', rtt: 0, timeout: true });
      continue;
    }

    // With hostname: " N  hostname (IP)  R ms  R ms  R ms"
    const full = line.match(/^\s*(\d+)\s+(\S+)\s+\(([^\)]+)\)\s+([\d.]+)\s+ms/);
    if (full) {
      hops.push({ hop: +full[1], hostname: full[2], ip: full[3], rtt: +full[4] });
      continue;
    }

    // Without hostname: " N  IP  R ms  R ms  R ms"
    const simple = line.match(/^\s*(\d+)\s+([^\s*]+)\s+([\d.]+)\s+ms/);
    if (simple) {
      hops.push({ hop: +simple[1], ip: simple[2], rtt: +simple[3] });
    }
  }

  return { target, ip: ipM?.[1] ?? target, raw, hops };
}

/** Sends ICMP echo requests to a target via HackerTarget (free, no auth). */
export async function pingTarget(target: string): Promise<PingResult> {
  const raw = await htFetch('/ping/', target);
  return parsePingOutput(raw, target);
}

/** Traces the network path to a target via HackerTarget (free, no auth). */
export async function tracerouteTarget(target: string): Promise<TracerouteResult> {
  const raw = await htFetch('/traceroute/', target);
  return parseTracerouteOutput(raw, target);
}
