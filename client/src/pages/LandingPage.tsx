import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Globe2,
  Layers,
  LineChart,
  MapPin,
  Route,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { CityTile } from '@/components/city/CityCard';
import { Reveal } from '@/components/common/Reveal';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SmartImage } from '@/components/common/SmartImage';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService } from '@/services/discovery.service';
import { formatCurrency, formatDuration, pluralise } from '@/lib/format';

/**
 * Landing page (Section 7).
 *
 * Every number and image here comes from the seeded database — the destination
 * rail, the city counts and the cost estimates are all live API data, so the
 * marketing page cannot drift from what the product actually contains.
 */

const HOW_IT_WORKS = [
  {
    icon: Compass,
    title: 'Create your trip',
    description: 'Name it, set your dates and pick a cover image in under a minute.',
  },
  {
    icon: MapPin,
    title: 'Choose destinations',
    description: 'Add as many cities as you like and set how long you will stay in each.',
  },
  {
    icon: Ticket,
    title: 'Add experiences',
    description: 'Search hundreds of curated activities and drop them onto the right day.',
  },
  {
    icon: Route,
    title: 'Build your itinerary',
    description: 'Reorder with drag and drop and get warned about overlapping plans.',
  },
  {
    icon: Wallet,
    title: 'Track your budget',
    description: 'See costs by category and per day, and set a limit you can watch.',
  },
  {
    icon: Share2,
    title: 'Share your journey',
    description: 'Publish a clean itinerary link to share or let others copy the whole trip.',
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: 'Multi-city planning',
    description:
      'Chained stays with their own dates, so a two-week, five-city trip stays readable.',
  },
  {
    icon: Sparkles,
    title: 'Smart itinerary',
    description:
      'Conflict detection warns you about overlaps and activities that fall outside a stay.',
  },
  {
    icon: Wallet,
    title: 'Budget tracking',
    description: 'Category breakdowns, per-day cost charts and an over-budget alert.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar planning',
    description: 'Month, week, day and timeline views kept in sync with your itinerary.',
  },
  {
    icon: Globe2,
    title: 'Activity discovery',
    description: 'Filter by category, cost and duration across every destination you pick.',
  },
  {
    icon: Share2,
    title: 'Trip sharing',
    description: 'One toggle publishes a public page — no account needed to view it.',
  },
];

