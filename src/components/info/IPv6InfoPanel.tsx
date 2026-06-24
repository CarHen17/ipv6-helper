import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Shield, MapPin, Server, Clock, Users, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, XCircle, Info, Copy, Check,
  Minimize2, Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type IPv6LookupResult,
  type IPv6TypeInfo,
  type BlockValidation,
  classifyIPv6,
  fullIPv6Lookup,
} from '@/lib/ipv6-info';
import { validateIPv6, type Ping6ValidateResult } from '@/lib/ping6-api';
import { lookupGeo, countryFlag, type GeoInfo } from '@/lib/geo-utils';
import { toast } from 'sonner';

interface IPv6InfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipv6Address: string;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copiado!');
      setTimeout(() => setCopied(false), 1500);
    }, () => toast.error('Falha ao copiar'));
  };
  return { copied, copy };
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

  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    muted: 'bg-muted/50 text-muted-foreground border-border',
  };
  const badgeColor = colorMap[typeInfo.color] || colorMap.muted;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background border-border flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Info className="w-4 h-4 text-primary" />
            Informações do Bloco
          </SheetTitle>
          {/* Address */}
          <div className="flex items-center justify-between gap-2 mt-2 bg-secondary/50 rounded-lg px-3 py-2.5">
            <code className="text-sm font-mono text-primary break-all leading-snug">{ipv6Address}</code>
            <button
              onClick={() => copy(ipv6Address)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Classification */}
          <section>
            <SectionLabel>Classificação</SectionLabel>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5', badgeColor)}>
                  {typeInfo.type}
                </Badge>
                <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-muted-foreground">
                  {typeInfo.rfc}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{typeInfo.description}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Field label="Escopo" value={typeInfo.scope} />
                <Field
                  label="Roteável"
                  value={typeInfo.routable ? 'Sim' : 'Não'}
                  valueClass={typeInfo.routable ? 'text-emerald-400' : 'text-red-400'}
                />
              </div>
            </div>
          </section>

          {/* Block Validation */}
          {result?.validation && (
            <section>
              <SectionLabel>Validação</SectionLabel>
              <BlockValidationBlock validation={result.validation} />
            </section>
          )}

          {/* Address forms */}
          <AnimatePresence>
            {ping6Result && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>Formas do Endereço</SectionLabel>
                <AddressFormsBlock result={ping6Result} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Consultando dados de rede...</span>
            </div>
          )}

          {/* Geo */}
          <AnimatePresence>
            {geoInfo && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>Geolocalização</SectionLabel>
                <GeoBlock geo={geoInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* BGP */}
          <AnimatePresence>
            {result?.bgpInfo && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>BGP</SectionLabel>
                <BGPBlock bgpInfo={result.bgpInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* RDAP */}
          <AnimatePresence>
            {result?.rdapInfo && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <SectionLabel>Registro RDAP</SectionLabel>
                <RDAPBlock rdapInfo={result.rdapInfo} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* No data */}
          {!loading && result && !result.bgpInfo && !result.rdapInfo && typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground py-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Dados de rede não disponíveis para este bloco. O prefixo pode não estar anunciado ou o limite da API foi atingido.</span>
            </div>
          )}

          {/* Not routable */}
          {!loading && !typeInfo.routable && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground py-1">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Endereço não roteável na Internet pública — informações BGP/RDAP não se aplicam.</span>
            </div>
          )}

          {/* External links */}
          {typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <section>
              <SectionLabel>Links externos</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'bgp.tools', href: `https://bgp.tools/prefix/${ipv6Address}` },
                  { label: 'HackerTarget', href: `https://hackertarget.com/as-ip-lookup/?q=${encodeURIComponent(ipv6Address)}` },
                  { label: 'WHOIS', href: `https://who.is/whois/${encodeURIComponent(ipv6Address)}` },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> {label}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2.5">
      {children}
    </p>
  );
}

function Field({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div>
      <span className="text-[11px] text-muted-foreground/70 block">{label}</span>
      <span className={cn('text-sm text-foreground font-medium', mono && 'font-mono', valueClass)}>{value}</span>
    </div>
  );
}

