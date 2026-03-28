import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe2, Search, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  MapPin, Server, Copy, ExternalLink, Info, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { lookupPTR, lookupHostedDomains, normaliseIPv6, type PTRResult, type HackerTargetResult } from '@/lib/reverse-ip-api';
import { lookupGeo, countryFlag, type GeoInfo } from '@/lib/geo-utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0 },
  transition: { duration: 0.3 },
};

const EXAMPLES = [
  '2001:4860:4860::8888',
  '2606:4700:4700::1111',
  '2620:fe::fe',
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copiado!'));
}

export function ReverseIPLookupView() {
  const [ip, setIp]           = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [searched, setSearched] = useState('');

  const [ptrResult,     setPtrResult]     = useState<PTRResult | null>(null);
  const [domainsResult, setDomainsResult] = useState<HackerTargetResult | null>(null);
  const [geo,           setGeo]           = useState<GeoInfo | null>(null);

  const hasResult = !!(ptrResult || domainsResult || geo);

  const handleSearch = async () => {
    const raw = ip.trim();
    if (!raw) { toast.error('Insira um endereço IPv6.'); return; }

    const canonical = normaliseIPv6(raw);
    if (!canonical) { setError('Endereço IPv6 inválido.'); return; }

    setLoading(true);
    setError('');
    setPtrResult(null);
    setDomainsResult(null);
    setGeo(null);
    setSearched(canonical);

    try {
      const [ptr, domains, geoData] = await Promise.allSettled([
        lookupPTR(canonical),
        lookupHostedDomains(canonical),
        lookupGeo(canonical),
      ]);

      if (ptr.status === 'fulfilled')     setPtrResult(ptr.value);
      if (domains.status === 'fulfilled') setDomainsResult(domains.value);
      if (geoData.status === 'fulfilled') setGeo(geoData.value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIp('');
    setError('');
    setSearched('');
    setPtrResult(null);
    setDomainsResult(null);
    setGeo(null);
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-primary" />
          Reverse IP Lookup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encontre o hostname reverso (PTR) e domínios hospedados em um endereço IPv6.
        </p>
      </div>

      <div className="space-y-4">
        {/* Form card */}
        <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4" {...fadeUp}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Endereço IPv6</label>
            <Input
              value={ip}
              onChange={e => { setIp(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleSearch()}
              placeholder="Ex.: 2001:4860:4860::8888"
              className={cn(
                'font-mono text-sm bg-secondary/60 border-border/60 h-11',
                error && 'border-destructive',
              )}
              spellCheck={false}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Examples */}
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
              <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
              Exemplos
            </summary>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => { setIp(ex); setError(''); }}
                  className="text-[11px] font-mono px-2.5 py-1 rounded border border-border/60 bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </details>

          {/* Action */}
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleSearch} disabled={loading || !ip.trim()} className="gap-2 h-11 px-5 text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Consultar
            </Button>
            {hasResult && !loading && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs text-muted-foreground h-8">
                <RefreshCw className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>
        </motion.div>

        {/* Loading state */}
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-3"
            >
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Consultando PTR, geolocalização e domínios…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {hasResult && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* PTR + Geo summary card */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Informações do IP</span>
                  <code className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono border border-primary/20">
                    {searched}
                  </code>
                </div>

                <div className="divide-y divide-border/30">
                  {/* PTR row */}
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Server className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Hostname PTR</p>
                      {ptrResult?.hostname ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-sm font-mono text-foreground truncate">{ptrResult.hostname}</code>
                          <button onClick={() => copyToClipboard(ptrResult.hostname!)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 mt-0.5 italic">Sem registro PTR</p>
                      )}
                      {ptrResult && (
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-mono truncate">{ptrResult.ptrName}</p>
                      )}
                    </div>
                    {ptrResult && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{ptrResult.queryTime}ms</span>
                    )}
                  </div>

                  {/* Geo row */}
                  {geo && (
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Localização</p>
                        <p className="text-sm text-foreground flex items-center gap-1.5">
                          <span>{countryFlag(geo.country ?? '')}</span>
                          <span>
                            {[geo.city, geo.region, geo.countryName].filter(Boolean).join(', ')}
                          </span>
                        </p>
                        {geo.org && (
                          <p className="text-xs text-muted-foreground">{geo.org}</p>
                        )}
                        {geo.timezone && (
                          <p className="text-[11px] text-muted-foreground/60">{geo.timezone}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {!geo && ptrResult !== null && (
                    <div className="px-4 py-3 flex items-center gap-3 text-muted-foreground/50">
                      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-sm italic">Geolocalização não disponível para este endereço</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Domains card */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Domínios hospedados</span>
                  </div>
                  {domainsResult && domainsResult.domains.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {domainsResult.domains.length} encontrado{domainsResult.domains.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {domainsResult?.limited && (
                  <div className="px-4 py-4 flex items-start gap-3 text-yellow-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Limite diário atingido</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A API gratuita do HackerTarget permite ~100 consultas/dia. Tente novamente amanhã.
                      </p>
                    </div>
                  </div>
                )}

                {domainsResult && !domainsResult.limited && domainsResult.domains.length === 0 && (
                  <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
                    <Info className="w-5 h-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum domínio encontrado para este IP.</p>
                    <p className="text-xs text-muted-foreground/60">
                      Bancos de dados de reverse-IP têm cobertura limitada para endereços IPv6.
                    </p>
                  </div>
                )}

                {domainsResult && domainsResult.domains.length > 0 && (
                  <div className="divide-y divide-border/20">
                    {domainsResult.domains.map((domain, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/20 transition-colors group">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <code className="text-sm font-mono text-foreground flex-1 truncate">{domain}</code>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyToClipboard(domain)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Copiar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <a
                            href={`https://${domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Abrir"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Source note */}
                <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/50">
                    Fonte: HackerTarget Reverse IP API
                  </span>
                  {domainsResult && domainsResult.domains.length > 0 && (
                    <button
                      onClick={() => copyToClipboard(domainsResult.domains.join('\n'))}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copiar lista
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
