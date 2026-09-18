import * as React from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  LayoutDashboard,
  MapPin,
  Pencil,
  Route,
  Ticket,
  Trash2,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState, LoadingPanel } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SmartImage } from '@/components/common/SmartImage';
import { ShareTripDialog } from '@/components/trip/ShareTripDialog';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { useTripMutations } from '@/hooks/useTripMutations';
import { useCurrency } from '@/hooks/useCurrency';
import { TRIP_STATUS_META } from '@/lib/categoryMeta';
import { describeCountdown, formatCurrency, formatDateRange, pluralise } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TripDetail } from '@/types/api';

/**
 * Trip workspace (Sections 13, 17 and 19).
 *
 * The trip is loaded once here and shared with every section through the outlet
 * context, so the overview, itinerary, budget and calendar cannot disagree about
 * dates, cities or costs.
 */

export interface TripWorkspaceContext {
  trip: TripDetail;
  currency: string;
}

/** Access the loaded trip from any workspace section. */
export function useTripWorkspace(): TripWorkspaceContext {
  return useOutletContext<TripWorkspaceContext>();
}

const TABS = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'itinerary', label: 'Itinerary', icon: Route, end: false },
  { to: 'budget', label: 'Budget', icon: Wallet, end: false },
  { to: 'calendar', label: 'Calendar', icon: CalendarDays, end: false },
];

export function TripWorkspaceLayout() {
  const { tripId = '' } = useParams();
  const currency = useCurrency();
  const navigate = useNavigate();
  const { deleteTrip } = useTripMutations();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const tripQuery = useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: () => tripsService.get(tripId),
    enabled: Boolean(tripId),
  });

  // Surfaced on the itinerary tab so a clash is visible without opening it.
  const conflictsQuery = useQuery({
    queryKey: queryKeys.tripConflicts(tripId),
    queryFn: () => tripsService.conflicts(tripId),
    enabled: Boolean(tripId),
    staleTime: 30_000,
  });

  if (tripQuery.isLoading) {
    return <LoadingPanel label="Opening your trip…" className="min-h-[60dvh]" />;
  }

  if (tripQuery.isError || !tripQuery.data) {
    return (
      <ErrorState
        title="We could not open this trip"
        message="It may have been deleted, or the link may be incomplete."
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }

  const trip = tripQuery.data.trip;
  const status = TRIP_STATUS_META[trip.status];
  const conflictCount = conflictsQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="relative h-44 sm:h-52">
          <SmartImage
            src={trip.coverImage}
            alt=""
            decorative
            seed={trip.name}
            className="size-full"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <Button asChild variant="secondary" size="sm" className="bg-background/85 backdrop-blur-sm">
              <Link to="/trips">
                <ArrowLeft />
                All trips
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              {trip.isPublic && trip.publicSlug ? (
                <Button asChild variant="secondary" size="sm" className="bg-background/85 backdrop-blur-sm">
                  <Link to={`/shared/${trip.publicSlug}`} target="_blank" rel="noreferrer">
                    <Globe2 />
                    Public page
                  </Link>
                </Button>
              ) : null}
              <ShareTripDialog
                trip={trip}
                trigger={
                  <Button variant="secondary" size="sm" className="bg-background/85 backdrop-blur-sm">
                    <Globe2 />
                    Share
                  </Button>
                }
              />
            </div>
          </div>

          <div className="absolute inset-x-4 bottom-4 space-y-2 text-white sm:inset-x-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.tone}>{status.label}</Badge>
              {trip.status === 'UPCOMING' ? (
                <Badge variant="accent">{describeCountdown(trip.daysUntilStart, trip.status)}</Badge>
              ) : null}
              {trip.sourceTripId ? <Badge variant="secondary">Copied trip</Badge> : null}
            </div>
            <h1 className="text-2xl font-semibold drop-shadow-sm sm:text-3xl">{trip.name}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {formatDateRange(trip.startDate, trip.endDate)} · {pluralise(trip.durationDays, 'day')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" />
                {pluralise(trip.cityCount, 'city', 'cities')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="size-3.5" aria-hidden="true" />
                {pluralise(trip.activityCount, 'activity', 'activities')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="size-3.5" aria-hidden="true" />
                {formatCurrency(trip.estimatedCost, currency)} estimated
              </span>
            </p>
          </div>
        </div>

        {/* ── Actions + tabs ── */}
        <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Trip sections" className="rail no-scrollbar gap-1">
            {TABS.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to === '' ? `/trips/${tripId}` : `/trips/${tripId}/${tab.to}`}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {tab.label}
                {tab.label === 'Itinerary' && conflictCount > 0 ? (
                  <span
                    className="flex items-center gap-1 rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold text-warning"
                    title={`${conflictCount} scheduling warnings`}
                  >
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    {conflictCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/trips/${tripId}/edit`}>
                <Pencil />
                Edit trip
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        loading={deleteTrip.isPending}
        title={`Delete “${trip.name}”?`}
        description={
          <>
            This removes {pluralise(trip.cityCount, 'city', 'cities')},{' '}
            {pluralise(trip.activityCount, 'activity', 'activities')} and every logged expense. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete trip"
        onConfirm={() =>
          deleteTrip.mutate(trip.id, {
            onSuccess: () => navigate('/trips', { replace: true }),
            onSettled: () => setConfirmDelete(false),
          })
        }
      />

      <Outlet context={{ trip, currency } satisfies TripWorkspaceContext} />
    </div>
  );
}
