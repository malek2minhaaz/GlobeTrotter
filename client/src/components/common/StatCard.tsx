import * as React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/feedback';

/** Dashboard statistic tile (Section 9 / 39). */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  accent = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  to?: string;
  accent?: 'primary' | 'amber' | 'rose' | 'violet';
}) {
  const accents = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  } as const;

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={cn('flex size-10 items-center justify-center rounded-xl', accents[accent])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 space-y-0.5">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </>
  );

  const className = cn(
    'rounded-xl border border-border bg-card p-5 shadow-sm transition-all',
    to && 'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={label}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <Skeleton className="size-10 rounded-xl" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}
