import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe2, Search, Loader2, RefreshCw, AlertTriangle, Copy, ExternalLink, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { lookupPTR, lookupHostedDomains, lookupCertDomains, mergeDomains, normaliseIPv6, type PTRResult, type HackerTargetResult } from '@/lib/reverse-ip-api';
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
  const [ip, setIp]             = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [searched, setSearched] = useState('');

  const [ptrResult,     setPtrResult]     = useState<PTRResult | null>(null);
  const [domainsResult, setDomainsResult] = useState<HackerTargetResult | null>(null);
  const [certDomains,   setCertDomains]   = useState<string[] | null>(null);
  const [geo,           setGeo]           = useState<GeoInfo | null>(null);

  const hasResult = !!(ptrResult || domainsResult || certDomains || geo);

  const allDomains = mergeDomains(
    domainsResult?.domains ?? [],
    certDomains ?? [],
  );

  const handleSearch = async () => {
    const raw = ip.trim();
    if (!raw) { toast.error('Insira um endereço IPv6.'); return; }

    const canonical = normaliseIPv6(raw);
    if (!canonical) { setError('Endereço IPv6 inválido.'); return; }

    setLoading(true);
    setError('');
    setPtrResult(null);
    setDomainsResult(null);
    setCertDomains(null);
    setGeo(null);
    setSearched(canonical);

    const [ptr, domains, certs, geoData] = await Promise.allSettled([
      lookupPTR(canonical),
      lookupHostedDomains(canonical),
      lookupCertDomains(canonical),
      lookupGeo(canonical),
    ]);

    if (ptr.status === 'fulfilled')     setPtrResult(ptr.value);
    if (domains.status === 'fulfilled') setDomainsResult(domains.value);
    if (certs.status === 'fulfilled')   setCertDomains(certs.value);
    if (geoData.status === 'fulfilled') setGeo(geoData.value);

    setLoading(false);
  };

  const handleReset = () => {
    setIp(''); setError(''); setSearched('');
    setPtrResult(null); setDomainsResult(null); setCertDomains(null); setGeo(null);
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-primary" />
          Domínios no IP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encontre domínios hospedados em um endereço IPv6 e seu hostname PTR reverso.
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
              className={cn('font-mono text-sm bg-secondary/60 border-border/60 h-11', error && 'border-destructive')}
              spellCheck={false}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>

          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
              <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
              Exemplos
            </summary>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setIp(ex); setError(''); }}
                  className="text-[11px] font-mono px-2.5 py-1 rounded border border-border/60 bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </details>

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

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Consultando PTR, domínios e geolocalização…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {hasResult && !loading && (
            <motion.div key="results"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Table header */}
                <div className="px-5 py-3.5 border-b border-border bg-secondary/30">
                  <h2 className="text-sm font-semibold text-foreground">Resultado</h2>
                </div>

                {/* Rows */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border/40">
                    {/* IP row */}
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground w-48 align-top">Endereço IP</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-foreground">{searched}</code>
                          <button onClick={() => copyToClipboard(searched)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* PTR row */}
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground align-top">Hostname PTR</td>
                      <td className="px-5 py-3">
                        {ptrResult?.hostname ? (
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-foreground">{ptrResult.hostname}</code>
                            <button onClick={() => copyToClipboard(ptrResult.hostname!)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Sem registro PTR</span>
                        )}
                        {ptrResult && (
                          <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5 break-all">{ptrResult.ptrName}</p>
                        )}
                      </td>
                    </tr>

                    {/* Geo row */}
                    {geo && (
                      <tr className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground align-top">Localização</td>
                        <td className="px-5 py-3">
                          <p className="flex items-center gap-2 text-foreground">
                            <span className="text-base leading-none">{countryFlag(geo.country ?? '')}</span>
                            <span>{[geo.city, geo.region, geo.countryName].filter(Boolean).join(', ')}</span>
                          </p>
                          {geo.org && <p className="text-xs text-muted-foreground mt-0.5">{geo.org}</p>}
                        </td>
                      </tr>
                    )}

                    {/* Total domains row */}
                    <tr className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground align-top">Total de Domínios<br/>Hospedados</td>
                      <td className="px-5 py-3">
                        {domainsResult?.limited ? (
                          <span className="text-yellow-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Limite diário atingido (HackerTarget)
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className={cn('font-semibold', allDomains.length > 0 ? 'text-primary' : 'text-muted-foreground')}>
                              {allDomains.length}
                            </span>
                            {(domainsResult || certDomains) && (
                              <div className="flex gap-2 flex-wrap">
                                {domainsResult && (
                                  <span className="text-[11px] text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                                    HackerTarget: {domainsResult.domains.length}
                                  </span>
                                )}
                                {certDomains && (
                                  <span className="text-[11px] text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                                    crt.sh: {certDomains.length}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Domain list row */}
                    {allDomains.length > 0 && (
                      <tr>
                        <td className="px-5 py-4 font-medium text-foreground align-top">Nome do Domínio<br/>Hospedado</td>
                        <td className="px-5 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                            {allDomains.map((domain, i) => (
                              <div key={i} className="flex items-center gap-1 group min-w-0">
                                <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80 font-mono text-xs truncate transition-colors flex-1">
                                  {domain}
                                </a>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => copyToClipboard(domain)} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Abrir">
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* No domains */}
                    {allDomains.length === 0 && !domainsResult?.limited && (
                      <tr>
                        <td className="px-5 py-4 font-medium text-foreground align-top">Nome do Domínio<br/>Hospedado</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-muted-foreground/60">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-sm italic">Nenhum domínio encontrado nas bases consultadas.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="px-5 py-2.5 border-t border-border/40 flex items-center justify-between bg-secondary/10">
                  <span className="text-[11px] text-muted-foreground/50">Fontes: HackerTarget · crt.sh Certificate Transparency · DoH · ipinfo.io</span>
                  {allDomains.length > 0 && (
                    <button onClick={() => copyToClipboard(allDomains.join('\n'))}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
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
