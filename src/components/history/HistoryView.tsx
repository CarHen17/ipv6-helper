import { useCalculator } from '@/hooks/useCalculatorState';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const { history, clearHistory, setIpv6Input } = useCalculator();
  const navigate = useNavigate();

  const restoreEntry = (entry: { block: string; prefix: number }) => {
    setIpv6Input(entry.block);
    navigate('/');
    toast.success('Cálculo restaurado');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Clock className="w-6 h-6 text-primary" /> Histórico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cálculos recentes · clique para restaurar</p>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => { if (confirm('Apagar todo o histórico?')) { clearHistory(); toast.info('Histórico apagado'); } }}>
            <Trash2 className="w-4 h-4" /> Limpar
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum cálculo no histórico ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-2">Os cálculos aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {history.map((entry, i) => (
              <motion.div
                key={entry.timestamp}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => restoreEntry(entry)}
                className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group flex items-center justify-between"
              >
                <div>
                  <code className="text-sm font-semibold text-primary font-mono">{entry.block}</code>
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
    </div>
  );
}
