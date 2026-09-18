import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
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
  Activity as ActivityIcon,
  Bookmark,
  CalendarClock,
  BarChart3,
  Globe2,
  MapPin,
  Plane,
  Receipt,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SmartImage } from '@/components/common/SmartImage';
import { queryKeys } from '@/lib/queryClient';
import { adminService } from '@/services/workspace.service';
import { activityCategoryLabel } from '@/lib/categoryMeta';
import { formatNumber, formatRelative, pluralise } from '@/lib/format';

/**
 * Admin analytics (Section 25).
 *
 * Read-only aggregates over the whole platform. Protected by `AdminRoute`, and
 * the API re-checks the role, so a non-admin cannot reach the data by URL.
 */
export default function AdminAnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: queryKeys.adminAnalytics,
    queryFn: adminService.analytics,
  });

  if (analyticsQuery.isLoading) {
    return (
      <>
        <RouteMeta title="Admin analytics" />
        <PageHeader title="Admin analytics" description="Loading platform metrics…" />
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <>
        <RouteMeta title="Admin analytics" />
        <PageHeader title="Admin analytics" />
        <ErrorState
          className="mt-6"
          title="We could not load the analytics"
          message="The reporting query failed. Please try again."
          onRetry={() => void analyticsQuery.refetch()}
        />
      </>
    );
  }

  const { totals, tripsOverTime, registrationsOverTime, popularCities, popularActivities, generatedAt } =
    analyticsQuery.data;

  const charts = [
    {
      title: 'Trips created over time',
      description: 'New trips per month across the platform',
      data: tripsOverTime,
      colour: 'var(--primary)',
    },
    {
      title: 'User registrations',
      description: 'New accounts per month',
      data: registrationsOverTime,
      colour: 'var(--chart-2)',
    },
  ];

  return (
    <>
      <RouteMeta
        title="Admin analytics"
        description="Platform-wide engagement, popular destinations and activity demand."
      />

      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-1.5">
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Admin
            </span>
          }
          title="Platform analytics"
          description="Aggregates across every account, trip and catalogue entry."
          actions={<Badge variant="secondary">Updated {formatRelative(generatedAt)}</Badge>}
        />

        {/* ── Totals ── */}
        <section
          aria-label="Platform totals"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <TotalCard icon={Users} label="Users" value={totals.users} />
          <TotalCard icon={Plane} label="Trips" value={totals.trips} hint={`${totals.publicTrips} public`} />
          <TotalCard icon={MapPin} label="Cities" value={totals.cities} />
          <TotalCard icon={ActivityIcon} label="Activities" value={totals.activities} />
          <TotalCard icon={Receipt} label="Expenses logged" value={totals.expenses} />
          <TotalCard icon={CalendarClock} label="Upcoming trips" value={totals.upcomingTrips} />
          <TotalCard icon={Bookmark} label="Saved destinations" value={totals.savedDestinations} />
          <TotalCard
            icon={Globe2}
            label="Share rate"
            value={totals.trips > 0 ? Math.round((totals.publicTrips / totals.trips) * 100) : 0}
            suffix="%"
            hint="Trips that are public"
          />
        </section>

        {/* ── Time series ── */}
        <section className="grid gap-5 lg:grid-cols-2">
          {charts.map((chart) => (
            <div key={chart.title} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold">{chart.title}</h2>
                <p className="text-xs text-muted-foreground">{chart.description}</p>
              </div>
              {chart.data.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="Not enough data yet"
                  description="This chart fills in as the platform is used."
                  className="py-10"
                />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart.data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id={`fill-${chart.title}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chart.colour} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={chart.colour} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--popover)',
                          color: 'var(--popover-foreground)',
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [formatNumber(value), chart.title]}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={chart.colour}
                        strokeWidth={2}
                        fill={`url(#fill-${chart.title})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* ── Popular cities ── */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Most popular destinations</h2>
            <p className="text-xs text-muted-foreground">
              Ranked by how often they appear on trips and in bookmarks
            </p>
          </div>

          {popularCities.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No destination data yet"
              description="Popularity appears once trips start including cities."
              className="py-10"
            />
          ) : (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={popularCities.slice(0, 8)}
                    margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                  >
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
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--popover)',
                        color: 'var(--popover-foreground)',
                        fontSize: 12,
                      }}
                      formatter={(value: number, key: string) => [
                        formatNumber(value),
                        key === 'tripCount' ? 'Trips' : 'Saved',
                      ]}
                    />
                    <Bar dataKey="tripCount" stackId="a" fill="var(--primary)" maxBarSize={44} />
                    <Bar dataKey="savedCount" stackId="a" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {popularCities.slice(0, 8).map((city) => (
                        <Cell key={city.id} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {popularCities.slice(0, 8).map((city, index) => (
                  <li
                    key={city.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  >
                    <span className="w-4 text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <SmartImage
                      src={city.image}
                      alt=""
                      decorative
                      seed={city.name}
                      className="size-9 shrink-0 rounded-md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{city.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pluralise(city.tripCount, 'trip')} · {city.savedCount} saved
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Popular activities ── */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Most planned activities</h2>
            <p className="text-xs text-muted-foreground">
              What travellers actually put on their itineraries
            </p>
          </div>

          {popularActivities.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="No activity demand yet"
              description="This table fills in as itineraries are built."
              className="py-10"
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-lg text-sm">
                <caption className="sr-only">Most planned activities across the platform</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Activity
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      City
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Times planned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {popularActivities.slice(0, 10).map((activity) => (
                    <tr key={activity.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <SmartImage
                            src={activity.image}
                            alt=""
                            decorative
                            seed={activity.name}
                            className="size-9 shrink-0 rounded-md"
                          />
                          <span className="font-medium">{activity.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{activity.cityName}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{activityCategoryLabel(activity.category)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatNumber(activity.timesPlanned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function TotalCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold tracking-tight">
          {formatNumber(value)}
          {suffix}
        </p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
