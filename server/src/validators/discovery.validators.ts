import { z } from 'zod';
import {
  activityCategorySchema,
  emptyToUndefined,
  idSchema,
  optionalQuery,
  paginationSchema,
} from './common.validators';

/**
 * Every filter uses `optionalQuery`, so a request that omits a filter *or* sends
 * it empty (`?country=`) is treated identically and stays valid.
 */

export const listCitiesQuerySchema = paginationSchema.extend({
  /** Free-text search across city, country, region and description. */
  q: optionalQuery(z.string().trim().max(120)),
  country: optionalQuery(z.string().trim().max(80)),
  region: optionalQuery(z.string().trim().max(80)),
  minCostIndex: optionalQuery(z.coerce.number().min(0).max(10)),
  maxCostIndex: optionalQuery(z.coerce.number().min(0).max(10)),
  minPopularity: optionalQuery(z.coerce.number().int().min(0).max(100)),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['popularity', 'name', 'costIndex', 'estimatedDailyCost']).default('popularity'),
  ),
});

export const cityIdParamSchema = z.object({ id: idSchema });

/**
 * Route parameters are validated against the *actual* parameter name. A schema
 * keyed on `id` would reject `/:cityId/activities` with "Required".
 */
export const cityActivitiesParamSchema = z.object({ cityId: idSchema });

export const listActivitiesQuerySchema = paginationSchema.extend({
  q: optionalQuery(z.string().trim().max(120)),
  cityId: optionalQuery(idSchema),
  category: optionalQuery(activityCategorySchema),
  minCost: optionalQuery(z.coerce.number().min(0)),
  maxCost: optionalQuery(z.coerce.number().min(0)),
  maxDuration: optionalQuery(z.coerce.number().min(0).max(48)),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['popularity', 'name', 'estimatedCost', 'duration']).default('popularity'),
  ),
});

export const activityIdParamSchema = z.object({ id: idSchema });

/** Filter facets for the discovery sidebar, so the UI never hardcodes them. */
export const discoveryFacetsQuerySchema = z.object({
  country: optionalQuery(z.string().trim().max(80)),
});

export const saveDestinationSchema = z.object({
  cityId: idSchema,
});

export const savedDestinationIdParamSchema = z.object({ id: idSchema });

export type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
