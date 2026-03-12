import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, ShieldAlert, Search, Copy, RotateCcw, ArrowRight,
  Info, Layers, AlertTriangle, CheckCircle2, XCircle, ChevronDown, Clipboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeOverlaps, type OverlapReport, type OverlapFinding } from '@/lib/overlap-utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar')
  );
}

const EXAMPLE_BLOCKS = `2001:db8::/32
2001:db8:1::/48
2001:db8:1::/64
2001:db8:2::/48
2001:db8:2::/48
2001:db8:3::/48
2001:db8:ffff::/48`;

const typeConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle; description: string }> = {
  duplicate: {
    label: 'Duplicado',
    color: 'text-amber-400',
    icon: Layers,
    description: 'Blocos idênticos',
  },
  contains: {
    label: 'Contém',
    color: 'text-primary',
    icon: ChevronDown,
    description: 'Bloco A contém bloco B',
  },
  contained: {
    label: 'Contido',
    color: 'text-primary',
    icon: ChevronDown,
    description: 'Bloco A está contido em B',
  },
  overlap: {
    label: 'Sobreposição',
    color: 'text-destructive',
    icon: AlertTriangle,
    description: 'Sobreposição parcial',
  },
};

function FindingRow({ finding, index }: { finding: OverlapFinding; index: number }) {
  const cfg = typeConfig[finding.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      className="flex items-start gap-3 px-3.5 py-3 rounded-lg bg-secondary/40 border border-transparent hover:border-border transition-colors"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5", cfg.color, "bg-secondary")}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <code className="text-sm font-mono text-foreground">
            {finding.blockA.network}/{finding.blockA.prefix}
          </code>
          <span className="text-xs text-muted-foreground hidden sm:inline">↔</span>
          <code className="text-sm font-mono text-foreground">
            {finding.blockB.network}/{finding.blockB.prefix}
          </code>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {finding.type === 'duplicate' && `Linhas ${finding.blockA.index} e ${finding.blockB.index} — blocos idênticos`}
          {finding.type === 'contains' && `Linha ${finding.blockA.index} (/${finding.blockA.prefix}) contém linha ${finding.blockB.index} (/${finding.blockB.prefix})`}
          {finding.type === 'contained' && `Linha ${finding.blockA.index} (/${finding.blockA.prefix}) está contido em linha ${finding.blockB.index} (/${finding.blockB.prefix})`}
          {finding.type === 'overlap' && `Linhas ${finding.blockA.index} e ${finding.blockB.index} — sobreposição parcial de endereços`}
        </p>
      </div>
    </motion.div>
  );
}

