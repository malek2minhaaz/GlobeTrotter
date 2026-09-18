import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Compass,
  List,
  MapPin,
  Plane,
  Route,
  Rows3,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, Separator } from '@/components/ui/misc';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/tooltip-checkbox';
import { CityPill } from '@/components/city/CityCard';
import { ReadOnlyItinerary, itineraryTotal } from '@/components/trip/ReadOnlyItinerary';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { useTripWorkspace } from '@/layouts/TripWorkspaceLayout';
import { formatCurrency, formatDateRange, pluralise } from '@/lib/format';
import { useUrlFilters } from '@/hooks/useUrlFilters';

/**
 * Trip overview (Section 16).
 *
 * A read-only pass over the whole plan, plus the entry points into editing it.
 * The itinerary itself is the same component the public share page renders.
 */
export default function TripOverviewPage() {
  const { trip, currency } = useTripWorkspace();
  const navigate = useNavigate();
  const { filters, setFilters } = useUrlFilters({ view: 'list' });

  const budgetQuery = useQuery({
    queryKey: queryKeys.tripBudget(trip.id),
    queryFn: () => tripsService.budget(trip.id),
    staleTime: 30_000,
  });

  const budget = budgetQuery.data;
  const activityTotal = itineraryTotal(trip);
  const plannedDays = trip.stops.reduce((total, stop) => total + stop.dayCount, 0);
  const usedPercent =
    trip.budgetLimit && trip.budgetLimit > 0
      ? Math.min(Math.round((trip.estimatedCost / trip.budgetLimit) * 100), 100)
      : null;
  const overBudget = Boolean(trip.budgetLimit && trip.estimatedCost > trip.budgetLimit);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {/* ── Planning summary ── */}
        <section
          aria-label="Trip analytics"
          className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
        >
          <Metric icon={CalendarDays} label="Trip length" value={pluralise(trip.durationDays, 'day')} />
          <Metric icon={Rows3} label="Planned days" value={String(plannedDays)} hint="Days inside stays" />
          <Metric icon={Ticket} label="Activities" value={String(trip.activityCount)} />
          <Metric
            icon={TrendingUp}
            label="Average per day"
            value={formatCurrency(
              trip.durationDays > 0 ? trip.estimatedCost / trip.durationDays : 0,
              currency,
            )}
          />
        </section>

        {/* ── Description ── */}
        {trip.description ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">About this trip</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {trip.description}
            </p>
          </section>
        ) : null}

        {/* ── Itinerary ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Itinerary</h2>
              <p className="text-xs text-muted-foreground">
                {pluralise(trip.cityCount, 'city', 'cities')} ·{' '}
                {pluralise(trip.activityCount, 'activity', 'activities')} ·{' '}
                {formatCurrency(activityTotal, currency)} in planned activities
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={filters.view}
                onValueChange={(value) => value && setFilters({ view: value })}
                aria-label="Itinerary view mode"
              >
                <ToggleGroupItem value="list" aria-label="List view">
                  <List />
                  List
                </ToggleGroupItem>
                <ToggleGroupItem value="timeline" aria-label="Timeline view">
                  <Route />
                  Timeline
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/trips/${trip.id}/calendar`)}
              >
                <CalendarDays />
                Calendar
              </Button>
            </div>
          </div>

          <ReadOnlyItinerary
            trip={trip}
            mode={filters.view === 'timeline' ? 'timeline' : 'list'}
            currency={currency}
          />

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/trips/${trip.id}/itinerary`}>
                <Sparkles />
                {trip.activityCount > 0 ? 'Edit itinerary' : 'Build itinerary'}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/trips/${trip.id}/budget`}>
                <Wallet />
                Manage budget
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {/* ── Side column ── */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Route</h2>
          {trip.stops.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No destinations yet. Add a city to start planning.
            </p>
          ) : (
            <ol className="space-y-3">
              {[...trip.stops]
                .sort((a, b) => a.order - b.order)
                .map((stop, index) => (
                  <li key={stop.id} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{stop.city.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(stop.startDate, stop.endDate)} ·{' '}
                        {pluralise(stop.dayCount, 'day')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pluralise(stop.itemCount, 'activity', 'activities')}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/trips/${trip.id}/itinerary`}>
              <MapPin />
              Add or reorder cities
            </Link>
          </Button>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Costs</h2>
          <div className="space-y-2 text-sm">
            <Row label="Activities" value={formatCurrency(activityTotal, currency)} />
            <Row
              label="Logged expenses"
              value={formatCurrency(budget?.logged ?? trip.loggedCost, currency)}
            />
            <Separator />
            <Row
              label="Estimated total"
              value={formatCurrency(trip.estimatedCost, currency)}
              strong
            />
            {trip.budgetLimit ? (
              <Row label="Budget limit" value={formatCurrency(trip.budgetLimit, currency)} />
            ) : null}
          </div>

          {usedPercent !== null ? (
            <div className="space-y-2">
              <Progress
                value={usedPercent}
                indicatorClassName={overBudget ? 'bg-destructive' : undefined}
              />
              <p className={overBudget ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {overBudget
                  ? `⚠️ ${formatCurrency(trip.estimatedCost - (trip.budgetLimit ?? 0), currency)} over budget`
                  : `${usedPercent}% of your budget used`}
              </p>
            </div>
          ) : (
            <Badge variant="outline" className="w-full justify-center">
              No budget limit set
            </Badge>
          )}

          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to={`/trips/${trip.id}/budget`}>Open budget page</Link>
          </Button>
        </section>

        {trip.stops.length > 0 ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Cities on this trip</h2>
            <div className="flex flex-wrap gap-1.5">
              {trip.stops.map((stop) => (
                <CityPill key={stop.id} name={stop.city.name} country={stop.city.country} />
              ))}
            </div>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link to="/discover">
                <Compass />
                Find more destinations
              </Link>
            </Button>
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border-dashed border-border bg-card/60 p-5 text-center">
            <Plane className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No destinations yet</p>
            <p className="text-xs text-muted-foreground">
              Add your first city and we will lay out the days for you.
            </p>
            <Button asChild size="sm">
              <Link to={`/trips/${trip.id}/itinerary`}>Add a destination</Link>
            </Button>
          </section>
        )}
      </aside>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-primary' : 'font-medium'}>{value}</span>
    </div>
  );
}
