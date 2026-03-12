import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Network, X, Plus, Trash2, Calculator, Globe, Server, Building2, Smartphone,
  Copy, ChevronDown, Info, Table as TableIcon
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
  isp: { base: '2001:db8::/32', levels: [{ label: 'Região', prefix: 40 }, { label: 'Cliente', prefix: 48 }, { label: 'Site', prefix: 56 }, { label: 'VLAN', prefix: 64 }] },
  enterprise: { base: '2001:db8::/48', levels: [{ label: 'Departamento', prefix: 56 }, { label: 'Segmento', prefix: 64 }] },
  datacenter: { base: '2001:db8::/40', levels: [{ label: 'PoP', prefix: 48 }, { label: 'Rack', prefix: 56 }, { label: 'Servidor', prefix: 64 }, { label: 'Container', prefix: 80 }] },
  mobile: { base: '2001:db8::/32', levels: [{ label: 'UF', prefix: 40 }, { label: 'Célula', prefix: 48 }, { label: 'Dispositivo', prefix: 64 }] },
};

const BV_PAGE = 50;

let levelIdCounter = 0;
function nextLevelId(): string {
  return `level-${++levelIdCounter}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar')
  );
}

export function PlannerView() {
  const [baseBlock, setBaseBlock] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [results, setResults] = useState<ComputedLevel[] | null>(null);
  const [base, setBase] = useState<BaseBlock | null>(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLevelIndex, setModalLevelIndex] = useState(0);
  const [modalBlocks, setModalBlocks] = useState<{ index: number; cidr: string; label: string }[]>([]);
  const [modalOffset, setModalOffset] = useState(0);
  const [modalHasMore, setModalHasMore] = useState(false);
  const [modalTotal, setModalTotal] = useState<bigint>(0n);

  const calculateRef = useRef<(baseVal?: string, lvls?: { label: string; prefix: number }[]) => void>();

  const calculate = useCallback((baseVal?: string, lvls?: { label: string; prefix: number }[]) => {
    const bv = baseVal || baseBlock;
    const parts = bv.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) { setError('Bloco base inválido. Use formato CIDR — ex: 2001:db8::/32'); return; }
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 1 || prefix > 128) { setError('Prefixo inválido'); return; }

    const parsedBase: BaseBlock = { address: parts[0].trim(), prefix };
    const parsedLevels = (lvls || levels).map(l => ({ label: l.label, prefix: typeof l.prefix === 'string' ? NaN : l.prefix }));

    if (parsedLevels.some(l => !l.label || isNaN(l.prefix))) { setError('Preencha todos os níveis'); return; }

    let prev = parsedBase.prefix;
    for (const l of parsedLevels) {
      if (l.prefix <= prev) { setError(`Nível "${l.label}": prefixo /${l.prefix} deve ser maior que /${prev}.`); return; }
      if (l.prefix > 128) { setError(`Prefixo /${l.prefix} excede /128.`); return; }
      prev = l.prefix;
    }

    const computed: ComputedLevel[] = [];
    let parentPrefix = parsedBase.prefix;
    let totalBlocks = 1n;
    for (const l of parsedLevels) {
      const bits = l.prefix - parentPrefix;
      const children = 2n ** BigInt(bits);
      totalBlocks *= children;
      const hosts = 2n ** BigInt(128 - l.prefix);
      computed.push({ label: l.label, prefix: l.prefix, bitsAtLevel: bits, childrenPerParent: children, totalBlocks, hostsPerBlock: hosts });
      parentPrefix = l.prefix;
    }

    setResults(computed);
    setBase(parsedBase);
    setError('');
  }, [baseBlock, levels]);

  calculateRef.current = calculate;

  const addLevel = useCallback(() => {
    setLevels(prev => [...prev, { id: nextLevelId(), label: '', prefix: '' }]);
  }, []);

  const removeLevel = useCallback((idx: number) => {
    setLevels(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLevel = useCallback((idx: number, field: 'label' | 'prefix', value: string) => {
    setLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: field === 'prefix' ? (value === '' ? '' : parseInt(value)) : value } : l));
  }, []);

  const loadPreset = useCallback((key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setBaseBlock(p.base);
    const newLevels = p.levels.map(l => ({ id: nextLevelId(), label: l.label, prefix: l.prefix }));
    setLevels(newLevels);
    // Use setTimeout to ensure state is updated, calling via ref to avoid stale closure
    setTimeout(() => calculateRef.current?.(p.base, p.levels), 0);
  }, []);

  const openBlocksModal = useCallback((levelIndex: number) => {
    if (!base || !results) return;
    setModalLevelIndex(levelIndex);
    setModalOffset(0);

    const level = results[levelIndex];
    const blockSize = 2n ** BigInt(128 - level.prefix);
    const networkBase = getNetworkAddress(base.address, base.prefix);
    const total = level.totalBlocks;
    const end = BigInt(BV_PAGE) < total ? BV_PAGE : Number(total);
    const items: { index: number; cidr: string; label: string }[] = [];

    for (let i = 0; i < end; i++) {
      const start = networkBase + BigInt(i) * blockSize;
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
    const level = results[modalLevelIndex];
    const blockSize = 2n ** BigInt(128 - level.prefix);
    const networkBase = getNetworkAddress(base.address, base.prefix);
    const total = level.totalBlocks;
    const endNum = BigInt(modalOffset + BV_PAGE) < total ? modalOffset + BV_PAGE : modalOffset + Number(total - BigInt(modalOffset));
    const items: { index: number; cidr: string; label: string }[] = [];

    for (let i = modalOffset; i < endNum; i++) {
      const start = networkBase + BigInt(i) * blockSize;
      const expanded = formatIPv6Address(start);
      items.push({ index: i + 1, cidr: `${shortenIPv6(expanded)}/${level.prefix}`, label: `${level.label} ${i + 1}` });
    }

    setModalBlocks(prev => [...prev, ...items]);
    setModalOffset(endNum);
    setModalHasMore(BigInt(endNum) < total);
  }, [base, results, modalLevelIndex, modalOffset]);

  const clearPlanner = useCallback(() => {
    setBaseBlock('');
    setLevels([]);
    setResults(null);
    setBase(null);
    setError('');
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
          <Network className="w-4 h-4 text-primary" /> Planejador Hierárquico
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Planeje hierarquias multi-nível de endereçamento IPv6</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Presets */}
        <div className="p-4 md:p-5 border-b border-border/60">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'isp' as const, icon: Globe, label: 'ISP' },
              { key: 'enterprise' as const, icon: Building2, label: 'Empresa' },
              { key: 'datacenter' as const, icon: Server, label: 'Datacenter' },
              { key: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => loadPreset(p.key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border border-border bg-secondary/40 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
              >
                <p.icon className="w-3 h-3" /> {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Base block */}
        <div className="p-4 md:p-5 border-b border-border/60">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Bloco Base</label>
          <Input
            value={baseBlock}
            onChange={e => setBaseBlock(e.target.value)}
            placeholder="Ex.: 2001:db8::/32"
            className="font-mono text-xs bg-secondary/60 h-9"
          />
        </div>

        {/* Levels */}
        <div className="p-4 md:p-5 border-b border-border/60">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Níveis</label>
          <div className="space-y-2 mb-3">
            {levels.map((level, i) => (
              <div key={level.id} className="flex items-center gap-2">
                 <span className="w-5 h-5 rounded bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                   {i + 1}
                </span>
                <Input
                  value={level.label}
                  onChange={e => updateLevel(i, 'label', e.target.value)}
                  placeholder="Ex: Região"
                  className="bg-secondary/60 flex-1 h-8 text-xs"
                />
                <span className="text-muted-foreground font-bold text-xs">/</span>
                <Input
                  type="number"
                  value={level.prefix}
                  onChange={e => updateLevel(i, 'prefix', e.target.value)}
                  placeholder="48"
                  className="bg-secondary/60 w-20 font-mono text-center h-8 text-xs"
                  min={1}
                  max={128}
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
         <div className="p-4 md:p-5 flex gap-2">
           <Button variant="outline" size="sm" onClick={clearPlanner} className="gap-1.5 h-7 px-3 text-[11px]">
             <Trash2 className="w-3 h-3" /> Limpar
           </Button>
           <Button size="sm" onClick={() => calculate()} className="gap-1.5 h-7 px-4 text-[11px]">
             <Calculator className="w-3 h-3" /> Calcular Hierarquia
           </Button>
         </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
             className="mt-4 p-3 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] text-xs flex items-start gap-2">
             <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && base && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-5">
            {/* Stats bar */}
            <div className="bg-card rounded-xl border border-border grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
              {[
                { val: results.length.toString(), label: 'Níveis' },
                { val: (results[results.length - 1].prefix - base.prefix).toString(), label: 'Bits alocados' },
                { val: formatBigInt(results[results.length - 1].totalBlocks), label: `Blocos — ${results[results.length - 1].label}` },
                { val: formatBigInt(results[results.length - 1].hostsPerBlock), label: 'End./bloco' },
              ].map((s, i) => (
                 <div key={`stat-${i}`} className="p-3 text-center">
                   <div className="text-sm font-bold text-primary tabular-nums">{s.val}</div>
                   <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.label}</div>
                 </div>
              ))}
            </div>

            {/* Tree */}
            <div className="bg-card rounded-xl border border-border p-5">
               <h3 className="text-xs font-medium mb-4 flex items-center gap-2">
                 <Network className="w-3.5 h-3.5 text-primary" /> Hierarquia visual
              </h3>
              <div className="space-y-0">
                {/* Base node */}
                 <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                   <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                     <Globe className="w-3 h-3 text-primary" />
                   </div>
                   <div className="min-w-0">
                     <div className="text-xs font-medium flex items-center gap-2">
                       Bloco Base <code className="text-[11px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono">{base.address}/{base.prefix}</code>
                     </div>
                     <div className="text-[10px] text-muted-foreground">{formatBigInt(2n ** BigInt(128 - base.prefix))} endereços totais</div>
                   </div>
                 </div>

                {results.map((level, i) => (
                  <div key={`tree-${level.prefix}-${i}`}>
                    {/* Connector */}
                    <div className="flex items-center gap-2 pl-3 py-0.5">
                      <div className="w-px h-5 bg-border ml-3" />
                      <span className="text-[10px] text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded-full">
                        +{level.bitsAtLevel} bit{level.bitsAtLevel !== 1 ? 's' : ''} → {formatBigInt(level.childrenPerParent)}×
                      </span>
                    </div>
                    {/* Node */}
                     <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                       <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                         {i + 1}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-xs font-medium flex items-center gap-2">
                           {level.label} <span className="text-[11px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono">/{level.prefix}</span>
                         </div>
                         <div className="text-[10px] text-muted-foreground">
                           {formatBigInt(level.totalBlocks)} blocos · {formatBigInt(level.hostsPerBlock)} end./bloco
                         </div>
                       </div>
                       <Button size="sm" variant="outline" className="shrink-0 gap-1 text-[11px] h-6 px-2" onClick={() => openBlocksModal(i)}>
                         <TableIcon className="w-3 h-3" /> Ver blocos
                       </Button>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60">
               <h3 className="text-xs font-medium flex items-center gap-2">
                 <TableIcon className="w-3.5 h-3.5 text-primary" /> Tabela de resumo
               </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60">
                    <tr>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Nível</th>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Prefixo</th>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Bits</th>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Filhos/pai</th>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Total</th>
                       <th className="p-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">End./bloco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr>
                      <td className="p-2.5 italic text-muted-foreground">Base</td>
                      <td className="p-2.5 font-mono">/{base.prefix}</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">1</td>
                      <td className="p-2.5 tabular-nums">{formatBigInt(2n ** BigInt(128 - base.prefix))}</td>
                    </tr>
                    {results.map((l, i) => (
                      <tr key={`summary-${l.prefix}-${i}`}>
                        <td className="p-2.5 font-medium">{l.label}</td>
                        <td className="p-2.5 font-mono">/{l.prefix}</td>
                        <td className="p-2.5 font-semibold text-primary">{l.bitsAtLevel}</td>
                        <td className="p-2.5 tabular-nums">{formatBigInt(l.childrenPerParent)}</td>
                        <td className="p-2.5 font-semibold tabular-nums">{formatBigInt(l.totalBlocks)}</td>
                        <td className="p-2.5 tabular-nums">{formatBigInt(l.hostsPerBlock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocks Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <TableIcon className="w-4 h-4 text-primary" />
              Blocos — {results?.[modalLevelIndex]?.label}
              <span className="text-[11px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono">/{results?.[modalLevelIndex]?.prefix}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Level tabs */}
          {results && results.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {results.map((l, i) => (
                <button
                  key={`tab-${l.prefix}-${i}`}
                  onClick={() => { setModalLevelIndex(i); openBlocksModal(i); }}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors",
                    i === modalLevelIndex ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {i + 1}. {l.label} <span className="opacity-60">({formatBigInt(l.totalBlocks)})</span>
                </button>
              ))}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            Mostrando <strong>1–{modalBlocks.length}</strong> de <strong>{formatBigInt(modalTotal)}</strong> blocos
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0 rounded-lg bg-secondary/20 p-1">
            {modalBlocks.map(block => (
              <div key={block.index} className="flex items-center gap-3 px-2.5 py-1.5 rounded hover:bg-secondary/50 group transition-colors">
                <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">{block.index}</span>
                <code className="text-xs font-mono text-primary flex-1">{block.cidr}</code>
                <span className="text-[10px] text-muted-foreground">{block.label}</span>
                <button
                  onClick={() => copyToClipboard(block.cidr)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
                >
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {modalHasMore && (
            <Button variant="outline" size="sm" onClick={loadMoreBlocks} className="gap-2">
              <ChevronDown className="w-3.5 h-3.5" /> Ver mais {BV_PAGE} blocos
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
