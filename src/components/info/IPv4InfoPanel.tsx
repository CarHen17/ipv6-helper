import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Info, Loader2 } from 'lucide-react';
import { classifyIPv4, fullIPv4Lookup, type IPv4LookupResult } from '@/lib/ipv4-info';
import { lookupGeo, type GeoInfo } from '@/lib/geo-utils';
import {
  useCopy, AddressHeader, ClassificationBlock, GeoBlock, BGPBlock, RDAPBlock,
  ExternalLinks, NotRoutableNote, NoDataNote, SectionLabel,
} from './InfoPanelShared';

interface IPv4InfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipv4Address: string;
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm overflow-y-auto bg-background border-border flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Info className="w-4 h-4 text-primary" />
            Informações do Bloco
          </SheetTitle>
          <AddressHeader address={ipv4Address} copied={copied} onCopy={() => copy(ipv4Address)} />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Classification */}
          <section>
            <SectionLabel>Classificação</SectionLabel>
            <ClassificationBlock typeInfo={typeInfo} />
          </section>

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
          {!loading && result && !result.bgpInfo && !result.rdapInfo && typeInfo.routable && <NoDataNote />}

          {/* External links */}
          {typeInfo.routable && (
            <section>
              <SectionLabel>Links externos</SectionLabel>
              <ExternalLinks links={[
                { label: 'bgp.tools', href: `https://bgp.tools/prefix/${ipv4Address}` },
                { label: 'HackerTarget', href: `https://hackertarget.com/ip-info/?q=${encodeURIComponent(ipv4Address.split('/')[0])}` },
                { label: 'WHOIS', href: `https://who.is/whois-ip/address/${encodeURIComponent(ipv4Address.split('/')[0])}` },
              ]} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