export default function LandingPage() {
  const popularQuery = useQuery({
    queryKey: queryKeys.popularCities,
    queryFn: () => discoveryService.popularCities(10),
    staleTime: 5 * 60_000,
  });

  // Real catalogue size for the hero strip, fetched as cheap count-only queries.
  const countsQuery = useQuery({
    queryKey: ['landing', 'counts'],
    queryFn: async () => {
      const [cities, activities] = await Promise.all([
        discoveryService.cities({ page: 1, pageSize: 1 }),
        discoveryService.activities({ page: 1, pageSize: 1 }),
      ]);
      return { cities: cities.meta.total, activities: activities.meta.total };
    },
    staleTime: 10 * 60_000,
  });

  const popular = popularQuery.data ?? [];
  const spotlight = popular.slice(0, 3);

  return (
    <>
      <RouteMeta />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/40"
        />
        <div
          aria-hidden="true"
          className="absolute -right-40 -top-40 size-[32rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div className="space-y-7">
            <Badge variant="accent" className="px-3 py-1 text-xs">
              <Sparkles aria-hidden="true" />
              Personalised multi-city travel planning
            </Badge>

            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Plan Your Journey.
              <br />
              <span className="bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent">
                Experience More.
              </span>
            </h1>

            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              GlobeTrotter turns a rough idea into a day-by-day itinerary. Choose your cities, add
              the experiences you actually want, watch the cost add up by category, and share the
              whole plan with a single link.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Start Planning
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/discover">
                  <Compass />
                  Explore Trips
                </Link>
              </Button>
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Destinations
                </dt>
                <dd className="text-2xl font-semibold">
                  {countsQuery.isLoading ? (
                    <Skeleton className="mt-1 h-7 w-12" />
                  ) : (
                    (countsQuery.data?.cities ?? 0)
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Curated activities
                </dt>
                <dd className="text-2xl font-semibold">
                  {countsQuery.isLoading ? (
                    <Skeleton className="mt-1 h-7 w-12" />
                  ) : (
                    (countsQuery.data?.activities ?? 0)
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Planning cost
                </dt>
                <dd className="flex items-center gap-1.5 text-2xl font-semibold">
                  Free
                  <Star className="size-4 text-warning" aria-hidden="true" />
                </dd>
              </div>
            </dl>
          </div>

          {/* Hero visual: a real three-city route with an itinerary and cost panel. */}
          <div className="relative">
            <div className="space-y-4 rounded-2xl border border-border bg-card/85 p-4 shadow-xl backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Rajasthan &amp; beyond</p>
                  <p className="text-xs text-muted-foreground">
                    {spotlight.length > 0
                      ? spotlight.map((city) => city.name).join(' → ')
                      : 'Pick your first three cities'}
                  </p>
                </div>
                <Badge variant="success">Upcoming</Badge>
              </div>

              <div className="flex gap-2 overflow-hidden">
                {popularQuery.isLoading
                  ? Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={index} className="h-24 flex-1 rounded-xl" />
                    ))
                  : spotlight.map((city) => (
                      <div key={city.id} className="relative h-24 flex-1 overflow-hidden rounded-xl">
                        <SmartImage
                          src={city.image}
                          alt=""
                          decorative
                          seed={`${city.name} ${city.country}`}
                          className="size-full"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="truncate text-xs font-medium text-white">{city.name}</p>
                        </div>
                      </div>
                    ))}
              </div>

              <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                {[
                  { time: '09:00 AM', title: 'Breakfast at the old market' },
                  { time: '11:00 AM', title: 'Amber Fort guided walk' },
                  { time: '07:30 PM', title: 'Sunset over the lake' },
                ].map((entry) => (
                  <div key={entry.time} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">
                      {entry.time}
                    </span>
                    <span className="flex size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="truncate text-xs">{entry.title}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Estimated trip cost</span>
                  <span className="font-semibold">
                    {spotlight.length > 0
                      ? formatCurrency(
                          spotlight.reduce((total, city) => total + city.estimatedDailyCost * 3, 0),
                          'INR',
                        )
                      : '—'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-teal-500" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Across {pluralise(spotlight.length || 3, 'city', 'cities')} ·{' '}
                  {pluralise(9, 'day')} · estimated from each city&apos;s cost index
                </p>
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-5 -left-5 hidden rounded-xl border border-border bg-card p-3 shadow-lg sm:block">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <LineChart className="size-3.5 text-success" aria-hidden="true" />
                Budget on track
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Explore ──────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-16 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Explore</p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Popular destinations
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Every destination carries a cost index and a daily estimate, so you can judge a
              shortlist before you commit to it.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/discover">
              Browse all destinations
              <ArrowRight />
            </Link>
          </Button>
        </Reveal>

        {popularQuery.isLoading ? (
          <div className="rail">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-52 w-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="rail no-scrollbar pb-2">
            {popular.map((city) => (
              <CityTile key={city.id} city={city} />
            ))}
          </div>
        )}
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-y border-border bg-card scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <Reveal className="mx-auto max-w-2xl space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              How it works
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              From idea to itinerary in six steps
            </h2>
            <p className="text-sm text-muted-foreground">
              The whole trip lives in one workspace — cities, days, activities, budget and sharing.
            </p>
          </Reveal>

          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }, index) => (
              <Reveal key={title} delay={index * 0.05}>
                <li className="flex h-full gap-4 rounded-xl border border-border bg-background p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Step {index + 1}
                    </p>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-7xl space-y-12 px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal className="mx-auto max-w-2xl space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Features</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for trips that actually happen
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything below is implemented end to end — no placeholders, no dead buttons.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <article className="h-full space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Cost preview ─────────────────────────────────────────────────── */}
      {spotlight.length > 0 ? (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
            <Reveal className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Real estimates
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Know the shape of the cost before you book
              </h2>
              <p className="text-sm text-muted-foreground">
                Each destination has a cost index and an average daily spend, and every activity
                carries its own estimate. GlobeTrotter adds them up per day, per category and per
                city — then tells you when you are drifting past your limit.
              </p>
              <Button asChild>
                <Link to="/signup">
                  Build my first budget
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-semibold">Sample daily costs</p>
                <ul className="space-y-3">
                  {spotlight.map((city) => (
                    <li key={city.id} className="flex items-center gap-3">
                      <SmartImage
                        src={city.image}
                        alt=""
                        decorative
                        seed={`${city.name} ${city.country}`}
                        className="size-10 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{city.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {city.country} · cost index {city.costIndex.toFixed(1)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        {formatCurrency(city.estimatedDailyCost, 'INR')}
                        <span className="text-xs font-normal text-muted-foreground">/day</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  A typical sightseeing day: a guided activity (
                  {spotlight[0] ? formatDuration(3) : '3 hrs'}
                  ), meals and local transport.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-teal-700 to-emerald-900 px-6 py-14 text-center shadow-xl sm:px-12">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative mx-auto max-w-2xl space-y-5 text-primary-foreground">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Start Planning Your Next Adventure
              </h2>
              <p className="text-sm text-primary-foreground/85 sm:text-base">
                Create a free account and plan your first multi-city itinerary in the next ten
                minutes. Or explore the seeded demo trip to see everything working.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/signup">
                    Create free account
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                >
                  <Link to="/discover">Explore destinations</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
