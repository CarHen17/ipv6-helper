import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface StepIndicatorProps {
  currentStep: number;
  steps: { label: string }[];
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ currentStep, steps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full gap-1">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(stepNum)}
              className={cn(
                "flex items-center gap-2 rounded-full px-1 py-0.5 transition-colors",
                isClickable && "cursor-pointer hover:bg-primary/10",
                !isClickable && "cursor-default"
              )}
            >
              <motion.div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shrink-0",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "bg-primary text-primary-foreground shadow-sm shadow-primary/25",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}
                animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                {isCompleted ? <Check className="w-3 h-3" /> : stepNum}
              </motion.div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap hidden sm:block",
                  isActive ? "text-primary" : isCompleted ? "text-foreground/80" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 h-px rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
