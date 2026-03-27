import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Copy, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  validateIPv4,
  convertIPv4toIPv6,
  isPrivateIPv4,
  type IPv4to6Result,
} from '@/lib/ipv4to6-utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

const EXAMPLES = ['192.0.2.1', '8.8.8.8', '1.1.1.1', '200.152.0.1'];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar'),
  );
}

export function IPv4to6View() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IPv4to6Result[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);

  const handleConvert = () => {
    const val = input.trim();
    const err = validateIPv4(val);
    if (err) { setError(err); setResults([]); return; }
    setError(null);
    setIsPrivate(isPrivateIPv4(val));
    setResults(convertIPv4toIPv6(val));
  };

  const handleReset = () => {
    setInput('');
    setError(null);
    setResults([]);
    setIsPrivate(false);
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
          Conversor IPv4 → IPv6
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Converte um endereço IPv4 para as representações IPv6 equivalentes.
        </p>
      </div>

      <div className="space-y-6">
        {/* Input card */}
        <motion.div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4" {...fadeUp}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Endereço IPv4</label>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => { setInput(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleConvert()}
                placeholder="Ex.: 192.0.2.1"
                className={cn(
                  'font-mono text-sm bg-secondary/60 border-border/60 flex-1 h-11',
                  error && 'border-destructive animate-shake',
                )}
                spellCheck={false}
              />
              <Button onClick={handleConvert} className="gap-2 h-11 px-5 text-sm">
                <ArrowRightLeft className="w-4 h-4" /> Converter
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Quick examples */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setInput(ex); setError(null); }}
                className="text-[11px] font-mono px-2.5 py-1 rounded border border-border/60 bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs text-muted-foreground h-8">
                <RefreshCw className="w-3 h-3" /> Limpar
              </Button>
            </div>
          )}
        </motion.div>

        {/* Private IP warning */}
        <AnimatePresence>
          {isPrivate && results.length > 0 && (
            <motion.div
              className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">Endereço privado/reservado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Este IP não é roteável na Internet pública. Mecanismos como NAT64 e 6to4 são projetados para IPs públicos.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              {results.map((r, i) => (
                <ResultCard key={r.mechanism} result={r} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info box */}
        {results.length === 0 && !error && (
          <div className="bg-secondary/30 rounded-xl border border-border/40 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-medium text-foreground">Mecanismos de transição IPv4/IPv6</p>
            </div>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <p><span className="font-mono text-primary">IPv4-Mapped</span> — Representa um IPv4 em socket dual-stack. Formato: <span className="font-mono">::ffff:x.x.x.x</span></p>
              <p><span className="font-mono text-primary">NAT64</span> — Gateway traduz entre clientes IPv6 e servidores IPv4. Prefixo <span className="font-mono">64:ff9b::/96</span> (RFC 6052)</p>
              <p><span className="font-mono text-primary">6to4</span> — Tunelamento automático, deriva prefixo <span className="font-mono">/48</span> do IPv4 público. Prefixo <span className="font-mono">2002::/16</span> (RFC 3056)</p>
              <p><span className="font-mono text-primary">IPv4-Compatible</span> — Formato obsoleto, mantido apenas por referência histórica.</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ResultCard({ result, index }: { result: IPv4to6Result; index: number }) {
  const isDeprecated = result.mechanism.includes('obsoleto');

  return (
    <motion.div
      className={cn(
        'bg-card rounded-xl border overflow-hidden',
        isDeprecated ? 'border-border/40 opacity-70' : 'border-border',
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">{result.mechanism}</h3>
          <Badge variant="outline" className="text-[10px] px-2 py-0 font-mono">{result.rfc}</Badge>
          {isDeprecated && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-yellow-500/30 text-yellow-400">
              depreciado
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        <p className="text-xs text-muted-foreground leading-relaxed">{result.description}</p>

        {/* Compressed form */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Comprimido</span>
          <div className="flex items-center justify-between gap-2 bg-secondary/50 rounded-lg px-3 py-2">
            <code className="text-sm font-mono text-primary break-all">{result.ipv6}</code>
            <button
              onClick={() => copyToClipboard(result.ipv6)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded form */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Expandido</span>
          <div className="flex items-center justify-between gap-2 bg-secondary/30 rounded-lg px-3 py-2">
            <code className="text-[11px] font-mono text-muted-foreground break-all">{result.ipv6Expanded}</code>
            <button
              onClick={() => copyToClipboard(result.ipv6Expanded)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CIDR block if applicable */}
        {result.cidr && (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Bloco CIDR</span>
            <div className="flex items-center justify-between gap-2 bg-secondary/30 rounded-lg px-3 py-2">
              <code className="text-sm font-mono text-foreground break-all">{result.cidr}</code>
              <button
                onClick={() => copyToClipboard(result.cidr!)}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Copiar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Note */}
        {result.note && (
          <div className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs',
            isDeprecated
              ? 'bg-yellow-500/5 border border-yellow-500/20 text-yellow-400'
              : 'bg-primary/5 border border-primary/15 text-muted-foreground',
          )}>
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{result.note}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
