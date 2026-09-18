import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Ticket,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/tooltip-checkbox';
import { ActivityPicker } from '@/components/activity/ActivityPicker';
import { ScheduleBoard, type ScheduleMove } from '@/components/trip/calendar/ScheduleBoard';
import { ItineraryItemDialog } from '@/components/trip/itinerary/ItineraryItemDialog';
import { ConflictResolutionDialog } from '@/components/trip/itinerary/ConflictResolutionDialog';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { toast } from '@/lib/toast';
import {
  addDaysToISO,
  addMonthsToISO,
  clampToRange,
  monthGrid,
  rangeLabel,
  todayISO,
  weekOf,
} from '@/lib/calendar';
import { formatCurrency, formatDate, formatTime, pluralise } from '@/lib/format';
import { daysBetween, nextSlot } from '@/lib/wizard';
import { useTripWorkspace } from '@/layouts/TripWorkspaceLayout';
import { useAddItineraryItem } from '@/hooks/useAddItineraryItem';
import { cn } from '@/lib/utils';
import type { Activity, Conflict, ItineraryItem } from '@/types/api';
import type { ItineraryItemForm } from '@/lib/schemas';

type CalendarView = 'month' | 'week' | 'day' | 'timeline';

/**
 * Calendar and timeline (Section 19).
 *
 * Month, week and day are the same draggable board at different zoom levels;
 * timeline is the chronological reading view. Every view reads from the same
 * itinerary, and every edit invalidates the trip, so the calendar and the builder
 * can never drift apart.
 */
