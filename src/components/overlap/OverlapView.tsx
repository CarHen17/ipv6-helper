import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, ShieldAlert, Search, Copy, RotateCcw,
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

const typeConfig: Record<string, { label: string; bgClass: string; borderClass: string; textClass: string; icon: typeof AlertTriangle }> = {
  duplicate: {
    label: 'Duplicado',
    bgClass: 'bg-muted/50',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    icon: Layers,
  },
  contains: {
    label: 'Contém',
    bgClass: 'bg-primary/5',
    borderClass: 'border-primary/15',
    textClass: 'text-primary',
    icon: ChevronDown,
  },
  contained: {
    label: 'Contido',
    bgClass: 'bg-primary/5',
    borderClass: 'border-primary/15',
    textClass: 'text-primary',
    icon: ChevronDown,
  },
  overlap: {
    label: 'Sobreposição',
    bgClass: 'bg-destructive/5',
    borderClass: 'border-destructive/15',
    textClass: 'text-destructive',
    icon: AlertTriangle,
  },
};

function FindingRow({ finding, index }: { finding: OverlapFinding; index: number }) {
  const cfg = typeConfig[finding.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-3 border transition-colors",
        cfg.bgClass, cfg.borderClass
      )}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary", cfg.textClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", cfg.textClass)}>
            {cfg.label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            — Linhas {finding.blockA.index} e {finding.blockB.index}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-mono font-medium text-foreground">
            {finding.blockA.network}/{finding.blockA.prefix}
          </code>
          <span className="text-xs text-muted-foreground">↔</span>
          <code className="text-sm font-mono font-medium text-foreground">
            {finding.blockB.network}/{finding.blockB.prefix}
          </code>
        </div>
      </div>
      <button
        onClick={() => copyToClipboard(`${finding.blockA.network}/${finding.blockA.prefix} ↔ ${finding.blockB.network}/${finding.blockB.prefix}`)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        title="Copiar"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
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
    default: 'bg-card border-border',
    success: 'bg-primary/5 border-primary/20',
    warning: 'bg-muted border-border',
    error: 'bg-destructive/5 border-destructive/20',
  };
  const iconVariants = {
    default: 'text-foreground',
    success: 'text-primary',
    warning: 'text-muted-foreground',
    error: 'text-destructive',
  };

  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-3", variants[variant])}>
      <div className={cn("w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0", iconVariants[variant])}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
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
    filterType
      ? filterType === 'contains'
        ? f.type === 'contains' || f.type === 'contained'
        : f.type === filterType
      : true
  ) ?? [];

  const hasIssues = report && (report.findings.length > 0 || report.errors.length > 0);
  const blockCount = input.trim()
    ? input.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length
    : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Verificador de Sobreposição
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cole uma lista de blocos IPv6 (CIDR) e detecte duplicatas, sobreposições e contenções.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Main column */}
        <div className="space-y-6">
          {/* Input Card */}
          <motion.div
            className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4"
            {...fadeUp}
          >
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">
                Lista de blocos (um por linha)
              </label>
              <button
                onClick={handleLoadExample}
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 font-medium"
              >
                <Clipboard className="w-3.5 h-3.5" /> Carregar exemplo
              </button>
            </div>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`2001:db8::/32\n2001:db8:1::/48\n2001:db8:2::/48\n# Linhas com # são ignoradas`}
              className={cn(
                "w-full min-h-[200px] rounded-lg bg-secondary/60 border border-border/60 px-4 py-3",
                "text-sm font-mono text-foreground placeholder:text-muted-foreground/50",
                "resize-y focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
              )}
              spellCheck={false}
            />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {blockCount > 0
                  ? `${blockCount} bloco(s) para analisar`
                  : 'Suporta comentários com # e linhas em branco'
                }
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="gap-2 h-11 text-sm" disabled={!input && !report}>
                  <RotateCcw className="w-4 h-4" /> Limpar
                </Button>
                <Button onClick={handleAnalyze} className="gap-2 h-11 px-5 text-sm" disabled={!input.trim()}>
                  <Search className="w-4 h-4" /> Analisar
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            {report && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-3"
                    {...fadeUp}
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Nenhum conflito detectado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Todos os {report.stats.valid} blocos são independentes.</p>
                    </div>
                  </motion.div>
                )}

                {/* Findings */}
                {report.findings.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-primary" />
                        Conflitos ({report.findings.length})
                      </h2>
                      {/* Filter chips */}
                      <div className="flex gap-1.5">
                        {[
                          { key: null, label: 'Todos' },
                          { key: 'duplicate', label: 'Duplicados' },
                          { key: 'contains', label: 'Contenções' },
                          { key: 'overlap', label: 'Sobreposições' },
                        ].map(filter => {
                          const count = filter.key === null
                            ? report.findings.length
                            : report.findings.filter(f =>
                                filter.key === 'contains'
                                  ? f.type === 'contains' || f.type === 'contained'
                                  : f.type === filter.key
                              ).length;
                          if (filter.key !== null && count === 0) return null;
                          return (
                            <button
                              key={filter.key ?? 'all'}
                              onClick={() => setFilterType(filter.key)}
                              className={cn(
                                "text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium",
                                filterType === filter.key
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {filter.label}{filter.key !== null ? ` (${count})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[450px] overflow-y-auto">
                      {filteredFindings.map((finding, i) => (
                        <FindingRow key={`${finding.blockA.index}-${finding.blockB.index}-${finding.type}`} finding={finding} index={i} />
                      ))}
                    </div>

                    <div className="flex justify-end pt-1">
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
                  </div>
                )}

                {/* Parse errors */}
                {report.errors.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Erros de parsing ({report.errors.length})
                    </h2>
                    <div className="space-y-1.5">
                      {report.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                          <span className="text-muted-foreground shrink-0 font-medium">Linha {err.line}:</span>
                          <code className="font-mono text-destructive truncate">{err.text}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Legend */}
          <motion.div
            className="bg-card rounded-xl border border-border p-5"
            {...fadeUp}
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              Legenda
            </h3>
            <div className="space-y-2.5 text-xs">
              {[
                { type: 'duplicate', desc: 'Blocos com endereço e prefixo idênticos' },
                { type: 'contains', desc: 'Um bloco maior engloba outro menor' },
                { type: 'overlap', desc: 'Faixas de endereços se sobrepõem parcialmente' },
              ].map(item => {
                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                return (
                  <div key={item.type} className="flex items-start gap-2.5">
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-secondary mt-0.5", cfg.textClass)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div>
                      <span className={cn("font-semibold", cfg.textClass)}>{cfg.label}</span>
                      <p className="text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Tips */}
          <motion.div
            className="bg-card rounded-xl border border-border p-5"
            {...fadeUp}
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">Dicas</h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
              <li>Use um bloco por linha no formato CIDR</li>
              <li>Linhas com <span className="font-mono text-primary">#</span> ou <span className="font-mono text-primary">//</span> são ignoradas</li>
              <li>Contenções são comuns em hierarquias — não necessariamente um erro</li>
              <li>Sobreposições parciais geralmente indicam erro de alocação</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
