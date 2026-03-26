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

function FindingRow({ finding }: { finding: OverlapFinding }) {
  const cfg = typeConfig[finding.type];

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
      <td className="py-2 px-3">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", cfg.textClass)}>{cfg.label}</span>
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
        {finding.blockA.index} ↔ {finding.blockB.index}
      </td>
      <td className="py-2 px-3">
        <code className="text-xs font-mono text-foreground">{finding.blockA.network}/{finding.blockA.prefix}</code>
      </td>
      <td className="py-2 px-3">
        <code className="text-xs font-mono text-foreground">{finding.blockB.network}/{finding.blockB.prefix}</code>
      </td>
      <td className="py-2 px-2">
        <button
          onClick={() => copyToClipboard(`${finding.blockA.network}/${finding.blockA.prefix} ↔ ${finding.blockB.network}/${finding.blockB.prefix}`)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Copiar"
        >
          <Copy className="w-3 h-3" />
        </button>
      </td>
    </tr>
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
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight text-foreground">{value}</p>
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
    if (!trimmed) { toast.error('Cole uma lista de blocos IPv6 em formato CIDR.'); return; }
    const lines = trimmed.split('\n');
    const result = analyzeOverlaps(lines);
    setReport(result);
    setFilterType(null);
    if (result.findings.length === 0 && result.errors.length === 0) toast.success('Nenhum conflito encontrado!');
    else if (result.findings.length > 0) toast.warning(`${result.findings.length} conflito(s) detectado(s)`);
  };

  const handleReset = () => { setInput(''); setReport(null); setFilterType(null); };
  const handleLoadExample = () => { setInput(EXAMPLE_BLOCKS); setReport(null); };

  const filteredFindings = report?.findings.filter(f =>
    filterType
      ? filterType === 'contains' ? f.type === 'contains' || f.type === 'contained' : f.type === filterType
      : true
  ) ?? [];

  const hasIssues = report && (report.findings.length > 0 || report.errors.length > 0);
  const blockCount = input.trim()
    ? input.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length
    : 0;

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Verificador de Sobreposição
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cole uma lista de blocos IPv6 (CIDR) e detecte duplicatas, sobreposições e contenções.
        </p>
      </div>

      <div className="space-y-6">
        {/* Input Card */}
        <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4" {...fadeUp}>
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

          <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {blockCount > 0 ? `${blockCount} bloco(s) para analisar` : 'Suporta comentários com # e linhas em branco'}
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={handleReset} className="gap-2 h-10 text-sm flex-1 sm:flex-none" disabled={!input && !report}>
                <RotateCcw className="w-4 h-4" /> Limpar
              </Button>
              <Button onClick={handleAnalyze} className="gap-2 h-10 px-5 text-sm flex-1 sm:flex-none" disabled={!input.trim()}>
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
              {/* Stats */}
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

              {/* All clean */}
              {!hasIssues && (
                <motion.div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-3" {...fadeUp}>
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
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {[
                        { key: null, label: 'Todos' },
                        { key: 'duplicate', label: 'Duplicados' },
                        { key: 'contains', label: 'Contenções' },
                        { key: 'overlap', label: 'Sobreposições' },
                      ].map(filter => {
                        const count = filter.key === null
                          ? report.findings.length
                          : report.findings.filter(f =>
                              filter.key === 'contains' ? f.type === 'contains' || f.type === 'contained' : f.type === filter.key
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

                  <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 px-3 font-medium">Tipo</th>
                          <th className="py-2 px-3 font-medium">Linhas</th>
                          <th className="py-2 px-3 font-medium">Bloco A</th>
                          <th className="py-2 px-3 font-medium">Bloco B</th>
                          <th className="py-2 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFindings.map((finding) => (
                          <FindingRow key={`${finding.blockA.index}-${finding.blockB.index}-${finding.type}`} finding={finding} />
                        ))}
                      </tbody>
                    </table>
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

              {/* Collapsible legend/tips */}
              <details className="bg-card rounded-xl border border-border">
                <summary className="px-5 py-3.5 cursor-pointer flex items-center gap-2 text-sm font-medium text-foreground select-none hover:bg-secondary/30 rounded-xl transition-colors">
                  <Info className="w-4 h-4 text-primary" />
                  Legenda e dicas
                </summary>
                <div className="px-5 pb-4 text-xs text-muted-foreground border-t border-border pt-3 space-y-3">
                  <div className="space-y-2">
                    {[
                      { type: 'duplicate', desc: 'Blocos com endereço e prefixo idênticos' },
                      { type: 'contains', desc: 'Um bloco maior engloba outro menor' },
                      { type: 'overlap', desc: 'Faixas de endereços se sobrepõem parcialmente' },
                    ].map(item => {
                      const cfg = typeConfig[item.type];
                      const Icon = cfg.icon;
                      return (
                        <div key={item.type} className="flex items-center gap-2.5">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-secondary", cfg.textClass)}>
                            <Icon className="w-3 h-3" />
                          </div>
                          <span><span className={cn("font-semibold", cfg.textClass)}>{cfg.label}:</span> {item.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                  <ul className="list-disc list-inside space-y-1 pt-1">
                    <li>Use um bloco por linha no formato CIDR</li>
                    <li>Linhas com <span className="font-mono text-primary">#</span> ou <span className="font-mono text-primary">//</span> são ignoradas</li>
                    <li>Contenções são comuns em hierarquias — não necessariamente um erro</li>
                    <li>Sobreposições parciais geralmente indicam erro de alocação</li>
                  </ul>
                </div>
              </details>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
