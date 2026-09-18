import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

/**
 * Calendar grid maths (Section 19).
 *
 * Weeks start on Monday, which is what an Indian or European traveller expects
 * and matches the day-by-day itinerary ordering.
 */

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromISODate(value: string): Date {
  return parseISO(`${value}T00:00:00`);
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function addDaysToISO(value: string, days: number): string {
  return toISODate(addDays(fromISODate(value), days));
}

export function addMonthsToISO(value: string, months: number): string {
  return toISODate(addMonths(fromISODate(value), months));
}

/** Seven dates for the week containing `value`. */
export function weekOf(value: string): string[] {
  const start = startOfWeek(fromISODate(value), WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, index) => toISODate(addDays(start, index)));
}

export interface MonthCell {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

/** Six weeks of dates covering the month, including the leading and trailing days. */
export function monthGrid(value: string): MonthCell[] {
  const anchor = fromISODate(value);
  const gridStart = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
  const gridEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTIONS);
  const today = todayISO();

  const cells: MonthCell[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    cells.push({
      date: toISODate(cursor),
      inMonth: cursor.getMonth() === anchor.getMonth(),
      isToday: toISODate(cursor) === today,
    });
    cursor = addDays(cursor, 1);
  }

  return cells;
}

/** Groups a flat list of dates into rows of seven for rendering. */
export function chunkWeeks<T>(dates: T[]): T[][] {
  const weeks: T[][] = [];
  for (let index = 0; index < dates.length; index += 7) {
    weeks.push(dates.slice(index, index + 7));
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Heading for the current view, e.g. `"September 2026"` or `"15–21 Sep 2026"`. */
export function rangeLabel(view: 'month' | 'week' | 'day', anchor: string): string {
  const date = fromISODate(anchor);
  if (view === 'month') return format(date, 'MMMM yyyy');
  if (view === 'day') return format(date, 'EEEE d MMMM yyyy');

  const days = weekOf(anchor);
  const first = fromISODate(days[0]!);
  const last = fromISODate(days[6]!);
  return `${format(first, 'd MMM')} – ${format(last, 'd MMM yyyy')}`;
}

/** Clamps a date into the trip window so navigation cannot wander off the plan. */
export function clampToRange(value: string, start: string, end: string): string {
  if (value < start) return start;
  if (value > end) return end;
  return value;
}
