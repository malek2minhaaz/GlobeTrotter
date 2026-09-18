import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, MapPin, Plane, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { SmartImage } from '@/components/common/SmartImage';
import { queryKeys } from '@/lib/queryClient';
import { toast } from '@/lib/toast';
import { tripsService } from '@/services/trips.service';
import { useAuth } from '@/contexts/AuthContext';
import { addDaysISO, formatDateRange, pluralise } from '@/lib/format';
import type { City, TripListItem } from '@/types/api';

/** Default stay length when dropping a city onto a trip from the discovery pages. */
const DEFAULT_STAY_DAYS = 3;

/**
 * "Add to Trip" (Sections 12 and 24).
 *
 * The trip list does not carry stop dates, so the chosen trip is re-read before
 * writing: the new city is appended after the last stay, and the request is
 * refused with an explanation when the trip has no free days left rather than
 * silently creating a stay outside the trip's window.
 */
export function AddCityToTripDialog({
  city,
  open,
  onOpenChange,
}: {
  city: City | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const tripParams = React.useMemo(() => ({ pageSize: 50, sortBy: 'startDate' as const, sort: 'asc' as const }), []);

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips(tripParams),
    queryFn: () => tripsService.list(tripParams),
    enabled: open && isAuthenticated,
  });

  const addMutation = useMutation({
    mutationFn: async (trip: TripListItem) => {
      if (!city) throw new Error('No city selected.');

      const { trip: detail } = await tripsService.get(trip.id);
      const lastStopEnd = detail.stops.reduce<string | null>(
        (latest, stop) => (!latest || stop.endDate > latest ? stop.endDate : latest),
        null,
      );

      const nextStart = lastStopEnd
        ? addDaysISO(lastStopEnd, 1) > detail.startDate
          ? addDaysISO(lastStopEnd, 1)
          : detail.startDate
        : detail.startDate;

      if (nextStart > detail.endDate) {
        throw new Error(
          `${detail.name} is fully booked — all ${pluralise(detail.durationDays, 'day')} already have a city.`,
        );
      }

      const proposedEnd = addDaysISO(nextStart, DEFAULT_STAY_DAYS - 1);
      const endDate = proposedEnd > detail.endDate ? detail.endDate : proposedEnd;

      await tripsService.addStop(trip.id, { cityId: city.id, startDate: nextStart, endDate });
      return { tripId: trip.id, startDate: nextStart, endDate };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(`${city?.name} added`, 'Open the itinerary to plan your days there.');
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'We could not add that city.'),
  });

  const trips = tripsQuery.data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {city?.name} to a trip</DialogTitle>
          <DialogDescription>
            Choose which trip should include {city?.name}
            {city ? `, ${city.country}` : ''}. We will schedule a{' '}
            {pluralise(DEFAULT_STAY_DAYS, 'day')} stay after your existing stops.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <EmptyState
            icon={Plane}
            title="Sign in to start planning"
            description="Create a free account to build multi-city itineraries and track your budget."
            action={
              <Button
                asChild
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/login?redirect=${encodeURIComponent(`/city/${city?.id ?? ''}`)}`);
                }}
              >
                <Link to={`/login?redirect=${encodeURIComponent(`/city/${city?.id ?? ''}`)}`}>
                  Sign in
                </Link>
              </Button>
            }
          />
        ) : tripsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : tripsQuery.isError ? (
          <ErrorState
            message="We could not load your trips. Please try again."
            onRetry={() => void tripsQuery.refetch()}
          />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No trips yet"
            description="Create your first trip and we will drop this city straight into it."
            action={
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/trips/create?city=${city?.id ?? ''}`);
                }}
              >
                <Plus />
                Plan a new trip
              </Button>
            }
          />
        ) : (
          <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <SmartImage
                  src={trip.coverImage}
                  alt=""
                  decorative
                  seed={trip.name}
                  className="size-12 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{trip.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">
                      <MapPin aria-hidden="true" />
                      {pluralise(trip.cityCount, 'city', 'cities')}
                    </Badge>
                    <Badge variant="secondary">{pluralise(trip.durationDays, 'day')}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  loading={addMutation.isPending && addMutation.variables?.id === trip.id}
                  disabled={addMutation.isPending}
                  onClick={() => addMutation.mutate(trip)}
                  aria-label={`Add ${city?.name} to ${trip.name}`}
                >
                  <Plus />
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
          You can change the dates, reorder cities and add activities once the city is in place.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Hook-friendly wrapper so pages do not all repeat the open/close plumbing. */
export function useAddCityDialog() {
  const [city, setCity] = React.useState<City | null>(null);
  return {
    city,
    open: Boolean(city),
    openFor: (next: City) => setCity(next),
    onOpenChange: (next: boolean) => {
      if (!next) setCity(null);
    },
  };
}
