import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Network, X, Plus, Calculator, Globe, Server, Building2, Smartphone,
  Copy, ChevronDown, Info, Table as TableIcon, ArrowUp, Layers, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  shortenIPv6, formatIPv6Address,
  getNetworkAddress, formatBigInt
} from '@/lib/ipv6-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Level {
  id: string;
  label: string;
  prefix: number | '';
}

interface ComputedLevel {
  label: string;
  prefix: number;
  bitsAtLevel: number;
  childrenPerParent: bigint;
  totalBlocks: bigint;
  hostsPerBlock: bigint;
}

interface BaseBlock {
  address: string;
  prefix: number;
}

const PRESETS = {
  isp:        { base: '2001:db8::/32', levels: [{ label: 'Região', prefix: 40 }, { label: 'Cliente', prefix: 48 }, { label: 'Site', prefix: 56 }, { label: 'VLAN', prefix: 64 }] },
  enterprise: { base: '2001:db8::/48', levels: [{ label: 'Departamento', prefix: 56 }, { label: 'Segmento', prefix: 64 }] },
  datacenter: { base: '2001:db8::/40', levels: [{ label: 'PoP', prefix: 48 }, { label: 'Rack', prefix: 56 }, { label: 'Servidor', prefix: 64 }, { label: 'Container', prefix: 80 }] },
  mobile:     { base: '2001:db8::/32', levels: [{ label: 'UF', prefix: 40 }, { label: 'Célula', prefix: 48 }, { label: 'Dispositivo', prefix: 64 }] },
};

const BV_PAGE = 50;

let levelIdCounter = 0;
function nextLevelId(): string { return `level-${++levelIdCounter}`; }

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar'),
  );
}

/** Compact human-readable form of a BigInt (e.g. 65K, 16M, 4B). */
function shortBigInt(n: bigint): string {
  if (n < 1000n)      return n.toString();
  if (n < 1_000_000n) return `${(Number(n) / 1000).toFixed(0)}K`;
  if (n < 1_000_000_000n) return `${(Number(n) / 1_000_000).toFixed(0)}M`;
  if (n < 1_000_000_000_000n) return `${(Number(n) / 1_000_000_000).toFixed(0)}B`;
  return formatBigInt(n);
}