export default function CalendarPage() {
  const { trip, currency } = useTripWorkspace();
  const queryClient = useQueryClient();

  const orderedStops = React.useMemo(
    () => [...trip.stops].sort((a, b) => a.order - b.order),
    [trip.stops],
  );

  const [view, setView] = React.useState<CalendarView>('month');
  const [anchor, setAnchor] = React.useState(() =>
    clampToRange(todayISO(), trip.startDate, trip.endDate),
  );
  const [editingItem, setEditingItem] = React.useState<ItineraryItem | null>(null);
  const [addToDate, setAddToDate] = React.useState<string | null>(null);

  const addItem = useAddItineraryItem(trip.id);

  const conflictsQuery = useQuery({
    queryKey: queryKeys.tripConflicts(trip.id),
    queryFn: () => tripsService.conflicts(trip.id),
    staleTime: 20_000,
  });
  const conflicts: Conflict[] = conflictsQuery.data ?? [];

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripConflicts(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripBudget(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }, [queryClient, trip.id]);

  const moveItems = useMutation({
    mutationFn: (changes: ScheduleMove[]) => tripsService.reorderItinerary(trip.id, changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.trip(trip.id) });
      const previous = queryClient.getQueryData(queryKeys.trip(trip.id));
      const byId = new Map(changes.map((change) => [change.id, change]));

      queryClient.setQueryData(
        queryKeys.trip(trip.id),
        (current: { trip: typeof trip } | undefined) => {
          if (!current) return current;
          return {
            trip: {
              ...current.trip,
              itineraryItems: current.trip.itineraryItems.map((item) => {
                const change = byId.get(item.id);
                if (!change) return item;
                return { ...item, date: change.date, order: change.order };
              }),
            },
          };
        },
      );

      return { previous };
    },
    onError: (error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.trip(trip.id), context.previous);
      toast.fromError(error, 'We could not reschedule that activity.');
    },
    onSuccess: (result) => {
      if (result.conflicts.length > 0) {
        toast.warning('Moved with a warning', result.conflicts[0]?.message);
      }
    },
    onSettled: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: ItineraryItemForm }) =>
      tripsService.updateItineraryItem(itemId, {
        title: values.title || undefined,
        category: values.category ? (values.category as ItineraryItem['category']) : undefined,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime || null,
        notes: values.notes || null,
        customCost:
          values.customCost === '' || values.customCost === undefined
            ? null
            : Number(values.customCost),
        allowOverlap: true,
      }),
    onSuccess: (result) => {
      invalidate();
      setEditingItem(null);
      if (result.warnings.length > 0) {
        toast.warning('Saved with a warning', result.warnings[0]?.message);
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
      setEditingItem(null);
      toast.info('Removed from the itinerary');
    },
    onError: (error) => toast.fromError(error, 'We could not remove that activity.'),
  });

  // ── Derived day lists ──

  const monthDays = React.useMemo(() => monthGrid(anchor).map((cell) => cell.date), [anchor]);
  const boardDays =
    view === 'month' ? monthDays : view === 'week' ? weekOf(anchor) : [anchor];

  const inViewItems = trip.itineraryItems.filter((item) => boardDays.includes(item.date));
  const viewCost = inViewItems.reduce((total, item) => total + item.effectiveCost, 0);

  const step = (direction: -1 | 1) => {
    if (view === 'month') setAnchor((current) => clampToRange(addMonthsToISO(current, direction), trip.startDate, trip.endDate));
    else if (view === 'week') setAnchor((current) => clampToRange(addDaysToISO(current, direction * 7), trip.startDate, trip.endDate));
    else setAnchor((current) => clampToRange(addDaysToISO(current, direction), trip.startDate, trip.endDate));
  };

  const stopForDate = (date: string) =>
    orderedStops.find((stop) => date >= stop.startDate && date <= stop.endDate) ?? null;

  const startAddToDay = (date: string) => {
    const stop = stopForDate(date);
    if (!stop) {
      toast.warning(
        'That day has no city',
        'Add a destination covering this date before scheduling activities.',
      );
      return;
    }
    setAddToDate(date);
  };

  const scheduleOnDay = (activity: Activity) => {
    if (!addToDate) return;
    const stop = stopForDate(addToDate);
    if (!stop) return;

    const existing = trip.itineraryItems
      .filter((item) => item.date === addToDate)
      .map((item) => ({ startTime: item.startTime, duration: item.activity?.duration ?? 1 }));
    const slot = nextSlot(existing, activity);

    addItem.add({
      activityId: activity.id,
      tripStopId: stop.id,
      date: addToDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      activityName: activity.name,
    });
    setAddToDate(null);
  };

  const addStop = addToDate ? stopForDate(addToDate) : null;

  if (trip.stops.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing to schedule yet"
        description="Add a destination and some activities, then come back to see the whole plan laid out on a calendar."
      />
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* ── Toolbar ── */}
        <section
          aria-label="Calendar controls"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex items-center gap-2">
            {/* Timeline is a whole-trip view, so period navigation does not apply. */}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={view === 'timeline'}
              onClick={() => step(-1)}
              aria-label="Previous period"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={view === 'timeline'}
              onClick={() => setAnchor(clampToRange(todayISO(), trip.startDate, trip.endDate))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={view === 'timeline'}
              onClick={() => step(1)}
              aria-label="Next period"
            >
              <ChevronRight />
            </Button>
            {/* Timeline always shows the whole journey, so it labels the trip, not a period. */}
            <p className="ml-1 text-sm font-semibold">
              {view === 'timeline'
                ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`
                : rangeLabel(view, anchor)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && setView(value as CalendarView)}
              aria-label="Calendar view"
            >
              <ToggleGroupItem value="month">Month</ToggleGroupItem>
              <ToggleGroupItem value="week">Week</ToggleGroupItem>
              <ToggleGroupItem value="day">Day</ToggleGroupItem>
              <ToggleGroupItem value="timeline">Timeline</ToggleGroupItem>
            </ToggleGroup>

            <Button size="sm" onClick={() => startAddToDay(anchor)}>
              <Plus />
              Add activity
            </Button>
          </div>
        </section>

        {/* ── View summary ── */}
        <section className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">
            <Ticket aria-hidden="true" />
            {pluralise(inViewItems.length, 'activity', 'activities')} in view
          </Badge>
          <Badge variant="outline">
            <Wallet aria-hidden="true" />
            {formatCurrency(viewCost, currency)}
          </Badge>
          {conflicts.length > 0 ? (
            <Badge variant="warning">⚠️ {pluralise(conflicts.length, 'scheduling warning')}</Badge>
          ) : (
            <Badge variant="success">No conflicts</Badge>
          )}
          <span className="text-xs">
            {trip.stops.length > 0
              ? `Cities: ${orderedStops.map((stop) => stop.city.name).join(' → ')}`
              : null}
          </span>
        </section>

        {/* ── Board ── */}
        {view === 'timeline' ? (
          <TimelineView
            tripStart={trip.startDate}
            tripEnd={trip.endDate}
            items={trip.itineraryItems}
            currency={currency}
            stopForDate={stopForDate}
            onOpen={setEditingItem}
          />
        ) : (
          <ScheduleBoard
            variant={view}
            anchor={anchor}
            days={boardDays}
            items={trip.itineraryItems}
            conflicts={conflicts}
            tripStart={trip.startDate}
            tripEnd={trip.endDate}
            onOpenItem={setEditingItem}
            onMove={(changes) => moveItems.mutate(changes)}
            onAddToDay={startAddToDay}
          />
        )}

        <p className="text-xs text-muted-foreground">
          Drag an activity onto another day to reschedule it, or onto another activity to change the
          order. Everything saves automatically.
        </p>
      </div>

      {/* ── Dialogs ── */}
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
        onSubmit={(values) => editingItem && updateItem.mutate({ itemId: editingItem.id, values })}
        onDelete={() => editingItem && deleteItem.mutate(editingItem.id)}
      />

      <Dialog open={Boolean(addToDate)} onOpenChange={(open) => !open && setAddToDate(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add an activity</DialogTitle>
            <DialogDescription>
              {addToDate && addStop
                ? `${formatDate(addToDate, 'EEEE d MMMM')} in ${addStop.city.name}. We will place it after everything already planned that day.`
                : 'Choose a day first.'}
            </DialogDescription>
          </DialogHeader>
          {addStop && addToDate ? (
            <div className="h-[60dvh]">
              <ActivityPicker
                cityId={addStop.city.id}
                cityName={addStop.city.name}
                onAdd={scheduleOnDay}
                addingId={addItem.pendingActivityId}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConflictResolutionDialog
        conflict={addItem.conflict}
        onDismiss={addItem.dismissConflict}
        onConfirm={() => {
          addItem.conflict?.retry();
          addItem.dismissConflict();
        }}
      />
    </>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function TimelineView({
  tripStart,
  tripEnd,
  items,
  currency,
  stopForDate,
  onOpen,
}: {
  tripStart: string;
  tripEnd: string;
  items: ItineraryItem[];
  currency: string;
  stopForDate: (date: string) => { id: string; city: { name: string } } | null;
  onOpen: (item: ItineraryItem) => void;
}) {
  const days = daysBetween(tripStart, tripEnd);
  const populated = days.filter((date) => items.some((item) => item.date === date));

  if (populated.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled yet"
        description="Once you add activities to your itinerary they will appear here in chronological order."
      />
    );
  }

  return (
    <ol className="space-y-6">
      {populated.map((date) => {
        const dayItems = items
          .filter((item) => item.date === date)
          .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order);
        const stop = stopForDate(date);

        return (
          <li key={date} className="relative pl-8 sm:pl-10">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1 size-6 rounded-full border-2 border-primary bg-card"
            />
            <span aria-hidden="true" className="absolute left-[11px] top-7 h-full w-px bg-border" />

            <header className="flex flex-wrap items-center gap-2 pb-3">
              <h3 className="text-sm font-semibold">{formatDate(date, 'EEEE d MMMM')}</h3>
              {stop ? (
                <Badge variant="outline">
                  <MapPin aria-hidden="true" />
                  {stop.city.name}
                </Badge>
              ) : (
                <Badge variant="warning">No city covers this day</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatCurrency(
                  dayItems.reduce((total, item) => total + item.effectiveCost, 0),
                  currency,
                )}
              </span>
            </header>

            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm',
                      'transition-colors hover:border-primary/40',
                    )}
                  >
                    <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                      {formatTime(item.startTime)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" aria-hidden="true" />
                        {formatTime(item.startTime)}
                        {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatCurrency(item.effectiveCost, currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
