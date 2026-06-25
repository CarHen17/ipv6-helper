import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Info, Loader2, CheckCircle, AlertTriangle, Copy, Check, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type IPv6LookupResult, type BlockValidation,
  classifyIPv6, fullIPv6Lookup,
} from '@/lib/ipv6-info';
import { validateIPv6, type Ping6ValidateResult } from '@/lib/ping6-api';
import { lookupGeo, type GeoInfo } from '@/lib/geo-utils';
import { toast } from 'sonner';
import {
  useCopy, AddressHeader, ClassificationBlock, GeoBlock, BGPBlock, RDAPBlock,
  ExternalLinks, NotRoutableNote, NoDataNote, SectionLabel,
} from './InfoPanelShared';

interface IPv6InfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipv6Address: string;
}

export function IPv6InfoPanel({ open, onOpenChange, ipv6Address }: IPv6InfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPv6LookupResult | null>(null);
  const [ping6Result, setPing6Result] = useState<Ping6ValidateResult | null>(null);
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (!open || !ipv6Address) return;
    setLoading(true);
    setResult(null);
    setPing6Result(null);
    setGeoInfo(null);

    const addrOnly = ipv6Address.split('/')[0];
    Promise.all([
      fullIPv6Lookup(ipv6Address).catch((): IPv6LookupResult => ({
        input: ipv6Address,
        isValid: false,
        typeInfo: classifyIPv6(ipv6Address),
        error: 'Falha ao consultar informações de rede',
      })),
      validateIPv6(addrOnly).catch(() => null),
      lookupGeo(addrOnly).catch(() => null),
    ]).then(([lookup, p6, geo]) => {
      setResult(lookup);
      setPing6Result(p6);
      setGeoInfo(geo);
    }).finally(() => setLoading(false));
  }, [open, ipv6Address]);

  const typeInfo = result?.typeInfo || classifyIPv6(ipv6Address);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm overflow-y-auto bg-background border-border flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Info className="w-4 h-4 text-primary" />
            Informações do Bloco
          </SheetTitle>
          <AddressHeader address={ipv6Address} copied={copied} onCopy={() => copy(ipv6Address)} />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Classification */}
          <section>
            <SectionLabel>Classificação</SectionLabel>
            <ClassificationBlock typeInfo={typeInfo} />
          </section>

          {/* Block validation */}
          {result?.validation && (
            <section>
              <SectionLabel>Validação</SectionLabel>
              <ValidationBlock validation={result.validation} />
            </section>
          )}

          {/* Address forms */}
          <AnimatePresence>
            {ping6Result && (
              <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>Formas do Endereço</SectionLabel>
                <AddressFormsBlock result={ping6Result} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Consultando dados de rede...
            </div>
          )}

          {/* Geo */}
          <AnimatePresence>
            {geoInfo && (
              <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>Geolocalização</SectionLabel>
                <GeoBlock geo={geoInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* BGP */}
          <AnimatePresence>
            {result?.bgpInfo && (
              <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>BGP</SectionLabel>
                <BGPBlock bgpInfo={result.bgpInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* RDAP */}
          <AnimatePresence>
            {result?.rdapInfo && (
              <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>RDAP</SectionLabel>
                <RDAPBlock rdapInfo={result.rdapInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* States */}
          {!loading && !typeInfo.routable && <NotRoutableNote />}
          {!loading && result && !result.bgpInfo && !result.rdapInfo && typeInfo.routable && typeInfo.type !== 'Documentação' && <NoDataNote />}

          {/* External links */}
          {typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <section>
              <SectionLabel>Links externos</SectionLabel>
              <ExternalLinks links={[
                { label: 'bgp.tools', href: `https://bgp.tools/prefix/${ipv6Address}` },
                { label: 'HackerTarget', href: `https://hackertarget.com/as-ip-lookup/?q=${encodeURIComponent(ipv6Address)}` },
                { label: 'WHOIS', href: `https://who.is/whois/${encodeURIComponent(ipv6Address)}` },
              ]} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ValidationBlock({ validation }: { validation: BlockValidation }) {
  const ok = validation.isAligned && !validation.prefixMismatch;
  return (
    <div className={cn(
      'rounded-lg px-3 py-2.5 flex items-start gap-2',
      ok ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-destructive/5 border border-destructive/20'
    )}>
      {ok
        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        : <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
      }
      <div className="space-y-1.5 min-w-0">
        <p className="text-xs text-foreground leading-snug">{validation.message}</p>
        {!validation.isAligned && validation.networkAddress && (
          <div>
            <span className="text-[10px] text-muted-foreground">Endereço correto</span>
            <code className="block text-xs font-mono text-primary mt-0.5">{validation.networkAddress}</code>
          </div>
        )}
        {validation.prefixMismatch && validation.announcedPrefix && (
          <div>
            <span className="text-[10px] text-muted-foreground">Prefixo anunciado no BGP</span>
            <code className="block text-xs font-mono text-primary mt-0.5">{validation.announcedPrefix}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function AddressFormsBlock({ result }: { result: Ping6ValidateResult }) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const copyFn = (text: string, set: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      set(true); toast.success('Copiado!');
      setTimeout(() => set(false), 1500);
    });
  };
  return (
    <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Minimize2 className="w-3 h-3" />Comprimido</span>
          <code className="text-xs font-mono text-primary break-all">{result.compressed}</code>
        </div>
        <button onClick={() => copyFn(result.compressed, setC1)} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {c1 ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
        <div className="min-w-0">
          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Maximize2 className="w-3 h-3" />Expandido</span>
          <code className="text-[11px] font-mono text-muted-foreground break-all">{result.expanded}</code>
        </div>
        <button onClick={() => copyFn(result.expanded, setC2)} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {c2 ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}
