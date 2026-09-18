import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CalendarPlus, LayoutGrid, List, Plane, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/tooltip-checkbox';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SearchInput } from '@/components/common/SearchInput';
import { ClearFilters, FilterChips, ResultCount, type ChipOption } from '@/components/common/FilterChips';
import { TripGridSkeleton } from '@/components/common/Skeletons';
import { TripCard } from '@/components/trip/TripCard';
import { queryKeys } from '@/lib/queryClient';
import { tripsService, type TripListParams } from '@/services/trips.service';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { TripStatusFilter, TripVisibilityFilter } from '@/types/api';

/** My Trips (Section 11): grid and list views, search, filters, sorting. */

const DEFAULT_FILTERS = {
  q: '',
  status: 'ALL',
  visibility: 'ALL',
  sortBy: 'startDate',
  sort: 'asc',
  view: 'grid',
  page: '1',
};

const STATUS_OPTIONS: Array<ChipOption<TripStatusFilter>> = [
  { value: 'ALL', label: 'All' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function MyTripsPage() {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useUrlFilters(DEFAULT_FILTERS);
  const debouncedQuery = useDebouncedValue(filters.q, 350);

  const params: TripListParams = {
    page: Number(filters.page) || 1,
    pageSize: 9,
    q: debouncedQuery || undefined,
    status: filters.status as TripStatusFilter,
    visibility: filters.visibility as TripVisibilityFilter,
    sortBy: filters.sortBy as TripListParams['sortBy'],
    sort: filters.sort as 'asc' | 'desc',
  };

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips(params),
    queryFn: () => tripsService.list(params),
    // Keeps the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });

  const trips = tripsQuery.data?.data ?? [];
  const meta = tripsQuery.data?.meta;

  return (
    <>
      <RouteMeta title="My Trips" />

      <div className="space-y-6">
        <PageHeader
          title="My Trips"
          description="Every journey you have planned, from a weekend away to a two-week multi-city route."
          actions={
            <Button asChild>
              <Link to="/trips/create">
                <CalendarPlus />
                Plan new trip
              </Link>
            </Button>
          }
        />

        {/* ── Toolbar ── */}
        <section
          aria-label="Filter trips"
          className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={filters.q}
              onChange={(value) => setFilters({ q: value })}
              placeholder="Search by trip name, description or city…"
              label="Search trips"
              className="lg:max-w-md lg:flex-1"
            />

            <div className="flex flex-wrap items-center gap-2">
              <FilterChips
                label="Trip status"
                options={STATUS_OPTIONS}
                value={filters.status as TripStatusFilter}
                onChange={(value) => setFilters({ status: value })}
              />

              <Select
                value={filters.visibility}
                onValueChange={(value) => setFilters({ visibility: value })}
              >
                <SelectTrigger className="w-36" aria-label="Filter by visibility">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All visibility</SelectItem>
                  <SelectItem value="PUBLIC">Public only</SelectItem>
                  <SelectItem value="PRIVATE">Private only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={`${filters.sortBy}:${filters.sort}`}
                onValueChange={(value) => {
                  const [sortBy, sort] = value.split(':');
                  setFilters({ sortBy, sort });
                }}
              >
                <SelectTrigger className="w-48" aria-label="Sort trips">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="startDate:asc">Starting soonest</SelectItem>
                  <SelectItem value="startDate:desc">Starting latest</SelectItem>
                  <SelectItem value="createdAt:desc">Recently created</SelectItem>
                  <SelectItem value="name:asc">Name A–Z</SelectItem>
                  <SelectItem value="cost:desc">Highest estimated cost</SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                value={filters.view}
                onValueChange={(value) => value && setFilters({ view: value })}
                aria-label="Choose layout"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <LayoutGrid />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {meta ? (
              <ResultCount count={meta.total} noun="trip" />
            ) : (
              <span className="text-sm text-muted-foreground">Loading trips…</span>
            )}
            {hasActiveFilters ? <ClearFilters onClick={clearFilters} /> : null}
          </div>
        </section>

        {/* ── Results ── */}
        {tripsQuery.isLoading ? (
          <TripGridSkeleton count={6} />
        ) : tripsQuery.isError ? (
          <ErrorState
            title="We could not load your trips"
            message="Please check your connection and try again."
            onRetry={() => void tripsQuery.refetch()}
          />
        ) : trips.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="No trips match those filters"
              description="Try a different status, clear the search box, or reset the filters to see everything."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Plane}
              title="No trips yet"
              description="Start planning your first adventure. Add cities, build day-by-day itineraries and track your budget as you go."
              action={
                <Button asChild>
                  <Link to="/trips/create">
                    <CalendarPlus />
                    Plan New Trip
                  </Link>
                </Button>
              }
            />
          )
        ) : filters.view === 'list' ? (
          <div className="space-y-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} variant="list" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && meta.totalPages > 1 ? (
          <nav
            aria-label="Trip pages"
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
    </>
  );
}
