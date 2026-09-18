import { z } from 'zod';
import {
  activityCategorySchema,
  dateOnlySchema,
  emptyToUndefined,
  expenseCategorySchema,
  idSchema,
  moneySchema,
  optionalBody,
  optionalMoneySchema,
  optionalQuery,
  optionalUrlSchema,
  paginationSchema,
  timeSchema,
} from './common.validators';

// ── Trips ────────────────────────────────────────────────────────────────────

const tripCoreSchema = z.object({
  name: z.string().trim().min(2, 'Give your trip a name.').max(120),
  description: optionalBody(z.string().trim().max(2000)),
  coverImage: optionalUrlSchema,
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  isPublic: z.boolean().optional().default(false),
  budgetLimit: optionalMoneySchema,
});

/** ISO date strings sort lexicographically, so a string compare is exact here. */
const endAfterStart = (data: { startDate: string; endDate: string }, path: (string | number)[]) =>
  data.endDate >= data.startDate
    ? null
    : { message: 'The end date cannot be before the start date.', path };

export const createTripSchema = tripCoreSchema
  .extend({
    stops: z
      .array(
        z.object({
          cityId: idSchema,
          startDate: dateOnlySchema,
          endDate: dateOnlySchema,
        }),
      )
      .max(20, 'A single trip supports up to 20 cities.')
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    const issue = endAfterStart(data, ['endDate']);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
  });

export const updateTripSchema = tripCoreSchema.partial().superRefine((data, ctx) => {
  if (data.startDate && data.endDate) {
    const issue = endAfterStart({ startDate: data.startDate, endDate: data.endDate }, ['endDate']);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
  }
});

export const tripIdParamSchema = z.object({ id: idSchema });

/** Visibility toggle for the share dialog (Section 20). */
export const shareTripBodySchema = z.object({
  isPublic: z.boolean(),
});

export const listTripsQuerySchema = paginationSchema.extend({
  q: optionalQuery(z.string().trim().max(120)),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'ALL']).default('ALL'),
  ),
  visibility: z.preprocess(emptyToUndefined, z.enum(['PUBLIC', 'PRIVATE', 'ALL']).default('ALL')),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['createdAt', 'startDate', 'name', 'cost']).default('startDate'),
  ),
});

// ── Stops (cities within a trip) ─────────────────────────────────────────────

export const createStopSchema = z
  .object({
    cityId: idSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    order: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The end date cannot be before the start date.',
        path: ['endDate'],
      });
    }
  });

export const updateStopSchema = z.object({
  startDate: optionalBody(dateOnlySchema),
  endDate: optionalBody(dateOnlySchema),
  order: z.coerce.number().int().min(0).optional(),
});

export const reorderStopsSchema = z.object({
  stopIds: z.array(idSchema).min(1, 'There is nothing to reorder.'),
});

export const stopIdParamSchema = z.object({ id: idSchema });

// ── Itinerary items ──────────────────────────────────────────────────────────

export const createItineraryItemSchema = z
  .object({
    // Either an activity from the catalogue, or a free-form title, or both.
    activityId: optionalBody(idSchema),
    title: optionalBody(z.string().trim().max(160)),
    category: optionalBody(activityCategorySchema),
    date: dateOnlySchema,
    startTime: timeSchema,
    endTime: optionalBody(timeSchema),
    notes: optionalBody(z.string().trim().max(1000)),
    customCost: optionalMoneySchema,
    // Set when the traveller drags an item to a different city's stop.
    tripStopId: optionalBody(idSchema),
    /** Conflict resolution: the client resolves the clash and retries (Section 15). */
    allowOverlap: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.activityId && !data.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide an activity or a title for this entry.',
        path: ['title'],
      });
    }
    if (data.endTime && data.startTime && data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The end time must be after the start time.',
        path: ['endTime'],
      });
    }
  });

export const updateItineraryItemSchema = z
  .object({
    title: optionalBody(z.string().trim().min(1).max(160)),
    category: optionalBody(activityCategorySchema),
    date: optionalBody(dateOnlySchema),
    startTime: optionalBody(timeSchema),
    endTime: optionalBody(timeSchema),
    notes: optionalBody(z.string().trim().max(1000)),
    customCost: optionalMoneySchema,
    activityId: optionalBody(idSchema),
    tripStopId: optionalBody(idSchema),
    allowOverlap: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The end time must be after the start time.',
        path: ['endTime'],
      });
    }
  });

/** Bulk reorder after a drag-and-drop gesture. */
export const reorderItinerarySchema = z.object({
  items: z
    .array(
      z.object({
        id: idSchema,
        date: optionalBody(dateOnlySchema),
        order: z.coerce.number().int().min(0),
        startTime: optionalBody(timeSchema),
        endTime: optionalBody(timeSchema),
      }),
    )
    .min(1, 'There is nothing to reorder.'),
});

export const itineraryItemIdParamSchema = z.object({ id: idSchema });

/** `POST /api/stops/:id/activities` — date and time are optional conveniences. */
export const addStopActivitySchema = z.object({
  activityId: idSchema,
  date: optionalBody(dateOnlySchema),
  startTime: optionalBody(timeSchema),
  endTime: optionalBody(timeSchema),
  notes: optionalBody(z.string().trim().max(1000)),
  customCost: optionalMoneySchema,
  allowOverlap: z.boolean().optional().default(false),
});

// ── Expenses ─────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  category: expenseCategorySchema,
  amount: moneySchema.refine((value) => value > 0, 'Enter an amount greater than zero.'),
  description: z.string().trim().min(1, 'Add a short description.').max(200),
  date: dateOnlySchema,
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseIdParamSchema = z.object({ id: idSchema });

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CreateItineraryItemInput = z.infer<typeof createItineraryItemSchema>;
