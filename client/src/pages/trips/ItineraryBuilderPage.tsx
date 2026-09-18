import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  MapPin,
  Plane,
  Plus,
  Route,
  Sparkles,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SheetContent, Dialog } from '@/components/ui/overlay';
import { Separator } from '@/components/ui/misc';
import { IconTooltip } from '@/components/ui/tooltip-checkbox';
import { ActivityPicker } from '@/components/activity/ActivityPicker';
import { ConflictBanner } from '@/components/common/ConflictBanner';
import { StayListPanel } from '@/components/trip/itinerary/StayListPanel';
import { AddCityDialog } from '@/components/trip/itinerary/AddCityDialog';
import { ItineraryItemDialog } from '@/components/trip/itinerary/ItineraryItemDialog';
import { SortableItineraryItems } from '@/components/trip/itinerary/SortableItineraryItems';
import { ConflictResolutionDialog } from '@/components/trip/itinerary/ConflictResolutionDialog';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { toast } from '@/lib/toast';
import { activityCategoryIcon, activityCategoryLabel } from '@/lib/categoryMeta';
import { formatCurrency, formatDateRange, pluralise } from '@/lib/format';
import { daysBetween, nextSlot } from '@/lib/wizard';
import { useTripWorkspace } from '@/layouts/TripWorkspaceLayout';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAddItineraryItem } from '@/hooks/useAddItineraryItem';
import { cn } from '@/lib/utils';
import type { Activity, Conflict, ItineraryItem, TripDetail, TripStop } from '@/types/api';
import type { ItineraryItemForm } from '@/lib/schemas';

/**
 * Itinerary builder (Sections 13, 14 and 15).
 *
 * Left: the cities and their dates. Centre: the days, with drag-and-drop
 * reordering and inline conflict warnings. Right: activity search scoped to the
 * selected city, plus a live cost summary. Below `lg` the side panes move into
 * sheets so the days keep the full width.
 */
