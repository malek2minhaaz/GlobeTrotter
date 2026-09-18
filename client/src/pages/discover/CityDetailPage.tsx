import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarPlus,
  Flame,
  Globe2,
  MapPin,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingPanel } from '@/components/ui/feedback';
import { Separator } from '@/components/ui/misc';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SmartImage } from '@/components/common/SmartImage';
import { SaveCityButton } from '@/components/city/SaveCityButton';
import { CityTile, costBand } from '@/components/city/CityCard';
import { ActivityPicker } from '@/components/activity/ActivityPicker';
import { AddCityToTripDialog, useAddCityDialog } from '@/components/trip/AddCityToTripDialog';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService } from '@/services/discovery.service';
import { formatCurrency, pluralise } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';

/**
 * City detail (Section 12).
 *
 * Adds the practical numbers a traveller needs to judge a destination — cost
 * index, an average daily spend and the full activity catalogue — alongside the
 * two actions that matter: save it, or put it on a trip.
 */
export default function CityDetailPage() {
  const { cityId = '' } = useParams();
  const currency = useCurrency();
  const addCity = useAddCityDialog();

  const cityQuery = useQuery({
    queryKey: queryKeys.city(cityId),
    queryFn: () => discoveryService.city(cityId),
    enabled: Boolean(cityId),
  });

  const popularQuery = useQuery({
    queryKey: queryKeys.popularCities,
    queryFn: () => discoveryService.popularCities(10),
    staleTime: 5 * 60_000,
  });

  if (cityQuery.isLoading) {
    return <LoadingPanel label="Loading destination…" className="min-h-[60dvh]" />;
  }

  if (cityQuery.isError || !cityQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState
          title="We could not find that destination"
          message="It may have been removed, or the link may be incomplete."
          onRetry={() => void cityQuery.refetch()}
        />
        <div className="mt-4 text-center">
          <Button asChild variant="outline">
            <Link to="/discover">
              <ArrowLeft />
              Back to discovery
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const city = cityQuery.data.city;
  const band = costBand(city.costIndex);
  const related = (popularQuery.data ?? []).filter((entry) => entry.id !== city.id).slice(0, 8);

  return (
    <>
      <RouteMeta
        title={`${city.name}, ${city.country}`}
        description={city.description.slice(0, 160)}
        image={city.image}
        type="article"
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="relative h-72 sm:h-96">
            <SmartImage
              src={city.image}
              alt={`${city.name}, ${city.country}`}
              seed={`${city.name} ${city.country}`}
              className="size-full"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

            <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3 sm:inset-x-6">
              <Button asChild variant="secondary" size="sm" className="bg-background/85 backdrop-blur-sm">
                <Link to="/discover">
                  <ArrowLeft />
                  All destinations
                </Link>
              </Button>
              <SaveCityButton
                cityId={city.id}
                isSaved={city.isSaved}
                cityName={city.name}
                variant="full"
                className="bg-background/85 backdrop-blur-sm"
              />
            </div>

            <div className="absolute inset-x-4 bottom-5 space-y-3 text-white sm:inset-x-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="solid">
                  <MapPin aria-hidden="true" />
                  {city.country}
                  {city.region ? ` · ${city.region}` : ''}
                </Badge>
                <Badge variant={band.tone}>{band.label}</Badge>
                {city.popularity >= 80 ? (
                  <Badge variant="accent">
                    <Flame aria-hidden="true" />
                    Popular
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold drop-shadow-sm sm:text-5xl">{city.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => addCity.openFor(city)}>
                  <Plus />
                  Add to Trip
                </Button>
                <Button asChild variant="secondary" className="bg-background/85 backdrop-blur-sm">
                  <Link to={`/trips/create?city=${city.id}`}>
                    <CalendarPlus />
                    Start a trip here
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-8">
            {/* ── About ── */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">About {city.name}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{city.description}</p>
            </section>

            {/* ── Activities ── */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Things to do</h2>
                  <p className="text-xs text-muted-foreground">
                    {pluralise(city.activityCount, 'activity', 'activities')} in the catalogue ·
                    filter by category, cost or duration
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => addCity.openFor(city)}>
                  <Plus />
                  Add city to a trip
                </Button>
              </div>

              {city.activityCount === 0 ? (
                <EmptyState
                  icon={Globe2}
                  title="No activities yet"
                  description="This destination does not have anything in the catalogue yet. You can still add your own entries in the itinerary builder."
                />
              ) : (
                <div className="flex h-[42rem] flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
                  {/* Browsing here; scheduling happens inside a trip, so adding an
                      activity routes through the city's "Add to Trip" flow. */}
                  <ActivityPicker
                    cityId={city.id}
                    cityName={city.name}
                    onAdd={() => addCity.openFor(city)}
                    className="min-h-0 flex-1"
                  />
                  <p className="pt-2 text-[11px] text-muted-foreground">
                    Add {city.name} to a trip to schedule these activities on specific days.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ── Aside ── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">At a glance</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5" aria-hidden="true" />
                    Estimated daily cost
                  </dt>
                  <dd className="font-semibold text-primary">
                    {formatCurrency(city.estimatedDailyCost, currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                    Cost index
                  </dt>
                  <dd className="font-medium">{city.costIndex.toFixed(1)} / 5</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Flame className="size-3.5" aria-hidden="true" />
                    Popularity
                  </dt>
                  <dd className="font-medium">{city.popularity} / 100</dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">A 3-day stay</dt>
                  <dd className="font-semibold">
                    {formatCurrency(city.estimatedDailyCost * 3, currency)}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground">
                Daily costs cover accommodation, meals and local transport at an average standard of
                comfort. Activities are priced separately.
              </p>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Actions</h2>
              <div className="grid gap-2">
                <Button onClick={() => addCity.openFor(city)} className="w-full">
                  <Plus />
                  Add to Trip
                </Button>
                <SaveCityButton
                  cityId={city.id}
                  isSaved={city.isSaved}
                  cityName={city.name}
                  variant="full"
                  className="w-full"
                />
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/discover">Browse more destinations</Link>
                </Button>
              </div>
            </section>
          </aside>
        </div>

        {/* ── Related ── */}
        {related.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Other destinations travellers like</h2>
            <div className="rail no-scrollbar pb-2">
              {related.map((entry) => (
                <CityTile key={entry.id} city={entry} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <AddCityToTripDialog
        city={addCity.city}
        open={addCity.open}
        onOpenChange={addCity.onOpenChange}
      />
    </>
  );
}
