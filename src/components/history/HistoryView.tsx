import { useState } from 'react';
import { useCalculator, type HistoryEntry } from '@/hooks/useCalculatorState';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { loadIPv4History, saveIPv4History, type IPv4HistoryEntry } from '@/lib/ipv4-history';
import { cn } from '@/lib/utils';

const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days < 7) return `há ${days}d`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function HistoryView() {
  const { history: ipv6History, clearHistory: clearIPv6History, restoreFromHistory } = useCalculator();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'ipv6' | 'ipv4'>('ipv6');
  const [ipv4History, setIPv4History] = useState<IPv4HistoryEntry[]>(loadIPv4History);
  const [confirmClear, setConfirmClear] = useState(false);

  const activeHistory = tab === 'ipv6' ? ipv6History : ipv4History;

  const restoreIPv6 = (entry: HistoryEntry) => {
    restoreFromHistory(entry);
    navigate('/');
    toast.success('Cálculo restaurado');
  };

  const restoreIPv4 = (entry: IPv4HistoryEntry) => {
    navigate('/', { state: { ...entry, _restoreMode: 'ipv4' } });
    toast.success('Cálculo restaurado');
  };

  const handleClear = () => {
    if (tab === 'ipv6') {
      clearIPv6History();
    } else {
      saveIPv4History([]);
      setIPv4History([]);
    }
    setConfirmClear(false);
    toast.info('Histórico apagado');
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...pageTransition}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Histórico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cálculos recentes · clique para restaurar</p>
        </div>
        {activeHistory.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive mt-1 shrink-0" onClick={() => setConfirmClear(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Tab toggle */}
      <div className="inline-flex items-center rounded-full border border-border bg-muted p-1 gap-0.5 shadow-sm mb-6">
        {(['ipv6', 'ipv4'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200',
              tab === t ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === t && (
              <motion.span
                layoutId="history-toggle"
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t === 'ipv6' ? 'IPv6' : 'IPv4'}</span>
            <span className={cn(
              'relative z-10 text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-colors',
              tab === t ? 'bg-white/20 text-primary-foreground/80' : 'bg-muted-foreground/10 text-muted-foreground/60',
            )}>
              {t === 'ipv6' ? '128-bit' : '32-bit'}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeHistory.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Nenhum cálculo no histórico ainda.</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">Os cálculos aparecem aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tab === 'ipv6'
                ? (ipv6History as HistoryEntry[]).map((entry, i) => (
                    <motion.div
                      key={entry.timestamp}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      onClick={() => restoreIPv6(entry)}
                      className="bg-card rounded-xl border border-border/60 p-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group flex items-center justify-between"
                    >
                      <div>
                        <code className="text-xs font-semibold text-primary font-mono">{entry.block}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          → /{entry.prefix}
                          {entry.subnetCount > 0 && `, ${entry.subnetCount.toLocaleString('pt-BR')} sub-redes`}
                          {' · '}{getRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                      <RotateCcw className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
                : (ipv4History as IPv4HistoryEntry[]).map((entry, i) => (
                    <motion.div
                      key={entry.timestamp}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      onClick={() => restoreIPv4(entry)}
                      className="bg-card rounded-xl border border-border/60 p-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group flex items-center justify-between"
                    >
                      <div>
                        <code className="text-xs font-semibold text-primary font-mono">{entry.cidr}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          → /{entry.subnetPrefix}
                          {entry.count > 0 && `, ${entry.count.toLocaleString('pt-BR')} sub-redes`}
                          {' · '}{getRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                      <RotateCcw className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
              }
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Confirm clear dialog */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Apagar histórico {tab.toUpperCase()}?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Todos os {activeHistory.length} registros serão removidos permanentemente.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="flex-1 text-xs h-8" onClick={handleClear}>
              Apagar tudo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
