import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Single-select filter chips.
 *
 * Rendered as a radio group so arrow keys move between options and the current
 * selection is announced (Section 37).
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('rail no-scrollbar -mx-1 px-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('text-xs', active ? 'opacity-80' : 'opacity-60')}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Result count line, announced politely as filters change. */
export function ResultCount({
  count,
  noun,
  className,
}: {
  count: number;
  noun: string;
  className?: string;
}) {
  return (
    <p role="status" aria-live="polite" className={cn('text-sm text-muted-foreground', className)}>
      <span className="font-medium text-foreground">{count}</span> {noun}
      {count === 1 ? '' : 's'} found
    </p>
  );
}

/** Appears only when at least one filter is narrowing the result set. */
export function ClearFilters({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('text-muted-foreground', className)}
    >
      <X />
      Clear filters
    </Button>
  );
}
