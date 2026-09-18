import { addDaysISO, dayCount, parseDateOnly } from './format';
import type { Activity } from '@/types/api';

/**
 * Scheduling maths for the create-trip wizard.
 *
 * The wizard composes a whole trip before any of it exists on the server, so the
 * date and time rules live here and are unit-testable in isolation from React.
 */

export interface DateWindow {
  startDate: string;
  endDate: string;
}

/** Every date in a stay, inclusive. */
export function daysBetween(start: string, end: string): string[] {
  const total = dayCount(start, end);
  const days: string[] = [];
  for (let offset = 0; offset < total; offset += 1) days.push(addDaysISO(start, offset));
  return days;
}

/**
 * Places a new stay after the last one, or overlaps the final day when the trip
 * has no free space left — the traveller can adjust the dates from the review
 * step rather than being blocked from adding a city.
 */
export function nextStayWindow(existing: DateWindow[], tripStart: string, tripEnd: string): DateWindow {
  const lastEnd = existing.reduce<string | null>(
    (latest, stay) => (!latest || stay.endDate > latest ? stay.endDate : latest),
    null,
  );

  const afterLast = lastEnd ? addDaysISO(lastEnd, 1) : tripStart;
  const startDate = afterLast > tripStart ? afterLast : tripStart;
  const safeStart = startDate > tripEnd ? tripEnd : startDate;

  const proposedEnd = addDaysISO(safeStart, 2);
  const endDate = proposedEnd > tripEnd ? tripEnd : proposedEnd;

  return { startDate: safeStart, endDate };
}

/**
 * Re-clamps stays so they stay inside a new trip window and never overlap.
 *
 * Called whenever the trip dates change, which is the only way a draught trip can
 * become invalid.
 */
export function clampStays<T extends DateWindow>(stays: T[], tripStart: string, tripEnd: string): T[] {
  let cursor = tripStart;

  return stays.map((stay) => {
    const proposedStart = stay.startDate < cursor ? cursor : stay.startDate;
    const startDate = proposedStart > tripEnd ? tripEnd : proposedStart;
    const proposedEnd = stay.endDate < startDate ? startDate : stay.endDate;
    const endDate = proposedEnd > tripEnd ? tripEnd : proposedEnd;

    const following = addDaysISO(endDate, 1);
    cursor = following > tripEnd ? tripEnd : following;

    return { ...stay, startDate, endDate };
  });
}

/** `"09:00"` plus minutes, clamped to the end of the day. */
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = Math.min((hours ?? 0) * 60 + (mins ?? 0) + minutes, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface PlannedSlot {
  startTime: string;
  endTime: string;
}

/**
 * Places an activity after everything already scheduled that day.
 *
 * Using each activity's own duration plus a one-hour gap is what keeps the
 * wizard's auto-generated plan free of overlaps, so nothing needs to be
 * resolved by the traveller before the trip is even created.
 */
export function nextSlot(
  existing: Array<{ startTime: string; duration: number }>,
  activity: Activity,
): PlannedSlot {
  let cursor = 9 * 60;

  for (const item of existing) {
    const [hours, mins] = item.startTime.split(':').map(Number);
    const startMinutes = (hours ?? 0) * 60 + (mins ?? 0);
    cursor = Math.max(cursor, startMinutes + Math.round(item.duration * 60) + 60);
  }

  const startTime = addMinutes('00:00', cursor);
  return { startTime, endTime: addMinutes(startTime, Math.round(activity.duration * 60)) };
}

/** Estimated cost of the activities chosen so far. */
export function activitiesCost(activities: Array<{ activity: Activity }>): number {
  return activities.reduce((total, item) => total + item.activity.estimatedCost, 0);
}

/**
 * Reference cost of the stays chosen so far.
 *
 * Uses each destination's own seeded daily estimate, so the figure is real
 * catalogue data rather than a guess. The authoritative totals come from the
 * budget endpoint once the trip exists.
 */
export function referenceStayCost(
  stays: Array<{ estimatedDailyCost: number; startDate: string; endDate: string }>,
): number {
  return stays.reduce(
    (total, stay) => total + stay.estimatedDailyCost * dayCount(stay.startDate, stay.endDate),
    0,
  );
}

/** Human label for a stay, e.g. `"12–15 Jun"`. */
export function stayLabel(stay: DateWindow): string {
  const start = parseDateOnly(stay.startDate);
  const end = parseDateOnly(stay.endDate);
  const startText = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endText = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return startText === endText ? startText : `${startText} – ${endText}`;
}
