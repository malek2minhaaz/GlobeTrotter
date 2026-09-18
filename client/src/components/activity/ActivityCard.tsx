import { Clock, MapPin, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SmartImage } from '@/components/common/SmartImage';
import { activityCategoryIcon, activityCategoryLabel } from '@/lib/categoryMeta';
import { formatCurrency, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import type { Activity } from '@/types/api';

/**
 * Activity presentation (Section 14).
 *
 * `card` is used in discovery grids and `row` in the itinerary builder's search
 * panel, where the list is narrow and vertical space is scarce.
 */
export function ActivityCard({
  activity,
  onAdd,
  adding = false,
  added = false,
  variant = 'card',
  showCity = false,
  className,
}: {
  activity: Activity;
  onAdd?: (activity: Activity) => void;
  adding?: boolean;
  added?: boolean;
  variant?: 'card' | 'row';
  showCity?: boolean;
  className?: string;
}) {
  const currency = useCurrency();
  const Icon = activityCategoryIcon(activity.category);

  const addButton = onAdd ? (
    <Button
      type="button"
      size={variant === 'row' ? 'sm' : 'default'}
      variant={added ? 'secondary' : 'default'}
      loading={adding}
      onClick={() => onAdd(activity)}
      aria-label={`Add ${activity.name} to your itinerary`}
      className={variant === 'card' ? 'w-full' : undefined}
    >
      {added ? <Icon /> : <Plus />}
      {added ? 'Added' : 'Add to itinerary'}
    </Button>
  ) : null;

  if (variant === 'row') {
    return (
      <article
        className={cn(
          'flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40',
          className,
        )}
      >
        <SmartImage
          src={activity.image}
          alt=""
          decorative
          seed={activity.name}
          className="size-16 shrink-0 rounded-lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-tight">{activity.name}</h3>
            <span className="shrink-0 text-sm font-semibold text-primary">
              {formatCurrency(activity.estimatedCost, currency)}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              <Icon aria-hidden="true" />
              {activityCategoryLabel(activity.category)}
            </Badge>
            <Badge variant="outline">
              <Clock aria-hidden="true" />
              {formatDuration(activity.duration)}
            </Badge>
            {showCity && activity.city ? (
              <Badge variant="outline">
                <MapPin aria-hidden="true" />
                {activity.city.name}
              </Badge>
            ) : null}
          </div>
          {addButton}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <SmartImage
          src={activity.image}
          alt=""
          decorative
          seed={activity.name}
          className="size-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <Badge variant="solid">
            <Icon aria-hidden="true" />
            {activityCategoryLabel(activity.category)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{activity.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-primary">
            {formatCurrency(activity.estimatedCost, currency)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            <Clock aria-hidden="true" />
            {formatDuration(activity.duration)}
          </Badge>
          {showCity && activity.city ? (
            <Badge variant="outline">
              <MapPin aria-hidden="true" />
              {activity.city.name}
            </Badge>
          ) : null}
        </div>
        {addButton ? <div className="mt-auto pt-1">{addButton}</div> : null}
      </div>
    </article>
  );
}

/** Compact chip used in the trip summary sidebar. */
export function ActivityChip({
  name,
  cost,
  onRemove,
}: {
  name: string;
  cost: number;
  onRemove?: () => void;
}) {
  const currency = useCurrency();
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
      <span className="truncate font-medium">{name}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground">{formatCurrency(cost, currency)}</span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        ) : null}
      </span>
    </div>
  );
}
