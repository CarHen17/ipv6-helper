// Shared display components for IPv4 and IPv6 info panels
import { useState } from 'react';
import { Copy, Check, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { countryFlag, type GeoInfo } from '@/lib/geo-utils';
import { toast } from 'sonner';
import type { BGPInfo, RDAPInfo } from '@/lib/ipv6-info';

export { type GeoInfo, type BGPInfo, type RDAPInfo };

export interface TypeInfo {
  type: string;
  description: string;
  scope: string;
  routable: boolean;
  color: string;
  rfc: string;
}

export const COLOR_MAP: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  green:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  orange:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  red:     'bg-red-500/10 text-red-400 border-red-500/20',
  purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  muted:   'bg-muted/50 text-muted-foreground border-border',
};

export function useCopy() {
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

export function AddressHeader({ address, copied, onCopy }: { address: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-secondary/50 rounded-lg px-3 py-2.5 mt-2">
      <code className="text-sm font-mono text-primary break-all leading-snug">{address}</code>
      <button onClick={onCopy} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0">
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function ClassificationBlock({ typeInfo }: { typeInfo: TypeInfo }) {
  const badgeColor = COLOR_MAP[typeInfo.color] || COLOR_MAP.muted;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5', badgeColor)}>
          {typeInfo.type}
        </Badge>
        <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-muted-foreground">
          {typeInfo.rfc}
        </Badge>
        <span className={cn('text-xs font-medium ml-auto', typeInfo.routable ? 'text-emerald-400' : 'text-muted-foreground')}>
          {typeInfo.routable ? '✓ Roteável' : '✕ Não roteável'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{typeInfo.description}</p>
    </div>
  );
}

export function GeoBlock({ geo }: { geo: GeoInfo }) {
  const flag = countryFlag(geo.country ?? '');
  const location = [geo.city, geo.region, geo.countryName].filter(Boolean).join(', ');
  return (
    <div className="bg-secondary/30 rounded-lg p-3 space-y-2.5">
      {location && (
        <p className="text-sm font-medium text-foreground">{flag} {location}</p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {geo.lat !== undefined && geo.lon !== undefined && (
          <>
            <span className="text-muted-foreground">Coordenadas</span>
            <span className="font-mono text-foreground">{geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}</span>
          </>
        )}
        {geo.timezone && (
          <>
            <span className="text-muted-foreground">Fuso horário</span>
            <span className="text-foreground">{geo.timezone}</span>
          </>
        )}
        {geo.org && (
          <>
            <span className="text-muted-foreground">Provedor</span>
            <span className="text-foreground truncate" title={geo.org}>{geo.org}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function BGPBlock({ bgpInfo }: { bgpInfo: BGPInfo }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {bgpInfo.asn && (
          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 text-primary border-primary/30">
            AS{bgpInfo.asn.replace(/^AS/i, '')}
          </Badge>
        )}
        {bgpInfo.country && <span className="text-xs text-muted-foreground">{bgpInfo.country}</span>}
      </div>
      {bgpInfo.asName && <p className="text-xs text-foreground">{bgpInfo.asName}</p>}
      {bgpInfo.prefix && (
        <p className="text-xs font-mono text-muted-foreground">Prefixo: {bgpInfo.prefix}</p>
      )}
    </div>
  );
}

export function RDAPBlock({ rdapInfo }: { rdapInfo: RDAPInfo }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rdapInfo.name && (
          <>
            <span className="text-muted-foreground">Nome</span>
            <span className="text-foreground font-medium">{rdapInfo.name}</span>
          </>
        )}
        {rdapInfo.handle && (
          <>
            <span className="text-muted-foreground">Handle</span>
            <span className="font-mono text-foreground">{rdapInfo.handle}</span>
          </>
        )}
        {rdapInfo.country && (
          <>
            <span className="text-muted-foreground">País</span>
            <span className="text-foreground">{rdapInfo.country}</span>
          </>
        )}
        {rdapInfo.type && (
          <>
            <span className="text-muted-foreground">Tipo</span>
            <span className="text-foreground">{rdapInfo.type}</span>
          </>
        )}
      </div>
      {rdapInfo.status && rdapInfo.status.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rdapInfo.status.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
          ))}
        </div>
      )}
      {rdapInfo.entities && rdapInfo.entities.length > 0 && (
        <div className="space-y-0.5">
          {rdapInfo.entities.map((e, i) => (
            <p key={i} className="text-xs text-foreground">
              {e.name}
              {e.roles.length > 0 && <span className="text-muted-foreground ml-1.5">({e.roles.join(', ')})</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExternalLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map(({ label, href }) => (
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
  );
}

export function NotRoutableNote() {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2.5">
      <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>Endereço não roteável — BGP/RDAP não se aplicam.</span>
    </div>
  );
}

export function NoDataNote() {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>Dados de rede não disponíveis — prefixo pode não estar anunciado.</span>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
      {children}
    </p>
  );
}
