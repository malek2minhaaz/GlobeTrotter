import type { ItineraryItem } from '@prisma/client';
import { minutesToTime, timeToMinutes, toDateOnly } from '../utils/dates';

/**
 * Smart-itinerary rules (Section 15).
 *
 * Conflicts are returned as data rather than thrown, so the UI can warn about
 * them while still letting the traveller save a deliberately overlapping plan.
 * The write endpoints only hard-fail when a conflict is *unscheduled* (outside
 * the trip or a city's dates) — overlaps are recoverable by rescheduling.
 */

export type ConflictType = 'OVERLAP' | 'OUTSIDE_TRIP' | 'OUTSIDE_STOP';

export interface Conflict {
  type: ConflictType;
  severity: 'warning' | 'error';
  message: string;
  /** Every item involved, so the client can highlight them together. */
  itemIds: string[];
  date: string;
  /** Customer-facing hint on how to resolve it. */
  resolution: string;
}

/** An entry with an open-ended end time is assumed to run for one hour. */
const ASSUMED_DURATION_MINUTES = 60;

interface SchedulableItem {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime?: string | null;
  tripStopId: string;
}

export interface ScheduleStop {
  id: string;
  startDate: Date;
  endDate: Date;
  cityName: string;
}

export interface ScheduleBounds {
  tripStart: Date;
  tripEnd: Date;
  stops: ScheduleStop[];
}

function intervalOf(item: Pick<SchedulableItem, 'startTime' | 'endTime'>) {
  const start = timeToMinutes(item.startTime);
  const end = item.endTime ? timeToMinutes(item.endTime) : start + ASSUMED_DURATION_MINUTES;
  // A zero-length entry still occupies an instant; widen it so it can conflict.
  return { start, end: Math.max(end, start + 15) };
}

function formatRange(item: Pick<SchedulableItem, 'startTime' | 'endTime'>) {
  const end = item.endTime ?? minutesToTime(timeToMinutes(item.startTime) + ASSUMED_DURATION_MINUTES);
  return `${item.startTime}–${end}`;
}

/**
 * Detect overlaps within the same day and entries scheduled outside the trip or
 * their city's window. `items` may be a mix of persisted and proposed entries.
 */
export function detectConflicts(items: SchedulableItem[], bounds: ScheduleBounds): Conflict[] {
  const conflicts: Conflict[] = [];
  const stopById = new Map(bounds.stops.map((stop) => [stop.id, stop]));
  const tripStartMs = bounds.tripStart.getTime();
  const tripEndMs = bounds.tripEnd.getTime();

  for (const item of items) {
    const dateMs = item.date.getTime();
    const dateLabel = toDateOnly(item.date);

    if (dateMs < tripStartMs || dateMs > tripEndMs) {
      conflicts.push({
        type: 'OUTSIDE_TRIP',
        severity: 'error',
        message: `"${item.title}" is scheduled on ${dateLabel}, outside your trip dates.`,
        itemIds: [item.id],
        date: dateLabel,
        resolution: 'Move it to a date inside the trip window or extend the trip.',
      });
      continue;
    }

    const stop = stopById.get(item.tripStopId);
    if (stop && (dateMs < stop.startDate.getTime() || dateMs > stop.endDate.getTime())) {
      conflicts.push({
        type: 'OUTSIDE_STOP',
        severity: 'error',
        message: `"${item.title}" falls outside your dates in ${stop.cityName}.`,
        itemIds: [item.id],
        date: dateLabel,
        resolution: `Move it into your stay in ${stop.cityName}, or adjust that city's dates.`,
      });
    }
  }

  // Overlap detection: compare only items sharing a date.
  const byDate = new Map<string, SchedulableItem[]>();
  for (const item of items) {
    const key = toDateOnly(item.date);
    byDate.set(key, [...(byDate.get(key) ?? []), item]);
  }

  for (const [date, dayItems] of byDate) {
    const sorted = [...dayItems].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i];
        const second = sorted[j];
        const a = intervalOf(first);
        const b = intervalOf(second);

        // Sorted by start, so once the second starts after the first ends we can
        // stop scanning forward for this `i`.
        if (b.start >= a.end) break;
        if (b.start < a.end && a.start < b.end) {
          conflicts.push({
            type: 'OVERLAP',
            severity: 'warning',
            message: `"${second.title}" (${formatRange(second)}) overlaps with "${first.title}" (${formatRange(first)}).`,
            itemIds: [first.id, second.id],
            date,
            resolution: 'Shift one of them to a free slot, or keep both if the overlap is intended.',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Estimates free time windows for a day, used to suggest a slot when the
 * traveller adds a new activity to an already-busy day.
 */
export function suggestSlot(
  items: Pick<SchedulableItem, 'startTime' | 'endTime'>[],
  preferredStart = '10:00',
  durationMinutes = 120,
): { startTime: string; endTime: string } {
  const ordered = [...items]
    .map((item) => intervalOf(item))
    .sort((a, b) => a.start - b.start);

  let cursor = Math.max(timeToMinutes(preferredStart), 8 * 60);

  for (const busy of ordered) {
    if (cursor + durationMinutes <= busy.start) break;
    cursor = Math.max(cursor, busy.end);
  }

  // Keep the suggestion inside a sane day.
  cursor = Math.min(cursor, 21 * 60);
  return { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + durationMinutes) };
}

/**
 * Narrow any row-shaped object to what the detector needs. Accepts a structural
 * type so callers holding a partial `select` are not forced to fabricate fields.
 */
export function toSchedulable(item: ItineraryItem | SchedulableItem): SchedulableItem {
  return {
    id: item.id,
    title: item.title,
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
    tripStopId: item.tripStopId,
  };
}
