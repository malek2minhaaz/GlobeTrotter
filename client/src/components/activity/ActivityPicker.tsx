import * as React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/common/SearchInput';
import { FilterChips, ClearFilters, type ChipOption } from '@/components/common/FilterChips';
import { ActivityListSkeleton } from '@/components/common/Skeletons';
import { ActivityCard } from './ActivityCard';
import { ACTIVITY_CATEGORIES } from '@/lib/categoryMeta';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService, type ActivityListParams } from '@/services/discovery.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { Activity, ActivityCategory } from '@/types/api';

/**
 * Activity search (Section 14).
 *
 * Used inside the itinerary builder and the create-trip wizard. It owns its own
 * search and filter state because those are panel-local, and only the "add"
 * action is lifted to the parent.
 */
export function ActivityPicker({
  cityId,
  cityName,
  onAdd,
  addingId,
  className,
}: {
  /** Restricts results to one destination; omit to search everywhere. */
  cityId?: string | null;
  cityName?: string;
  onAdd: (activity: Activity) => void;
  addingId?: string | null;
  className?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<ActivityCategory | 'ALL'>('ALL');
  const [cost, setCost] = React.useState<'ALL' | 'FREE' | 'LOW' | 'MID' | 'HIGH'>('ALL');
  const [duration, setDuration] = React.useState<'ALL' | 'SHORT' | 'HALF' | 'LONG'>('ALL');
  const [showFilters, setShowFilters] = React.useState(false);

  const debouncedQuery = useDebouncedValue(query, 350);

  const params: ActivityListParams = {
    pageSize: 24,
    q: debouncedQuery || undefined,
    cityId: cityId ?? undefined,
    category: category === 'ALL' ? undefined : category,
    minCost: cost === 'MID' ? 1000 : cost === 'HIGH' ? 5000 : undefined,
    maxCost: cost === 'FREE' ? 0 : cost === 'LOW' ? 1000 : cost === 'MID' ? 5000 : undefined,
    maxDuration:
      duration === 'SHORT' ? 2 : duration === 'HALF' ? 4 : duration === 'LONG' ? 9 : undefined,
    sortBy: 'popularity',
    sort: 'desc',
  };

  const activitiesQuery = useQuery({
    queryKey: queryKeys.activities(params),
    queryFn: () => discoveryService.activities(params),
    placeholderData: keepPreviousData,
  });

  const activities = activitiesQuery.data?.data ?? [];
  const hasFilters = query !== '' || category !== 'ALL' || cost !== 'ALL' || duration !== 'ALL';

  const reset = () => {
    setQuery('');
    setCategory('ALL');
    setCost('ALL');
    setDuration('ALL');
  };

  const categoryOptions: Array<ChipOption<ActivityCategory | 'ALL'>> = [
    { value: 'ALL', label: 'All categories' },
    ...ACTIVITY_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label })),
  ];

  return (
    <div className={cn('flex h-full flex-col gap-3', className)}>
      <div className="space-y-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search things to do…"
          label="Search activities"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="activity-filters"
          >
            <SlidersHorizontal />
            Filters
            {hasFilters ? (
              <Badge variant="solid" className="ml-0.5 px-1.5 py-0">
                on
              </Badge>
            ) : null}
          </Button>
          {hasFilters ? <ClearFilters onClick={reset} className="ml-auto" /> : null}
        </div>

        {showFilters ? (
          <div id="activity-filters" className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={cost} onValueChange={(value) => setCost(value as typeof cost)}>
                <SelectTrigger className="h-9" aria-label="Filter by cost">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any cost</SelectItem>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="LOW">Under ₹1,000</SelectItem>
                  <SelectItem value="MID">Under ₹5,000</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={duration}
                onValueChange={(value) => setDuration(value as typeof duration)}
              >
                <SelectTrigger className="h-9" aria-label="Filter by duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any duration</SelectItem>
                  <SelectItem value="SHORT">Up to 2 hours</SelectItem>
                  <SelectItem value="HALF">Up to 4 hours</SelectItem>
                  <SelectItem value="LONG">A full day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FilterChips
              label="Activity category"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
            />
          </div>
        ) : null}
      </div>

      {cityName ? (
        <p className="text-xs text-muted-foreground">
          Showing things to do in <span className="font-medium text-foreground">{cityName}</span>
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
        {activitiesQuery.isLoading ? (
          <ActivityListSkeleton count={4} />
        ) : activitiesQuery.isError ? (
          <ErrorState
            message="We could not load activities right now."
            onRetry={() => void activitiesQuery.refetch()}
          />
        ) : activities.length === 0 ? (
          <EmptyState
            icon={hasFilters ? Search : Ticket}
            title={hasFilters ? 'No activities match' : 'No activities here yet'}
            description={
              hasFilters
                ? 'Try a broader category, a higher budget or a longer duration.'
                : 'Once this destination has activities in the catalogue they will appear here.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
            className="py-8"
          />
        ) : (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              variant="row"
              onAdd={onAdd}
              adding={addingId === activity.id}
            />
          ))
        )}
      </div>

      {activities.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {activitiesQuery.data?.meta.total ?? activities.length} activities available
        </p>
      ) : null}
    </div>
  );
}
