import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Copy, ArrowLeftRight, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reverseIPv6, REVERSE_EXAMPLES, type ReverseResult } from '@/lib/ipv6-reverse-utils';
import { reverseIPv4, REVERSE_IPV4_EXAMPLES, type IPv4ReverseResult } from '@/lib/ipv4-reverse-utils';

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

type Mode = 'ipv6' | 'ipv4';

export function IPv6ReverseView() {
  const [mode, setMode] = useState<Mode>('ipv6');
  const [input, setInput] = useState('');
  const [result6, setResult6] = useState<ReverseResult | null>(null);
  const [result4, setResult4] = useState<IPv4ReverseResult | null>(null);
  const [error, setError] = useState('');

  const result = mode === 'ipv6' ? result6 : result4;

  const handleConvert = () => {
    setError('');
    if (mode === 'ipv6') {
      const r = reverseIPv6(input.trim());
      if (!r) {
        setError('Endereço IPv6 inválido. Verifique a sintaxe e tente novamente.');
        setResult6(null);
        return;
      }
      setResult6(r);
    } else {
      const r = reverseIPv4(input.trim());
      if (!r) {
        setError('Endereço IPv4 inválido. Use o formato 192.168.1.1 ou 192.168.1.0/24.');
        setResult4(null);
        return;
      }
      setResult4(r);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConvert();
  };

  const handleReset = () => {
    setInput('');
    setResult6(null);
    setResult4(null);
    setError('');
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setInput('');
    setResult6(null);
    setResult4(null);
    setError('');
  };

  const handleExample = (value: string) => {
    setInput(value);
    setError('');
    if (mode === 'ipv6') {
      setResult6(reverseIPv6(value));
    } else {
      setResult4(reverseIPv4(value));
    }
  };

  const examples = mode === 'ipv6' ? REVERSE_EXAMPLES : REVERSE_IPV4_EXAMPLES;

  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" /> Zona PTR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gera notação {mode === 'ipv6' ? 'ip6.arpa' : 'in-addr.arpa'} para registros PTR e delegações de DNS reverso.
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1 mt-1 shrink-0">
            <RefreshCw className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-lg w-fit mb-5 border border-border/40">
        {(['ipv6', 'ipv4'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
              mode === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'ipv6' ? 'IPv6' : 'IPv4'}
          </button>
        ))}
      </div>

      {/* Input card */}
      <div className="bg-card rounded-xl border border-border p-5 md:p-6 space-y-4">
        {/* What is this? */}
        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
            <Info className="w-3 h-3 text-primary/60" />
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
            O que é DNS reverso {mode === 'ipv6' ? 'IPv6' : 'IPv4'}?
          </summary>
          <div className="mt-2 flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
            {mode === 'ipv6' ? (
              <span>
                Para IPv6, cada nibble (dígito hex) do endereço expandido é invertido e separado por pontos, formando
                um nome no domínio <code className="font-mono text-foreground">ip6.arpa</code>.
                Aceita endereço individual ou bloco CIDR (ex: <code className="font-mono text-foreground">2001:db8::/32</code>).
              </span>
            ) : (
              <span>
                Para IPv4, os octetos do endereço são invertidos, formando um nome no domínio{' '}
                <code className="font-mono text-foreground">in-addr.arpa</code>.
                Para blocos fora dos limites de octeto (ex: <code className="font-mono text-foreground">/25</code>),
                a delegação usa a notação RFC 2317 (CLASSLESS).
                Aceita endereço individual ou bloco CIDR (ex: <code className="font-mono text-foreground">192.168.1.0/24</code>).
              </span>
            )}
          </div>
        </details>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Endereço {mode === 'ipv6' ? 'IPv6' : 'IPv4'} ou bloco CIDR
          </label>
          <Input
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'ipv6' ? 'Ex.: 2001:db8::1  ou  2001:db8::/32' : 'Ex.: 192.168.1.1  ou  192.168.1.0/24'}
            className="font-mono text-sm bg-secondary/60 border-border/60 h-11"
            spellCheck={false}
          />
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>

        {/* Quick examples */}
        <details className="group">
          <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit select-none">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block">›</span>
            Exemplos rápidos
          </summary>
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {examples.map(ex => (
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

        <div className="flex flex-col items-end gap-1 pt-1">
          <Button onClick={handleConvert} className="gap-2 h-11 px-5 text-sm" disabled={!input.trim()}>
            <ArrowLeftRight className="w-4 h-4" /> Converter
          </Button>
        </div>
      </div>

      {/* Results — IPv6 */}
      {mode === 'ipv6' && result6 && (
        <motion.div
          className="mt-4 bg-card rounded-xl border border-border p-5 md:p-6 space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Resultado</h2>
            </div>
            <CopyRow label="Endereço expandido (128 bits)" value={result6.expanded} />
            <CopyRow
              label={result6.prefix !== undefined ? `PTR — endereço de rede /${result6.prefix}` : 'Registro PTR (nome completo — 32 nibbles)'}
              value={result6.fullReverse}
              highlight
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nomes de zona de DNS reverso
            </p>
            <p className="text-xs text-muted-foreground">
              Use estes nomes para delegar zonas de DNS reverso ao seu provedor ou servidor DNS.
            </p>
            <div className="space-y-2">
              {result6.zones.map(z => (
                <div key={z.prefix} className="relative">
                  <CopyRow
                    label={`/${z.prefix}${!z.onNibble ? ' (limite de nibble mais próximo: /' + Math.floor(z.prefix / 4) * 4 + ')' : ''}`}
                    value={z.zone}
                  />
                  {result6.prefix !== undefined && z.prefix === result6.prefix && (
                    <span className="absolute top-2.5 right-10 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                      seu bloco
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <details className="bg-card rounded-xl border border-border group">
            <summary className="px-5 py-3.5 cursor-pointer flex items-center gap-2 text-sm font-medium text-foreground select-none hover:bg-secondary/30 rounded-xl transition-colors list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <Info className="w-4 h-4 text-primary" />
              Como usar
            </summary>
            <div className="px-5 pb-4 text-xs text-muted-foreground border-t border-border pt-3 space-y-1.5">
              <p>
                <strong>Registro PTR</strong> — aponta o endereço IP completo para um hostname. Configure na zona
                do seu bloco mais específico (ex: <code className="font-mono text-foreground">{result6.zones.at(-1)?.zone ?? 'zona.ip6.arpa'}</code>).
              </p>
              <p>
                <strong>Delegação de zona</strong> — para delegar o DNS reverso de um bloco ao cliente, crie
                um registro NS apontando o nome da zona correspondente ao prefixo delegado.
              </p>
            </div>
          </details>
        </motion.div>
      )}

      {/* Results — IPv4 */}
      {mode === 'ipv4' && result4 && (
        <motion.div
          className="mt-4 bg-card rounded-xl border border-border p-5 md:p-6 space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Resultado</h2>
            </div>
            <CopyRow label="Endereço de rede" value={result4.prefix !== undefined ? `${result4.address}/${result4.prefix}` : result4.address} />
            <CopyRow
              label={result4.prefix !== undefined ? `PTR — rede /${result4.prefix}` : 'Registro PTR (endereço completo)'}
              value={result4.fullReverse}
              highlight
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nomes de zona de DNS reverso
            </p>
            <p className="text-xs text-muted-foreground">
              Use estes nomes para delegar zonas de DNS reverso ao seu provedor ou servidor DNS.
            </p>
            <div className="space-y-2">
              {result4.zones.map(z => (
                <div key={z.prefix} className="space-y-2">
                  <div className="relative">
                    <CopyRow
                      label={`/${z.prefix}${!z.onOctet ? ' (zona pai — limite de octeto)' : ''}`}
                      value={z.zone}
                    />
                    {result4.prefix !== undefined && z.prefix === result4.prefix && z.onOctet && (
                      <span className="absolute top-2.5 right-10 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                        seu bloco
                      </span>
                    )}
                  </div>
                  {z.rfc2317 && (
                    <div className="relative">
                      <CopyRow
                        label={`/${z.prefix} — delegação RFC 2317 (CLASSLESS)`}
                        value={z.rfc2317}
                        highlight
                      />
                      {result4.prefix !== undefined && z.prefix === result4.prefix && (
                        <span className="absolute top-2.5 right-10 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                          seu bloco
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <details className="bg-card rounded-xl border border-border group">
            <summary className="px-5 py-3.5 cursor-pointer flex items-center gap-2 text-sm font-medium text-foreground select-none hover:bg-secondary/30 rounded-xl transition-colors list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <Info className="w-4 h-4 text-primary" />
              Como usar
            </summary>
            <div className="px-5 pb-4 text-xs text-muted-foreground border-t border-border pt-3 space-y-1.5">
              <p>
                <strong>Registro PTR</strong> — aponta o endereço completo para um hostname. Para um host como{' '}
                <code className="font-mono text-foreground">{result4.address}</code>, crie o PTR na zona{' '}
                <code className="font-mono text-foreground">{result4.zones.find(z => z.prefix === 24)?.zone ?? result4.zones.at(-1)?.zone}</code>.
              </p>
              {result4.zones.some(z => z.rfc2317) && (
                <p>
                  <strong>RFC 2317 (CLASSLESS)</strong> — para blocos menores que /24 (ex: /25, /26), a zona pai ({result4.zones.find(z => !z.onOctet)?.zone}) deve conter
                  registros CNAME delegando para a subzona no formato <code className="font-mono text-foreground">rede/prefixo.zona.in-addr.arpa</code>.
                </p>
              )}
              <p>
                <strong>Delegação de zona</strong> — crie registros NS na zona pai apontando para o servidor DNS
                responsável pelo bloco delegado.
              </p>
            </div>
          </details>
        </motion.div>
      )}
    </motion.div>
  );
}
