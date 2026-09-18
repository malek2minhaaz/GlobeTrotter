import * as React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { activityCategoryIcon } from '@/lib/categoryMeta';
import { formatTime } from '@/lib/format';
import { WEEKDAY_LABELS, chunkWeeks, fromISODate } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import type { Conflict, ItineraryItem } from '@/types/api';

/**
 * Calendar board (Section 19).
 *
 * Month, week and day views share one drag-and-drop implementation, so moving an
 * activity to another date behaves identically wherever it happens. Dropping
 * onto a day cell reschedules the activity there; dropping onto another activity
 * inserts it at that position. Ordering and date changes go to the API in a
 * single reorder call, so a move can never half-apply.
 */

export interface ScheduleMove {
  id: string;
  order: number;
  date: string;
  startTime: string;
  endTime: string | null;
}

export function ScheduleBoard({
  variant,
  anchor,
  days,
  items,
  conflicts,
  tripStart,
  tripEnd,
  onOpenItem,
  onMove,
  onAddToDay,
}: {
  variant: 'month' | 'week' | 'day';
  anchor: string;
  days: string[];
  items: ItineraryItem[];
  conflicts: Conflict[];
  /** Trip window — anything outside it is shown but cannot be dropped into. */
  tripStart: string;
  tripEnd: string;
  onOpenItem: (item: ItineraryItem) => void;
  onMove: (changes: ScheduleMove[]) => void;
  onAddToDay?: (date: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const inTrip = React.useCallback(
    (date: string) => date >= tripStart && date <= tripEnd,
    [tripStart, tripEnd],
  );

  const conflictIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const conflict of conflicts) {
      for (const id of conflict.itemIds) if (!id.startsWith('__')) ids.add(id);
    }
    return ids;
  }, [conflicts]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const moved = items.find((item) => item.id === activeId);
    if (!moved) return;

    const targetDate = overId.startsWith('day-cell-')
      ? overId.replace('day-cell-', '')
      : (items.find((item) => item.id === overId)?.date ?? moved.date);

    const sortByOrder = (list: ItineraryItem[]) =>
      [...list].sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));

    const targetSiblings = sortByOrder(
      items.filter((item) => item.date === targetDate && item.id !== activeId),
    );

    // Dropping on another activity inserts before it; dropping on the cell appends.
    let insertAt = targetSiblings.length;
    if (!overId.startsWith('day-cell-')) {
      const overIndex = targetSiblings.findIndex((item) => item.id === overId);
      if (overIndex >= 0) insertAt = overIndex;
    }

    const nextTarget = [
      ...targetSiblings.slice(0, insertAt),
      moved,
      ...targetSiblings.slice(insertAt),
    ];

    const changes: ScheduleMove[] = nextTarget.map((item, index) => ({
      id: item.id,
      order: index,
      date: targetDate,
      startTime: item.startTime,
      endTime: item.endTime,
    }));

    // The day it came from needs renumbering too.
    if (moved.date !== targetDate) {
      const sourceSiblings = sortByOrder(items.filter((item) => item.date === moved.date));
      sourceSiblings
        .filter((item) => item.id !== activeId)
        .forEach((item, index) => {
          changes.push({
            id: item.id,
            order: index,
            date: moved.date,
            startTime: item.startTime,
            endTime: item.endTime,
          });
        });
    }

    onMove(changes);
  };

  if (variant === 'month') {
    const weeks = chunkWeeks(days);
    const anchoredMonth = fromISODate(anchor).getMonth();

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label[0]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((date) => {
              const dateObj = fromISODate(date);
              const outsideTrip = !inTrip(date);
              const dayItems = items
                .filter((item) => item.date === date)
                .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
              const isOtherMonth = dateObj.getMonth() !== anchoredMonth;

              return (
                <DroppableDay
                  key={date}
                  date={date}
                  disabled={outsideTrip}
                  className={cn(
                    'min-h-24 border-b border-r border-border p-1.5 last:border-r-0',
                    isOtherMonth && 'bg-muted/20',
                    outsideTrip && 'opacity-45',
                  )}
                >
                  <div className="flex items-center justify-between gap-1 pb-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isOtherMonth ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {dateObj.getDate()}
                    </span>
                    {onAddToDay && !outsideTrip ? (
                      <button
                        type="button"
                        onClick={() => onAddToDay(date)}
                        aria-label={`Add an activity on ${date}`}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="size-3" />
                      </button>
                    ) : null}
                  </div>

                  <SortableContext
                    items={dayItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <SortableChip
                          key={item.id}
                          item={item}
                          conflict={conflictIds.has(item.id)}
                          onOpen={() => onOpenItem(item)}
                        />
                      ))}
                    </ul>
                  </SortableContext>

                  {dayItems.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => onAddToDay?.(date)}
                      className="mt-1 w-full text-left text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      +{dayItems.length - 3} more
                    </button>
                  ) : null}
                </DroppableDay>
              );
            })}
          </div>
        </div>
      </DndContext>
    );
  }

  // ── Week and day ──

  const columns = variant === 'week' ? days : days.slice(0, 1);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={cn('grid gap-3', variant === 'week' ? 'sm:grid-cols-7' : 'grid-cols-1')}>
        {columns.map((date) => {
          const dayItems = items
            .filter((item) => item.date === date)
            .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
          const dateObj = fromISODate(date);
          const insideTrip = inTrip(date);

          return (
            <DroppableDay
              key={date}
              date={date}
              disabled={!insideTrip}
              className={cn(
                'flex min-h-52 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm',
                !insideTrip && 'opacity-50',
              )}
            >
              <header className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dateObj.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </p>
                  <p className="text-sm font-semibold">{dateObj.getDate()}</p>
                </div>
                {onAddToDay && insideTrip ? (
                  <button
                    type="button"
                    onClick={() => onAddToDay(date)}
                    aria-label={`Add an activity on ${date}`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </header>

              <SortableContext
                items={dayItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex-1 space-y-2">
                  {dayItems.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-[11px] text-muted-foreground">
                      Drop an activity here
                    </li>
                  ) : (
                    dayItems.map((item) => (
                      <SortableCard
                        key={item.id}
                        item={item}
                        conflict={conflictIds.has(item.id)}
                        onOpen={() => onOpenItem(item)}
                      />
                    ))
                  )}
                </ul>
              </SortableContext>
            </DroppableDay>
          );
        })}
      </div>
    </DndContext>
  );
}

// ── DnD pieces ───────────────────────────────────────────────────────────────

function DroppableDay({
  date,
  disabled,
  className,
  children,
}: {
  date: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-cell-${date}`, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && !disabled && 'bg-primary/5 ring-1 ring-inset ring-primary/40')}
    >
      {children}
    </div>
  );
}

function SortableChip({
  item,
  conflict,
  onOpen,
}: {
  item: ItineraryItem;
  conflict: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const Icon = activityCategoryIcon(item.category);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded px-1.5 py-1 text-[11px]',
        isDragging ? 'opacity-80 shadow-md' : '',
        conflict ? 'bg-warning/20' : 'bg-primary/10',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${item.title} to another day`}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3" aria-hidden="true" />
      </button>
      <span className="text-muted-foreground">{formatTime(item.startTime).replace(':00', '')}</span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        title={item.title}
      >
        {item.title}
      </button>
      <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
    </li>
  );
}

function SortableCard({
  item,
  conflict,
  onOpen,
}: {
  item: ItineraryItem;
  conflict: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const Icon = activityCategoryIcon(item.category);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-lg border bg-background p-2 text-xs shadow-sm',
        isDragging ? 'border-primary shadow-lg' : 'border-border',
        conflict && 'border-warning/60',
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder or move ${item.title}`}
          className="mt-px cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Open details for ${item.title}`}
        >
          <span className="block truncate font-medium">{item.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {formatTime(item.startTime)}
            {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
          </span>
          {item.category ? (
            <Badge variant="secondary" className="mt-1">
              <Icon aria-hidden="true" />
              {item.category.toLowerCase()}
            </Badge>
          ) : null}
        </button>
      </div>
    </li>
  );
}
