import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Copy, ArrowLeftRight, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reverseIPv6, REVERSE_EXAMPLES, type ReverseResult } from '@/lib/ipv6-reverse-utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado!'),
    () => toast.error('Falha ao copiar'),
  );
}

function CopyRow({ label, value, mono = true, highlight = false }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-start justify-between gap-3 rounded-lg px-3.5 py-3',
      highlight ? 'bg-primary/8 border border-primary/20' : 'bg-secondary/30',
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <p className={cn('text-sm break-all leading-relaxed', mono && 'font-mono font-medium', highlight ? 'text-primary' : 'text-foreground')}>
          {value}
        </p>
      </div>
      <button
        onClick={() => copy(value)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
        title="Copiar"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function IPv6ReverseView() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [error, setError] = useState('');

  const handleConvert = () => {
    setError('');
    const r = reverseIPv6(input.trim());
    if (!r) {
      setError('Endereço IPv6 inválido. Verifique a sintaxe e tente novamente.');
      setResult(null);
      return;
    }
    setResult(r);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConvert();
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError('');
  };

  const handleExample = (value: string) => {
    setInput(value);
    setError('');
    const r = reverseIPv6(value);
    setResult(r);
  };

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-primary" /> IP Reverso IPv6
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gera a notação reversa DNS (ip6.arpa) usada em registros PTR e delegações de zona de DNS reverso.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4">
        {/* What is this? */}
        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
            <Info className="w-3 h-3 text-primary/60" />
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
            O que é DNS reverso IPv6?
          </summary>
          <div className="mt-2 flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
            <span>
              O DNS reverso mapeia endereços IP a nomes de domínio. Para IPv6, cada nibble (dígito hex) do endereço
              expandido é invertido e separado por pontos, formando um nome no domínio <code className="font-mono text-foreground">ip6.arpa</code>.
              Aceita endereço individual ou bloco CIDR (ex: <code className="font-mono text-foreground">2001:db8::/32</code>).
            </span>
          </div>
        </details>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Endereço IPv6 ou bloco CIDR</label>
          <Input
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Ex.: 2001:db8::1  ou  2001:db8::/32"
            className="font-mono text-sm bg-secondary/60 border-border/60 h-11"
            spellCheck={false}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>

        {/* Quick examples */}
        <details className="group">
          <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
            Exemplos rápidos
          </summary>
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {REVERSE_EXAMPLES.map(ex => (
              <button
                key={ex.value}
                onClick={() => handleExample(ex.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors font-mono"
              >
                {ex.value}
              </button>
            ))}
          </div>
        </details>

        <div className="flex items-center justify-end pt-1">
          <Button onClick={handleConvert} className="gap-2 h-11 px-5 text-sm" disabled={!input.trim()}>
            <ArrowLeftRight className="w-4 h-4" /> Converter
          </Button>
        </div>
        {result && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs text-muted-foreground h-8">
              <RefreshCw className="w-3 h-3" /> Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <motion.div
          className="mt-4 bg-card rounded-xl border border-border p-5 md:p-6 space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Address info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Resultado</h2>
            </div>

            <CopyRow label="Endereço expandido (128 bits)" value={result.expanded} />
            <CopyRow
              label={result.prefix !== undefined ? `PTR — endereço de rede /${result.prefix}` : 'Registro PTR (nome completo — 32 nibbles)'}
              value={result.fullReverse}
              highlight
            />
          </div>

          {/* Zone names */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nomes de zona de DNS reverso
            </p>
            <p className="text-xs text-muted-foreground">
              Use estes nomes para delegar zonas de DNS reverso ao seu provedor ou servidor DNS.
            </p>
            <div className="space-y-2">
              {result.zones.map(z => (
                <div key={z.prefix} className="relative">
                  <CopyRow
                    label={`/${z.prefix}${!z.onNibble ? ' (limite de nibble mais próximo: /' + Math.floor(z.prefix / 4) * 4 + ')' : ''}`}
                    value={z.zone}
                  />
                  {result.prefix !== undefined && z.prefix === result.prefix && (
                    <span className="absolute top-2.5 right-10 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                      seu bloco
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Explanation */}
          <details className="bg-card rounded-xl border border-border group">
            <summary className="px-5 py-3.5 cursor-pointer flex items-center gap-2 text-sm font-medium text-foreground select-none hover:bg-secondary/30 rounded-xl transition-colors list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <Info className="w-4 h-4 text-primary" />
              Como usar
            </summary>
            <div className="px-5 pb-4 text-xs text-muted-foreground border-t border-border pt-3 space-y-1.5">
              <p>
                <strong>Registro PTR</strong> — aponta o endereço IP completo para um hostname. Configure na zona
                do seu bloco mais específico (ex: <code className="font-mono text-foreground">{result.zones.at(-1)?.zone ?? 'zona.ip6.arpa'}</code>).
              </p>
              <p>
                <strong>Delegação de zona</strong> — para delegar o DNS reverso de um bloco ao cliente, crie
                um registro NS apontando o nome da zona correspondente ao prefixo delegado.
              </p>
            </div>
          </details>
        </motion.div>
      )}
    </motion.div>
  );
}
