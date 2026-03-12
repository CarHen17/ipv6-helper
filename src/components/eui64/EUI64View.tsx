import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cpu, Copy, RotateCcw, ArrowRight, Info, Globe, Link2, Fingerprint } from 'lucide-react';
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

const EXAMPLE_MACS = [
  { label: '00:1A:2B:3C:4D:5E', value: '00:1A:2B:3C:4D:5E' },
  { label: 'AA:BB:CC:DD:EE:FF', value: 'AA:BB:CC:DD:EE:FF' },
  { label: '02:42:AC:11:00:02', value: '02:42:AC:11:00:02' },
];

function ResultCard({ icon: Icon, label, value, fullValue, mono = true }: {
  icon: typeof Globe;
  label: string;
  value: string;
  fullValue?: string;
  mono?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const displayed = showFull && fullValue ? fullValue : value;

  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-4 space-y-2"
      {...fadeUp}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {fullValue && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-secondary transition-colors"
            >
              {showFull ? 'Curto' : 'Completo'}
            </button>
          )}
          <button
            onClick={() => copyToClipboard(displayed)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copiar"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className={cn(
        "text-base font-semibold text-foreground break-all leading-relaxed",
        mono && "font-mono"
      )}>
        {displayed}
      </p>
    </motion.div>
  );
}

export function EUI64View() {
  const [macInput, setMacInput] = useState('');
  const [prefixInput, setPrefixInput] = useState('2001:db8::');
  const [result, setResult] = useState<EUI64Result | null>(null);
  const [error, setError] = useState('');

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
          className="bg-card border border-border rounded-xl p-5 space-y-4"
          {...fadeUp}
        >
          {/* MAC Address */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Endereço MAC
            </label>
            <Input
              value={macInput}
              onChange={e => setMacInput(e.target.value)}
              placeholder="00:1A:2B:3C:4D:5E"
              className="h-11 text-sm font-mono bg-secondary/50 border-border"
              onKeyDown={e => e.key === 'Enter' && handleCalculate()}
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_MACS.map(ex => (
                <button
                  key={ex.value}
                  onClick={() => setMacInput(ex.value)}
                  className="text-xs px-2.5 py-1 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prefix */}
          <div className="space-y-2">
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
          <div className="flex gap-2 pt-1">
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
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary" />
                Resultados
              </h2>

              {/* MAC normalised */}
              <div className="bg-secondary/50 border border-border rounded-lg px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">MAC normalizado</span>
                  <p className="text-sm font-mono font-medium text-foreground">{result.macNormalised}</p>
                </div>
                <button onClick={() => copyToClipboard(result.macNormalised)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* EUI-64 */}
              <ResultCard
                icon={Fingerprint}
                label="Identificador EUI-64"
                value={result.eui64}
              />

              {/* SLAAC Address */}
              <ResultCard
                icon={Globe}
                label="Endereço SLAAC"
                value={result.slaacAddress}
                fullValue={result.slaacAddressFull}
              />

              {/* Link-local */}
              <ResultCard
                icon={Link2}
                label="Endereço Link-Local"
                value={result.linkLocal}
                fullValue={result.linkLocalFull}
              />

              {/* Info box */}
              <motion.div
                className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5"
                {...fadeUp}
              >
                <p className="font-medium text-foreground/80 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" /> Como funciona
                </p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>O MAC de 48 bits é dividido em duas metades</li>
                  <li>Os bytes <span className="font-mono text-primary">FF:FE</span> são inseridos no meio</li>
                  <li>O 7º bit (U/L) do primeiro byte é invertido</li>
                  <li>O resultado é combinado com o prefixo /64 para formar o endereço SLAAC</li>
                  <li>O mesmo identificador com prefixo <span className="font-mono text-primary">fe80::</span> gera o link-local</li>
                </ol>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
