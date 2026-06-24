import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalculatorView } from '@/components/calculator/CalculatorView';
import { IPv4CalculatorView } from '@/components/calculator/IPv4CalculatorView';
import { cn } from '@/lib/utils';

type Mode = 'ipv4' | 'ipv6';

const MODES: { value: Mode; label: string; badge: string }[] = [
  { value: 'ipv4', label: 'IPv4', badge: '32-bit' },
  { value: 'ipv6', label: 'IPv6', badge: '128-bit' },
];

const Index = () => {
  const [mode, setMode] = useState<Mode>('ipv6');

  return (
    <div className="w-full">
      {/* Toggle */}
      <div className="flex justify-center pt-6 pb-2">
        <div className="inline-flex items-center rounded-full border border-border bg-muted p-1 gap-0.5 shadow-sm">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                'relative flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200',
                mode === m.value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode === m.value && (
                <motion.span
                  layoutId="calculator-toggle"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{m.label}</span>
              <span className={cn(
                'relative z-10 text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-colors',
                mode === m.value
                  ? 'bg-white/20 text-primary-foreground/80'
                  : 'bg-muted-foreground/10 text-muted-foreground/60',
              )}>
                {m.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Both calculators stay mounted — only visibility toggles */}
      <div className={mode === 'ipv4' ? undefined : 'hidden'}>
        <IPv4CalculatorView />
      </div>
      <div className={mode === 'ipv6' ? undefined : 'hidden'}>
        <CalculatorView />
      </div>
    </div>
  );
};

export default Index;
