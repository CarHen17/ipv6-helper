import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalculatorView } from '@/components/calculator/CalculatorView';
import { IPv4CalculatorView } from '@/components/calculator/IPv4CalculatorView';
import { cn } from '@/lib/utils';

type Mode = 'ipv4' | 'ipv6';

const Index = () => {
  const [mode, setMode] = useState<Mode>('ipv6');

  return (
    <div className="w-full">
      <div className="flex justify-center pt-6 pb-2">
        <div className="inline-flex items-center rounded-full border border-border bg-muted p-1 gap-1">
          {(['ipv4', 'ipv6'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'relative px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200',
                mode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="calculator-toggle"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{m === 'ipv4' ? 'IPv4' : 'IPv6'}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'ipv4' ? <IPv4CalculatorView /> : <CalculatorView />}
    </div>
  );
};

export default Index;
