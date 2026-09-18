import * as React from 'react';
import { CalendarDays, Clock, MapPin, Route, StickyNote, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { SmartImage } from '@/components/common/SmartImage';
import { activityCategoryIcon, activityCategoryLabel } from '@/lib/categoryMeta';
import { formatCurrency, formatDateRange, formatTime, pluralise } from '@/lib/format';
import { daysBetween } from '@/lib/wizard';
import { cn } from '@/lib/utils';
import type { ItineraryItem, TripDetail, TripStop } from '@/types/api';

/**
 * Read-only itinerary (Section 16).
 *
 * Shared by the trip overview and the public shared page, so a visitor sees
 * exactly the same plan the owner does. `list` groups by city then day, while
 * `timeline` follows the trip chronologically across city boundaries.
 */

export type ItineraryMode = 'list' | 'timeline';

export interface DayPlan {
  date: string;
  dayNumber: number;
  stop: TripStop | null;
  items: ItineraryItem[];
}

/** Flattens the whole trip into chronological days, city included. */
export function buildDayPlans(trip: TripDetail): DayPlan[] {
  const sortedStops = [...trip.stops].sort((a, b) => a.order - b.order);
  const plans: DayPlan[] = [];
  let dayNumber = 1;

  // Days come from the stays, so a city with nothing planned still shows up —
  // an empty day is information, not a gap.
  for (const stop of sortedStops) {
    for (const date of daysBetween(stop.startDate, stop.endDate)) {
      plans.push({
        date,
        dayNumber: dayNumber++,
        stop,
        items: trip.itineraryItems
          .filter((item) => item.date === date)
          .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order),
      });
    }
  }

  // Anything scheduled outside a stay still needs to be visible somewhere.
  const covered = new Set(plans.map((plan) => plan.date));
  const orphans = Array.from(
    new Set(trip.itineraryItems.map((item) => item.date).filter((date) => !covered.has(date))),
  ).sort();

  for (const date of orphans) {
    plans.push({
      date,
      dayNumber: dayNumber++,
      stop: null,
      items: trip.itineraryItems
        .filter((item) => item.date === date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
  }

  return plans;
}

export function itineraryTotal(trip: TripDetail): number {
  return trip.itineraryItems.reduce((total, item) => total + item.effectiveCost, 0);
}

export function ReadOnlyItinerary({
  trip,
  mode = 'list',
  currency = 'INR',
  showCosts = true,
  className,
}: {
  trip: TripDetail;
  mode?: ItineraryMode;
  currency?: string;
  showCosts?: boolean;
  className?: string;
}) {
  const plans = React.useMemo(() => buildDayPlans(trip), [trip]);

  if (trip.stops.length === 0 && trip.itineraryItems.length === 0) {
    return (
      <EmptyState
        icon={Route}
        title="This itinerary is still empty"
        description="No destinations or activities have been added yet. Add a city to start planning the days."
        className={className}
      />
    );
  }

  if (mode === 'timeline') {
    return (
      <div className={cn('space-y-6', className)}>
        {plans.map((plan) => (
          <TimelineDay key={plan.date} plan={plan} currency={currency} showCosts={showCosts} />
        ))}
      </div>
    );
  }

  const stopsInOrder = [...trip.stops].sort((a, b) => a.order - b.order);

  return (
    <div className={cn('space-y-8', className)}>
      {stopsInOrder.map((stop) => {
        const stopPlans = plans.filter((plan) => plan.stop?.id === stop.id);
        const stopCost = stopPlans
          .flatMap((plan) => plan.items)
          .reduce((total, item) => total + item.effectiveCost, 0);

        return (
          <section key={stop.id} className="space-y-4">
            <header className="flex flex-wrap items-center gap-3">
              <SmartImage
                src={stop.city.image}
                alt=""
                decorative
                seed={`${stop.city.name} ${stop.city.country}`}
                className="size-12 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">{stop.city.name}</h3>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3" aria-hidden="true" />
                    {stop.city.country}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3" aria-hidden="true" />
                    {formatDateRange(stop.startDate, stop.endDate)}
                  </span>
                  <span>{pluralise(stop.dayCount, 'day')}</span>
                </p>
              </div>
              {showCosts ? (
                <Badge variant="secondary">
                  <Wallet aria-hidden="true" />
                  {formatCurrency(stopCost, currency)}
                </Badge>
              ) : null}
            </header>

            <div className="space-y-3 border-l-2 border-border pl-4 sm:pl-6">
              {stopPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activities planned for this stay yet.
                </p>
              ) : null}
              {stopPlans.map((plan) => (
                <DayBlock key={plan.date} plan={plan} currency={currency} showCosts={showCosts} />
              ))}
            </div>
          </section>
        );
      })}

      {stopsInOrder.length === 0 && trip.itineraryItems.length > 0
        ? plans.map((plan) => (
            <DayBlock key={plan.date} plan={plan} currency={currency} showCosts={showCosts} />
          ))
        : null}
    </div>
  );
}

function DayBlock({
  plan,
  currency,
  showCosts,
}: {
  plan: DayPlan;
  currency: string;
  showCosts: boolean;
}) {
  const dayCost = plan.items.reduce((total, item) => total + item.effectiveCost, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          Day {plan.dayNumber} · {formatDateRange(plan.date, plan.date)}
        </span>
        {showCosts && plan.items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {formatCurrency(dayCost, currency)}
          </span>
        ) : null}
      </div>

      {plan.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Free day — nothing scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {plan.items.map((item) => (
            <ItineraryRow key={item.id} item={item} currency={currency} showCosts={showCosts} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItineraryRow({
  item,
  currency,
  showCosts,
}: {
  item: ItineraryItem;
  currency: string;
  showCosts: boolean;
}) {
  const Icon = activityCategoryIcon(item.category);

  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
        {formatTime(item.startTime)}
      </span>
      {item.activity ? (
        <SmartImage
          src={item.activity.image}
          alt=""
          decorative
          seed={item.title}
          className="size-12 shrink-0 rounded-lg"
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.category ? (
            <Badge variant="secondary">
              <Icon aria-hidden="true" />
              {activityCategoryLabel(item.category)}
            </Badge>
          ) : null}
          {item.endTime ? (
            <Badge variant="outline">
              <Clock aria-hidden="true" />
              {formatTime(item.startTime)} – {formatTime(item.endTime)}
            </Badge>
          ) : null}
        </div>
        {item.notes ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="mt-px size-3 shrink-0" aria-hidden="true" />
            {item.notes}
          </p>
        ) : null}
      </div>
      {showCosts ? (
        <span className="shrink-0 pt-0.5 text-sm font-semibold text-primary">
          {formatCurrency(item.effectiveCost, currency)}
        </span>
      ) : null}
    </li>
  );
}

function TimelineDay({
  plan,
  currency,
  showCosts,
}: {
  plan: DayPlan;
  currency: string;
  showCosts: boolean;
}) {
  return (
    <div className="relative pl-8 sm:pl-10">
      {/* The rail itself is decorative; the day heading carries the meaning. */}
      <span
        aria-hidden="true"
        className="absolute left-[11px] top-2 h-full w-px bg-border"
      />
      <span
        aria-hidden="true"
        className="absolute left-0 top-1 flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
      >
        {plan.dayNumber}
      </span>

      <div className="space-y-3">
        <header className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{formatDateRange(plan.date, plan.date)}</h3>
          {plan.stop ? (
            <Badge variant="outline">
              <MapPin aria-hidden="true" />
              {plan.stop.city.name}
            </Badge>
          ) : (
            <Badge variant="warning">Outside your stays</Badge>
          )}
          {showCosts ? (
            <span className="text-xs text-muted-foreground">
              {formatCurrency(
                plan.items.reduce((total, item) => total + item.effectiveCost, 0),
                currency,
              )}
            </span>
          ) : null}
        </header>

        {plan.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Free day — nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {plan.items.map((item) => (
              <ItineraryRow key={item.id} item={item} currency={currency} showCosts={showCosts} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