export function PlannerView() {
  const [baseBlock, setBaseBlock]   = useState('');
  const [levels, setLevels]         = useState<Level[]>([]);
  const [results, setResults]       = useState<ComputedLevel[] | null>(null);
  const [base, setBase]             = useState<BaseBlock | null>(null);
  const [error, setError]           = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalLevelIndex, setModalLevelIndex] = useState(0);
  const [modalBlocks, setModalBlocks]         = useState<{ index: number; cidr: string; label: string }[]>([]);
  const [modalOffset, setModalOffset]         = useState(0);
  const [modalHasMore, setModalHasMore]       = useState(false);
  const [modalTotal, setModalTotal]           = useState<bigint>(0n);

  const calculateRef = useRef<(baseVal?: string, lvls?: { label: string; prefix: number }[]) => void>();
  const resultsRef   = useRef<HTMLDivElement>(null);
  const formRef      = useRef<HTMLDivElement>(null);

  const calculate = useCallback((baseVal?: string, lvls?: { label: string; prefix: number }[]) => {
    const bv    = baseVal || baseBlock;
    const parts = bv.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) { setError('Bloco base inválido. Use formato CIDR — ex: 2001:db8::/32'); return; }
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 1 || prefix > 128) { setError('Prefixo inválido'); return; }

    const parsedBase   = { address: parts[0].trim(), prefix };
    const parsedLevels = (lvls || levels).map(l => ({ label: l.label, prefix: typeof l.prefix === 'string' ? NaN : l.prefix }));

    if (parsedLevels.some(l => !l.label || isNaN(l.prefix))) { setError('Preencha todos os níveis com nome e prefixo'); return; }
    if (parsedLevels.length === 0)                            { setError('Adicione ao menos um nível de subdivisão'); return; }

    let prev = parsedBase.prefix;
    for (const l of parsedLevels) {
      if (l.prefix <= prev)  { setError(`Nível "${l.label}": prefixo /${l.prefix} deve ser maior que /${prev}.`); return; }
      if (l.prefix > 128)    { setError(`Prefixo /${l.prefix} excede /128.`); return; }
      prev = l.prefix;
    }

    const computed: ComputedLevel[] = [];
    let parentPrefix = parsedBase.prefix;
    let totalBlocks  = 1n;
    for (const l of parsedLevels) {
      const bits     = l.prefix - parentPrefix;
      const children = 2n ** BigInt(bits);
      totalBlocks   *= children;
      const hosts    = 2n ** BigInt(128 - l.prefix);
      computed.push({ label: l.label, prefix: l.prefix, bitsAtLevel: bits, childrenPerParent: children, totalBlocks, hostsPerBlock: hosts });
      parentPrefix = l.prefix;
    }

    setResults(computed);
    setBase(parsedBase);
    setError('');

    // Scroll to results on next paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }, [baseBlock, levels]);

  calculateRef.current = calculate;

  const addLevel    = useCallback(() => setLevels(prev => [...prev, { id: nextLevelId(), label: '', prefix: '' }]), []);
  const removeLevel = useCallback((idx: number) => setLevels(prev => prev.filter((_, i) => i !== idx)), []);
  const updateLevel = useCallback((idx: number, field: 'label' | 'prefix', value: string) => {
    setLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: field === 'prefix' ? (value === '' ? '' : parseInt(value)) : value } : l));
  }, []);

  const loadPreset = useCallback((key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setBaseBlock(p.base);
    const newLevels = p.levels.map(l => ({ id: nextLevelId(), label: l.label, prefix: l.prefix }));
    setLevels(newLevels);
    setTimeout(() => calculateRef.current?.(p.base, p.levels), 0);
  }, []);

  const openBlocksModal = useCallback((levelIndex: number) => {
    if (!base || !results) return;
    setModalLevelIndex(levelIndex);
    setModalOffset(0);
    const level     = results[levelIndex];
    const blockSize = 2n ** BigInt(128 - level.prefix);
    const networkBase = getNetworkAddress(base.address, base.prefix);
    const total     = level.totalBlocks;
    const end       = BigInt(BV_PAGE) < total ? BV_PAGE : Number(total);
    const items: { index: number; cidr: string; label: string }[] = [];
    for (let i = 0; i < end; i++) {
      const start   = networkBase + BigInt(i) * blockSize;
      const expanded = formatIPv6Address(start);
      items.push({ index: i + 1, cidr: `${shortenIPv6(expanded)}/${level.prefix}`, label: `${level.label} ${i + 1}` });
    }
    setModalBlocks(items);
    setModalOffset(end);
    setModalTotal(total);
    setModalHasMore(BigInt(end) < total);
    setModalOpen(true);
  }, [base, results]);

  const loadMoreBlocks = useCallback(() => {
    if (!base || !results) return;
    const level     = results[modalLevelIndex];
    const blockSize = 2n ** BigInt(128 - level.prefix);
    const networkBase = getNetworkAddress(base.address, base.prefix);
    const total     = level.totalBlocks;
    const endNum    = BigInt(modalOffset + BV_PAGE) < total ? modalOffset + BV_PAGE : modalOffset + Number(total - BigInt(modalOffset));
    const items: { index: number; cidr: string; label: string }[] = [];
    for (let i = modalOffset; i < endNum; i++) {
      const start   = networkBase + BigInt(i) * blockSize;
      const expanded = formatIPv6Address(start);
      items.push({ index: i + 1, cidr: `${shortenIPv6(expanded)}/${level.prefix}`, label: `${level.label} ${i + 1}` });
    }
    setModalBlocks(prev => [...prev, ...items]);
    setModalOffset(endNum);
    setModalHasMore(BigInt(endNum) < total);
  }, [base, results, modalLevelIndex, modalOffset]);

  const clearPlanner = useCallback(() => {
    setBaseBlock(''); setLevels([]); setResults(null); setBase(null); setError('');
  }, []);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <motion.div
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" /> Planejador Hierárquico
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Divida seu bloco IPv6 em múltiplos níveis — como regiões, clientes ou departamentos — e veja
          quantos blocos e endereços você tem em cada camada.
        </p>
      </div>

      {/* ── Input card ─────────────────────────────────────────────────── */}
      <div ref={formRef} className="space-y-6">
        <motion.div
          className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-5"
          {...{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }}
        >
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Modelos prontos <span className="font-normal text-muted-foreground">(carrega um exemplo para o seu tipo de organização)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'isp'        as const, icon: Globe,     label: 'ISP' },
                { key: 'enterprise' as const, icon: Building2, label: 'Empresa' },
                { key: 'datacenter' as const, icon: Server,    label: 'Datacenter' },
                { key: 'mobile'     as const, icon: Smartphone,label: 'Mobile' },
              ]).map(p => (
                <button
                  key={p.key}
                  onClick={() => loadPreset(p.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary/40 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <p.icon className="w-3.5 h-3.5" /> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Base block */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Bloco Base <span className="font-normal text-muted-foreground">(alocação recebida do seu provedor)</span>
            </label>
            <Input
              value={baseBlock}
              onChange={e => setBaseBlock(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && calculate()}
              placeholder="Ex.: 2001:db8::/32  (bloco que você recebeu)"
              className="font-mono text-sm bg-secondary/60 h-11"
            />
          </div>

          {/* Levels */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Níveis de subdivisão <span className="font-normal text-muted-foreground">(ex: Região → Cidade → Cliente)</span>
            </label>
            <div className="space-y-2 mb-2.5">
              {levels.map((level, i) => (
                <div key={level.id} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <Input
                    value={level.label}
                    onChange={e => updateLevel(i, 'label', e.target.value)}
                    placeholder="Nome (ex: Região, Cliente, Setor)"
                    className="bg-secondary/60 flex-1 h-9 text-sm"
                  />
                  <span className="text-muted-foreground font-bold text-sm">/</span>
                  <Input
                    type="number"
                    value={level.prefix}
                    onChange={e => updateLevel(i, 'prefix', e.target.value)}
                    placeholder="48"
                    className="bg-secondary/60 w-20 font-mono text-center h-9 text-sm"
                    min={1} max={128}
                  />
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => removeLevel(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full gap-2 border-dashed h-8 text-xs" onClick={addLevel}>
              <Plus className="w-3.5 h-3.5" /> Adicionar Nível
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={() => calculate()} className="gap-2 h-11 px-5 text-sm">
              <Calculator className="w-3.5 h-3.5" /> Calcular
            </Button>
          </div>
          {results && base && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearPlanner} className="gap-1.5 text-xs text-muted-foreground h-8">
                <RefreshCw className="w-3 h-3" /> Limpar
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 p-3 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] text-sm flex items-start gap-2"
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {results && base && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-6 space-y-4"
          >
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Resultado</span>
                <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono border border-primary/20">
                  {base.address}/{base.prefix}
                </code>
              </div>
              <button
                onClick={scrollToForm}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowUp className="w-3 h-3" /> Editar
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { val: results.length.toString(),                                      label: 'Níveis',            sub: 'na hierarquia' },
                { val: `${results[results.length - 1].prefix - base.prefix}`,          label: 'Bits utilizados',   sub: `de /128` },
                { val: shortBigInt(results[results.length - 1].totalBlocks),           label: results[results.length - 1].label, sub: 'blocos no total' },
                { val: shortBigInt(results[results.length - 1].hostsPerBlock),         label: 'End. por bloco',    sub: results[results.length - 1].label },
              ].map((s, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-3.5 text-center">
                  <div className="text-lg font-bold text-primary tabular-nums leading-none">{s.val}</div>
                  <div className="text-xs font-medium text-foreground mt-1 truncate">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Hierarchy */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" /> Hierarquia
              </h3>

              <div className="space-y-0">
                {/* Base node */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Bloco Base</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {base.address}/{base.prefix} — {formatBigInt(2n ** BigInt(128 - base.prefix))} endereços
                    </div>
                  </div>
                </div>

                {results.map((level, i) => (
                  <div key={`tree-${level.prefix}-${i}`}>
                    {/* Connector */}
                    <div className="flex items-center gap-0 pl-4 py-2">
                      <div className="flex flex-col items-center mr-3">
                        <div className="w-px h-3 bg-border" />
                        <div className="w-1.5 h-1.5 rounded-full bg-border" />
                        <div className="w-px h-3 bg-border" />
                      </div>
                      <span className="text-[11px] text-muted-foreground bg-secondary/60 border border-border/40 px-2.5 py-1 rounded-full font-mono">
                        +{level.bitsAtLevel} bit{level.bitsAtLevel !== 1 ? 's' : ''} → <strong className="text-foreground">{formatBigInt(level.childrenPerParent)}×</strong> por bloco pai
                      </span>
                    </div>

                    {/* Level node */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                      <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{level.label}</span>
                          <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono border border-primary/20">/{level.prefix}</code>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                          <span><strong className="text-foreground tabular-nums">{formatBigInt(level.totalBlocks)}</strong> blocos totais</span>
                          <span><strong className="text-foreground tabular-nums">{formatBigInt(level.hostsPerBlock)}</strong> end./bloco</span>
                        </div>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        className="shrink-0 gap-1.5 text-xs h-8 px-3 w-full sm:w-auto"
                        onClick={() => openBlocksModal(i)}
                      >
                        <TableIcon className="w-3.5 h-3.5" /> Ver blocos
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Blocks Modal ───────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] flex flex-col gap-3">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <TableIcon className="w-4 h-4 text-primary" />
              {results?.[modalLevelIndex]?.label}
              <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono border border-primary/20">
                /{results?.[modalLevelIndex]?.prefix}
              </code>
            </DialogTitle>
          </DialogHeader>

          {/* Level tabs */}
          {results && results.length > 1 && (
            <div className="flex gap-1 overflow-x-auto shrink-0 -mx-1 px-1">
              {results.map((l, i) => (
                <button
                  key={`tab-${l.prefix}-${i}`}
                  onClick={() => { setModalLevelIndex(i); openBlocksModal(i); }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                    i === modalLevelIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {i + 1}. {l.label}
                  <span className="ml-1 opacity-60">/{l.prefix}</span>
                </button>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Info className="w-3.5 h-3.5" />
            Mostrando <strong className="text-foreground">{modalBlocks.length}</strong> de <strong className="text-foreground">{formatBigInt(modalTotal)}</strong> blocos
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-border/40 divide-y divide-border/30">
            {modalBlocks.map(block => (
              <div key={block.index} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 group transition-colors">
                <span className="text-xs text-muted-foreground w-8 text-right tabular-nums shrink-0">{block.index}</span>
                <code className="text-sm font-mono text-primary flex-1 min-w-0 truncate">{block.cidr}</code>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{block.label}</span>
                <button
                  onClick={() => copyToClipboard(block.cidr)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all shrink-0"
                  title="Copiar"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {modalHasMore && (
            <Button variant="outline" size="sm" onClick={loadMoreBlocks} className="gap-2 shrink-0 text-sm">
              <ChevronDown className="w-4 h-4" /> Carregar mais {BV_PAGE} blocos
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
