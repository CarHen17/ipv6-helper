import { useState, useMemo } from 'react';
import { useCalculator } from '@/hooks/useCalculatorState';
import { StepIndicator } from './StepIndicator';
import { shortenIPv6, COMMON_PREFIXES, isValidIPv6Address, IPV6_CONFIG, type SubnetData, type ComparisonResult } from '@/lib/ipv6-utils';
import { exportToCSV, exportToTXT, exportToJSON, exportToExcel, exportSubnetsToCSV } from '@/lib/export-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calculator, Search, Copy, Download, ChevronDown, X,
  List, Plus, RotateCcw, Info, Layers, ArrowLeftRight, TriangleAlert,
  FileText, FileSpreadsheet, FileCode, Loader2, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STEPS = [
  { label: 'Inserir IPv6' },
  { label: 'Escolher Prefixo' },
  { label: 'Gerenciar Sub-redes' },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar para a área de transferência')
  );
}

export function CalculatorView() {
  const ctx = useCalculator();
  const [searchQuery, setSearchQuery] = useState('');
  const [reverseSearchIp, setReverseSearchIp] = useState('');
  const [reverseResult, setReverseResult] = useState<{ found: boolean; subnet?: SubnetData; index?: number; error?: string } | null>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<'main' | 'subnet' | 'aggregated'>('main');
  const [exportFilename, setExportFilename] = useState('ips_ipv6');
  const [subnetIpsModalOpen, setSubnetIpsModalOpen] = useState(false);
  const [confirmPrefix, setConfirmPrefix] = useState<{ prefix: number; count: bigint } | null>(null);

  const filteredSubnets = useMemo((): { subnet: SubnetData; realIdx: number }[] => {
    if (!searchQuery) {
      return ctx.subRedesGeradas
        .slice(0, ctx.displayedCount)
        .map((subnet, i) => ({ subnet, realIdx: i }));
    }
    const q = searchQuery.toLowerCase();
    const result: { subnet: SubnetData; realIdx: number }[] = [];
    for (let i = 0; i < ctx.subRedesGeradas.length && result.length < 200; i++) {
      const s = ctx.subRedesGeradas[i];
      if (
        s.subnet.toLowerCase().includes(q) ||
        s.initial.toLowerCase().includes(q) ||
        s.final.toLowerCase().includes(q) ||
        s.network.toLowerCase().includes(q)
      ) {
        result.push({ subnet: s, realIdx: i });
      }
    }
    return result;
  }, [searchQuery, ctx.subRedesGeradas, ctx.displayedCount]);

  const handleCalcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = ctx.calcularSubRedes();
    if (ok) toast.success('Bloco IPv6 processado com sucesso');
  };

  const handleReverseSearch = () => {
    if (!reverseSearchIp.trim()) return;
    if (!isValidIPv6Address(reverseSearchIp.trim())) {
      setReverseResult({ found: false, error: 'Endereço IPv6 inválido' });
      return;
    }
    const result = ctx.reverseSearch(reverseSearchIp.trim());
    setReverseResult(result);
  };

  const handleExport = (format: string) => {
    let ips: { ip: string; number: number }[] = [];
    if (exportTarget === 'main') ips = ctx.mainBlockIps;
    else if (exportTarget === 'subnet') ips = ctx.subnetIps;
    else if (exportTarget === 'aggregated') ips = ctx.aggregatedIps;

    const fn = exportFilename.replace(/[\\/:*?"<>|]/g, '_').replace(/\.(csv|xlsx?|txt|json)$/i, '') || 'ips_ipv6';

    switch (format) {
      case 'csv': exportToCSV(ips, fn); break;
      case 'excel': exportToExcel(ips, fn); break;
      case 'txt': exportToTXT(ips, fn); break;
      case 'json': exportToJSON(ips, fn); break;
    }
    setExportModalOpen(false);
    toast.success(`Arquivo ${format.toUpperCase()} exportado com sucesso!`);
  };

  const handleGenerateSubnetIps = () => {
    ctx.generateSubnetIps();
    setSubnetIpsModalOpen(true);
  };

  const sidebarBlockDisplay = ctx.sidebarBlock
    ? `${shortenIPv6(ctx.sidebarBlock.network)}/${ctx.sidebarBlock.prefix}`
    : '';

  const handleStepClick = (step: number) => {
    if (step < ctx.currentStep) {
      if (step === 1) {
        ctx.resetCalculadora();
      } else {
        ctx.goBackToStep(step);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header with inline step indicator */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Calculadora de Sub-redes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Divisão e gerenciamento de blocos IPv6</p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[320px]">
          <StepIndicator currentStep={ctx.currentStep} steps={STEPS} onStepClick={handleStepClick} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-6">
          {/* Step 1: Input */}
          <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6" layout>
            <form onSubmit={handleCalcSubmit}>
              <label className="block text-sm font-medium text-foreground mb-3">
                Insira um endereço IPv6 no formato CIDR:
              </label>
              <div className="flex gap-3">
                <Input
                  value={ctx.ipv6Input}
                  onChange={e => ctx.setIpv6Input(e.target.value)}
                  placeholder="Ex.: 2001:db8::/41"
                  className={cn(
                    "font-mono text-sm bg-secondary/60 border-border/60 flex-1 h-11",
                    ctx.errorMessage && "animate-shake border-destructive"
                  )}
                />
                <Button type="submit" className="gap-2 h-11 px-5 text-sm">
                  <Calculator className="w-4 h-4" />
                  <span className="hidden sm:inline">Calcular</span>
                </Button>
              </div>
              <AnimatePresence>
                {ctx.errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                  >
                    <p>{ctx.errorMessage}</p>
                    {ctx.errorSuggestion && (
                      <p className="text-sm mt-1 opacity-70">💡 {ctx.errorSuggestion}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* Step 2: Prefix Selection */}
          <AnimatePresence>
            {ctx.currentStep === 2 && ctx.mainBlock && (
              <motion.div {...fadeUp} className="bg-card rounded-xl border border-border p-5 md:p-6">
                <h3 className="text-sm font-medium text-foreground mb-4">Escolha o prefixo para divisão:</h3>
                <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-11 gap-1">
                  {Array.from({ length: 128 - ctx.mainBlock.prefix }, (_, i) => ctx.mainBlock!.prefix + 1 + i).map(prefix => {
                    const isCommon = COMMON_PREFIXES[prefix];
                    return (
                      <button
                        key={prefix}
                         onClick={() => {
                           const count = ctx.getSubnetCount(prefix);
                           if (count && count > IPV6_CONFIG.LARGE_SUBNET_THRESHOLD) {
                             setConfirmPrefix({ prefix, count });
                           } else {
                             ctx.selecionarPrefixo(prefix);
                           }
                         }}
                        className={cn(
                          "py-1.5 rounded text-[11px] font-mono font-medium transition-all duration-150 border text-center",
                          isCommon
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/25"
                            : "border-border/30 bg-secondary/40 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                        )}
                        title={isCommon || undefined}
                      >
                        /{prefix}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          <AnimatePresence>
            {ctx.isLoading && (
              <motion.div {...fadeUp} className="bg-card rounded-xl border border-border p-8 flex flex-col items-center gap-4">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando sub-redes ({ctx.loadingProgress}%)...</p>
                <div className="w-full max-w-xs h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${ctx.loadingProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Results Table */}
          <AnimatePresence>
            {ctx.subRedesGeradas.length > 0 && !ctx.isLoading && (
              <motion.div {...fadeUp} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Table header bar */}
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-medium text-foreground">Sub-redes</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold tabular-nums">
                      {ctx.subRedesGeradas.length.toLocaleString('pt-BR')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1.5 h-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleStepClick(2)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Novo cálculo
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filtrar..."
                        className="pl-8 h-8 text-xs w-40 bg-secondary/50 border-border/40"
                      />
                    </div>
                    {ctx.selectedIndices.size === 1 && (
                      <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={handleGenerateSubnetIps}>
                        <List className="w-3.5 h-3.5" /> IPs
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setReverseOpen(true)}
                      title="Busca reversa"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 h-8"
                      onClick={() => {
                        exportSubnetsToCSV(
                          searchQuery ? filteredSubnets.map(f => f.subnet) : ctx.subRedesGeradas
                        );
                        toast.success('Sub-redes exportadas como CSV');
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                      <tr>
                        <th className="p-3 w-10">
                          <input
                            type="checkbox"
                            checked={ctx.selectedIndices.size === ctx.subRedesGeradas.length && ctx.subRedesGeradas.length > 0}
                            onChange={ctx.toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                         <th className="p-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Sub-rede</th>
                         <th className="p-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Inicial</th>
                         <th className="p-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Final</th>
                         <th className="p-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Rede</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredSubnets.map(({ subnet, realIdx }) => {
                        const isSelected = ctx.selectedIndices.has(realIdx);
                        const isIndividual = ctx.individualSelectedIndex === realIdx;

                        return (
                          <tr
                            key={realIdx}
                            className={cn(
                              "cursor-pointer transition-colors duration-100",
                              isSelected && "bg-primary/8",
                              isIndividual && "bg-accent/10 border-l-2 border-l-primary",
                              !isSelected && !isIndividual && "hover:bg-secondary/30"
                            )}
                            onClick={() => ctx.selectIndividual(realIdx)}
                          >
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => ctx.toggleSelect(realIdx)}
                                className="rounded"
                              />
                            </td>
                             <td className="p-3 font-mono text-sm text-primary">{shortenIPv6(subnet.subnet)}</td>
                             <td className="p-3 font-mono text-sm text-foreground/80">{shortenIPv6(subnet.initial)}</td>
                             <td className="p-3 font-mono text-sm text-foreground/80">{shortenIPv6(subnet.final)}</td>
                             <td className="p-3 font-mono text-sm text-foreground/60">{shortenIPv6(subnet.network)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Load more */}
                {!searchQuery && ctx.displayedCount < ctx.subRedesGeradas.length && (
                  <div className="p-3 border-t border-border/40 text-center">
                    <Button variant="ghost" size="sm" onClick={ctx.loadMore} className="gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <ChevronDown className="w-3.5 h-3.5" />
                      Carregar mais ({(ctx.subRedesGeradas.length - ctx.displayedCount).toLocaleString('pt-BR')} restantes)
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar - Block Info */}
        <div className="space-y-6">
          <AnimatePresence>
            {ctx.mainBlock && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-xl border border-border p-5 sticky top-16"
              >
                 <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                   <Info className="w-4 h-4 text-primary" />
                   {ctx.individualSelectedIndex !== null ? (
                     <span className="text-[hsl(var(--success))]">Bloco Selecionado</span>
                   ) : (
                     'Informações do Bloco'
                   )}
                 </h3>

                <div className="space-y-3">
                  <InfoRow label="CIDR" value={sidebarBlockDisplay} onCopy={() => copyToClipboard(sidebarBlockDisplay)} />
                  <InfoRow label="Gateway" value={ctx.sidebarGateway} onCopy={() => copyToClipboard(ctx.sidebarGateway)} />
                </div>

                {/* Main block IPs toggle */}
                {ctx.individualSelectedIndex === null && (
                  <div className="mt-5 space-y-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 text-xs"
                      onClick={ctx.toggleMainBlockIps}
                    >
                      {ctx.mainBlockIpsVisible ? <X className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                      {ctx.mainBlockIpsVisible ? 'Fechar IPs' : 'Exibir IPs'}
                    </Button>

                    <AnimatePresence>
                      {ctx.mainBlockIpsVisible && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <div className="flex gap-1 mb-2">
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1 h-7" onClick={ctx.generateMoreMainBlockIps}>
                              <Plus className="w-3 h-3" /> +50
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1 h-7" onClick={ctx.resetMainBlockIps}>
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1 h-7" onClick={() => { setExportTarget('main'); setExportModalOpen(true); }}>
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                          <IPList ips={ctx.mainBlockIps} onCopy={copyToClipboard} maxHeight="300px" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Aggregation */}
                <AnimatePresence>
                  {ctx.aggregationResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 pt-5 border-t border-border/40"
                    >
                      {ctx.aggregationResult.canAggregate ? (
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                            <Layers className="w-4 h-4 text-primary" /> Bloco Agregado
                          </h4>
                          <div className="space-y-2">
                            <InfoRow label="CIDR" value={ctx.aggregationResult.aggregatedBlock!.subnet} onCopy={() => copyToClipboard(ctx.aggregationResult!.aggregatedBlock!.subnet)} />
                            <InfoRow label="Rede" value={ctx.aggregationResult.aggregatedBlock!.network} onCopy={() => copyToClipboard(ctx.aggregationResult!.aggregatedBlock!.network)} />
                            <p className="text-sm text-muted-foreground">
                              {ctx.aggregationResult.aggregatedBlock!.blockCount} blocos originais
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="w-full mt-3 gap-1 text-xs" onClick={ctx.toggleAggregatedIps}>
                            {ctx.aggregatedIpsVisible ? <X className="w-3 h-3" /> : <List className="w-3 h-3" />}
                            {ctx.aggregatedIpsVisible ? 'Fechar IPs' : 'Exibir IPs'}
                          </Button>
                          <AnimatePresence>
                            {ctx.aggregatedIpsVisible && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2">
                                <div className="flex gap-1 mb-2">
                                  <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1 h-7" onClick={ctx.generateMoreAggregatedIps}>
                                    <Plus className="w-3 h-3" /> +50
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1 h-7" onClick={ctx.resetAggregatedIps}>
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                </div>
                                <IPList ips={ctx.aggregatedIps} onCopy={copyToClipboard} maxHeight="250px" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : ctx.comparisonResult ? (
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                            <ArrowLeftRight className="w-4 h-4 text-primary" /> Comparação
                          </h4>
                          <ComparisonInfo result={ctx.comparisonResult} reason={ctx.aggregationResult.reason} />
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 text-sm">
                          <TriangleAlert className="w-4 h-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-[hsl(var(--warning))] text-sm">Agregação não possível</p>
                            <p className="text-sm text-muted-foreground mt-1">{ctx.aggregationResult.reason}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reverse Search Dialog */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Busca Reversa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Encontre a qual sub-rede um endereço IPv6 pertence.</p>
            <div className="flex gap-2">
              <Input
                value={reverseSearchIp}
                onChange={e => setReverseSearchIp(e.target.value)}
                placeholder="Ex.: 2001:db8::1"
                className="font-mono bg-secondary/60 flex-1"
                onKeyDown={e => e.key === 'Enter' && handleReverseSearch()}
              />
              <Button onClick={handleReverseSearch} size="sm" className="gap-1.5">
                <Search className="w-4 h-4" /> Buscar
              </Button>
            </div>
            {reverseResult && (
              <div className={cn(
                "p-3 rounded-lg text-sm",
                reverseResult.found ? "bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20 text-[hsl(var(--success))]" :
                reverseResult.error ? "bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]" :
                "bg-muted text-muted-foreground"
              )}>
                {reverseResult.found
                  ? `Encontrado na sub-rede: ${shortenIPv6(reverseResult.subnet?.subnet ?? '')} (índice ${(reverseResult.index ?? 0) + 1})`
                  : reverseResult.error || 'Endereço não encontrado nas sub-redes geradas'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Subnet IPs Dialog */}
      <Dialog open={subnetIpsModalOpen && ctx.subnetIpsVisible && !!ctx.subnetIpsBlock} onOpenChange={(open) => { if (!open) { setSubnetIpsModalOpen(false); ctx.resetSubnetIps(); } }}>
        <DialogContent className="bg-card border-border max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <List className="w-4 h-4 text-primary" />
              IPs da Sub-rede: <code className="text-primary text-xs font-mono">{ctx.subnetIpsBlock ? shortenIPv6(ctx.subnetIpsBlock.subnet) : ''}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2 shrink-0">
            <Button size="sm" variant="outline" onClick={ctx.generateMoreSubnetIps} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> +50
            </Button>
            <Button size="sm" variant="outline" onClick={() => { ctx.resetSubnetIps(); ctx.generateSubnetIps(); }} className="gap-1 text-xs h-7">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setExportTarget('subnet'); setExportModalOpen(true); }} className="gap-1 text-xs h-7">
              <Download className="w-3 h-3" /> Exportar
            </Button>
            <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{ctx.subnetIps.length} IPs</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-secondary/30 p-1">
            {ctx.subnetIps.map(item => (
              <div key={item.number} className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-secondary/60 group transition-colors">
                <span className="text-[10px] text-muted-foreground w-7 text-right shrink-0 tabular-nums">{item.number}</span>
                <code className="text-xs font-mono text-foreground/90 flex-1 truncate">{item.ip}</code>
                <button
                  onClick={() => copyToClipboard(item.ip)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
                >
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" /> Exportar Lista de IPs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {exportTarget === 'main' && `${ctx.mainBlockIps.length} endereços IPv6`}
              {exportTarget === 'subnet' && `${ctx.subnetIps.length} endereços IPv6`}
              {exportTarget === 'aggregated' && `${ctx.aggregatedIps.length} endereços IPv6`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { format: 'csv', icon: FileText, label: 'CSV', desc: 'Planilha por vírgulas' },
                { format: 'excel', icon: FileSpreadsheet, label: 'Excel', desc: 'Microsoft Excel' },
                { format: 'txt', icon: FileText, label: 'TXT', desc: 'Lista simples' },
                { format: 'json', icon: FileCode, label: 'JSON', desc: 'Dados estruturados' },
              ].map(opt => (
                <button
                  key={opt.format}
                  onClick={() => handleExport(opt.format)}
                  className="flex flex-col items-center p-4 rounded-lg border border-border/60 bg-secondary/40 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 gap-2"
                >
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do arquivo:</label>
              <Input value={exportFilename} onChange={e => setExportFilename(e.target.value)} className="bg-secondary/60" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Large subnet confirmation dialog */}
      <Dialog open={!!confirmPrefix} onOpenChange={(open) => { if (!open) setConfirmPrefix(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
              Grande quantidade de sub-redes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O prefixo <code className="font-mono text-primary">/{confirmPrefix?.prefix}</code> gerará{' '}
              <span className="font-semibold text-foreground">{confirmPrefix?.count?.toLocaleString('pt-BR')}</span> sub-redes.
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
              <Info className="w-4 h-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Por questões de desempenho, apenas <span className="font-medium text-foreground">{IPV6_CONFIG.MAX_SUBNETS_GENERATION.toLocaleString('pt-BR')}</span> sub-redes serão geradas como amostra.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setConfirmPrefix(null)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 text-xs h-8" onClick={() => {
                if (confirmPrefix) {
                  ctx.selecionarPrefixo(confirmPrefix.prefix, true);
                }
                setConfirmPrefix(null);
              }}>
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 group">
      <span className="text-xs text-muted-foreground shrink-0 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <code className="text-sm font-mono text-foreground truncate">{value}</code>
        <button onClick={onCopy} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all shrink-0">
          <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
        </button>
      </div>
    </div>
  );
}

function IPList({ ips, onCopy, maxHeight = '400px' }: { ips: { ip: string; number: number }[]; onCopy: (ip: string) => void; maxHeight?: string }) {
  return (
    <div className="overflow-y-auto space-y-px rounded-lg bg-secondary/30 p-1" style={{ maxHeight }}>
      {ips.map(item => (
        <div key={item.number} className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-secondary/60 group transition-colors">
          <span className="text-xs text-muted-foreground w-7 text-right shrink-0 tabular-nums">{item.number}</span>
          <code className="text-sm font-mono text-foreground/90 flex-1 truncate">{item.ip}</code>
          <button
            onClick={() => onCopy(item.ip)}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ComparisonInfo({ result, reason }: { result: ComparisonResult; reason: string }) {
  const labels: Record<string, string> = {
    identical: 'Os blocos são idênticos',
    b2_in_b1: 'Bloco B está contido em Bloco A',
    b1_in_b2: 'Bloco A está contido em Bloco B',
    overlap: 'Os blocos têm sobreposição parcial',
    disjoint: 'Os blocos são disjuntos (sem sobreposição)',
    error: 'Erro ao comparar blocos',
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-foreground">{labels[result.relationship] || 'Relação desconhecida'}</p>
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
        <TriangleAlert className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}
