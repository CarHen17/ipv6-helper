import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Globe, Loader2, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Copy, Plus, Trash2, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { lookupDNS, type DNSRecord } from '@/lib/ping6-api';
import { lookupGeo, countryFlag, type GeoInfo } from '@/lib/geo-utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

interface DomainResult {
  domain: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  hasAAAA: boolean;
  hasA: boolean;
  aaaaRecords: DNSRecord[];
  aRecords: DNSRecord[];
  queryTime?: number;
  error?: string;
  geo?: GeoInfo | null; // geolocation of first AAAA record
}

const PRESETS = [
  'google.com',
  'facebook.com',
  'cloudflare.com',
  'github.com',
  'netflix.com',
  'amazon.com',
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar'),
  );
}

export function ReadinessView() {
  const [domains, setDomains] = useState<string[]>(['']);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loading, setLoading] = useState(false);

  const updateDomain = (i: number, val: string) => {
    setDomains(d => d.map((v, j) => (j === i ? val : v)));
  };

  const addDomain = () => {
    if (domains.length >= 20) { toast.error('Máximo de 20 domínios por vez.'); return; }
    setDomains(d => [...d, '']);
  };

  const removeDomain = (i: number) => {
    if (domains.length <= 1) return;
    setDomains(d => d.filter((_, j) => j !== i));
  };

  const loadPresets = () => {
    setDomains(PRESETS);
    setResults([]);
  };

  const handleReset = () => {
    setDomains(['']);
    setResults([]);
  };

  const handleCheck = async () => {
    const cleaned = domains
      .map(d => {
        let val = d.trim().toLowerCase();
        // Strip protocol (http:// https://) and trailing slashes/paths
        val = val.replace(/^https?:\/\//, '').replace(/[\/\?#].*$/, '');
        return val;
      })
      .filter(Boolean);
    if (cleaned.length === 0) { toast.error('Insira ao menos um domínio.'); return; }

    const unique = [...new Set(cleaned)];
    setLoading(true);

    const initial: DomainResult[] = unique.map(domain => ({
      domain, status: 'loading', hasAAAA: false, hasA: false, aaaaRecords: [], aRecords: [],
    }));
    setResults(initial);

    const updated = await Promise.all(
      unique.map(async (domain): Promise<DomainResult> => {
        const start = Date.now();
        try {
          const [aaaa, a] = await Promise.all([
            lookupDNS(domain, 'AAAA', 'cloudflare'),
            lookupDNS(domain, 'A', 'cloudflare'),
          ]);
          // Geo lookup for the first AAAA record (best-effort, never blocks)
          const firstAAAA = aaaa.records[0]?.value;
          const geo = firstAAAA ? await lookupGeo(firstAAAA).catch(() => null) : null;
          return {
            domain,
            status: 'done',
            hasAAAA: aaaa.records.length > 0,
            hasA: a.records.length > 0,
            aaaaRecords: aaaa.records,
            aRecords: a.records,
            queryTime: Date.now() - start,
            geo,
          };
        } catch (err) {
          return {
            domain,
            status: 'error',
            hasAAAA: false,
            hasA: false,
            aaaaRecords: [],
            aRecords: [],
            error: err instanceof Error ? err.message : 'Erro desconhecido',
            queryTime: Date.now() - start,
          };
        }
      }),
    );

    setResults(updated);
    setLoading(false);

    const ready = updated.filter(r => r.hasAAAA).length;
    toast.success(`Verificação concluída: ${ready}/${updated.length} com IPv6`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleCheck();
  };

  const readyCount = results.filter(r => r.hasAAAA).length;
  const doneCount = results.filter(r => r.status === 'done').length;

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Verificador IPv6
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analise se domínios possuem registros AAAA (IPv6) configurados.
        </p>
      </div>

      <div className="space-y-6">
        {/* Input card */}
        <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4" {...fadeUp}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Domínios</label>
              <button
                onClick={loadPresets}
                className="text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                Carregar exemplos
              </button>
            </div>

            <div className="space-y-2">
              {domains.map((domain, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={domain}
                    onChange={e => updateDomain(i, e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ex.: ${PRESETS[i % PRESETS.length]}`}
                    className="font-mono text-sm bg-secondary/60 border-border/60 flex-1 h-11"
                    spellCheck={false}
                    disabled={loading}
                  />
                  {domains.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDomain(i)}
                      className="h-11 w-11 text-muted-foreground hover:text-destructive shrink-0"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={addDomain}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8"
              disabled={loading || domains.length >= 20}
            >
              <Plus className="w-3 h-3" /> Adicionar domínio
            </Button>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              onClick={handleCheck}
              className="gap-2 h-11 px-5 text-sm"
              disabled={loading || domains.every(d => !d.trim())}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              Verificar
            </Button>
          </div>
          {results.length > 0 && !loading && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs text-muted-foreground h-8">
                <RefreshCw className="w-3 h-3" /> Limpar
              </Button>
            </div>
          )}
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Summary */}
              {doneCount > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                        readyCount === doneCount
                          ? 'bg-primary/15 text-primary'
                          : readyCount > 0
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-destructive/15 text-destructive'
                      )}>
                        {readyCount}/{doneCount}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {readyCount === doneCount
                            ? 'Todos os domínios possuem IPv6!'
                            : readyCount > 0
                              ? 'Alguns domínios possuem IPv6'
                              : 'Nenhum domínio possui IPv6'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {readyCount} de {doneCount} domínio(s) com registros AAAA
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full sm:w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${doneCount > 0 ? (readyCount / doneCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Domain cards */}
              <div className="space-y-3">
                {results.map((r, i) => (
                  <motion.div
                    key={r.domain}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {r.status === 'loading' && (
                          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                        )}
                        {r.status === 'done' && r.hasAAAA && (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        )}
                        {r.status === 'done' && !r.hasAAAA && (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        {r.status === 'error' && (
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <code className="text-sm font-mono text-foreground truncate block">{r.domain}</code>
                          {r.geo && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <span>{countryFlag(r.geo.country ?? '')}</span>
                              <span>{[r.geo.city, r.geo.countryName].filter(Boolean).join(', ')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r.status === 'done' && (
                          <>
                            {r.hasA && (
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                A
                              </span>
                            )}
                            {r.hasAAAA && (
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                                AAAA
                              </span>
                            )}
                            {!r.hasAAAA && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/20">
                                Sem IPv6
                              </span>
                            )}
                          </>
                        )}
                        {r.queryTime !== undefined && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />{r.queryTime}ms
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Record details */}
                    {r.status === 'done' && (r.aaaaRecords.length > 0 || r.aRecords.length > 0) && (
                      <div className="px-4 py-2.5 border-t border-border/40 space-y-1.5">
                        {r.aaaaRecords.map((rec, j) => (
                          <div key={`aaaa-${j}`} className="flex items-center justify-between gap-2">
                            <code className="text-xs font-mono text-primary break-all">{rec.value}</code>
                            <button
                              onClick={() => copyToClipboard(rec.value)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {r.aRecords.map((rec, j) => (
                          <div key={`a-${j}`} className="flex items-center justify-between gap-2">
                            <code className="text-xs font-mono text-muted-foreground break-all">{rec.value}</code>
                            <button
                              onClick={() => copyToClipboard(rec.value)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {r.status === 'error' && (
                      <div className="px-4 py-2.5 border-t border-border/40">
                        <p className="text-xs text-destructive">{r.error}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
