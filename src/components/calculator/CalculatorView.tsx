import { useState, useMemo } from 'react';
import { useCalculator } from '@/hooks/useCalculatorState';
import { StepIndicator } from './StepIndicator';
import { shortenIPv6, COMMON_PREFIXES, isValidIPv6Address, type SubnetData } from '@/lib/ipv6-utils';
import { exportToCSV, exportToTXT, exportToJSON, exportToExcel, exportSubnetsToCSV } from '@/lib/export-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calculator, Search, Copy, Download, ChevronDown, Check, X,
  List, Plus, RotateCcw, Info, Layers, ArrowLeftRight, TriangleAlert,
  FileText, FileSpreadsheet, FileCode, FileDown, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STEPS = [
  { label: 'Inserir IPv6' },
  { label: 'Escolher Prefixo' },
  { label: 'Gerenciar Sub-redes' },
];

export function CalculatorView() {
  const ctx = useCalculator();
  const [searchQuery, setSearchQuery] = useState('');
  const [reverseSearchIp, setReverseSearchIp] = useState('');
  const [reverseResult, setReverseResult] = useState<{ found: boolean; subnet?: SubnetData; index?: number; error?: string } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<'main' | 'subnet' | 'aggregated'>('main');
  const [exportFilename, setExportFilename] = useState('ips_ipv6');

  const filteredSubnets = useMemo(() => {
    if (!searchQuery) return ctx.subRedesGeradas.slice(0, ctx.displayedCount);
    return ctx.filterSubnets(searchQuery).slice(0, 200);
  }, [searchQuery, ctx.subRedesGeradas, ctx.displayedCount, ctx.filterSubnets]);

  const handleCalcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = ctx.calcularSubRedes();
    if (ok) toast.success('Bloco IPv6 processado com sucesso');
  };

  const handleReverseSearch = () => {
    if (!reverseSearchIp.trim()) return;
    if (!isValidIPv6Address(reverseSearchIp.trim())) {
      setReverseResult({ error: 'Endereço IPv6 inválido' });
      return;
    }
    const result = ctx.reverseSearch(reverseSearchIp.trim());
    setReverseResult(result);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copiado!'));
  };

  const handleExport = (format: string) => {
    let ips: { ip: string; number: number }[] = [];
    if (exportTarget === 'main') ips = ctx.mainBlockIps;
    else if (exportTarget === 'subnet') ips = ctx.subnetIps;
    else if (exportTarget === 'aggregated') ips = ctx.aggregatedIps;

    const fn = exportFilename.replace(/[\\/:*?"<>|]/g, '_').replace(/\.(csv|xlsx?|txt|json)$/i, '');

    switch (format) {
      case 'csv': exportToCSV(ips, fn); break;
      case 'excel': exportToExcel(ips, fn); break;
      case 'txt': exportToTXT(ips, fn); break;
      case 'json': exportToJSON(ips, fn); break;
    }
    setExportModalOpen(false);
    toast.success(`Arquivo ${format.toUpperCase()} exportado com sucesso!`);
  };

  const sidebarBlockDisplay = ctx.sidebarBlock
    ? `${shortenIPv6(ctx.sidebarBlock.network)}/${ctx.sidebarBlock.prefix}`
    : '';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calculadora de Sub-redes</h1>
        <p className="text-sm text-muted-foreground mt-1">Divisão e gerenciamento de blocos IPv6</p>
      </div>

      {/* Step Indicator */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <StepIndicator currentStep={ctx.currentStep} steps={STEPS} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {/* Step 1: Input */}
          <motion.div className="bg-card rounded-xl border border-border p-6" layout>
            <form onSubmit={handleCalcSubmit}>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Insira um endereço IPv6 no formato CIDR:
              </label>
              <div className="flex gap-3">
                <Input
                  value={ctx.ipv6Input}
                  onChange={e => ctx.setIpv6Input(e.target.value)}
                  placeholder="Ex.: 2001:db8::/41"
                  className={cn(
                    "font-mono bg-secondary border-border flex-1",
                    ctx.errorMessage && "animate-shake border-destructive"
                  )}
                />
                <Button type="submit" className="gap-2">
                  <Calculator className="w-4 h-4" />
                  Calcular Sub-redes
                </Button>
              </div>
              <AnimatePresence>
                {ctx.errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
                  >
                    <p>{ctx.errorMessage}</p>
                    {ctx.errorSuggestion && (
                      <p className="text-xs mt-1 opacity-80">💡 {ctx.errorSuggestion}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* Step 2: Prefix Selection */}
          <AnimatePresence>
            {ctx.currentStep >= 2 && ctx.mainBlock && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4">Escolha o prefixo para divisão:</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 128 - ctx.mainBlock.prefix }, (_, i) => ctx.mainBlock!.prefix + 1 + i).map(prefix => {
                    const isCommon = COMMON_PREFIXES[prefix];
                    return (
                      <button
                        key={prefix}
                        onClick={() => ctx.selecionarPrefixo(prefix)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all duration-200 border",
                          isCommon
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border bg-secondary text-secondary-foreground hover:border-primary/30 hover:bg-primary/5"
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-4"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando sub-redes ({ctx.loadingProgress}%)...</p>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
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
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                {/* Table header bar */}
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Sub-redes Geradas</h3>
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                      {ctx.subRedesGeradas.length.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filtrar..."
                        className="pl-8 h-8 text-xs w-48 bg-secondary"
                      />
                    </div>
                    {ctx.selectedIndices.size === 1 && (
                      <Button size="sm" variant="outline" className="text-xs gap-1" onClick={ctx.generateSubnetIps}>
                        <List className="w-3.5 h-3.5" /> Gerar IPs
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => {
                        exportSubnetsToCSV(
                          searchQuery ? ctx.filterSubnets(searchQuery) : ctx.subRedesGeradas
                        );
                        toast.success('Sub-redes copiadas como CSV');
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" /> CSV
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary z-10">
                      <tr>
                        <th className="p-2 w-10">
                          <input
                            type="checkbox"
                            checked={ctx.selectedIndices.size === ctx.subRedesGeradas.length && ctx.subRedesGeradas.length > 0}
                            onChange={ctx.toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Sub-rede</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Inicial</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Final</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Rede</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubnets.map((subnet, displayIdx) => {
                        const realIdx = searchQuery
                          ? ctx.subRedesGeradas.indexOf(subnet)
                          : displayIdx;
                        const isSelected = ctx.selectedIndices.has(realIdx);
                        const isIndividual = ctx.individualSelectedIndex === realIdx;

                        return (
                          <tr
                            key={realIdx}
                            className={cn(
                              "border-t border-border/50 cursor-pointer transition-colors duration-150",
                              isSelected && "bg-primary/10",
                              isIndividual && "bg-accent/15 border-l-2 border-l-primary",
                              !isSelected && !isIndividual && "hover:bg-secondary/50"
                            )}
                            onClick={() => ctx.selectIndividual(realIdx)}
                          >
                            <td className="p-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => ctx.toggleSelect(realIdx)}
                                className="rounded"
                              />
                            </td>
                            <td className="p-2 font-mono text-primary">{shortenIPv6(subnet.subnet)}</td>
                            <td className="p-2 font-mono">{shortenIPv6(subnet.initial)}</td>
                            <td className="p-2 font-mono">{shortenIPv6(subnet.final)}</td>
                            <td className="p-2 font-mono">{shortenIPv6(subnet.network)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Load more */}
                {!searchQuery && ctx.displayedCount < ctx.subRedesGeradas.length && (
                  <div className="p-4 border-t border-border text-center">
                    <Button variant="outline" size="sm" onClick={ctx.loadMore} className="gap-2">
                      <ChevronDown className="w-4 h-4" />
                      Carregar mais ({ctx.subRedesGeradas.length - ctx.displayedCount} restantes)
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reverse Search */}
          <AnimatePresence>
            {ctx.subRedesGeradas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" /> Busca Reversa
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={reverseSearchIp}
                    onChange={e => setReverseSearchIp(e.target.value)}
                    placeholder="Ex.: 2001:db8::1"
                    className="font-mono bg-secondary flex-1"
                    onKeyDown={e => e.key === 'Enter' && handleReverseSearch()}
                  />
                  <Button onClick={handleReverseSearch} variant="outline" className="gap-1">
                    <Search className="w-4 h-4" /> Buscar
                  </Button>
                </div>
                {reverseResult && (
                  <div className={cn(
                    "mt-3 p-3 rounded-lg text-sm",
                    reverseResult.found ? "bg-green-500/10 border border-green-500/30 text-green-400" :
                    reverseResult.error ? "bg-warning/10 border border-warning/30 text-warning" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {reverseResult.found
                      ? `Encontrado na sub-rede: ${shortenIPv6(reverseResult.subnet.subnet)} (índice ${reverseResult.index + 1})`
                      : reverseResult.error || 'Endereço não encontrado nas sub-redes geradas'}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subnet IPs */}
          <AnimatePresence>
            {ctx.subnetIpsVisible && ctx.subnetIpsBlock && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">
                    IPs da Sub-rede: <code className="text-primary">{shortenIPv6(ctx.subnetIpsBlock.subnet)}</code>
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={ctx.generateMoreSubnetIps} className="gap-1 text-xs">
                      <Plus className="w-3 h-3" /> Mais 50
                    </Button>
                    <Button size="sm" variant="outline" onClick={ctx.resetSubnetIps} className="gap-1 text-xs">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setExportTarget('subnet'); setExportModalOpen(true); }} className="gap-1 text-xs">
                      <Download className="w-3 h-3" /> Exportar
                    </Button>
                  </div>
                </div>
                <IPList ips={ctx.subnetIps} onCopy={copyToClipboard} />
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
                className="bg-card rounded-xl border border-border p-5 sticky top-6"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-primary" />
                  {ctx.individualSelectedIndex !== null ? (
                    <span className="text-green-400">Bloco Selecionado</span>
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
                  <div className="mt-4 space-y-3">
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
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={ctx.generateMoreMainBlockIps}>
                              <Plus className="w-3 h-3" /> +50
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={ctx.resetMainBlockIps}>
                              <RotateCcw className="w-3 h-3" /> Reset
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={() => { setExportTarget('main'); setExportModalOpen(true); }}>
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
                      className="mt-4 pt-4 border-t border-border"
                    >
                      {ctx.aggregationResult.canAggregate ? (
                        <div>
                          <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3">
                            <Layers className="w-3.5 h-3.5 text-primary" /> Bloco Agregado
                          </h4>
                          <div className="space-y-2">
                            <InfoRow label="CIDR" value={ctx.aggregationResult.aggregatedBlock!.subnet} onCopy={() => copyToClipboard(ctx.aggregationResult!.aggregatedBlock!.subnet)} />
                            <InfoRow label="Rede" value={ctx.aggregationResult.aggregatedBlock!.network} onCopy={() => copyToClipboard(ctx.aggregationResult!.aggregatedBlock!.network)} />
                            <p className="text-xs text-muted-foreground">
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
                                  <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={ctx.generateMoreAggregatedIps}>
                                    <Plus className="w-3 h-3" /> +50
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={ctx.resetAggregatedIps}>
                                    <RotateCcw className="w-3 h-3" /> Reset
                                  </Button>
                                </div>
                                <IPList ips={ctx.aggregatedIps} onCopy={copyToClipboard} maxHeight="250px" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : ctx.comparisonResult ? (
                        <div>
                          <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-primary" /> Comparação
                          </h4>
                          <ComparisonInfo result={ctx.comparisonResult} reason={ctx.aggregationResult.reason} />
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                          <TriangleAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-warning text-xs">Agregação não possível</p>
                            <p className="text-xs text-muted-foreground mt-1">{ctx.aggregationResult.reason}</p>
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
                  className="flex flex-col items-center p-4 rounded-lg border border-border bg-secondary hover:border-primary hover:bg-primary/5 transition-all duration-200 gap-2"
                >
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do arquivo:</label>
              <Input value={exportFilename} onChange={e => setExportFilename(e.target.value)} className="bg-secondary" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <code className="text-xs font-mono text-foreground truncate">{value}</code>
        <button onClick={onCopy} className="p-1 rounded hover:bg-primary/10 transition-colors shrink-0">
          <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
        </button>
      </div>
    </div>
  );
}

function IPList({ ips, onCopy, maxHeight = '400px' }: { ips: { ip: string; number: number }[]; onCopy: (ip: string) => void; maxHeight?: string }) {
  return (
    <div className="overflow-y-auto space-y-0.5" style={{ maxHeight }}>
      {ips.map(item => (
        <div key={item.number} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/50 group">
          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{item.number}.</span>
          <code className="text-xs font-mono text-foreground flex-1 truncate">{item.ip}</code>
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

function ComparisonInfo({ result, reason }: { result: any; reason: string }) {
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
      <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/30">
        <TriangleAlert className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}
