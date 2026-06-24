import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calculator, Copy, Download, ChevronDown, X,
  List, Plus, RotateCcw, Info, FileText, FileSpreadsheet,
  FileCode, Search, Shield, ShieldOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
import {
  validateIPv4,
  parseIPv4Block,
  generateIPv4Subnets,
  getSubnetCountIPv4,
  formatHostCount,
  IPV4_COMMON_PREFIXES,
  type IPv4BlockData,
  type IPv4SubnetData,
} from '@/lib/ipv4-utils';

const STEPS = [
  { label: 'Inserir IPv4' },
  { label: 'Escolher Prefixo' },
  { label: 'Sub-redes' },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

const LOAD_BATCH = 100;
const LARGE_THRESHOLD = 4096;

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar'),
  );
}

function exportCSV(subnets: IPv4SubnetData[], filename: string) {
  const header = 'Índice,Sub-rede,Rede,Broadcast,Primeiro Host,Último Host,Hosts Utilizáveis\n';
  const rows = subnets.map(s =>
    `${s.index + 1},${s.subnet},${s.network},${s.broadcast},${s.firstHost},${s.lastHost},${s.totalHosts}`
  ).join('\n');
  download(`${header}${rows}`, `${filename}.csv`, 'text/csv');
}

function exportTXT(subnets: IPv4SubnetData[], filename: string) {
  const lines = subnets.map(s =>
    `[${String(s.index + 1).padStart(4, '0')}] ${s.subnet}  Rede: ${s.network}  Broadcast: ${s.broadcast}  Hosts: ${s.firstHost} - ${s.lastHost}  (${s.totalHosts} hosts)`
  ).join('\n');
  download(lines, `${filename}.txt`, 'text/plain');
}

