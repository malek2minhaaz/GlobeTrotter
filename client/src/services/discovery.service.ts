import { api, toQueryString } from '@/lib/api';
import type {
  Activity,
  ActivityCategory,
  City,
  CityDetail,
  DiscoveryFacets,
  Paginated,
  SavedDestination,
} from '@/types/api';

/** City and activity discovery, plus bookmarks. */

export interface CityListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  country?: string;
  region?: string;
  minCostIndex?: number;
  maxCostIndex?: number;
  minPopularity?: number;
  sortBy?: 'popularity' | 'name' | 'costIndex' | 'estimatedDailyCost';
  sort?: 'asc' | 'desc';
}

export interface ActivityListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  cityId?: string;
  category?: ActivityCategory;
  minCost?: number;
  maxCost?: number;
  maxDuration?: number;
  sortBy?: 'popularity' | 'name' | 'estimatedCost' | 'duration';
  sort?: 'asc' | 'desc';
}

export const discoveryService = {
  cities: (params: CityListParams = {}) =>
    api.getList<City>(`/cities${toQueryString(params as Record<string, unknown>)}`),

  city: (cityId: string) => api.get<{ city: CityDetail }>(`/cities/${cityId}`),

  facets: () => api.get<DiscoveryFacets>('/cities/facets'),

  popularCities: (limit = 8) => api.get<City[]>(`/cities/popular${toQueryString({ limit })}`),

  activities: (params: ActivityListParams = {}) =>
    api.getList<Activity>(`/activities${toQueryString(params as Record<string, unknown>)}`),

  activity: (activityId: string) => api.get<{ activity: Activity }>(`/activities/${activityId}`),

  cityActivities: (cityId: string) => api.get<Activity[]>(`/cities/${cityId}/activities`),

  // ── Saved destinations ──
  saved: (params: { page?: number; pageSize?: number; q?: string; sort?: 'asc' | 'desc' } = {}) =>
    api.getList<SavedDestination>(`/saved${toQueryString(params as Record<string, unknown>)}`),

  save: (cityId: string) => api.post<{ saved: SavedDestination }>('/saved', { cityId }),

  unsave: (cityId: string) => api.delete<{ success: boolean }>(`/saved/${cityId}`),
};

export type { Paginated };