function BlockValidationBlock({ validation }: { validation: BlockValidation }) {
  const ok = validation.isAligned && !validation.prefixMismatch;
  return (
    <div className={cn(
      'rounded-lg px-3.5 py-3 flex items-start gap-2.5',
      ok ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-destructive/5 border border-destructive/20'
    )}>
      {ok
        ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        : <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      }
      <div className="space-y-2 min-w-0">
        <p className="text-sm text-foreground leading-snug">{validation.message}</p>
        {!validation.isAligned && validation.networkAddress && (
          <div>
            <span className="text-[11px] text-muted-foreground">Endereço correto</span>
            <code className="block text-sm font-mono text-primary mt-0.5">{validation.networkAddress}</code>
          </div>
        )}
        {validation.prefixMismatch && validation.announcedPrefix && (
          <div>
            <span className="text-[11px] text-muted-foreground">Prefixo anunciado no BGP</span>
            <code className="block text-sm font-mono text-primary mt-0.5">{validation.announcedPrefix}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function AddressFormsBlock({ result }: { result: Ping6ValidateResult }) {
  const { copied: c1, copy: copy1 } = useCopy();
  const { copied: c2, copy: copy2 } = useCopy();
  return (
    <div className="space-y-2">
      <CopyRow label="Comprimido" value={result.compressed} copied={c1} onCopy={() => copy1(result.compressed)} />
      <CopyRow label="Expandido" value={result.expanded} copied={c2} onCopy={() => copy2(result.expanded)} mono small />
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy, mono = true, small }: {
  label: string; value: string; copied: boolean; onCopy: () => void; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-secondary/40 rounded-lg px-3 py-2.5">
      <div className="min-w-0">
        <span className="text-[11px] text-muted-foreground/70 block">{label}</span>
        <code className={cn('font-mono break-all', small ? 'text-[11px] text-muted-foreground' : 'text-sm text-primary')}>{value}</code>
      </div>
      <button onClick={onCopy} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Copiar">
        {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

function GeoBlock({ geo }: { geo: GeoInfo }) {
  const flag = countryFlag(geo.country ?? '');
  const location = [geo.city, geo.region, geo.countryName].filter(Boolean).join(', ');
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {location && (
        <div className="col-span-2">
          <span className="text-[11px] text-muted-foreground/70 block">Localização</span>
          <span className="text-sm text-foreground font-medium">{flag} {location}</span>
        </div>
      )}
      {geo.lat !== undefined && geo.lon !== undefined && (
        <Field label="Coordenadas" value={`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`} mono />
      )}
      {geo.timezone && <Field label="Fuso horário" value={geo.timezone} />}
      {geo.org && <div className="col-span-2"><Field label="Provedor" value={geo.org} /></div>}
    </div>
  );
}

function BGPBlock({ bgpInfo }: { bgpInfo: NonNullable<IPv6LookupResult['bgpInfo']> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {bgpInfo.asn && <Field label="ASN" value={`AS${bgpInfo.asn.replace(/^AS/i, '')}`} mono />}
      {bgpInfo.country && <Field label="País" value={bgpInfo.country} />}
      {bgpInfo.asName && <div className="col-span-2"><Field label="Organização" value={bgpInfo.asName} /></div>}
      {bgpInfo.prefix && <div className="col-span-2"><Field label="Prefixo" value={bgpInfo.prefix} mono /></div>}
    </div>
  );
}

function RDAPBlock({ rdapInfo }: { rdapInfo: NonNullable<IPv6LookupResult['rdapInfo']> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rdapInfo.name && <div className="col-span-2"><Field label="Nome" value={rdapInfo.name} /></div>}
        {rdapInfo.handle && <Field label="Handle" value={rdapInfo.handle} mono />}
        {rdapInfo.country && <Field label="País" value={rdapInfo.country} />}
        {rdapInfo.type && <Field label="Tipo" value={rdapInfo.type} />}
      </div>
      {rdapInfo.status && rdapInfo.status.length > 0 && (
        <div>
          <span className="text-[11px] text-muted-foreground/70 block mb-1.5">Status</span>
          <div className="flex flex-wrap gap-1">
            {rdapInfo.status.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
            ))}
          </div>
        </div>
      )}
      {rdapInfo.entities && rdapInfo.entities.length > 0 && (
        <div>
          <span className="text-[11px] text-muted-foreground/70 block mb-1.5">Entidades</span>
          <div className="space-y-1">
            {rdapInfo.entities.map((e, i) => (
              <div key={i} className="text-sm text-foreground">
                {e.name}
                {e.roles.length > 0 && <span className="text-muted-foreground text-[11px] ml-1.5">({e.roles.join(', ')})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {rdapInfo.events && rdapInfo.events.length > 0 && (
        <div>
          <span className="text-[11px] text-muted-foreground/70 block mb-1.5">Eventos</span>
          <div className="space-y-1">
            {rdapInfo.events.map((e, i) => (
              <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{e.action}</span>
                <span className="text-foreground">{new Date(e.date).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
