import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Shield, MapPin, Server, ExternalLink,
  Loader2, AlertTriangle, Info, Copy, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { classifyIPv4, fullIPv4Lookup, type IPv4LookupResult } from '@/lib/ipv4-info';
import { lookupGeo, countryFlag, type GeoInfo } from '@/lib/geo-utils';
import { toast } from 'sonner';

interface IPv4InfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipv4Address: string; // CIDR, e.g. "10.0.0.0/8"
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

export function IPv4InfoPanel({ open, onOpenChange, ipv4Address }: IPv4InfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPv4LookupResult | null>(null);
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (!open || !ipv4Address) return;
    setLoading(true);
    setResult(null);
    setGeoInfo(null);

    const addrOnly = ipv4Address.split('/')[0];
    Promise.all([
      fullIPv4Lookup(ipv4Address).catch((): IPv4LookupResult => ({
        input: ipv4Address,
        typeInfo: classifyIPv4(ipv4Address),
      })),
      lookupGeo(addrOnly).catch(() => null),
    ]).then(([lookup, geo]) => {
      setResult(lookup);
      setGeoInfo(geo);
    }).finally(() => setLoading(false));
  }, [open, ipv4Address]);

  const typeInfo = result?.typeInfo || classifyIPv4(ipv4Address);

  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    green:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    orange:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
    purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
    blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    muted:   'bg-muted/50 text-muted-foreground border-border',
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
          <div className="flex items-center justify-between gap-2 mt-2 bg-secondary/50 rounded-lg px-3 py-2.5">
            <code className="text-sm font-mono text-primary break-all leading-snug">{ipv4Address}</code>
            <button
              onClick={() => copy(ipv4Address)}
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
          {!loading && result && !result.bgpInfo && !result.rdapInfo && typeInfo.routable && (
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
          {typeInfo.routable && (
            <section>
              <SectionLabel>Links externos</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'bgp.tools', href: `https://bgp.tools/prefix/${ipv4Address}` },
                  { label: 'HackerTarget', href: `https://hackertarget.com/as-ip-lookup/?q=${encodeURIComponent(ipv4Address)}` },
                  { label: 'WHOIS', href: `https://who.is/whois/${encodeURIComponent(ipv4Address)}` },
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

function BGPBlock({ bgpInfo }: { bgpInfo: NonNullable<IPv4LookupResult['bgpInfo']> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {bgpInfo.asn && <Field label="ASN" value={`AS${bgpInfo.asn.replace(/^AS/i, '')}`} mono />}
      {bgpInfo.country && <Field label="País" value={bgpInfo.country} />}
      {bgpInfo.asName && <div className="col-span-2"><Field label="Organização" value={bgpInfo.asName} /></div>}
      {bgpInfo.prefix && <div className="col-span-2"><Field label="Prefixo anunciado" value={bgpInfo.prefix} mono /></div>}
    </div>
  );
}

function RDAPBlock({ rdapInfo }: { rdapInfo: NonNullable<IPv4LookupResult['rdapInfo']> }) {
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