function exportJSON(subnets: IPv4SubnetData[], filename: string) {
  download(JSON.stringify(subnets, null, 2), `${filename}.json`, 'application/json');
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface InfoRowProps { label: string; value: string; onCopy?: () => void }
function InfoRow({ label, value, onCopy }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-mono font-medium truncate">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function IPv4CalculatorView() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null);
  const [block, setBlock] = useState<IPv4BlockData | null>(null);
  const [blockCidr, setBlockCidr] = useState('');
  const [subnets, setSubnets] = useState<IPv4SubnetData[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<number | null>(null);
  const [displayedCount, setDisplayedCount] = useState(LOAD_BATCH);
  const [confirmPrefix, setConfirmPrefix] = useState<{ prefix: number; count: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('subnets_ipv4');
  const [customPrefix, setCustomPrefix] = useState('');

  const displayed = useMemo(() => {
    const filtered = searchQuery
      ? subnets.filter(s =>
          s.subnet.includes(searchQuery) ||
          s.network.includes(searchQuery) ||
          s.broadcast.includes(searchQuery) ||
          s.firstHost.includes(searchQuery) ||
          s.lastHost.includes(searchQuery)
        )
      : subnets;
    return filtered.slice(0, displayedCount);
  }, [subnets, searchQuery, displayedCount]);

  function handleCalculate() {
    const err = validateIPv4(input);
    if (err) {
      setError(err.message);
      setErrorSuggestion(err.suggestion);
      return;
    }
    const [ipPart, prefixStr] = input.trim().split('/');
    const prefix = parseInt(prefixStr, 10);
    const parsed = parseIPv4Block(input);
    // Normalize: use the network address
    const normalizedCidr = `${parsed.network}/${prefix}`;
    setBlock(parsed);
    setBlockCidr(normalizedCidr);
    setError(null);
    setErrorSuggestion(null);
    setSubnets([]);
    setSelectedPrefix(null);
    setStep(2);
    setSearchQuery('');
    void ipPart; // suppress unused warning
  }

  function applyPrefix(prefix: number, force = false) {
    if (!block) return;
    const [, mainPrefixStr] = blockCidr.split('/');
    const mainPrefix = parseInt(mainPrefixStr, 10);
    if (prefix <= mainPrefix) return;
    const count = getSubnetCountIPv4(mainPrefix, prefix);
    if (count > LARGE_THRESHOLD && !force) {
      setConfirmPrefix({ prefix, count });
      return;
    }
    const generated = generateIPv4Subnets(blockCidr, prefix);
    setSubnets(generated);
    setSelectedPrefix(prefix);
    setDisplayedCount(LOAD_BATCH);
    setStep(3);
    setSearchQuery('');
    setConfirmPrefix(null);
  }

  function reset() {
    setStep(1);
    setInput('');
    setError(null);
    setErrorSuggestion(null);
    setBlock(null);
    setBlockCidr('');
    setSubnets([]);
    setSelectedPrefix(null);
    setSearchQuery('');
    setConfirmPrefix(null);
    setCustomPrefix('');
  }

  const mainPrefix = blockCidr ? parseInt(blockCidr.split('/')[1], 10) : 0;
  const prefixOptions = Array.from({ length: 32 - mainPrefix }, (_, i) => mainPrefix + 1 + i);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Calculadora IPv4</h2>
          <p className="text-xs text-muted-foreground">Sub-redes, máscaras e endereçamento</p>
        </div>
      </div>

      <StepIndicator steps={STEPS} currentStep={step} onStepClick={(s) => {
        if (s < step) {
          if (s === 1) reset();
          if (s === 2 && step === 3) { setStep(2); setSubnets([]); setSelectedPrefix(null); }
        }
      }} />

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Input ── */}
        {step === 1 && (
          <motion.div key="step1" {...fadeUp} className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Insira um endereço IPv4 em notação CIDR para começar o cálculo.
              </p>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(null); setErrorSuggestion(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                  placeholder="Ex.: 192.168.0.0/24"
                  className={cn('font-mono', error && 'border-destructive')}
                />
                <Button onClick={handleCalculate} className="shrink-0">
                  <Calculator className="w-4 h-4 mr-2" /> Calcular
                </Button>
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                  <p className="text-sm text-destructive font-medium">{error}</p>
                  {errorSuggestion && <p className="text-xs text-muted-foreground">{errorSuggestion}</p>}
                </div>
              )}
              {/* Quick examples */}
              <div className="flex flex-wrap gap-2">
                {['192.168.0.0/24', '10.0.0.0/8', '172.16.0.0/12'].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setInput(ex); setError(null); }}
                    className="text-xs font-mono px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Block Info + Prefix Selection ── */}
        {step === 2 && block && (
          <motion.div key="step2" {...fadeUp} className="space-y-4">
            {/* Block summary */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" /> Bloco Principal
                </h3>
                <div className="flex items-center gap-1.5 text-xs">
                  {block.isPrivate ? (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Shield className="w-3 h-3" /> Privado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-500">
                      <ShieldOff className="w-3 h-3" /> Público
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div>
                  <InfoRow label="Rede" value={`${block.network}/${mainPrefix}`} onCopy={() => copyToClipboard(`${block.network}/${mainPrefix}`)} />
                  <InfoRow label="Broadcast" value={block.broadcast} onCopy={() => copyToClipboard(block.broadcast)} />
                  <InfoRow label="Primeiro Host" value={block.firstHost} onCopy={() => copyToClipboard(block.firstHost)} />
                  <InfoRow label="Último Host" value={block.lastHost} onCopy={() => copyToClipboard(block.lastHost)} />
                </div>
                <div>
                  <InfoRow label="Máscara de Sub-rede" value={block.subnetMask} onCopy={() => copyToClipboard(block.subnetMask)} />
                  <InfoRow label="Wildcard" value={block.wildcardMask} onCopy={() => copyToClipboard(block.wildcardMask)} />
                  <InfoRow label="Hosts Utilizáveis" value={formatHostCount(block.totalHosts)} />
                  <InfoRow label="Classe" value={block.ipClass} />
                  {block.privateRange && <InfoRow label="Faixa Privada" value={block.privateRange} />}
                </div>
              </div>
            </div>

            {/* Prefix selection */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Dividir em Sub-redes</h3>
              <p className="text-xs text-muted-foreground">
                Escolha um prefixo maior que <code className="font-mono">/{mainPrefix}</code> para gerar sub-redes.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {IPV4_COMMON_PREFIXES.filter(p => p.value > mainPrefix && p.value <= 30).map(p => {
                  const count = getSubnetCountIPv4(mainPrefix, p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => applyPrefix(p.value)}
                      className="group flex flex-col items-start px-3 py-2.5 rounded-lg border border-border hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 text-left"
                    >
                      <span className="text-sm font-mono font-semibold text-foreground group-hover:text-primary">/{p.value}</span>
                      <span className="text-xs text-muted-foreground">{formatHostCount(count)} sub-redes</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom prefix */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={customPrefix}
                  onChange={e => setCustomPrefix(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const p = parseInt(customPrefix, 10);
                      if (p > mainPrefix && p <= 32) applyPrefix(p);
                    }
                  }}
                  placeholder={`Prefixo personalizado (${mainPrefix + 1}–32)`}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const p = parseInt(customPrefix, 10);
                    if (p > mainPrefix && p <= 32) applyPrefix(p);
                    else toast.error(`Prefixo deve ser entre ${mainPrefix + 1} e 32`);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Confirm large generation */}
            {confirmPrefix && (
              <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-orange-500">Operação grande</p>
                <p className="text-sm text-muted-foreground">
                  Isso irá gerar <span className="font-semibold text-foreground">{confirmPrefix.count.toLocaleString('pt-BR')}</span> sub-redes /{confirmPrefix.prefix}.
                  Pode ser lento em dispositivos mais fracos.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => applyPrefix(confirmPrefix.prefix, true)}>Gerar mesmo assim</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmPrefix(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Recalcular
            </Button>
          </motion.div>
        )}

        {/* ── STEP 3: Subnets ── */}
        {step === 3 && subnets.length > 0 && block && (
          <motion.div key="step3" {...fadeUp} className="space-y-4">
            {/* Summary bar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">Bloco</p>
                    <p className="text-sm font-mono font-semibold">{blockCidr}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sub-redes /{selectedPrefix}</p>
                    <p className="text-sm font-semibold">{subnets.length.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hosts por sub-rede</p>
                    <p className="text-sm font-semibold">{formatHostCount(subnets[0]?.totalHosts ?? 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setStep(2); setSubnets([]); setSelectedPrefix(null); }}>
                    <ChevronDown className="w-3.5 h-3.5 rotate-90 mr-1.5" /> Voltar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setDisplayedCount(LOAD_BATCH); }}
                placeholder="Buscar por rede, broadcast, host..."
                className="pl-9 font-mono text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Sub-rede</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Broadcast</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Primeiro Host</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Último Host</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Hosts</th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((s) => (
                      <tr key={s.index} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground">{s.index + 1}</td>
                        <td className="px-3 py-2 font-mono font-medium">{s.subnet}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground hidden sm:table-cell">{s.broadcast}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground hidden md:table-cell">{s.firstHost}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground hidden md:table-cell">{s.lastHost}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{s.totalHosts.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => copyToClipboard(s.subnet)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {displayed.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma sub-rede encontrada.</div>
              )}
            </div>

            {/* Load more */}
            {!searchQuery && displayedCount < subnets.length && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Exibindo {displayed.length} de {subnets.length}</span>
                <Button size="sm" variant="outline" onClick={() => setDisplayedCount(c => Math.min(c + LOAD_BATCH, subnets.length))}>
                  <List className="w-3.5 h-3.5 mr-1.5" /> Carregar mais
                </Button>
              </div>
            )}
            {searchQuery && (
              <p className="text-sm text-muted-foreground">{displayed.length} resultado(s) para "{searchQuery}"</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export modal */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Exportar Sub-redes</h3>
              <button onClick={() => setExportOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Nome do arquivo</label>
              <Input value={exportFilename} onChange={e => setExportFilename(e.target.value)} placeholder="subnets_ipv4" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => { exportCSV(subnets, exportFilename); setExportOpen(false); }}>
                <FileText className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => { exportTXT(subnets, exportFilename); setExportOpen(false); }}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> TXT
              </Button>
              <Button variant="outline" size="sm" onClick={() => { exportJSON(subnets, exportFilename); setExportOpen(false); }}>
                <FileCode className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
