import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Copy, RefreshCw, Globe, Clock, Server, Loader2,
  AlertTriangle, CheckCircle2, ChevronDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  lookupDNS,
  type DNSResult,
  type DNSRecordType,
  type DNSResolver,
} from '@/lib/ping6-api';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

const DNS_TYPES: DNSRecordType[] = ['AAAA', 'A', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'PTR'];
const DNS_RESOLVERS: { value: DNSResolver; label: string; color: string }[] = [
  { value: 'cloudflare', label: 'Cloudflare', color: 'text-orange-400' },
  { value: 'google',     label: 'Google',     color: 'text-blue-400' },
  { value: 'nextdns',    label: 'NextDNS',    color: 'text-green-400' },
];

const TYPE_COLORS: Record<string, string> = {
  AAAA:  'bg-primary/10 text-primary border-primary/20',
  A:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  MX:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  TXT:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  NS:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  CNAME: 'bg-green-500/10 text-green-400 border-green-500/20',
  SOA:   'bg-red-500/10 text-red-400 border-red-500/20',
  PTR:   'bg-muted/50 text-muted-foreground border-border',
};

const EXAMPLES = [
  'google.com',
  'cloudflare.com',
  'ipv6.google.com',
  'ds.test-ipv6.com',
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar')
  );
}

export function DNSView() {
  const [hostname, setHostname]   = useState('');
  const [dnsType, setDnsType]     = useState<DNSRecordType>('AAAA');
  const [resolver, setResolver]   = useState<DNSResolver>('cloudflare');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<DNSResult | null>(null);
  const [error, setError]         = useState('');

  const handleLookup = async () => {
    const h = hostname.trim();
    if (!h) { toast.error('Insira um hostname para consultar.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await lookupDNS(h, dnsType, resolver);
      setResult(data);
      if (data.records.length === 0) {
        toast.info('Nenhum registro encontrado para este hostname e tipo.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar DNS';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setHostname('');
    setResult(null);
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup();
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          DNS Lookup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulte registros DNS usando resolvedores globais com suporte a IPv6.
        </p>
      </div>

      <div className="space-y-6">
        {/* Input card */}
        <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4" {...fadeUp}>
          {/* Hostname input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Hostname</label>
            <div className="flex gap-2">
              <Input
                value={hostname}
                onChange={e => setHostname(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex.: google.com"
                className="font-mono text-sm bg-secondary/60 border-border/60 flex-1 h-11"
                spellCheck={false}
              />
            </div>
            {/* Quick examples */}
            <details className="group">
              <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none mt-0.5">
                <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
                Exemplos
              </summary>
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setHostname(ex)}
                    className="text-[11px] font-mono text-primary hover:text-primary/80 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Type + Resolver selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Record type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipo de registro
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {DNS_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setDnsType(type)}
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded-lg border font-mono font-medium transition-colors',
                      dnsType === type
                        ? TYPE_COLORS[type] ?? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolver */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resolvedor
              </label>
              <div className="flex gap-1.5">
                {DNS_RESOLVERS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setResolver(r.value)}
                    className={cn(
                      'flex-1 text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors',
                      resolver === r.value
                        ? cn('bg-card border-border', r.color)
                        : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-1 pt-1">
            <Button
              onClick={handleLookup}
              className="gap-2 h-11 px-5 text-sm"
              disabled={loading || !hostname.trim()}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              Consultar
            </Button>
            {(result || error) && !loading && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs text-muted-foreground h-8">
                <RefreshCw className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && !loading && (
            <motion.div
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro na consulta</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Summary bar */}
              <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {result.records.length > 0
                    ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {result.records.length > 0
                        ? `${result.records.length} registro(s) encontrado(s)`
                        : 'Nenhum registro encontrado'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.hostname} · {dnsType} · {result.resolver}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  {result.queryTime}ms
                </div>
              </div>

              {/* Records table */}
              {result.records.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/60">
                    <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" />
                      Registros DNS
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[420px]">
                      <thead>
                        <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 px-4 font-medium">Tipo</th>
                          <th className="py-2 px-4 font-medium">Valor</th>
                          <th className="py-2 px-4 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> TTL
                          </th>
                          <th className="py-2 px-3 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {result.records.map((rec, i) => (
                          <tr key={i} className="hover:bg-secondary/20 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className={cn(
                                'text-[11px] font-bold font-mono px-2 py-0.5 rounded border',
                                TYPE_COLORS[rec.type] ?? TYPE_COLORS.PTR
                              )}>
                                {rec.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <code className="text-sm font-mono text-foreground break-all">
                                {rec.value}
                              </code>
                            </td>
                            <td className="py-2.5 px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {rec.ttl}s
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => copyToClipboard(rec.value)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                title="Copiar valor"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Resolvido via <span className="font-medium text-foreground">{result.resolver}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5 h-7"
                      onClick={() => {
                        const lines = result.records.map(r => `${r.type}\t${r.value}\t${r.ttl}s`);
                        copyToClipboard(lines.join('\n'));
                      }}
                    >
                      <Copy className="w-3 h-3" /> Copiar tudo
                    </Button>
                  </div>
                </div>
              )}

              {/* Type info callout */}
              {dnsType === 'AAAA' && result.records.length > 0 && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-start gap-3">
                  <ChevronDown className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Registros <span className="font-semibold text-primary">AAAA</span> são os endereços IPv6 associados ao hostname.
                    Múltiplos registros indicam balanceamento de carga ou redundância.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