export default function ItineraryBuilderPage() {
  const { trip, currency } = useTripWorkspace();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const orderedStops = React.useMemo(
    () => [...trip.stops].sort((a, b) => a.order - b.order),
    [trip.stops],
  );

  const [activeStopId, setActiveStopId] = React.useState<string | null>(
    orderedStops[0]?.id ?? null,
  );
  const [activeDate, setActiveDate] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<ItineraryItem | null>(null);
  const [addCityOpen, setAddCityOpen] = React.useState(false);
  const [mobileCitiesOpen, setMobileCitiesOpen] = React.useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = React.useState(false);
  const [stopToRemove, setStopToRemove] = React.useState<TripStop | null>(null);
  const [itemToRemove, setItemToRemove] = React.useState<ItineraryItem | null>(null);

  const activeStop = orderedStops.find((stop) => stop.id === activeStopId) ?? orderedStops[0] ?? null;

  const conflictsQuery = useQuery({
    queryKey: queryKeys.tripConflicts(trip.id),
    queryFn: () => tripsService.conflicts(trip.id),
    staleTime: 20_000,
  });
  const conflicts = conflictsQuery.data ?? [];

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripConflicts(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripBudget(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
  }, [queryClient, trip.id]);

  // ── Day selection ──

  const activeDays = activeStop ? daysBetween(activeStop.startDate, activeStop.endDate) : [];

  React.useEffect(() => {
    if (!activeStop) {
      setActiveDate(null);
      return;
    }
    const days = daysBetween(activeStop.startDate, activeStop.endDate);
    setActiveDate((current) => (current && days.includes(current) ? current : (days[0] ?? null)));
  }, [activeStop]);

  const dayItems = React.useMemo(
    () =>
      trip.itineraryItems
        .filter((item) => item.date === activeDate)
        .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime)),
    [trip.itineraryItems, activeDate],
  );

  const unscheduledDays = orderedStops.filter((stop) =>
    daysBetween(stop.startDate, stop.endDate).every(
      (date) => !trip.itineraryItems.some((item) => item.date === date),
    ),
  );

  // ── Mutations ──

  const addItem = useAddItineraryItem(trip.id);

  /**
   * Schedules a picked activity after everything already on the chosen day, so
   * the builder's default times never create the overlap it would then warn about.
   */
  const scheduleActivity = (activity: Activity) => {
    if (!activeStop || !activeDate) {
      toast.info('Pick a city and a day first');
      return;
    }
    const existing = trip.itineraryItems
      .filter((item) => item.date === activeDate)
      .map((item) => ({ startTime: item.startTime, duration: item.activity?.duration ?? 1 }));
    const slot = nextSlot(existing, activity);

    addItem.add({
      activityId: activity.id,
      tripStopId: activeStop.id,
      date: activeDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      activityName: activity.name,
    });
  };

  const updateItem = useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: ItineraryItemForm }) =>
      tripsService.updateItineraryItem(itemId, {
        title: values.title || undefined,
        category: values.category ? (values.category as ItineraryItem['category']) : undefined,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime || null,
        notes: values.notes || null,
        customCost: values.customCost === '' || values.customCost === undefined ? null : Number(values.customCost),
        allowOverlap: true,
      }),
    onSuccess: (result) => {
      invalidate();
      setEditingItem(null);
      if (result.warnings.length > 0) {
        toast.warning('Saved with a scheduling warning', result.warnings[0]?.message);
      } else {
        toast.success('Activity updated');
      }
    },
    onError: (error) => toast.fromError(error, 'We could not save that activity.'),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => tripsService.removeItineraryItem(itemId),
    onSuccess: () => {
      invalidate();
      setItemToRemove(null);
      setEditingItem(null);
      toast.info('Removed from the itinerary');
    },
    onError: (error) => toast.fromError(error, 'We could not remove that activity.'),
  });

  const reorderItems = useMutation({
    mutationFn: (ordered: ItineraryItem[]) =>
      tripsService.reorderItinerary(
        trip.id,
        ordered.map((item, index) => ({ id: item.id, order: index })),
      ),
    // Apply the new order immediately so the drop feels instant.
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.trip(trip.id) });
      const previous = queryClient.getQueryData(queryKeys.trip(trip.id));
      const orderById = new Map(ordered.map((item, index) => [item.id, index]));

      queryClient.setQueryData(queryKeys.trip(trip.id), (current: { trip: typeof trip } | undefined) => {
        if (!current) return current;
        return {
          trip: {
            ...current.trip,
            itineraryItems: current.trip.itineraryItems.map((item) =>
              orderById.has(item.id) ? { ...item, order: orderById.get(item.id)! } : item,
            ),
          },
        };
      });

      return { previous };
    },
    onError: (error, _ordered, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.trip(trip.id), context.previous);
      toast.fromError(error, 'We could not save the new order.');
    },
    onSuccess: (result) => {
      if (result.conflicts.length > 0) {
        toast.warning('Order saved with a warning', result.conflicts[0]?.message);
      }
    },
    onSettled: invalidate,
  });

  const addStop = useMutation({
    mutationFn: (values: { cityId: string; startDate: string; endDate: string }) =>
      tripsService.addStop(trip.id, values),
    onSuccess: () => {
      invalidate();
      setAddCityOpen(false);
      toast.success('City added', 'Now add some activities to its days.');
    },
    onError: (error) => toast.fromError(error, 'We could not add that city.'),
  });

  const updateStop = useMutation({
    mutationFn: ({ stopId, patch }: { stopId: string; patch: { startDate?: string; endDate?: string } }) =>
      tripsService.updateStop(stopId, patch),
    onSuccess: () => invalidate(),
    onError: (error) => toast.fromError(error, 'We could not update those dates.'),
  });

  const reorderStops = useMutation({
    mutationFn: (stopIds: string[]) => tripsService.reorderStops(trip.id, stopIds),
    onSuccess: () => {
      invalidate();
      toast.success('Route reordered');
    },
    onError: (error) => toast.fromError(error, 'We could not reorder your cities.'),
  });

  const removeStop = useMutation({
    mutationFn: (stopId: string) => tripsService.removeStop(stopId),
    onSuccess: (result) => {
      invalidate();
      setStopToRemove(null);
      toast.info(
        'City removed',
        result.removedItems > 0
          ? `${pluralise(result.removedItems, 'activity', 'activities')} were removed with it.`
          : undefined,
      );
    },
    onError: (error) => toast.fromError(error, 'We could not remove that city.'),
  });

  const moveStop = (stopId: string, direction: -1 | 1) => {
    const ids = orderedStops.map((stop) => stop.id);
    const index = ids.indexOf(stopId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    reorderStops.mutate(next);
  };

  const lastStayEnd = orderedStops.reduce<string | null>(
    (latest, stop) => (!latest || stop.endDate > latest ? stop.endDate : latest),
    null,
  );

  const itineraryCost = trip.itineraryItems.reduce((total, item) => total + item.effectiveCost, 0);
  const dayCost = dayItems.reduce((total, item) => total + item.effectiveCost, 0);

  // ── Shared panes ──

  const citiesPane = (
    <StayListPanel
      stops={trip.stops}
      activeStopId={activeStop?.id ?? null}
      tripStart={trip.startDate}
      tripEnd={trip.endDate}
      onSelect={(stopId) => {
        setActiveStopId(stopId);
        setMobileCitiesOpen(false);
      }}
      onReorder={moveStop}
      onUpdateDates={(stopId, patch) => updateStop.mutate({ stopId, patch })}
      onRemove={setStopToRemove}
      onAddCity={() => {
        setAddCityOpen(true);
        setMobileCitiesOpen(false);
      }}
    />
  );

  const pickerPane = activeStop ? (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Add activities</h2>
        <p className="text-xs text-muted-foreground">
          {activeDate
            ? `Adding to ${formatDateRange(activeDate, activeDate)} in ${activeStop.city.name}`
            : 'Select a day first'}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ActivityPicker
          cityId={activeStop.city.id}
          cityName={activeStop.city.name}
          onAdd={(activity) => {
            scheduleActivity(activity);
            setMobilePickerOpen(false);
          }}
          addingId={addItem.pendingActivityId}
        />
      </div>
    </div>
  ) : null;

  if (orderedStops.length === 0) {
    return (
      <>
        <EmptyState
          icon={Plane}
          title="Add your first destination"
          description="The itinerary is built around your cities. Add one and we will lay out the days for you to fill."
          action={
            <Button onClick={() => setAddCityOpen(true)}>
              <Plus />
              Add a city
            </Button>
          }
        />
        <AddCityDialog
          open={addCityOpen}
          onOpenChange={setAddCityOpen}
          tripStart={trip.startDate}
          tripEnd={trip.endDate}
          existingCityIds={[]}
          lastStayEnd={null}
          saving={addStop.isPending}
          onSubmit={({ city, startDate, endDate }) =>
            addStop.mutate({ cityId: city.id, startDate, endDate })
          }
        />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-12">
        {/* ── Left: cities ── */}
        {isDesktop ? (
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">{citiesPane}</div>
          </aside>
        ) : null}

        {/* ── Centre: days ── */}
        <section className="space-y-4 lg:col-span-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {activeStop ? activeStop.city.name : 'Itinerary'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeStop
                  ? `${formatDateRange(activeStop.startDate, activeStop.endDate)} · ${pluralise(activeStop.dayCount, 'day')}`
                  : 'Add a city to begin'}
              </p>
            </div>

            {!isDesktop ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setMobileCitiesOpen(true)}>
                  <MapPin />
                  Cities
                </Button>
                <Button size="sm" onClick={() => setMobilePickerOpen(true)} disabled={!activeStop}>
                  <Plus />
                  Add activity
                </Button>
              </div>
            ) : null}
          </header>

          <div className="rail no-scrollbar gap-2">
            {activeDays.map((date, index) => {
              const count = trip.itineraryItems.filter((item) => item.date === date).length;
              const selected = date === activeDate;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setActiveDate(date)}
                  aria-pressed={selected}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="block font-semibold">Day {index + 1}</span>
                  <span className="block text-muted-foreground">
                    {formatDateRange(date, date)}
                  </span>
                  <span className={count > 0 ? 'block text-primary' : 'block text-muted-foreground'}>
                    {count > 0 ? `${count} planned` : 'empty'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Warnings are shown for the day being edited; the summary panel
              carries the total across the trip. */}
          <ConflictBanner conflicts={conflicts.filter((conflict) => conflict.date === activeDate)} />

          {activeDate ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {formatDateRange(activeDate, activeDate)}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {dayItems.length > 0
                      ? `${pluralise(dayItems.length, 'activity', 'activities')} · ${formatCurrency(dayCost, currency)}`
                      : 'nothing planned'}
                  </span>
                </h3>
                {dayItems.length > 0 ? (
                  <IconTooltip label="Drag the handle to reorder, or use the arrow buttons">
                    <Badge variant="outline">Drag to reorder</Badge>
                  </IconTooltip>
                ) : null}
              </div>

              {dayItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <CalendarDays
                    className="mx-auto size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-medium">Nothing planned for this day</p>
                  <p className="text-xs text-muted-foreground">
                    {isDesktop
                      ? 'Search for something to do in the panel on the right.'
                      : 'Tap “Add activity” to search things to do.'}
                  </p>
                  {!isDesktop ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => setMobilePickerOpen(true)}
                      disabled={!activeStop}
                    >
                      <Plus />
                      Add activity
                    </Button>
                  ) : null}
                </div>
              ) : (
                <SortableItineraryItems
                  items={dayItems}
                  currency={currency}
                  conflicts={conflicts}
                  onReorder={(next) => reorderItems.mutate(next)}
                  onEdit={setEditingItem}
                  onDelete={setItemToRemove}
                />
              )}
            </div>
          ) : null}

          {unscheduledDays.length > 0 ? (
            <section className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                Still empty
              </h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {unscheduledDays.map((stop) => (
                  <li key={stop.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => setActiveStopId(stop.id)}
                    >
                      {stop.city.name}
                    </button>
                    <span>· {pluralise(stop.dayCount, 'day')} with nothing planned</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        {/* ── Right: picker + summary ── */}
        {isDesktop ? (
          <aside className="space-y-5 lg:col-span-3">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-24">
              <div className="h-[24rem]">{pickerPane}</div>
              <Separator />
              <SummaryPanel
                trip={trip}
                currency={currency}
                itineraryCost={itineraryCost}
                conflicts={conflicts}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* ── Mobile sheets ── */}
      {!isDesktop ? (
        <>
          <Dialog open={mobileCitiesOpen} onOpenChange={setMobileCitiesOpen}>
            <SheetContent side="bottom" title="Cities on this trip" className="max-h-[85dvh]">
              {citiesPane}
            </SheetContent>
          </Dialog>

          <Dialog open={mobilePickerOpen} onOpenChange={setMobilePickerOpen}>
            <SheetContent
              side="bottom"
              title="Add an activity"
              description={
                activeStop ? `Searching ${activeStop.city.name}` : 'Select a city first'
              }
              className="max-h-[85dvh]"
            >
              <div className="h-[65dvh]">{pickerPane}</div>
            </SheetContent>
          </Dialog>
        </>
      ) : null}

      {/* ── Summary on tablet and below ── */}
      {!isDesktop ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SummaryPanel
            trip={trip}
            currency={currency}
            itineraryCost={itineraryCost}
            conflicts={conflicts}
          />
        </section>
      ) : null}

      {/* ── Dialogs ── */}
      <AddCityDialog
        open={addCityOpen}
        onOpenChange={setAddCityOpen}
        tripStart={trip.startDate}
        tripEnd={trip.endDate}
        existingCityIds={orderedStops.map((stop) => stop.cityId)}
        lastStayEnd={lastStayEnd}
        saving={addStop.isPending}
        onSubmit={({ city, startDate, endDate }) =>
          addStop.mutate({ cityId: city.id, startDate, endDate })
        }
      />

      <ItineraryItemDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        saving={updateItem.isPending}
        deleting={deleteItem.isPending}
        minDate={trip.startDate}
        maxDate={trip.endDate}
        onSubmit={(values) => {
          if (editingItem) updateItem.mutate({ itemId: editingItem.id, values });
        }}
        onDelete={() => {
          if (editingItem) deleteItem.mutate(editingItem.id);
        }}
      />

      <ConflictResolutionDialog
        conflict={addItem.conflict}
        onDismiss={addItem.dismissConflict}
        onConfirm={() => {
          addItem.conflict?.retry();
          addItem.dismissConflict();
        }}
      />

      <ConfirmDialog
        open={Boolean(stopToRemove)}
        onOpenChange={(open) => {
          if (!open) setStopToRemove(null);
        }}
        destructive
        loading={removeStop.isPending}
        title={`Remove ${stopToRemove?.city.name}?`}
        description={
          <>
            This deletes the stay and all{' '}
            {pluralise(stopToRemove?.itemCount ?? 0, 'activity', 'activities')} planned there. Your
            other cities are not affected.
          </>
        }
        confirmLabel="Remove city"
        onConfirm={() => stopToRemove && removeStop.mutate(stopToRemove.id)}
      />

      <ConfirmDialog
        open={Boolean(itemToRemove)}
        onOpenChange={(open) => {
          if (!open) setItemToRemove(null);
        }}
        destructive
        loading={deleteItem.isPending}
        title="Remove this activity?"
        description={`“${itemToRemove?.title ?? 'This activity'}” will be removed from ${itemToRemove ? formatDateRange(itemToRemove.date, itemToRemove.date) : 'your itinerary'}.`}
        confirmLabel="Remove"
        onConfirm={() => itemToRemove && deleteItem.mutate(itemToRemove.id)}
      />
    </>
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

function SummaryPanel({
  trip,
  currency,
  itineraryCost,
  conflicts,
}: {
  trip: TripDetail;
  currency: string;
  itineraryCost: number;
  conflicts: Conflict[];
}) {
  const byCategory = new Map<string, { label: string; total: number; count: number }>();

  for (const item of trip.itineraryItems) {
    const key = item.category ?? 'UNCATEGORISED';
    const existing = byCategory.get(key) ?? {
      label: item.category ? activityCategoryLabel(item.category) : 'Uncategorised',
      total: 0,
      count: 0,
    };
    existing.total += item.effectiveCost;
    existing.count += 1;
    byCategory.set(key, existing);
  }

  const categories = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Trip summary</h2>

      <dl className="space-y-2 text-sm">
        <Row label="Cities" value={String(trip.stops.length)} />
        <Row label="Days" value={String(trip.durationDays)} />
        <Row label="Activities" value={String(trip.itineraryItems.length)} />
        <Separator />
        <Row label="Activities cost" value={formatCurrency(itineraryCost, currency)} strong />
      </dl>

      {categories.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">By category</p>
          <ul className="space-y-1.5">
            {categories.slice(0, 5).map(([key, entry]) => {
              const Icon = activityCategoryIcon(
                key === 'UNCATEGORISED' ? null : (key as ItineraryItem['category']),
              );
              return (
                <li key={key} className="flex items-center gap-2 text-xs">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="shrink-0 text-muted-foreground">{entry.count}</span>
                  <span className="shrink-0 font-medium">
                    {formatCurrency(entry.total, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="space-y-1.5 rounded-lg bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {pluralise(conflicts.length, 'scheduling warning', 'scheduling warnings')}
          </p>
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {conflicts.slice(0, 3).map((conflict, index) => (
              <li key={index}>{conflict.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
          No scheduling conflicts detected.
        </p>
      )}

      <div className="grid gap-2">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/trips/${trip.id}/budget`}>
            <Wallet />
            Budget &amp; expenses
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link to={`/trips/${trip.id}/calendar`}>
            <CalendarDays />
            Open calendar
          </Link>
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Route className="mt-px size-3 shrink-0" aria-hidden="true" />
        Changes save automatically. Conflicts are advisory — you can always keep an intentional
        overlap.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold text-primary' : 'font-medium'}>{value}</dd>
    </div>
  );
}
