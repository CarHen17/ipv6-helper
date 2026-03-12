import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cpu, Copy, RotateCcw, ArrowRight, Info, Globe, Link2, Fingerprint, Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidMAC, isValidPrefix64, computeEUI64, type EUI64Result } from '@/lib/eui64-utils';

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

const COMMON_PREFIXES = [
  { label: '2001:db8::', desc: 'Documentação' },
  { label: '2001:0db8:abcd::', desc: 'Exemplo' },
  { label: 'fd00::', desc: 'ULA' },
];

function ResultRow({ icon: Icon, label, value, fullValue, highlight = false }: {
  icon: typeof Globe;
  label: string;
  value: string;
  fullValue?: string;
  highlight?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const displayed = showFull && fullValue ? fullValue : value;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayed).then(() => {
      setCopied(true);
      toast.success('Copiado!');
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={cn(
      "group flex items-center gap-3 rounded-lg px-3.5 py-3 transition-colors",
      highlight
        ? "bg-primary/8 border border-primary/20"
        : "bg-secondary/40 border border-transparent hover:border-border"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        highlight ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <p className="text-sm font-mono font-semibold text-foreground truncate" title={displayed}>
          {displayed}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {fullValue && (
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors hidden sm:block"
          >
            {showFull ? 'Curto' : 'Expandido'}
          </button>
        )}
        <button
          onClick={handleCopy}
          className={cn(
            "p-1.5 rounded-md transition-all",
            copied
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
          title="Copiar"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function EUI64View() {
  const [macInput, setMacInput] = useState('');
  const [prefixInput, setPrefixInput] = useState('2001:db8::');
  const [result, setResult] = useState<EUI64Result | null>(null);
  const [error, setError] = useState('');

  const macValid = macInput.trim() ? isValidMAC(macInput) : null;

  const handleCalculate = () => {
    setError('');
    setResult(null);

    if (!macInput.trim()) {
      setError('Informe um endereço MAC.');
      return;
    }
    if (!isValidMAC(macInput)) {
      setError('MAC address inválido. Use o formato XX:XX:XX:XX:XX:XX');
      return;
    }
    if (!prefixInput.trim()) {
      setError('Informe um prefixo /64.');
      return;
    }
    if (!isValidPrefix64(prefixInput)) {
      setError('Prefixo inválido. Use até 4 hextets (ex: 2001:db8::)');
      return;
    }

    try {
      const res = computeEUI64(macInput, prefixInput);
      setResult(res);
    } catch {
      setError('Erro ao calcular. Verifique os valores informados.');
    }
  };

  const handleReset = () => {
    setMacInput('');
    setPrefixInput('2001:db8::');
    setResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <motion.div {...fadeUp}>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            Calculadora EUI-64 / SLAAC
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Converta um MAC address em identificador EUI-64 e calcule o endereço SLAAC completo.
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          className="bg-card border border-border rounded-xl p-5 space-y-5"
          {...fadeUp}
        >
          {/* Two-column grid for inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* MAC Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                Endereço MAC
                {macValid === true && <Check className="w-3 h-3 text-green-500" />}
              </label>
              <div className="relative">
                <Input
                  value={macInput}
                  onChange={e => setMacInput(e.target.value)}
                  placeholder="00:1A:2B:3C:4D:5E"
                  className={cn(
                    "h-11 text-sm font-mono bg-secondary/50 border-border pr-10",
                    macValid === false && "border-destructive/50 focus-visible:ring-destructive/30"
                  )}
                  onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                />
                {macInput && (
                  <button
                    onClick={() => setMacInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Prefix */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Prefixo /64
              </label>
              <Input
                value={prefixInput}
                onChange={e => setPrefixInput(e.target.value)}
                placeholder="2001:db8::"
                className="h-11 text-sm font-mono bg-secondary/50 border-border"
                onKeyDown={e => e.key === 'Enter' && handleCalculate()}
              />
            </div>
          </div>

          {/* Quick fills — integrated inline */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mr-1">Exemplos:</span>
            {[
              { mac: '00:1A:2B:3C:4D:5E', prefix: '2001:db8::' },
              { mac: 'AA:BB:CC:DD:EE:FF', prefix: '2001:db8::' },
              { mac: '02:42:AC:11:00:02', prefix: 'fd00::' },
            ].map((ex, i) => (
              <button
                key={i}
                onClick={() => { setMacInput(ex.mac); setPrefixInput(ex.prefix); }}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all",
                  "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border"
                )}
              >
                <Zap className="w-3 h-3 text-primary/60" />
                <span className="font-mono">{ex.mac}</span>
              </button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Info className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleCalculate} className="h-10 text-sm gap-2 flex-1 sm:flex-none">
              <ArrowRight className="w-4 h-4" /> Calcular
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-10 text-sm gap-2">
              <RotateCcw className="w-4 h-4" /> Limpar
            </Button>
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Resultados</h2>
              </div>

              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <ResultRow
                  icon={Fingerprint}
                  label="MAC normalizado"
                  value={result.macNormalised}
                />
                <ResultRow
                  icon={Fingerprint}
                  label="Identificador EUI-64"
                  value={result.eui64}
                  highlight
                />
                <ResultRow
                  icon={Globe}
                  label="Endereço SLAAC"
                  value={result.slaacAddress}
                  fullValue={result.slaacAddressFull}
                  highlight
                />
                <ResultRow
                  icon={Link2}
                  label="Endereço Link-Local"
                  value={result.linkLocal}
                  fullValue={result.linkLocalFull}
                />
              </div>

              {/* Process explanation — collapsible */}
              <details className="group bg-primary/5 border border-primary/15 rounded-xl">
                <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-xs font-medium text-foreground/80 select-none">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Como funciona o cálculo EUI-64
                </summary>
                <div className="px-4 pb-3 text-xs text-muted-foreground space-y-1">
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>O MAC de 48 bits é dividido em duas metades</li>
                    <li>Os bytes <span className="font-mono text-primary">FF:FE</span> são inseridos no meio → 64 bits</li>
                    <li>O 7º bit (U/L) do primeiro byte é invertido</li>
                    <li>O resultado é combinado com o prefixo /64 para formar o endereço SLAAC</li>
                    <li>O mesmo identificador com prefixo <span className="font-mono text-primary">fe80::</span> gera o link-local</li>
                  </ol>
                </div>
              </details>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
