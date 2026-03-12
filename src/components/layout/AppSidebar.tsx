import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calculator, Network, Clock, RotateCcw, Globe, Sun, Moon, PanelLeftClose, PanelLeft, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalculator } from '@/hooks/useCalculatorState';
import { useTheme } from '@/hooks/useTheme';
import { IPv6InfoPanel } from '@/components/info/IPv6InfoPanel';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { path: '/', label: 'Calculadora', icon: Calculator },
  { path: '/planner', label: 'Planejador', icon: Network },
  { path: '/history', label: 'Histórico', icon: Clock },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetCalculadora, mainBlock, ipv6Input } = useCalculator();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const hasBlock = !!mainBlock || !!ipv6Input.trim();
  const infoAddress = mainBlock
    ? `${mainBlock.network}/${mainBlock.prefix}`
    : ipv6Input.trim();

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <button
              onClick={collapsed ? toggleSidebar : undefined}
              className={cn(
                "w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center shrink-0 transition-all duration-200",
                collapsed && "hover:bg-primary/30 cursor-pointer hover:scale-105"
              )}
              title={collapsed ? 'Expandir menu' : undefined}
            >
              {collapsed ? (
                <PanelLeft className="w-4 h-4 text-primary" />
              ) : (
                <Globe className="w-4 h-4 text-primary" />
              )}
            </button>
            {!collapsed && (
              <>
                <div className="overflow-hidden flex-1 min-w-0">
                  <h1 className="text-sm font-semibold text-sidebar-foreground truncate">Calculadora IPv6</h1>
                  <p className="text-xs text-muted-foreground truncate leading-tight">Sub-redes & Planejamento</p>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200 shrink-0 hover:scale-105"
                  title="Recolher menu"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px]">Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "transition-all duration-200 text-xs",
                          isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            {hasBlock && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setInfoPanelOpen(true)}
                  tooltip="Info do bloco"
                  className="text-primary hover:bg-primary/10 transition-all duration-200 text-xs"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Info do Bloco</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                className="text-muted-foreground hover:text-foreground transition-all duration-200 text-xs"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={resetCalculadora}
                tooltip="Limpar"
                className="text-destructive hover:bg-destructive/10 transition-all duration-200 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <IPv6InfoPanel
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
        ipv6Address={infoAddress}
      />
    </>
  );
}
