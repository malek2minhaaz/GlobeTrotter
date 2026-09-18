import { useQuery } from '@tanstack/react-query';
import { Check, MapPin, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { SearchInput } from '@/components/common/SearchInput';
import { SmartImage } from '@/components/common/SmartImage';
import { ActivityListSkeleton } from '@/components/common/Skeletons';
import { costBand } from './CityCard';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService } from '@/services/discovery.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { City } from '@/types/api';

/**
 * City picker used by the create-trip wizard and the itinerary builder's
 * "add city" flow. Destinations already on the trip are shown as added rather
 * than hidden, so the list does not jump around as you select.
 */
export function CitySearchPicker({
  query,
  onQueryChange,
  selectedIds,
  onSelect,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedIds: string[];
  onSelect: (city: City) => void;
  className?: string;
}) {
  const debouncedQuery = useDebouncedValue(query, 350);

  const citiesQuery = useQuery({
    queryKey: queryKeys.cities({ q: debouncedQuery, picker: true }),
    queryFn: () =>
      discoveryService.cities({
        q: debouncedQuery || undefined,
        pageSize: 30,
        sortBy: debouncedQuery ? 'name' : 'popularity',
        sort: debouncedQuery ? 'asc' : 'desc',
      }),
  });

  const cities = citiesQuery.data?.data ?? [];
  const selected = new Set(selectedIds);

  return (
    <div className={cn('flex h-full flex-col gap-3', className)}>
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Where do you want to go?"
        label="Search destinations"
      />

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
        {citiesQuery.isLoading ? (
          <ActivityListSkeleton count={4} />
        ) : citiesQuery.isError ? (
          <ErrorState
            message="We could not load destinations right now."
            onRetry={() => void citiesQuery.refetch()}
          />
        ) : cities.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No destinations match"
            description="Try a different spelling, or search by country such as “Japan” or “France”."
            className="py-8"
          />
        ) : (
          cities.map((city) => {
            const added = selected.has(city.id);
            const band = costBand(city.costIndex);
            return (
              <article
                key={city.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors',
                  added ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <SmartImage
                  src={city.image}
                  alt=""
                  decorative
                  seed={`${city.name} ${city.country}`}
                  className="size-14 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{city.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    {city.country}
                    {city.region ? ` · ${city.region}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant={band.tone}>{band.label}</Badge>
                    <span className="text-[11px] text-muted-foreground">
                      ~{formatCurrency(city.estimatedDailyCost, 'INR')}/day
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={added ? 'secondary' : 'default'}
                  onClick={() => onSelect(city)}
                  aria-label={added ? `${city.name} is already on this trip` : `Add ${city.name}`}
                >
                  {added ? <Check /> : <Plus />}
                  {added ? 'Added' : 'Add'}
                </Button>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
