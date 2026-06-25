import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import {
  Calculator, Search, Activity, ScanSearch, ArrowRightLeft,
  FileSearch, Globe2, ShieldCheck, Network, Cpu, Clock, Globe,
} from 'lucide-react';

const PAGE_META: Record<string, { label: string; Icon: React.ElementType }> = {
  '/':           { label: 'Calculadora',      Icon: Calculator },
  '/dns':        { label: 'DNS Lookup',        Icon: Search },
  '/network':    { label: 'Rede (Ping)',        Icon: Activity },
  '/readiness':  { label: 'Verificador IPv6',  Icon: ScanSearch },
  '/ipv4to6':    { label: 'IPv4 → IPv6',       Icon: ArrowRightLeft },
  '/reverse':    { label: 'Zona PTR',           Icon: FileSearch },
  '/reverse-ip': { label: 'Domínios no IP',    Icon: Globe2 },
  '/overlap':    { label: 'Sobreposição',      Icon: ShieldCheck },
  '/planner':    { label: 'Planejador',         Icon: Network },
  '/eui64':      { label: 'EUI-64 / SLAAC',    Icon: Cpu },
  '/history':    { label: 'Histórico',          Icon: Clock },
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { label: 'IP Toolkit', Icon: Globe };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-20">
            <SidebarTrigger className="h-8 w-8" />
            <div className="flex items-center gap-2">
              <meta.Icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{meta.label}</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
