import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Bookmark, Compass, MapPin, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SearchInput } from '@/components/common/SearchInput';
import { ResultCount } from '@/components/common/FilterChips';
import { SmartImage } from '@/components/common/SmartImage';
import { CityGridSkeleton } from '@/components/common/Skeletons';
import { CityCard } from '@/components/city/CityCard';
import { AddCityToTripDialog, useAddCityDialog } from '@/components/trip/AddCityToTripDialog';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService } from '@/services/discovery.service';
import { useSavedCity } from '@/hooks/useSavedCity';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';

/**
 * Saved destinations (Section 24).
 *
 * Bookmarks are sorted by when they were saved, so the most recent keep coming
 * back to the top. Removal is immediate and reversible by bookmarking again.
 */

const DEFAULT_FILTERS = { q: '', sort: 'desc', page: '1' };

export default function SavedDestinationsPage() {
  const currency = useCurrency();
  const addCity = useAddCityDialog();
  const { toggle } = useSavedCity();
  const { filters, setFilters, hasActiveFilters } = useUrlFilters(DEFAULT_FILTERS);
  const debouncedQuery = useDebouncedValue(filters.q, 350);

  const savedQuery = useQuery({
    queryKey: queryKeys.saved({
      q: debouncedQuery,
      sort: filters.sort,
      page: filters.page,
    }),
    queryFn: () =>
      discoveryService.saved({
        q: debouncedQuery || undefined,
        sort: filters.sort as 'asc' | 'desc',
        page: Number(filters.page) || 1,
        pageSize: 16,
      }),
    placeholderData: keepPreviousData,
  });

  const saved = savedQuery.data?.data ?? [];
  const meta = savedQuery.data?.meta;

  return (
    <>
      <RouteMeta
        title="Saved destinations"
        description="Your bookmarked destinations, ready to drop into a trip."
      />

      <div className="space-y-6">
        <PageHeader
          title="Saved destinations"
          description="Places you bookmarked while browsing. Add one to a trip whenever the dates line up."
          actions={
            <Button asChild variant="outline">
              <Link to="/discover">
                <Compass />
                Explore more
              </Link>
            </Button>
          }
        />

        {saved.length > 0 || hasActiveFilters ? (
          <section
            aria-label="Filter saved destinations"
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <SearchInput
              value={filters.q}
              onChange={(value) => setFilters({ q: value })}
              placeholder="Search your saved destinations…"
              label="Search saved destinations"
              className="sm:max-w-md sm:flex-1"
            />
            <div className="flex items-center gap-3">
              {meta ? <ResultCount count={meta.total} noun="destination" /> : null}
              <Select value={filters.sort} onValueChange={(value) => setFilters({ sort: value })}>
                <SelectTrigger className="w-44" aria-label="Sort saved destinations">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Recently saved</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        ) : null}

        {savedQuery.isLoading ? (
          <CityGridSkeleton count={4} />
        ) : savedQuery.isError ? (
          <ErrorState
            title="We could not load your saved destinations"
            message="Please try again in a moment."
            onRetry={() => void savedQuery.refetch()}
          />
        ) : saved.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Search : Bookmark}
            title={hasActiveFilters ? 'No saved destinations match' : 'No saved destinations'}
            description={
              hasActiveFilters
                ? 'Try a different search term, or clear it to see everything you have bookmarked.'
                : 'Tap the bookmark on any destination while browsing and it will appear here.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={() => setFilters({ q: '', sort: 'desc' })}>
                  Clear search
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/discover">
                    <Compass />
                    Browse destinations
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {saved.map((entry) => (
              <CityCard key={entry.id} city={entry.city} onAddToTrip={addCity.openFor} />
            ))}
          </div>
        )}

        {saved.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Recently saved</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
              {saved.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 p-3">
                  <SmartImage
                    src={entry.city.image}
                    alt=""
                    decorative
                    seed={`${entry.city.name} ${entry.city.country}`}
                    className="size-11 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/city/${entry.city.id}`}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {entry.city.name}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {entry.city.country}
                      </span>
                      <span>Saved {formatDate(entry.savedAt, 'd MMM yyyy')}</span>
                      <span>{formatCurrency(entry.city.estimatedDailyCost, currency)}/day</span>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addCity.openFor(entry.city)}>
                    Add to trip
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => toggle(entry.city.id, true)}
                    aria-label={`Remove ${entry.city.name} from saved destinations`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {meta && meta.totalPages > 1 ? (
          <nav
            aria-label="Saved destination pages"
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
