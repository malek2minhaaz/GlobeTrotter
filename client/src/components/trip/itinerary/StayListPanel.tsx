import { ArrowDown, ArrowUp, CalendarDays, MapPin, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { IconTooltip } from '@/components/ui/tooltip-checkbox';
import { SmartImage } from '@/components/common/SmartImage';
import { formatDateRange, pluralise } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TripStop } from '@/types/api';

/**
 * Cities on the trip (Section 13, left pane).
 *
 * Reordering uses explicit controls rather than a drag handle: changing city order
 * changes which days belong to which city, so it deserves a deliberate action with
 * a clear label rather than an easy-to-trigger gesture.
 */
export function StayListPanel({
  stops,
  activeStopId,
  tripStart,
  tripEnd,
  onSelect,
  onReorder,
  onUpdateDates,
  onRemove,
  onAddCity,
  className,
}: {
  stops: TripStop[];
  activeStopId: string | null;
  tripStart: string;
  tripEnd: string;
  onSelect: (stopId: string) => void;
  onReorder: (stopId: string, direction: -1 | 1) => void;
  onUpdateDates: (stopId: string, patch: { startDate?: string; endDate?: string }) => void;
  onRemove: (stop: TripStop) => void;
  onAddCity: () => void;
  className?: string;
}) {
  const ordered = [...stops].sort((a, b) => a.order - b.order);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Cities</h2>
        <Badge variant="secondary">{ordered.length}</Badge>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No destinations yet. Add a city to start planning your days.
        </p>
      ) : (
        <ol className="space-y-2">
          {ordered.map((stop, index) => {
            const active = stop.id === activeStopId;
            return (
              <li
                key={stop.id}
                className={cn(
                  'space-y-2 rounded-xl border p-3 transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(stop.id)}
                  className="flex w-full items-center gap-3 text-left"
                  aria-pressed={active}
                  aria-label={`Show days in ${stop.city.name}`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <SmartImage
                    src={stop.city.image}
                    alt=""
                    decorative
                    seed={`${stop.city.name} ${stop.city.country}`}
                    className="size-10 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{stop.city.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {pluralise(stop.dayCount, 'day')} ·{' '}
                      {pluralise(stop.itemCount, 'activity', 'activities')}
                    </span>
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`stay-${stop.id}-from`} className="text-[11px]">
                      Arrive
                    </Label>
                    <Input
                      id={`stay-${stop.id}-from`}
                      type="date"
                      value={stop.startDate}
                      min={tripStart}
                      max={tripEnd}
                      className="h-8 px-2 text-xs"
                      onChange={(event) =>
                        onUpdateDates(stop.id, { startDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`stay-${stop.id}-to`} className="text-[11px]">
                      Leave
                    </Label>
                    <Input
                      id={`stay-${stop.id}-to`}
                      type="date"
                      value={stop.endDate}
                      min={stop.startDate}
                      max={tripEnd}
                      className="h-8 px-2 text-xs"
                      onChange={(event) => onUpdateDates(stop.id, { endDate: event.target.value })}
                    />
                  </div>
                </div>

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  {formatDateRange(stop.startDate, stop.endDate)}
                </p>

                <div className="flex items-center justify-end gap-0.5">
                  <IconTooltip label="Move earlier in the route">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => onReorder(stop.id, -1)}
                      aria-label={`Move ${stop.city.name} earlier`}
                    >
                      <ArrowUp />
                    </Button>
                  </IconTooltip>
                  <IconTooltip label="Move later in the route">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === ordered.length - 1}
                      onClick={() => onReorder(stop.id, 1)}
                      aria-label={`Move ${stop.city.name} later`}
                    >
                      <ArrowDown />
                    </Button>
                  </IconTooltip>
                  <IconTooltip label="Remove this city">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onRemove(stop)}
                      aria-label={`Remove ${stop.city.name} from the trip`}
                    >
                      <Trash2 />
                    </Button>
                  </IconTooltip>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddCity}>
        <Plus />
        Add city
      </Button>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="mt-px size-3 shrink-0" aria-hidden="true" />
        Removing a city also removes the activities scheduled there.
      </p>
    </div>
  );
}
