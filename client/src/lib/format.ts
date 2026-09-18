import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/**
 * Date handling.
 *
 * The API sends date-only strings (`YYYY-MM-DD`). `parseISO` reads those as local
 * midnight, which is what a traveller means by "15 June" — converting to UTC would
 * shift the day for anyone west of Greenwich.
 */
export function parseDateOnly(value: string): Date {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date(value);
}

export function formatDate(value: string, pattern = 'd MMM yyyy'): string {
  return format(parseDateOnly(value), pattern);
}

export function formatDateShort(value: string): string {
  return format(parseDateOnly(value), 'd MMM');
}

export function formatDateRange(start: string, end: string): string {
  const from = parseDateOnly(start);
  const to = parseDateOnly(end);
  if (format(from, 'yyyy') !== format(to, 'yyyy')) {
    return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
  }
  if (format(from, 'MMM') === format(to, 'MMM')) {
    return `${format(from, 'd')}–${format(to, 'd MMM yyyy')}`;
  }
  return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
}

export function formatWeekday(value: string): string {
  return format(parseDateOnly(value), 'EEEE');
}

export function formatDayHeading(value: string): string {
  return format(parseDateOnly(value), 'EEE d MMM');
}

/** `"09:00"` → `"9:00 AM"`. */
export function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(start: string, end?: string | null): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function formatRelative(value: string): string {
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

/** Inclusive day count between two date-only strings. */
export function dayCount(start: string, end: string): number {
  const from = parseDateOnly(start).getTime();
  const to = parseDateOnly(end).getTime();
  return Math.max(Math.round((to - from) / 86_400_000) + 1, 1);
}

/** Today as `YYYY-MM-DD` in local time, for date inputs and comparisons. */
export function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function addDaysISO(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
}

// ── Money ────────────────────────────────────────────────────────────────────

/**
 * Costs across a multi-country trip are shown in one currency, chosen on the
 * profile. Indian formatting groups by lakh, so the locale matters.
 */
export function formatCurrency(amount: number, currency = 'INR', options: { compact?: boolean } = {}) {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    ...(options.compact && amount >= 100_000 ? { notation: 'compact' as const } : {}),
  }).format(Math.round(amount));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (Number.isInteger(hours)) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${whole}h ${minutes}m`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Human copy for how far away a trip is. */
export function describeCountdown(daysUntilStart: number, status: string): string {
  if (status === 'ONGOING') return 'Happening now';
  if (status === 'COMPLETED') return 'Completed';
  if (daysUntilStart === 0) return 'Starts today';
  if (daysUntilStart === 1) return 'Starts tomorrow';
  if (daysUntilStart < 0) return 'In progress';
  return `In ${daysUntilStart} days`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
