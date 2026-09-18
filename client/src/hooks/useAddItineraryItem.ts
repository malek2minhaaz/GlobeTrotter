import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { tripsService } from '@/services/trips.service';
import type { Conflict } from '@/types/api';

export interface PendingConflict {
  message: string;
  conflicts: Conflict[];
  /** Retries the same write with the overlap explicitly allowed. */
  retry: () => void;
}

interface AddPayload {
  activityId: string;
  tripStopId?: string | null;
  date: string;
  startTime: string;
  endTime?: string | null;
  allowOverlap?: boolean;
  /** Used for the success toast only. */
  activityName?: string;
}

/**
 * Adding an activity, with the smart-itinerary rule handled (Section 15).
 *
 * When two activities overlap the API answers 409 rather than silently
 * scheduling a clash. Rather than surfacing a dead-end error, the conflict is
 * handed back so the traveller can confirm and retry — this is the "resolve
 * conflicts" path shared by the itinerary builder and the calendar.
 */
export function useAddItineraryItem(tripId: string) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = React.useState<PendingConflict | null>(null);

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripConflicts(tripId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripBudget(tripId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
  }, [queryClient, tripId]);

  const mutation = useMutation({
    mutationFn: (payload: AddPayload) =>
      tripsService.addItineraryItem(tripId, {
        activityId: payload.activityId,
        tripStopId: payload.tripStopId ?? null,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime ?? null,
        allowOverlap: payload.allowOverlap ?? false,
      }),
    onSuccess: (result, variables) => {
      invalidate();
      if (result.warnings.length > 0) {
        toast.warning('Added with a scheduling warning', result.warnings[0]?.message);
      } else {
        toast.success(variables.activityName ? `${variables.activityName} added` : 'Activity added');
      }
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.status === 409) {
        const conflicts =
          (error.details as { conflicts?: Conflict[] } | undefined)?.conflicts ?? [];
        setConflict({
          message: error.message,
          conflicts,
          retry: () => mutation.mutate({ ...variables, allowOverlap: true }),
        });
        return;
      }
      toast.fromError(error, 'We could not add that activity.');
    },
  });

  return {
    add: mutation.mutate,
    isLoading: mutation.isPending,
    /** Id of the activity currently being written, for per-row spinners. */
    pendingActivityId: mutation.isPending ? (mutation.variables?.activityId ?? null) : null,
    conflict,
    dismissConflict: () => setConflict(null),
  };
}
