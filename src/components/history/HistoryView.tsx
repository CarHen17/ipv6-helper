import { useCalculator, type HistoryEntry } from '@/hooks/useCalculatorState';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

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
  const { history, clearHistory, restoreFromHistory } = useCalculator();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  const restoreEntry = (entry: HistoryEntry) => {
    restoreFromHistory(entry);
    navigate('/');
    toast.success('Cálculo restaurado');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-primary" /> Histórico
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Cálculos recentes · clique para restaurar</p>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Nenhum cálculo no histórico ainda.</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1.5">Os cálculos aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {history.map((entry, i) => (
              <motion.div
                key={entry.timestamp}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => restoreEntry(entry)}
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
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm clear dialog */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Apagar histórico?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Todos os {history.length} registros serão removidos permanentemente.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="flex-1 text-xs h-8" onClick={() => {
              clearHistory();
              setConfirmClear(false);
              toast.info('Histórico apagado');
            }}>
              Apagar tudo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
