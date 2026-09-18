import { AlertTriangle, CalendarX2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conflict } from '@/types/api';

/**
 * Surfaces the smart-itinerary rules (Section 15).
 *
 * Conflicts are advisory: they explain what clashes and how to resolve it, but
 * the traveller decides whether to keep the overlap.
 */
export function ConflictBanner({
  conflicts,
  className,
  onDismiss,
}: {
  conflicts: Conflict[];
  className?: string;
  onDismiss?: () => void;
}) {
  if (conflicts.length === 0) return null;

  const hasError = conflicts.some((conflict) => conflict.severity === 'error');

  return (
    <section
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-xl border p-4',
        hasError
          ? 'border-destructive/35 bg-destructive/5'
          : 'border-warning/40 bg-warning/10',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn('mt-0.5 size-5 shrink-0', hasError ? 'text-destructive' : 'text-warning')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-semibold">
            {conflicts.length === 1
              ? 'One scheduling warning'
              : `${conflicts.length} scheduling warnings`}
          </h3>
          <ul className="space-y-1.5">
            {conflicts.slice(0, 4).map((conflict, index) => (
              <li key={`${conflict.type}-${conflict.date}-${index}`} className="text-sm">
                <span className="text-foreground">{conflict.message}</span>
                <span className="block text-xs text-muted-foreground">{conflict.resolution}</span>
              </li>
            ))}
          </ul>
          {conflicts.length > 4 ? (
            <p className="text-xs text-muted-foreground">
              +{conflicts.length - 4} more on later days
            </p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Compact inline variant used inside the itinerary builder rows. */
export function ConflictHint({ message, className }: { message: string; className?: string }) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 rounded-md bg-warning/15 px-2 py-1 text-xs text-[color-mix(in_oklch,var(--warning),black_30%)] dark:text-warning',
        className,
      )}
    >
      <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** Shown when an itinerary has no scheduled items at all. */
export function EmptyItineraryHint({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <CalendarX2 className="size-4" aria-hidden="true" />
      Nothing scheduled yet — add an activity to start building your day.
    </p>
  );
}