function StatCard({ value, label, icon: Icon, variant = 'default' }: {
  value: number;
  label: string;
  icon: typeof CheckCircle2;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const variants = {
    default: 'bg-secondary/50 text-foreground',
    success: 'bg-primary/8 text-primary border-primary/20',
    warning: 'bg-amber-500/8 text-amber-400 border-amber-500/20',
    error: 'bg-destructive/8 text-destructive border-destructive/20',
  };

  return (
    <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", variants[variant])}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function OverlapView() {
  const [input, setInput] = useState('');
  const [report, setReport] = useState<OverlapReport | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const handleAnalyze = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error('Cole uma lista de blocos IPv6 em formato CIDR.');
      return;
    }

    const lines = trimmed.split('\n');
    const result = analyzeOverlaps(lines);
    setReport(result);
    setFilterType(null);

    if (result.findings.length === 0 && result.errors.length === 0) {
      toast.success('Nenhum conflito encontrado!');
    } else if (result.findings.length > 0) {
      toast.warning(`${result.findings.length} conflito(s) detectado(s)`);
    }
  };

  const handleReset = () => {
    setInput('');
    setReport(null);
    setFilterType(null);
  };

  const handleLoadExample = () => {
    setInput(EXAMPLE_BLOCKS);
    setReport(null);
  };

  const filteredFindings = report?.findings.filter(f =>
    filterType ? f.type === filterType : true
  ) ?? [];

  const hasIssues = report && (report.findings.length > 0 || report.errors.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <motion.div {...fadeUp}>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Verificador de Sobreposição
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cole uma lista de blocos IPv6 (CIDR) e detecte duplicatas, sobreposições e contenções.
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          className="bg-card border border-border rounded-xl p-5 space-y-4"
          {...fadeUp}
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Lista de Blocos (um por linha)
            </label>
            <button
              onClick={handleLoadExample}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <Clipboard className="w-3 h-3" /> Carregar exemplo
            </button>
          </div>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`2001:db8::/32\n2001:db8:1::/48\n2001:db8:2::/48\n# Linhas com # são ignoradas`}
            className={cn(
              "w-full min-h-[180px] rounded-lg bg-secondary/50 border border-border px-3.5 py-3",
              "text-sm font-mono text-foreground placeholder:text-muted-foreground/50",
              "resize-y focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
            )}
            spellCheck={false}
          />

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {input.trim()
                ? `${input.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length} bloco(s)`
                : 'Suporta comentários com # e linhas em branco'
              }
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="h-9 text-sm gap-2" disabled={!input && !report}>
                <RotateCcw className="w-3.5 h-3.5" /> Limpar
              </Button>
              <Button onClick={handleAnalyze} className="h-9 text-sm gap-2" disabled={!input.trim()}>
                <Search className="w-3.5 h-3.5" /> Analisar
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {report && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard value={report.stats.valid} label="Blocos válidos" icon={CheckCircle2} variant="default" />
                <StatCard value={report.stats.clean} label="Sem conflito" icon={ShieldCheck} variant="success" />
                <StatCard
                  value={report.stats.duplicates + report.stats.containments}
                  label="Dup. / Contenções"
                  icon={Layers}
                  variant={report.stats.duplicates + report.stats.containments > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  value={report.stats.overlaps}
                  label="Sobreposições"
                  icon={ShieldAlert}
                  variant={report.stats.overlaps > 0 ? 'error' : 'default'}
                />
              </div>

              {/* All clean banner */}
              {!hasIssues && (
                <motion.div
                  className="bg-primary/8 border border-primary/20 rounded-xl p-4 flex items-center gap-3"
                  {...fadeUp}
                >
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Nenhum conflito detectado</p>
                    <p className="text-xs text-muted-foreground">Todos os {report.stats.valid} blocos são independentes.</p>
                  </div>
                </motion.div>
              )}

              {/* Findings */}
              {report.findings.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-primary" />
                      Conflitos ({report.findings.length})
                    </h2>
                    {/* Filter chips */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setFilterType(null)}
                        className={cn(
                          "text-[11px] px-2 py-1 rounded-md transition-colors",
                          !filterType ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Todos
                      </button>
                      {['duplicate', 'contains', 'overlap'].map(type => {
                        const count = report.findings.filter(f =>
                          type === 'contains' ? (f.type === 'contains' || f.type === 'contained') : f.type === type
                        ).length;
                        if (count === 0) return null;
                        return (
                          <button
                            key={type}
                            onClick={() => setFilterType(filterType === type ? null : type)}
                            className={cn(
                              "text-[11px] px-2 py-1 rounded-md transition-colors",
                              filterType === type ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {typeConfig[type].label} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {filteredFindings.map((finding, i) => (
                      <FindingRow key={`${finding.blockA.index}-${finding.blockB.index}-${finding.type}`} finding={finding} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Parse errors */}
              {report.errors.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    Erros de parsing ({report.errors.length})
                  </h2>
                  <div className="space-y-1">
                    {report.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
                        <span className="text-muted-foreground shrink-0">Linha {err.line}:</span>
                        <code className="font-mono text-destructive truncate">{err.text}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy report */}
              {report.findings.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      const lines = report.findings.map(f =>
                        `[${typeConfig[f.type].label}] ${f.blockA.network}/${f.blockA.prefix} ↔ ${f.blockB.network}/${f.blockB.prefix}`
                      );
                      copyToClipboard(lines.join('\n'));
                    }}
                  >
                    <Copy className="w-3 h-3" /> Copiar relatório
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
