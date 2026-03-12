import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calculator, Network, Clock, Settings, RotateCcw, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalculator } from '@/hooks/useCalculatorState';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/', label: 'Calculadora', icon: Calculator },
  { path: '/planner', label: 'Planejador', icon: Network },
  { path: '/history', label: 'Histórico', icon: Clock },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetCalculadora } = useCalculator();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <div className="w-5 h-0.5 bg-foreground mb-1" />
        <div className="w-5 h-0.5 bg-foreground mb-1" />
        <div className="w-5 h-0.5 bg-foreground" />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform duration-300",
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">Calculadora IPv6</h1>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMobileOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-1">
          <button
            onClick={resetCalculadora}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpar
          </button>
        </div>
      </aside>
    </>
  );
}
