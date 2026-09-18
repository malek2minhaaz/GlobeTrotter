import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Compass,
  Globe2,
  MapPin,
  Plane,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Progress } from '@/components/ui/misc';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { StatCard } from '@/components/common/StatCard';
import { SmartImage } from '@/components/common/SmartImage';
import { DashboardSkeleton } from '@/components/common/Skeletons';
import { CityTile } from '@/components/city/CityCard';
import { TripCard, TripCardCompact } from '@/components/trip/TripCard';
import { queryKeys } from '@/lib/queryClient';
import { dashboardService } from '@/services/workspace.service';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import {
  describeCountdown,
  formatCurrency,
  formatDateRange,
  formatNumber,
  pluralise,
} from '@/lib/format';
import type { AppNotification, TripListItem } from '@/types/api';

/** Dashboard — the main application hub (Sections 9 and 39). */
export default function DashboardPage() {
  const { user } = useAuth();
  const currency = useCurrency();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardService.get,
  });

  const greeting = greetFor(new Date().getHours());
  const firstName = user?.name.split(' ')[0] ?? 'traveller';

  if (dashboardQuery.isLoading) {
    return (
      <>
        <RouteMeta title="Dashboard" />
        <PageHeader title={`${greeting}, ${firstName} 👋`} description="Loading your trips…" />
        <DashboardSkeleton />
      </>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <>
        <RouteMeta title="Dashboard" />
        <PageHeader title={`${greeting}, ${firstName} 👋`} />
        <ErrorState
          title="We could not load your dashboard"
          message="Your trips are safe — this is just a problem fetching them. Please try again."
          onRetry={() => void dashboardQuery.refetch()}
        />
      </>
    );
  }

  const {
    stats,
    analytics,
    focusTrip,
    recentTrips,
    upcomingTrips,
    popularDestinations,
    savedDestinations,
    notifications,
  } = dashboardQuery.data;

  const chartData = recentTrips.slice(0, 5).map((trip) => ({
    name: trip.name.length > 16 ? `${trip.name.slice(0, 15)}…` : trip.name,
    cost: Math.round(trip.estimatedCost),
    status: trip.status,
  }));

  return (
    <>
      <RouteMeta title="Dashboard" />

      <div className="space-y-6">
        <PageHeader
          eyebrow={user ? `Signed in as ${user.email}` : undefined}
          title={`${greeting}, ${firstName} 👋`}
          description={
            stats.upcomingTrips > 0
              ? `You have ${pluralise(stats.upcomingTrips, 'trip')} coming up and ${pluralise(stats.citiesPlanned, 'city', 'cities')} planned so far.`
              : 'Ready to plan your next adventure? Start with a destination you have been meaning to see.'
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link to="/discover">
                  <Compass />
                  Explore cities
                </Link>
              </Button>
              <Button asChild>
                <Link to="/trips/create">
                  <CalendarPlus />
                  Plan new trip
                </Link>
              </Button>
            </>
          }
        />

        {/* ── Statistics ── */}
        <section aria-label="Trip statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Plane}
            label="Upcoming trips"
            value={formatNumber(stats.upcomingTrips)}
            hint={`${stats.completedTrips} completed`}
            to="/trips?status=UPCOMING"
          />
          <StatCard
            icon={CalendarDays}
            label="Total trips"
            value={formatNumber(stats.totalTrips)}
            hint={`${stats.publicTrips} shared publicly`}
            to="/trips"
            accent="violet"
          />
          <StatCard
            icon={MapPin}
            label="Cities planned"
            value={formatNumber(stats.citiesPlanned)}
            hint={`${stats.citiesVisited} already visited`}
            to="/trips"
            accent="amber"
          />
          <StatCard
            icon={Bookmark}
            label="Saved destinations"
            value={formatNumber(stats.savedDestinations)}
            hint="Bookmarked for later"
            to="/saved"
            accent="rose"
          />
        </section>

        {/* ── Trip analytics ── */}
        <section
          aria-label="Planning analytics"
          className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
        >
          <AnalyticsItem
            icon={CalendarDays}
            label="Planned days"
            value={formatNumber(analytics.plannedDays)}
          />
          <AnalyticsItem icon={MapPin} label="Cities" value={formatNumber(analytics.cities)} />
          <AnalyticsItem
            icon={Ticket}
            label="Activities"
            value={formatNumber(analytics.activities)}
          />
          <AnalyticsItem
            icon={Wallet}
            label="Estimated total"
            value={formatCurrency(analytics.estimatedTotalCost, currency)}
          />
          <AnalyticsItem
            icon={TrendingUp}
            label="Average per day"
            value={formatCurrency(analytics.averageDailyCost, currency)}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* ── Upcoming trip ── */}
            {focusTrip ? (
              <UpcomingTripCard trip={focusTrip} currency={currency} />
            ) : (
              <EmptyState
                icon={Plane}
                title="No upcoming trips yet"
                description="Start planning your first adventure — pick a destination and we will build the days around it."
                action={
                  <Button asChild>
                    <Link to="/trips/create">
                      <CalendarPlus />
                      Plan New Trip
                    </Link>
                  </Button>
                }
              />
            )}

            {/* ── Cost by trip ── */}
            {chartData.length > 0 ? (
              <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Estimated cost by trip</h2>
                    <p className="text-xs text-muted-foreground">
                      Activities and planned spend across your most recent trips
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Wallet aria-hidden="true" />
                    {currency}
                  </Badge>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)
                        }
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        formatter={(value: number) => [formatCurrency(value, currency), 'Estimate']}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--popover)',
                          color: 'var(--popover-foreground)',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="cost" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.status === 'ONGOING'
                                ? 'var(--success)'
                                : entry.status === 'COMPLETED'
                                  ? 'var(--chart-4)'
                                  : 'var(--primary)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            {/* ── Recent trips ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Recent trips</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/trips">
                    View all
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
              {recentTrips.length === 0 ? (
                <EmptyState
                  icon={Plane}
                  title="No trips yet"
                  description="Your trips will appear here as soon as you create one."
                  action={
                    <Button asChild>
                      <Link to="/trips/create">Plan New Trip</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {recentTrips.slice(0, 4).map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Side column ── */}
          <div className="space-y-6">
            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Quick actions</h2>
              <div className="grid gap-2">
                <QuickAction to="/trips/create" icon={CalendarPlus} label="Plan New Trip" />
                <QuickAction to="/discover" icon={Compass} label="Explore Cities" />
                <QuickAction to="/saved" icon={Bookmark} label="Saved Destinations" />
                <QuickAction
                  to={focusTrip ? `/trips/${focusTrip.id}/calendar` : '/trips'}
                  icon={CalendarDays}
                  label="View Calendar"
                />
              </div>
            </section>

            <NotificationsPanel notifications={notifications} />

            {upcomingTrips.length > 1 ? (
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Coming up</h2>
                <div className="space-y-2">
                  {upcomingTrips.slice(0, 4).map((trip) => (
                    <TripCardCompact key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            ) : null}

            {savedDestinations.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Saved destinations</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/saved">View all</Link>
                  </Button>
                </div>
                <ul className="space-y-2">
                  {savedDestinations.slice(0, 3).map(({ id, city }) => (
                    <li key={id}>
                      <Link
                        to={`/city/${city.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40"
                      >
                        <SmartImage
                          src={city.image}
                          alt=""
                          decorative
                          seed={`${city.name} ${city.country}`}
                          className="size-10 shrink-0 rounded-lg"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{city.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {city.country}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        {/* ── Popular destinations ── */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Popular destinations</h2>
              <p className="text-xs text-muted-foreground">
                Bookmark one now and plan it when the dates line up
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/discover">
                Explore all
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="rail no-scrollbar pb-2">
            {popularDestinations.map((city) => (
              <CityTile key={city.id} city={city} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function greetFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function AnalyticsItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof CalendarPlus;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {label}
      <ArrowRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function UpcomingTripCard({ trip, currency }: { trip: TripListItem; currency: string }) {
  const usedPercent =
    trip.budgetLimit && trip.budgetLimit > 0
      ? Math.min(Math.round((trip.estimatedCost / trip.budgetLimit) * 100), 100)
      : null;
  const overBudget = Boolean(trip.budgetLimit && trip.estimatedCost > trip.budgetLimit);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative h-52 sm:h-60">
        <SmartImage
          src={trip.coverImage}
          alt=""
          decorative
          seed={trip.name}
          className="size-full"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <Badge variant="solid">
            <Plane aria-hidden="true" />
            {describeCountdown(trip.daysUntilStart, trip.status)}
          </Badge>
          {trip.isPublic ? (
            <Badge variant="secondary">
              <Globe2 aria-hidden="true" />
              Public
            </Badge>
          ) : null}
        </div>

        <div className="absolute inset-x-5 bottom-5 space-y-2 text-white">
          <h2 className="text-xl font-semibold drop-shadow-sm sm:text-2xl">{trip.name}</h2>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {pluralise(trip.cityCount, 'city', 'cities')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="size-3.5" aria-hidden="true" />
              {pluralise(trip.activityCount, 'activity', 'activities')}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Duration" value={pluralise(trip.durationDays, 'day')} />
          <MiniStat label="Planned days" value={String(trip.plannedDays)} />
          <MiniStat label="Estimated" value={formatCurrency(trip.estimatedCost, currency)} />
          <MiniStat
            label="Logged"
            value={formatCurrency(trip.loggedCost, currency)}
            hint={trip.budgetLimit ? `of ${formatCurrency(trip.budgetLimit, currency)}` : undefined}
          />
        </div>

        {usedPercent !== null ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Budget used</span>
              <span className={overBudget ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                {usedPercent}%
              </span>
            </div>
            <Progress
              value={usedPercent}
              indicatorClassName={
                overBudget ? 'bg-destructive' : 'bg-gradient-to-r from-primary to-teal-500'
              }
            />
            {overBudget ? (
              <p className="text-xs font-medium text-destructive">
                ⚠️ Your estimated trip cost is{' '}
                {formatCurrency(trip.estimatedCost - (trip.budgetLimit ?? 0), currency)} above your
                budget.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={`/trips/${trip.id}`}>
              Open trip workspace
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/trips/${trip.id}/itinerary`}>
              <Sparkles />
              Build itinerary
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NotificationsPanel({ notifications }: { notifications: AppNotification[] }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">Needs your attention</h2>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing to flag right now. Budgets are on track and no itinerary clashes.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.slice(0, 4).map((notification) => (
            <li key={notification.id}>
              <Link
                to={notification.actionHref ?? '/trips'}
                className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">{notification.message}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
