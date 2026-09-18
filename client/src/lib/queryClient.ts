import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * TanStack Query configuration.
 *
 * All server state lives here; local UI state stays in React. Retrying is
 * limited to genuine transient failures — retrying a 4xx only delays the error
 * the traveller actually needs to see.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Query keys in one place so invalidation never drifts from fetching. */
export const queryKeys = {
  auth: ['auth', 'me'] as const,
  dashboard: ['dashboard'] as const,
  notifications: ['notifications'] as const,
  trips: (params?: unknown) => ['trips', params ?? {}] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  tripBudget: (tripId: string) => ['trip', tripId, 'budget'] as const,
  tripConflicts: (tripId: string) => ['trip', tripId, 'conflicts'] as const,
  cities: (params?: unknown) => ['cities', params ?? {}] as const,
  city: (cityId: string) => ['city', cityId] as const,
  cityFacets: ['cities', 'facets'] as const,
  popularCities: ['cities', 'popular'] as const,
  activities: (params?: unknown) => ['activities', params ?? {}] as const,
  saved: (params?: unknown) => ['saved', params ?? {}] as const,
  profile: ['profile'] as const,
  adminAnalytics: ['admin', 'analytics'] as const,
};
