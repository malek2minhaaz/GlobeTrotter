import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { toast } from '@/lib/toast';
import { shareService, tripsService } from '@/services/trips.service';

/**
 * Trip mutations shared by the dashboard, the trips list and the trip workspace.
 *
 * Centralising them keeps cache invalidation honest: a trip change always
 * refreshes the list, the detail view and the dashboard together, so no two
 * screens can disagree about the same trip.
 */
export function useTripMutations() {
  const queryClient = useQueryClient();

  /** Refreshes everything a trip change can affect. */
  const invalidate = (tripId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    if (tripId) void queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
  };

  const deleteTrip = useMutation({
    mutationFn: (tripId: string) => tripsService.remove(tripId),
    onSuccess: (_data, tripId) => {
      queryClient.removeQueries({ queryKey: queryKeys.trip(tripId) });
      invalidate();
      toast.success('Trip deleted', 'The itinerary and its expenses were removed.');
    },
    onError: (error) => toast.fromError(error, 'We could not delete that trip.'),
  });

  const shareTrip = useMutation({
    mutationFn: ({ tripId, isPublic }: { tripId: string; isPublic: boolean }) =>
      tripsService.share(tripId, isPublic),
    onSuccess: (result, variables) => {
      invalidate(variables.tripId);
      queryClient.setQueryData(queryKeys.trip(variables.tripId), result);
      toast.success(
        variables.isPublic ? 'Trip is now public' : 'Trip is now private',
        variables.isPublic
          ? 'Anyone with the link can view your itinerary.'
          : 'The share link no longer works.',
      );
    },
    onError: (error) => toast.fromError(error, 'We could not change the sharing setting.'),
  });

  const copyTrip = useMutation({
    mutationFn: (slug: string) => shareService.copy(slug),
    onSuccess: () => {
      invalidate();
      toast.success('Trip copied', 'A private copy is now in your trips.');
    },
    onError: (error) => toast.fromError(error, 'We could not copy that trip.'),
  });

  return { deleteTrip, shareTrip, copyTrip, invalidate };
}
