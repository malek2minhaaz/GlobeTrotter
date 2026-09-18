import { ApiError } from './ApiError';

/**
 * All date-only fields are stored at UTC midnight (Prisma `@db.Date`). These
 * helpers keep that invariant: everything enters and leaves the API as a
 * `YYYY-MM-DD` string, so no client can shift a trip by a timezone.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateOnlyString(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY_RE.test(value);
}

export function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** `"2026-10-22"` → Date at UTC midnight. Throws a 400 on malformed input. */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return normalizeToUTCMidnight(value);
  if (!isDateOnlyString(value)) {
    throw ApiError.badRequest(`"${String(value)}" is not a valid date. Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible calendar dates like 2026-02-31, which Date would roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw ApiError.badRequest(`"${value}" is not a real calendar date.`);
  }
  return date;
}

/** Date → `"2026-10-22"`. */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function normalizeToUTCMidnight(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Today at UTC midnight — the reference point for every status calculation. */
export function todayUTC(): Date {
  return normalizeToUTCMidnight(new Date());
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function diffInDaysUTC(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Inclusive list of days between two dates. Used for calendars and day charts. */
export function eachDayInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = normalizeToUTCMidnight(start);
  const last = normalizeToUTCMidnight(end);
  // Guard against a pathological range blowing up memory.
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 1000) {
    days.push(cursor);
    cursor = addDaysUTC(cursor, 1);
    guard += 1;
  }
  return days;
}

/** Trip lifecycle state, derived rather than stored so it is never stale. */
export function tripStatus(startDate: Date, endDate: Date): 'UPCOMING' | 'ONGOING' | 'COMPLETED' {
  const today = todayUTC();
  if (today.getTime() < startDate.getTime()) return 'UPCOMING';
  if (today.getTime() > endDate.getTime()) return 'COMPLETED';
  return 'ONGOING';
}

/** `"HH:mm"` → minutes past midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Minutes past midnight → `"HH:mm"`, clamped to a single day. */
export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
