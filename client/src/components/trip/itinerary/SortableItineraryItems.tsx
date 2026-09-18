import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Clock, GripVertical, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/ui/tooltip-checkbox';
import { SmartImage } from '@/components/common/SmartImage';
import { activityCategoryIcon, activityCategoryLabel } from '@/lib/categoryMeta';
import { formatCurrency, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Conflict, ItineraryItem } from '@/types/api';

/**
 * Drag-and-drop reordering (Section 13).
 *
 * Ordering is the only thing a drag changes — moving an activity to another day
 * is a deliberate edit, so it stays in the item dialog. Arrow-key sensors plus
 * explicit Move up/down buttons mean the same reordering is reachable without a
 * pointer.
 */
export function SortableItineraryItems({
  items,
  currency,
  conflicts,
  onReorder,
  onEdit,
  onDelete,
  className,
}: {
  items: ItineraryItem[];
  currency: string;
  conflicts: Conflict[];
  onReorder: (next: ItineraryItem[]) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;

    onReorder(arrayMove(items, from, to));
  };

  /** Used by the accessible Move up/down buttons. */
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    onReorder(arrayMove(items, index, target));
  };

  const conflictMessages = new Map<string, string>();
  for (const conflict of conflicts) {
    for (const id of conflict.itemIds) {
      if (id.startsWith('__')) continue;
      if (!conflictMessages.has(id)) conflictMessages.set(id, conflict.message);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn('space-y-2', className)}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              currency={currency}
              conflictMessage={conflictMessages.get(item.id)}
              onMove={move}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  index,
  total,
  currency,
  conflictMessage,
  onMove,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem;
  index: number;
  total: number;
  currency: string;
  conflictMessage?: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
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
        'group flex gap-3 rounded-xl border bg-card p-3 shadow-sm',
        isDragging ? 'z-10 border-primary shadow-lg' : 'border-border',
        conflictMessage && 'border-warning/50',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.title}. Use arrow keys to move it.`}
        className="mt-1 flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <span className="w-14 shrink-0 pt-1 text-xs font-medium text-muted-foreground">
        {formatTime(item.startTime)}
      </span>

      {item.activity ? (
        <SmartImage
          src={item.activity.image}
          alt=""
          decorative
          seed={item.title}
          className="size-12 shrink-0 rounded-lg"
        />
      ) : null}

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.category ? (
            <Badge variant="secondary">
              <Icon aria-hidden="true" />
              {activityCategoryLabel(item.category)}
            </Badge>
          ) : null}
          {item.endTime ? (
            <Badge variant="outline">
              <Clock aria-hidden="true" />
              {formatTime(item.startTime)} – {formatTime(item.endTime)}
            </Badge>
          ) : null}
          {item.customCost !== null ? (
            <Badge variant="accent">{formatCurrency(item.effectiveCost, currency)}</Badge>
          ) : null}
        </div>
        {item.notes ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="mt-px size-3 shrink-0" aria-hidden="true" />
            {item.notes}
          </p>
        ) : null}
        {conflictMessage ? (
          <p className="rounded-md bg-warning/15 px-2 py-1 text-xs text-[color-mix(in_oklch,var(--warning),black_30%)] dark:text-warning">
            ⚠️ {conflictMessage}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-1">
        <span className="text-sm font-semibold text-primary">
          {formatCurrency(item.effectiveCost, currency)}
        </span>
        <div className="flex items-center gap-0.5">
          <IconTooltip label="Move earlier">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
              aria-label={`Move ${item.title} earlier`}
            >
              <ArrowUp />
            </Button>
          </IconTooltip>
          <IconTooltip label="Move later">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
              aria-label={`Move ${item.title} later`}
            >
              <ArrowDown />
            </Button>
          </IconTooltip>
          <IconTooltip label="Edit activity">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.title}`}
            >
              <Pencil />
            </Button>
          </IconTooltip>
          <IconTooltip label="Remove from itinerary">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(item)}
              aria-label={`Remove ${item.title}`}
            >
              <Trash2 />
            </Button>
          </IconTooltip>
        </div>
      </div>
    </li>
  );
}
