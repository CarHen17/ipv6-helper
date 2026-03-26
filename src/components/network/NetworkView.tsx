import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, RotateCcw, Loader2, AlertTriangle, CheckCircle2,
  XCircle, Key, Eye, EyeOff, Save, Wifi, GitBranch, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  pingTarget, tracerouteTarget,
  getPing6ApiKey, setPing6ApiKey,
  type PingResult, type TracerouteResult,
} from '@/lib/ping6-api';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

const EXAMPLES = [
  '2001:4860:4860::8888',
  '2606:4700:4700::1111',
  'google.com',
  'cloudflare.com',
];

// ── API Key Config ────────────────────────────────────────────────────────────

function ApiKeyConfig() {
  const [open, setOpen]       = useState(false);
  const [key, setKey]         = useState(() => getPing6ApiKey());
  const [show, setShow]       = useState(false);
  const [dirty, setDirty]     = useState(false);
  const hasKey = !!getPing6ApiKey();

  const handleChange = (v: string) => { setKey(v); setDirty(true); };
  const handleSave = () => {
    setPing6ApiKey(key);
    setDirty(false);
    toast.success(key.trim() ? 'Chave API salva.' : 'Chave API removida.');
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium text-foreground">Chave API (ping6.net)</span>
          {hasKey && !dirty && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              configurada
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ping e Traceroute requerem uma chave API do{' '}
                <span className="text-primary font-medium">ping6.net</span>.
                A chave é armazenada localmente no seu navegador.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={key}
                    onChange={e => handleChange(e.target.value)}
                    type={show ? 'text' : 'password'}
                    placeholder="Sua chave API..."
                    className="font-mono text-sm bg-secondary/60 border-border/60 h-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!dirty}
                  className="gap-1.5 h-9 text-xs px-3"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Ping Tab ──────────────────────────────────────────────────────────────────

function PingTab() {
  const [target, setTarget]   = useState('');
  const [count, setCount]     = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PingResult | null>(null);
  const [error, setError]     = useState('');

  const handlePing = async () => {
    const t = target.trim();
    if (!t) { toast.error('Insira um endereço IPv6 ou hostname.'); return; }
    if (!getPing6ApiKey()) { toast.error('Configure sua chave API acima para usar o Ping.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await pingTarget(t, count);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao executar ping';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const lossColor = (loss: number) =>
    loss === 0 ? 'text-emerald-400' : loss < 50 ? 'text-yellow-400' : 'text-destructive';

  const rttColor = (rtt: number, avg: number) => {
    if (rtt <= avg * 0.8) return 'text-emerald-400';
    if (rtt <= avg * 1.5) return 'text-foreground';
    return 'text-yellow-400';
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Destino (IPv6 ou hostname)</label>
          <div className="flex gap-2">
            <Input
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePing()}
              placeholder="Ex.: 2001:4860:4860::8888"
              className="font-mono text-sm bg-secondary/60 border-border/60 flex-1 h-11"
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] text-muted-foreground">Exemplos:</span>
            {EXAMPLES.slice(0, 2).map(ex => (
              <button key={ex} onClick={() => setTarget(ex)}
                className="text-[11px] font-mono text-primary hover:text-primary/80 transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Packet count */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pacotes: {count}
          </label>
          <div className="flex gap-1.5">
            {[1, 2, 4, 6, 10].map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={cn(
                  'w-10 h-8 rounded-lg text-xs font-mono border transition-colors',
                  count === n
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setTarget(''); setResult(null); setError(''); }} disabled={!target && !result} className="gap-2 h-10 text-sm">
            <RotateCcw className="w-4 h-4" /> Limpar
          </Button>
          <Button onClick={handlePing} disabled={loading || !target.trim()} className="gap-2 h-10 px-5 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            Pingar
          </Button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3" {...fadeUp}>
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Erro no ping</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Transmitidos', value: result.stats.transmitted, icon: Wifi },
                { label: 'Recebidos', value: result.stats.received, icon: CheckCircle2 },
                { label: 'Perda', value: `${result.stats.loss}%`, icon: XCircle, color: lossColor(result.stats.loss) },
                { label: 'RTT Médio', value: `${result.stats.avg.toFixed(1)}ms`, icon: Activity },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className={cn('w-4 h-4', color ?? 'text-primary')} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className={cn('text-base font-bold leading-tight', color ?? 'text-foreground')}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-packet */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/60">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Pacotes
                </h3>
              </div>
              <div className="divide-y divide-border/30">
                {result.results.map(hop => (
                  <div key={hop.seq} className="flex items-center px-4 py-2.5 gap-4">
                    <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">#{hop.seq}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-mono font-semibold', rttColor(hop.rtt, result.stats.avg))}>
                          {hop.rtt.toFixed(1)}ms
                        </span>
                        <span className="text-[11px] text-muted-foreground">TTL {hop.ttl}</span>
                      </div>
                      {/* RTT bar */}
                      <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden max-w-[200px]">
                        <div
                          className={cn('h-full rounded-full transition-all', rttColor(hop.rtt, result.stats.avg).replace('text-', 'bg-'))}
                          style={{ width: `${Math.min((hop.rtt / result.stats.max) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground flex gap-4">
                <span>Min: <strong className="text-foreground">{result.stats.min.toFixed(1)}ms</strong></span>
                <span>Avg: <strong className="text-foreground">{result.stats.avg.toFixed(1)}ms</strong></span>
                <span>Max: <strong className="text-foreground">{result.stats.max.toFixed(1)}ms</strong></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Traceroute Tab ────────────────────────────────────────────────────────────

function TracerouteTab() {
  const [target, setTarget]     = useState('');
  const [maxHops, setMaxHops]   = useState(30);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<TracerouteResult | null>(null);
  const [error, setError]       = useState('');

  const handleTrace = async () => {
    const t = target.trim();
    if (!t) { toast.error('Insira um endereço IPv6 ou hostname.'); return; }
    if (!getPing6ApiKey()) { toast.error('Configure sua chave API acima para usar o Traceroute.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await tracerouteTarget(t, maxHops);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no traceroute';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Max RTT for bar normalization
  const maxRtt = result
    ? Math.max(...result.hops.map(h => h.rtt), 1)
    : 1;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Destino (IPv6 ou hostname)</label>
          <Input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrace()}
            placeholder="Ex.: google.com"
            className="font-mono text-sm bg-secondary/60 border-border/60 h-11"
            spellCheck={false}
          />
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] text-muted-foreground">Exemplos:</span>
            {EXAMPLES.slice(2).map(ex => (
              <button key={ex} onClick={() => setTarget(ex)}
                className="text-[11px] font-mono text-primary hover:text-primary/80 transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Max hops */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Máx. de hops: {maxHops}
          </label>
          <div className="flex gap-1.5">
            {[10, 20, 30, 64].map(n => (
              <button
                key={n}
                onClick={() => setMaxHops(n)}
                className={cn(
                  'w-12 h-8 rounded-lg text-xs font-mono border transition-colors',
                  maxHops === n
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setTarget(''); setResult(null); setError(''); }} disabled={!target && !result} className="gap-2 h-10 text-sm">
            <RotateCcw className="w-4 h-4" /> Limpar
          </Button>
          <Button onClick={handleTrace} disabled={loading || !target.trim()} className="gap-2 h-10 px-5 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
            Rastrear
          </Button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3" {...fadeUp}>
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Erro no traceroute</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  Rota para <code className="text-primary font-mono text-xs">{result.ip}</code>
                </h3>
                <span className="text-xs text-muted-foreground">{result.hops.length} hops</span>
              </div>
              <div className="divide-y divide-border/20">
                {result.hops.map((hop, i) => {
                  const isFirst = i === 0;
                  const isLast  = i === result.hops.length - 1;
                  return (
                    <div key={hop.hop} className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/20',
                      isFirst && 'bg-primary/5',
                      isLast  && 'bg-emerald-500/5',
                    )}>
                      {/* Hop number + connector */}
                      <div className="flex flex-col items-center shrink-0 w-6">
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                          isLast  ? 'bg-emerald-500 text-white' :
                          isFirst ? 'bg-primary text-primary-foreground' :
                          'bg-secondary text-muted-foreground'
                        )}>
                          {hop.hop}
                        </div>
                        {!isLast && <div className="w-px h-3 bg-border/50 mt-0.5" />}
                      </div>

                      {/* IP + hostname */}
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-foreground truncate block">
                          {hop.ip}
                        </code>
                        {hop.hostname && hop.hostname !== hop.ip && (
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {hop.hostname}
                          </span>
                        )}
                        {/* RTT bar */}
                        <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden max-w-[160px]">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              hop.rtt < maxRtt * 0.3  ? 'bg-emerald-400' :
                              hop.rtt < maxRtt * 0.7  ? 'bg-yellow-400' : 'bg-orange-400'
                            )}
                            style={{ width: `${(hop.rtt / maxRtt) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* RTT */}
                      <span className={cn(
                        'text-sm font-mono font-semibold shrink-0',
                        hop.rtt < maxRtt * 0.3  ? 'text-emerald-400' :
                        hop.rtt < maxRtt * 0.7  ? 'text-yellow-400' : 'text-orange-400'
                      )}>
                        {hop.rtt.toFixed(1)}ms
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function NetworkView() {
  return (
    <motion.div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" {...fadeUp}>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Ferramentas de Rede
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ping e Traceroute IPv6 via servidores do ping6.net.
        </p>
      </div>

      <div className="space-y-5">
        {/* API Key config */}
        <ApiKeyConfig />

        {/* Info notice */}
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ping e Traceroute são executados a partir dos servidores do{' '}
            <span className="font-medium text-foreground">ping6.net</span>, não do seu computador.
            Os resultados refletem a conectividade da infraestrutura deles com o destino.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ping">
          <TabsList className="w-full">
            <TabsTrigger value="ping" className="flex-1 gap-2 text-sm">
              <Wifi className="w-4 h-4" /> Ping
            </TabsTrigger>
            <TabsTrigger value="traceroute" className="flex-1 gap-2 text-sm">
              <GitBranch className="w-4 h-4" /> Traceroute
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ping" className="mt-5">
            <PingTab />
          </TabsContent>
          <TabsContent value="traceroute" className="mt-5">
            <TracerouteTab />
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
