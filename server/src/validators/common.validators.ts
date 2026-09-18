import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  EXPENSE_CATEGORIES,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  SUPPORTED_LANGUAGES,
} from '../config/constants';

/**
 * Query strings cannot express "absent" — a cleared filter arrives as "". These
 * helpers normalise that to undefined before validation.
 */
export const emptyToUndefined = (value: unknown) => {
  if (value === '' || value === undefined || value === null) return undefined;
  return value;
};

/**
 * An optional query parameter.
 *
 * The `.optional()` must sit *inside* the preprocess, not outside it. With
 * `z.preprocess(fn, schema).optional()`, Zod's optional check sees the raw input:
 * a missing parameter short-circuits, but an empty one (`?q=`) does not — the
 * preprocess runs, hands `undefined` to an inner schema that still requires a
 * value, and the request fails with "Required". Putting `.optional()` inside
 * means the normalised `undefined` is accepted too, so all three states —
 * absent, empty, and present — behave correctly.
 */
export function optionalQuery<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

/**
 * An optional request-body field.
 *
 * As above, and `null` is also accepted so that a form can explicitly clear a
 * value (for example setting an itinerary note back to empty).
 */
export function optionalBody<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional().nullable());
}

export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format.');

export const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Times must use the 24-hour HH:mm format.');

export const idSchema = z.string().trim().min(1, 'A valid id is required.').max(64);

/** Pagination shared by every list endpoint (Section 36). */
export const paginationSchema = z.object({
  // `.default()` inside the preprocess already covers absent, empty and present.
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  ),
  sort: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc')),
});

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/\d/, 'Password must include at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(200);

/** Accepts a real URL or nothing at all. */
export const optionalUrlSchema = optionalBody(z.string().trim().url('Enter a valid URL.').max(600));

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

export const activityCategorySchema = z.enum(ACTIVITY_CATEGORIES);
export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

/** Non-negative money, capped to the same precision the column stores. */
export const moneySchema = z.coerce
  .number()
  .nonnegative('Amounts cannot be negative.')
  .max(99_999_999, 'That amount is unrealistically large.')
  .transform((value) => Math.round(value * 100) / 100);

export const optionalMoneySchema = optionalBody(moneySchema);

export type PaginationInput = z.infer<typeof paginationSchema>;
