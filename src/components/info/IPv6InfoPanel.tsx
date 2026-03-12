import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Globe, Shield, MapPin, Server, Clock, Users, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, XCircle, Info, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type IPv6LookupResult,
  type IPv6TypeInfo,
  classifyIPv6,
  fullIPv6Lookup,
} from '@/lib/ipv6-info';

interface IPv6InfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipv6Address: string;
}

export function IPv6InfoPanel({ open, onOpenChange, ipv6Address }: IPv6InfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPv6LookupResult | null>(null);

  useEffect(() => {
    if (!open || !ipv6Address) return;
    
    setLoading(true);
    setResult(null);

    fullIPv6Lookup(ipv6Address)
      .then(setResult)
      .catch(() => {
        setResult({
          input: ipv6Address,
          isValid: false,
          typeInfo: classifyIPv6(ipv6Address),
          error: 'Falha ao consultar informações de rede',
        });
      })
      .finally(() => setLoading(false));
  }, [open, ipv6Address]);

  const typeInfo = result?.typeInfo || classifyIPv6(ipv6Address);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Informações do Bloco IPv6
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Address display */}
          <div className="bg-secondary/50 rounded-lg p-3">
            <code className="text-xs font-mono text-primary break-all">{ipv6Address}</code>
          </div>

          {/* Type Classification - always shown */}
          <TypeClassificationCard typeInfo={typeInfo} />

          {/* Loading */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Consultando informações de rede...</span>
            </motion.div>
          )}

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
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <AlertTriangle className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground">
                Não foi possível obter informações de rede para este bloco.
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                O endereço pode não estar anunciado ou o limite da API foi atingido.
              </p>
            </div>
          )}

          {/* Not routable info */}
          {!loading && !typeInfo.routable && (
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-foreground">Endereço não roteável</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Este tipo de endereço não é roteado na Internet pública, portanto informações de BGP/RDAP não estão disponíveis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* External links */}
          {typeInfo.routable && typeInfo.type !== 'Documentação' && (
            <div className="pt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Links externos</p>
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={`https://bgp.tools/prefix/${ipv6Address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> bgp.tools
                </a>
                <a
                  href={`https://hackertarget.com/as-ip-lookup/?q=${encodeURIComponent(ipv6Address.split('/')[0])}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> HackerTarget
                </a>
                <a
                  href={`https://who.is/whois-ip/ip-address/${encodeURIComponent(ipv6Address.split('/')[0])}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> WHOIS
                </a>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
      <div className="px-3 py-2 border-b border-border/60">
        <h3 className="text-[11px] font-medium flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-primary" /> Classificação
        </h3>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', badgeColor)}>
            {typeInfo.type}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {typeInfo.rfc}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{typeInfo.description}</p>
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
      <div className="px-3 py-2 border-b border-border/60">
        <h3 className="text-[11px] font-medium flex items-center gap-1.5">
          <Server className="w-3 h-3 text-primary" /> Informações BGP
        </h3>
      </div>
      <div className="p-3 space-y-2">
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
      <div className="px-3 py-2 border-b border-border/60">
        <h3 className="text-[11px] font-medium flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-primary" /> Registro RDAP
        </h3>
      </div>
      <div className="p-3 space-y-2">
        {rdapInfo.name && <InfoRow icon={Globe} label="Nome" value={rdapInfo.name} />}
        {rdapInfo.handle && <InfoRow icon={Server} label="Handle" value={rdapInfo.handle} mono />}
        {rdapInfo.country && <InfoRow icon={MapPin} label="País" value={rdapInfo.country} />}
        {rdapInfo.type && <InfoRow icon={Info} label="Tipo" value={rdapInfo.type} />}
        {rdapInfo.startAddress && rdapInfo.endAddress && (
          <InfoRow icon={Globe} label="Range" value={`${rdapInfo.startAddress} — ${rdapInfo.endAddress}`} mono />
        )}
        {rdapInfo.status && rdapInfo.status.length > 0 && (
          <div className="flex items-start gap-1.5">
            <CheckCircle className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground block">Status</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {rdapInfo.status.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
        {rdapInfo.entities && rdapInfo.entities.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground block mb-1">Entidades</span>
            {rdapInfo.entities.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <Users className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{e.name}</span>
                {e.roles.length > 0 && (
                  <span className="text-muted-foreground text-[9px]">({e.roles.join(', ')})</span>
                )}
              </div>
            ))}
          </div>
        )}
        {rdapInfo.events && rdapInfo.events.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground block mb-1">Eventos</span>
            {rdapInfo.events.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <Clock className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
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
      <Icon className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-[10px] text-muted-foreground block">{label}</span>
        <span className={cn('text-[11px] text-foreground break-all', mono && 'font-mono', valueClass)}>
          {value}
        </span>
      </div>
    </div>
  );
}
