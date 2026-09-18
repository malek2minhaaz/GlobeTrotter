import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Copy,
  Eye,
  Globe2,
  Lock,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconTooltip } from '@/components/ui/tooltip-checkbox';
import { SmartImage } from '@/components/common/SmartImage';
import { TRIP_STATUS_META } from '@/lib/categoryMeta';
import { formatCurrency, formatDateRange, describeCountdown, pluralise } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useTripMutations } from '@/hooks/useTripMutations';
import type { TripListItem } from '@/types/api';

/**
 * Trip card (Section 11).
 *
 * One component serves the dashboard, My Trips and the public shared page: the
 * `variant` only changes the layout, so a trip never looks like two different
 * objects depending on where you found it.
 */
export function TripCard({
  trip,
  variant = 'grid',
  showActions = true,
  className,
}: {
  trip: TripListItem;
  variant?: 'grid' | 'list';
  showActions?: boolean;
  className?: string;
}) {
  const currency = useCurrency();
  const { deleteTrip, shareTrip } = useTripMutations();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const status = TRIP_STATUS_META[trip.status];

  const meta = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        {formatDateRange(trip.startDate, trip.endDate)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5" aria-hidden="true" />
        {pluralise(trip.cityCount, 'city', 'cities')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Wallet className="size-3.5" aria-hidden="true" />
        {formatCurrency(trip.estimatedCost, currency)}
      </span>
    </div>
  );

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={status.tone}>{status.label}</Badge>
      {trip.isPublic ? (
        <Badge variant="outline">
          <Globe2 aria-hidden="true" />
          Public
        </Badge>
      ) : (
        <Badge variant="outline">
          <Lock aria-hidden="true" />
          Private
        </Badge>
      )}
      {trip.status === 'UPCOMING' ? (
        <Badge variant="accent">{describeCountdown(trip.daysUntilStart, trip.status)}</Badge>
      ) : null}
    </div>
  );

  const actionsMenu = showActions ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          // Keeps the button from being swallowed by the card's link overlay.
          onClick={(event) => event.preventDefault()}
          aria-label={`Actions for ${trip.name}`}
          className="shrink-0 bg-background/80 backdrop-blur-sm"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/trips/${trip.id}`}>
            <Eye />
            View trip
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/trips/${trip.id}/edit`}>
            <Pencil />
            Edit details
          </Link>
        </DropdownMenuItem>
        {trip.isPublic && trip.publicSlug ? (
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard
                .writeText(`${window.location.origin}/shared/${trip.publicSlug}`)
                .then(() => import('@/lib/toast').then(({ toast }) => toast.success('Link copied')))
                .catch(() => undefined);
            }}
          >
            <Copy />
            Copy share link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => shareTrip.mutate({ tripId: trip.id, isPublic: !trip.isPublic })}
        >
          {trip.isPublic ? <Lock /> : <Globe2 />}
          {trip.isPublic ? 'Make private' : 'Make public'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setConfirmOpen(true)}
        >
          <Trash2 />
          Delete trip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const confirmDialog = showActions ? (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      destructive
      loading={deleteTrip.isPending}
      title={`Delete “${trip.name}”?`}
      description={
        <>
          This permanently removes the itinerary, {pluralise(trip.activityCount, 'activity', 'activities')}{' '}
          and any logged expenses. It cannot be undone.
        </>
      }
      confirmLabel="Delete trip"
      onConfirm={() =>
        deleteTrip.mutate(trip.id, { onSettled: () => setConfirmOpen(false) })
      }
    />
  ) : null;

  if (variant === 'list') {
    return (
      <>
        <article
          className={cn(
            'group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:flex-row',
            className,
          )}
        >
          <Link
            to={`/trips/${trip.id}`}
            className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg sm:h-32 sm:w-52"
            tabIndex={-1}
            aria-hidden="true"
          >
            <SmartImage
              src={trip.coverImage}
              alt=""
              decorative
              seed={trip.name}
              className="size-full transition-transform duration-500 group-hover:scale-105"
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-base font-semibold">
                  <Link to={`/trips/${trip.id}`} className="hover:text-primary">
                    {trip.name}
                  </Link>
                </h3>
                {actionsMenu}
              </div>
              {badges}
              {trip.description ? (
                <p className="line-clamp-1 text-sm text-muted-foreground">{trip.description}</p>
              ) : null}
            </div>
            {meta}
          </div>
        </article>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <article
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
          className,
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <Link to={`/trips/${trip.id}`} tabIndex={-1} aria-hidden="true">
            <SmartImage
              src={trip.coverImage}
              alt=""
              decorative
              seed={trip.name}
              className="size-full transition-transform duration-500 group-hover:scale-105"
            />
          </Link>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <Badge variant={status.tone} className="bg-background/90 backdrop-blur-sm">
              {status.label}
            </Badge>
          </div>
          <div className="absolute right-3 top-3">{actionsMenu}</div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-medium text-white">
            <MapPin className="size-3.5" aria-hidden="true" />
            {trip.cities.length > 0
              ? trip.cities
                  .slice(0, 3)
                  .map((city) => city.name)
                  .join(' · ')
              : 'No destinations yet'}
            {trip.cities.length > 3 ? ` +${trip.cities.length - 3}` : ''}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="space-y-2">
            <h3 className="truncate text-base font-semibold">
              <Link to={`/trips/${trip.id}`} className="hover:text-primary">
                {trip.name}
              </Link>
            </h3>
            {badges}
          </div>
          {trip.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{trip.description}</p>
          ) : null}
          <div className="mt-auto space-y-3 pt-1">
            {meta}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={`/trips/${trip.id}`}>
                Open trip
                <Eye />
              </Link>
            </Button>
          </div>
        </div>
      </article>
      {confirmDialog}
    </>
  );
}

/** Small icon-only variant used in dense dashboard lists. */
export function TripCardCompact({ trip }: { trip: TripListItem }) {
  const currency = useCurrency();
  const status = TRIP_STATUS_META[trip.status];

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
    >
      <SmartImage
        src={trip.coverImage}
        alt=""
        decorative
        seed={trip.name}
        className="size-12 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-primary">{trip.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={status.tone}>{status.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(trip.estimatedCost, currency, { compact: true })}
        </span>
      </div>
    </Link>
  );
}

/** Row of icon actions used on the trip workspace header. */
export function TripActionIcons({ trip }: { trip: TripListItem }) {
  return (
    <div className="flex items-center gap-1">
      <IconTooltip label={trip.isPublic ? 'Public trip' : 'Private trip'}>
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {trip.isPublic ? <Globe2 className="size-4" /> : <Lock className="size-4" />}
        </span>
      </IconTooltip>
    </div>
  );
}
