import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Compass, Globe2, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SearchInput } from '@/components/common/SearchInput';
import { ClearFilters, FilterChips, ResultCount, type ChipOption } from '@/components/common/FilterChips';
import { CityGridSkeleton } from '@/components/common/Skeletons';
import { CityCard, CityTile } from '@/components/city/CityCard';
import { AddCityToTripDialog, useAddCityDialog } from '@/components/trip/AddCityToTripDialog';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService, type CityListParams } from '@/services/discovery.service';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * City discovery (Section 12).
 *
 * Public by design: a visitor can browse destinations, and bookmarking or adding
 * one to a trip is what prompts them to sign in.
 */

const DEFAULT_FILTERS = {
  q: '',
  country: '',
  region: '',
  cost: 'ALL',
  popularity: 'ALL',
  sortBy: 'popularity',
  sort: 'desc',
  page: '1',
};

const COST_OPTIONS: Array<ChipOption<string>> = [
  { value: 'ALL', label: 'Any budget' },
  { value: 'BUDGET', label: 'Budget-friendly' },
  { value: 'MID', label: 'Mid-range' },
  { value: 'PREMIUM', label: 'Premium' },
];

export default function DiscoverPage() {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useUrlFilters(DEFAULT_FILTERS);
  const debouncedQuery = useDebouncedValue(filters.q, 350);
  const addCity = useAddCityDialog();

  const params: CityListParams = {
    page: Number(filters.page) || 1,
    pageSize: 12,
    q: debouncedQuery || undefined,
    country: filters.country || undefined,
    region: filters.region || undefined,
    minCostIndex: filters.cost === 'MID' ? 2.1 : filters.cost === 'PREMIUM' ? 3.1 : undefined,
    maxCostIndex: filters.cost === 'BUDGET' ? 2 : filters.cost === 'MID' ? 3 : undefined,
    minPopularity: filters.popularity === 'POPULAR' ? 80 : undefined,
    sortBy: filters.sortBy as CityListParams['sortBy'],
    sort: filters.sort as 'asc' | 'desc',
  };

  const citiesQuery = useQuery({
    queryKey: queryKeys.cities(params),
    queryFn: () => discoveryService.cities(params),
    placeholderData: keepPreviousData,
  });

  const facetsQuery = useQuery({
    queryKey: queryKeys.cityFacets,
    queryFn: discoveryService.facets,
    staleTime: 10 * 60_000,
  });

  // Full city records, so the rail can show real images and daily costs.
  const popularQuery = useQuery({
    queryKey: queryKeys.popularCities,
    queryFn: () => discoveryService.popularCities(8),
    staleTime: 5 * 60_000,
  });

  const cities = citiesQuery.data?.data ?? [];
  const meta = citiesQuery.data?.meta;
  const facets = facetsQuery.data;
  const popular = popularQuery.data ?? [];

  return (
    <>
      <RouteMeta
        title="Discover destinations"
        description="Browse destinations by country, region, cost index and popularity, then add them straight to a trip."
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-1.5">
              <Compass className="size-3.5" aria-hidden="true" />
              Explore
            </span>
          }
          title="Where do you want to go?"
          description="Every destination carries a cost index, an average daily spend and a catalogue of things to do."
        />

        {/* ── Search + filters ── */}
        <section
          aria-label="Filter destinations"
          className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <SearchInput
            value={filters.q}
            onChange={(value) => setFilters({ q: value })}
            placeholder="Search destinations, countries or regions…"
            label="Search destinations"
            className="max-w-2xl"
          />

          <div className="flex flex-wrap items-center gap-2">
            <FilterChips
              label="Budget band"
              options={COST_OPTIONS}
              value={filters.cost}
              onChange={(value) => setFilters({ cost: value })}
            />

            <Select
              value={filters.popularity}
              onValueChange={(value) => setFilters({ popularity: value })}
            >
              <SelectTrigger className="w-40" aria-label="Filter by popularity">
                <SelectValue placeholder="Popularity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Everyone</SelectItem>
                <SelectItem value="POPULAR">Most popular</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.country || 'ALL'}
              onValueChange={(value) => setFilters({ country: value === 'ALL' ? '' : value })}
            >
              <SelectTrigger className="w-44" aria-label="Filter by country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All countries</SelectItem>
                {(facets?.countries ?? []).map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.value} ({entry.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.region || 'ALL'}
              onValueChange={(value) => setFilters({ region: value === 'ALL' ? '' : value })}
            >
              <SelectTrigger className="w-44" aria-label="Filter by region">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All regions</SelectItem>
                {(facets?.regions ?? []).map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.value} ({entry.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={`${filters.sortBy}:${filters.sort}`}
              onValueChange={(value) => {
                const [sortBy, sort] = value.split(':');
                setFilters({ sortBy, sort });
              }}
            >
              <SelectTrigger className="w-48" aria-label="Sort destinations">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity:desc">Most popular</SelectItem>
                <SelectItem value="name:asc">Name A–Z</SelectItem>
                <SelectItem value="costIndex:asc">Cheapest first</SelectItem>
                <SelectItem value="costIndex:desc">Most expensive first</SelectItem>
                <SelectItem value="estimatedDailyCost:asc">Lowest daily cost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {meta ? (
              <ResultCount count={meta.total} noun="destination" />
            ) : (
              <span className="text-sm text-muted-foreground">Loading destinations…</span>
            )}
            {hasActiveFilters ? <ClearFilters onClick={clearFilters} /> : null}
          </div>
        </section>

        {/* ── Popular rail ── */}
        {popular.length > 0 ? (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Trending with travellers
            </h2>
            <div className="rail no-scrollbar pb-2">
              {popular.map((city) => (
                <CityTile key={city.id} city={city} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Results ── */}
        {citiesQuery.isLoading ? (
          <CityGridSkeleton count={8} />
        ) : citiesQuery.isError ? (
          <ErrorState
            title="We could not load destinations"
            message="Please check your connection and try again."
            onRetry={() => void citiesQuery.refetch()}
          />
        ) : cities.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Search : Globe2}
            title={hasActiveFilters ? 'No destinations match' : 'No destinations yet'}
            description={
              hasActiveFilters
                ? 'Try widening the budget band, clearing the country filter, or searching a different spelling.'
                : 'The catalogue is empty. Run the seed script to load the demo destinations.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cities.map((city) => (
              <CityCard key={city.id} city={city} onAddToTrip={addCity.openFor} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && meta.totalPages > 1 ? (
          <nav
            aria-label="Destination pages"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setFilters({ page: meta.page - 1 }, { resetPage: false })}
            >
              Previous
            </Button>
            <p className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{meta.page}</span> of{' '}
              {meta.totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setFilters({ page: meta.page + 1 }, { resetPage: false })}
            >
              Next
            </Button>
          </nav>
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
