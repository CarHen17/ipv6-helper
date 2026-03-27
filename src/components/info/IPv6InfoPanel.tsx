import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Globe, Shield, MapPin, Server, Clock, Users, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, XCircle, Info, RefreshCw, Minimize2, Maximize2, Copy,
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

export function IPv6InfoPanel({ open, onOpenChange, ipv6Address }: IPv6InfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPv6LookupResult | null>(null);
  const [ping6Result, setPing6Result] = useState<Ping6ValidateResult | null>(null);
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);

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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Informações do Bloco IPv6
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Address display */}
          <div className="bg-secondary/50 rounded-lg p-3.5">
            <code className="text-sm font-mono text-primary break-all">{ipv6Address}</code>
          </div>

          {/* Block Validation */}
          {result?.validation && (
            <BlockValidationCard validation={result.validation} />
          )}

          {/* Type Classification - always shown */}
          <TypeClassificationCard typeInfo={typeInfo} />

          {/* Ping6 Validate */}
          <AnimatePresence>
            {ping6Result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Ping6ValidateCard result={ping6Result} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Consultando informações de rede...</span>
            </motion.div>
          )}

          {/* Geolocation */}
          <AnimatePresence>
            {geoInfo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <GeoCard geo={geoInfo} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* BGP Info */}
          <AnimatePresence>
            {result?.bgpInfo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <BGPInfoCard bgpInfo={result.bgpInfo} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* RDAP Info */}
          <AnimatePresence>
            {result?.rdapInfo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <RDAPInfoCard rdapInfo={result.rdapInfo} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* No network data message */}
          {!loading && result && !result.bgpInfo && !result.rdapInfo && typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <div className="bg-secondary/30 rounded-lg p-4 text-center">
              <AlertTriangle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Não foi possível obter informações de rede para este bloco.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O endereço pode não estar anunciado ou o limite da API foi atingido.
              </p>
            </div>
          )}

          {/* Not routable info */}
          {!loading && !typeInfo.routable && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Endereço não roteável</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este tipo de endereço não é roteado na Internet pública, portanto informações de BGP/RDAP não estão disponíveis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* External links */}
          {typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Links externos</p>
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={`https://bgp.tools/prefix/${ipv6Address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> bgp.tools
                </a>
                <a
                  href={`https://hackertarget.com/as-ip-lookup/?q=${encodeURIComponent(ipv6Address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> HackerTarget
                </a>
                <a
                  href={`https://who.is/whois/${encodeURIComponent(ipv6Address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> WHOIS
                </a>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BlockValidationCard({ validation }: { validation: BlockValidation }) {
  const hasMismatch = validation.prefixMismatch && validation.announcedPrefix;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      validation.isAligned && !hasMismatch
        ? "bg-emerald-500/5 border-emerald-500/20"
        : "bg-destructive/5 border-destructive/20"
    )}>
      <div className={cn(
        "px-3 py-2 border-b",
        validation.isAligned && !hasMismatch ? "border-emerald-500/20" : "border-destructive/20"
      )}>
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          {validation.isAligned && !hasMismatch
            ? <CheckCircle className="w-4 h-4 text-emerald-400" />
            : <AlertTriangle className="w-4 h-4 text-destructive" />
          }
          Validação do Bloco
        </h3>
      </div>
      <div className="p-3.5 space-y-2.5">
        <p className="text-sm text-muted-foreground leading-relaxed">{validation.message}</p>

        {!validation.isAligned && validation.networkAddress && (
          <div className="bg-secondary/40 rounded-md p-2.5">
            <span className="text-xs text-muted-foreground block">Endereço de rede correto:</span>
            <code className="text-sm font-mono text-primary">{validation.networkAddress}</code>
          </div>
        )}

        {hasMismatch && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-xs font-medium text-destructive">
                Prefixo diverge do BGP
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {validation.prefixMismatchType === 'shorter'
                ? `Você digitou /${validation.prefix}, mas o BGP anuncia este espaço de endereçamento como /${validation.announcedPrefixLen} — um bloco maior. O prefixo /${validation.prefix} não existe como rota independente na tabela BGP global.`
                : `Você digitou /${validation.prefix}, mas o BGP anuncia um bloco mais específico como /${validation.announcedPrefixLen}. O prefixo que você digitou engloba mais espaço do que o anunciado.`
              }
            </p>
            <div>
              <span className="text-xs text-muted-foreground block">Prefixo anunciado no BGP:</span>
              <code className="text-sm font-mono text-primary">{validation.announcedPrefix}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeClassificationCard({ typeInfo }: { typeInfo: IPv6TypeInfo }) {
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/60">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-primary" /> Classificação
        </h3>
      </div>
      <div className="p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5', badgeColor)}>
            {typeInfo.type}
          </Badge>
          <Badge variant="outline" className="text-xs px-2.5 py-0.5">
            {typeInfo.rfc}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{typeInfo.description}</p>
        <div className="grid grid-cols-2 gap-2">
          <InfoRow icon={MapPin} label="Escopo" value={typeInfo.scope} />
          <InfoRow
            icon={typeInfo.routable ? CheckCircle : XCircle}
            label="Roteável"
            value={typeInfo.routable ? 'Sim' : 'Não'}
            valueClass={typeInfo.routable ? 'text-emerald-400' : 'text-red-400'}
          />
        </div>
      </div>
    </div>
  );
}

function BGPInfoCard({ bgpInfo }: { bgpInfo: NonNullable<IPv6LookupResult['bgpInfo']> }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/60">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Server className="w-4 h-4 text-primary" /> Informações BGP
        </h3>
      </div>
      <div className="p-3.5 space-y-2.5">
        {bgpInfo.asn && <InfoRow icon={Server} label="ASN" value={`AS${bgpInfo.asn.replace(/^AS/i, '')}`} mono />}
        {bgpInfo.asName && <InfoRow icon={Users} label="Organização" value={bgpInfo.asName} />}
        {bgpInfo.prefix && <InfoRow icon={Globe} label="Prefixo" value={bgpInfo.prefix} mono />}
        {bgpInfo.country && <InfoRow icon={MapPin} label="País" value={bgpInfo.country} />}
      </div>
    </div>
  );
}

function RDAPInfoCard({ rdapInfo }: { rdapInfo: NonNullable<IPv6LookupResult['rdapInfo']> }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/60">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-primary" /> Registro RDAP
        </h3>
      </div>
      <div className="p-3.5 space-y-2.5">
        {rdapInfo.name && <InfoRow icon={Globe} label="Nome" value={rdapInfo.name} />}
        {rdapInfo.handle && <InfoRow icon={Server} label="Handle" value={rdapInfo.handle} mono />}
        {rdapInfo.country && <InfoRow icon={MapPin} label="País" value={rdapInfo.country} />}
        {rdapInfo.type && <InfoRow icon={Info} label="Tipo" value={rdapInfo.type} />}
        {rdapInfo.startAddress && rdapInfo.endAddress && (
          <InfoRow icon={Globe} label="Range" value={`${rdapInfo.startAddress} — ${rdapInfo.endAddress}`} mono />
        )}
        {rdapInfo.status && rdapInfo.status.length > 0 && (
          <div className="flex items-start gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground block">Status</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {rdapInfo.status.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
        {rdapInfo.entities && rdapInfo.entities.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-border/40">
            <span className="text-xs text-muted-foreground block mb-1.5">Entidades</span>
            {rdapInfo.entities.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-foreground">{e.name}</span>
                {e.roles.length > 0 && (
                  <span className="text-muted-foreground text-[10px]">({e.roles.join(', ')})</span>
                )}
              </div>
            ))}
          </div>
        )}
        {rdapInfo.events && rdapInfo.events.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-border/40">
            <span className="text-xs text-muted-foreground block mb-1.5">Eventos</span>
            {rdapInfo.events.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground capitalize">{e.action}:</span>
                <span className="text-foreground">{new Date(e.date).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Ping6ValidateCard({ result }: { result: Ping6ValidateResult }) {
  const copyText = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copiado!'),
      () => toast.error('Falha ao copiar')
    );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/60 flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-primary" /> Formas do Endereço
        </h3>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-2 py-0',
            result.valid
              ? 'border-emerald-500/30 text-emerald-400'
              : 'border-destructive/30 text-destructive'
          )}
        >
          {result.valid ? 'válido' : 'inválido'}
        </Badge>
      </div>
      <div className="p-3.5 space-y-3">
        {result.type && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground block">Tipo (ping6)</span>
              <span className="text-sm text-foreground">{result.type}</span>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Minimize2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Comprimido</span>
                <code className="text-sm font-mono text-primary break-all">{result.compressed}</code>
              </div>
            </div>
            <button
              onClick={() => copyText(result.compressed)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Maximize2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Expandido</span>
                <code className="text-[11px] font-mono text-muted-foreground break-all">{result.expanded}</code>
              </div>
            </div>
            <button
              onClick={() => copyText(result.expanded)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeoCard({ geo }: { geo: GeoInfo }) {
  const flag = countryFlag(geo.country ?? '');
  const location = [geo.city, geo.region, geo.countryName].filter(Boolean).join(', ');

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/60">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" /> Geolocalização
        </h3>
      </div>
      <div className="p-3.5 space-y-2.5">
        {location && (
          <div className="flex items-start gap-1.5">
            <span className="text-base leading-none mt-0.5">{flag}</span>
            <div>
              <span className="text-xs text-muted-foreground block">Localização</span>
              <span className="text-sm text-foreground">{location}</span>
            </div>
          </div>
        )}
        {geo.lat !== undefined && geo.lon !== undefined && (
          <InfoRow icon={MapPin} label="Coordenadas" value={`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`} mono />
        )}
        {geo.timezone && (
          <InfoRow icon={Clock} label="Fuso horário" value={geo.timezone} />
        )}
        {geo.org && (
          <InfoRow icon={Server} label="Provedor" value={geo.org} />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className={cn('text-sm text-foreground break-all', mono && 'font-mono', valueClass)}>
          {value}
        </span>
      </div>
    </div>
  );
}
