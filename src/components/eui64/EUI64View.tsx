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
        : "bg-secondary/30 border border-transparent hover:border-border"
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

    if (!macInput.trim()) { setError('Informe um endereço MAC.'); return; }
    if (!isValidMAC(macInput)) { setError('MAC address inválido. Use o formato XX:XX:XX:XX:XX:XX'); return; }
    if (!prefixInput.trim()) { setError('Informe um prefixo /64.'); return; }
    if (!isValidPrefix64(prefixInput)) { setError('Prefixo inválido. Use até 4 hextets (ex: 2001:db8::)'); return; }

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
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          Calculadora EUI-64 / SLAAC
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Converta o endereço MAC de um dispositivo em um identificador EUI-64 e obtenha o endereço IPv6 completo
          gerado automaticamente pelo dispositivo (SLAAC — sem precisar de servidor DHCP).
        </p>
      </div>

      <div className="space-y-6">
        {/* Input Card */}
        <motion.div
          className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-5"
          {...fadeUp}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground flex items-center gap-1.5">
                Endereço MAC do dispositivo
                {macValid === true && <Check className="w-3.5 h-3.5 text-primary" />}
              </label>
              <div className="relative">
                <Input
                  value={macInput}
                  onChange={e => setMacInput(e.target.value)}
                  placeholder="00:1A:2B:3C:4D:5E"
                  className={cn(
                    "font-mono text-sm bg-secondary/60 border-border/60 h-11 pr-10",
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Prefixo da rede <span className="font-normal text-muted-foreground">(/64)</span>
              </label>
              <Input
                value={prefixInput}
                onChange={e => setPrefixInput(e.target.value)}
                placeholder="Ex.: 2001:db8::  (seu prefixo /64)"
                className="font-mono text-sm bg-secondary/60 border-border/60 h-11"
                onKeyDown={e => e.key === 'Enter' && handleCalculate()}
              />
            </div>
          </div>

          {/* Quick fills */}
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
              <Zap className="w-3 h-3 text-primary/40" />
              <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
              Exemplos rápidos
            </summary>
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { mac: '00:1A:2B:3C:4D:5E', prefix: '2001:db8::', label: 'Dispositivo genérico' },
                { mac: 'AA:BB:CC:DD:EE:FF', prefix: '2001:db8::', label: 'MAC multicast' },
                { mac: '02:42:AC:11:00:02', prefix: 'fd00::',     label: 'Docker / ULA' },
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setMacInput(ex.mac); setPrefixInput(ex.prefix); }}
                  className="inline-flex flex-col text-left gap-0 text-xs px-2.5 py-1.5 rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-all"
                >
                  <span className="font-mono">{ex.mac}</span>
                  <span className="text-[10px] text-muted-foreground/70">{ex.label}</span>
                </button>
              ))}
            </div>
          </details>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Info className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleCalculate} className="gap-2 h-11 px-5 text-sm">
              <ArrowRight className="w-4 h-4" /> Calcular
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-2 h-11 text-sm">
              <RotateCcw className="w-4 h-4" /> Limpar
            </Button>
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-2">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  Resultados
                </h2>
                <ResultRow icon={Fingerprint} label="MAC normalizado" value={result.macNormalised} />
                <ResultRow icon={Fingerprint} label="Identificador EUI-64" value={result.eui64} highlight />
                <ResultRow icon={Globe} label="Endereço SLAAC" value={result.slaacAddress} fullValue={result.slaacAddressFull} highlight />
                <ResultRow icon={Link2} label="Endereço Link-Local" value={result.linkLocal} fullValue={result.linkLocalFull} />
              </div>

              {/* Collapsible info */}
              <details className="bg-card rounded-xl border border-border">
                <summary className="px-5 py-3.5 cursor-pointer flex items-center gap-2 text-sm font-medium text-foreground select-none hover:bg-secondary/30 rounded-xl transition-colors">
                  <Info className="w-4 h-4 text-primary" />
                  Como funciona o cálculo EUI-64
                </summary>
                <div className="px-5 pb-4 text-xs text-muted-foreground border-t border-border pt-3 space-y-3">
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>O MAC de 48 bits é dividido em duas metades de 3 bytes</li>
                    <li>Os bytes <span className="font-mono text-primary">FF:FE</span> são inseridos no meio → identificador de 64 bits (EUI-64)</li>
                    <li>Um bit do primeiro byte é modificado para marcar o endereço como localmente gerado</li>
                    <li>O EUI-64 é combinado com o prefixo de rede /64 → endereço SLAAC completo de 128 bits</li>
                    <li>O mesmo EUI-64 com o prefixo <span className="font-mono text-primary">fe80::</span> forma o endereço link-local (usado na rede local)</li>
                  </ol>
                  {/* Inline transformation diagram */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="bg-secondary/60 rounded-lg px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">MAC (48 bits)</span>
                      <span className="font-mono text-xs text-foreground">{result.macNormalised}</span>
                    </div>
                    <div className="bg-primary/8 border border-primary/20 rounded-lg px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">EUI-64 (64 bits)</span>
                      <span className="font-mono text-xs text-primary">{result.eui64}</span>
                    </div>
                    <div className="bg-primary/8 border border-primary/20 rounded-lg px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">SLAAC (128 bits)</span>
                      <span className="font-mono text-[11px] text-primary">{result.slaacAddress}</span>
                    </div>
                  </div>
                </div>
              </details>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
