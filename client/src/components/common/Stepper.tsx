import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDefinition {
  id: string;
  label: string;
  description?: string;
}

/**
 * Wizard progress indicator (Section 10).
 *
 * Rendered as an ordered list so the sequence is clear to screen readers, with
 * completed steps clickable to jump back and future steps disabled.
 */
export function Stepper({
  steps,
  currentIndex,
  onStepClick,
  className,
}: {
  steps: StepDefinition[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn('rail no-scrollbar gap-2', className)}>
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const clickable = Boolean(onStepClick) && index <= currentIndex;

        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick?.(index) : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : isComplete
                    ? 'border-border bg-card hover:border-primary/40'
                    : 'border-border/60 bg-muted/30',
                !clickable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isComplete
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block whitespace-nowrap text-xs font-medium',
                    isCurrent ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground sm:block">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
