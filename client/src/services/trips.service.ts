import { api, toQueryString } from '@/lib/api';
import type {
  Activity,
  Budget,
  Conflict,
  Expense,
  ExpenseCategory,
  ItineraryItem,
  Paginated,
  TripDetail,
  TripListItem,
  TripStatusFilter,
  TripStop,
  TripVisibilityFilter,
} from '@/types/api';

/** Trips, city stays, the itinerary, the budget and sharing. */

export interface TripListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: TripStatusFilter;
  visibility?: TripVisibilityFilter;
  sortBy?: 'createdAt' | 'startDate' | 'name' | 'cost';
  sort?: 'asc' | 'desc';
}

export interface CreateTripPayload {
  name: string;
  description?: string | null;
  coverImage?: string | null;
  startDate: string;
  endDate: string;
  isPublic?: boolean;
  budgetLimit?: number | null;
  stops?: Array<{ cityId: string; startDate: string; endDate: string }>;
}

export interface CreateItineraryItemPayload {
  activityId?: string | null;
  title?: string | null;
  category?: ItineraryItem['category'];
  date: string;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
  customCost?: number | null;
  tripStopId?: string | null;
  /** Set once the traveller confirms they want to keep an overlap. */
  allowOverlap?: boolean;
}

export const tripsService = {
  list: (params: TripListParams = {}) =>
    api.getList<TripListItem>(`/trips${toQueryString(params as Record<string, unknown>)}`),

  get: (tripId: string) => api.get<{ trip: TripDetail }>(`/trips/${tripId}`),

  create: (payload: CreateTripPayload) => api.post<{ trip: TripDetail }>('/trips', payload),

  update: (tripId: string, payload: Partial<CreateTripPayload>) =>
    api.put<{ trip: TripDetail }>(`/trips/${tripId}`, payload),

  remove: (tripId: string) => api.delete<{ success: boolean }>(`/trips/${tripId}`),

  share: (tripId: string, isPublic: boolean) =>
    api.post<{ trip: TripDetail }>(`/trips/${tripId}/share`, { isPublic }),

  conflicts: (tripId: string) => api.get<Conflict[]>(`/trips/${tripId}/conflicts`),

  // ── City stays ──
  addStop: (tripId: string, payload: { cityId: string; startDate: string; endDate: string; order?: number }) =>
    api.post<{ stop: TripStop }>(`/trips/${tripId}/stops`, payload),

  updateStop: (stopId: string, payload: { startDate?: string; endDate?: string; order?: number }) =>
    api.put<{ stop: TripStop }>(`/stops/${stopId}`, payload),

  removeStop: (stopId: string) =>
    api.delete<{ success: boolean; removedItems: number }>(`/stops/${stopId}`),

  reorderStops: (tripId: string, stopIds: string[]) =>
    api.put<{ reordered: number }>(`/trips/${tripId}/stops/reorder`, { stopIds }),

  stopActivities: (stopId: string) => api.get<Activity[]>(`/stops/${stopId}/activities`),

  addActivityToStop: (
    stopId: string,
    payload: {
      activityId: string;
      date?: string;
      startTime?: string;
      endTime?: string | null;
      notes?: string | null;
      customCost?: number | null;
      allowOverlap?: boolean;
    },
  ) =>
    api.post<{ item: ItineraryItem; warnings: Conflict[] }>(`/stops/${stopId}/activities`, payload),

  // ── Itinerary ──
  addItineraryItem: (tripId: string, payload: CreateItineraryItemPayload) =>
    api.post<{ item: ItineraryItem; warnings: Conflict[] }>(`/trips/${tripId}/itinerary`, payload),

  updateItineraryItem: (itemId: string, payload: Partial<CreateItineraryItemPayload>) =>
    api.put<{ item: ItineraryItem; warnings: Conflict[] }>(`/itinerary-items/${itemId}`, payload),

  removeItineraryItem: (itemId: string) =>
    api.delete<{ success: boolean }>(`/itinerary-items/${itemId}`),

  reorderItinerary: (
    tripId: string,
    items: Array<{ id: string; order: number; date?: string; startTime?: string; endTime?: string | null }>,
  ) => api.put<{ updated: number; conflicts: Conflict[] }>(`/trips/${tripId}/itinerary/reorder`, { items }),

  // ── Budget ──
  budget: (tripId: string) => api.get<Budget>(`/trips/${tripId}/budget`),

  addExpense: (
    tripId: string,
    payload: { category: ExpenseCategory; amount: number; description: string; date: string },
  ) => api.post<{ expense: Expense }>(`/trips/${tripId}/expenses`, payload),

  updateExpense: (
    expenseId: string,
    payload: Partial<{ category: ExpenseCategory; amount: number; description: string; date: string }>,
  ) => api.put<{ expense: Expense }>(`/expenses/${expenseId}`, payload),

  removeExpense: (expenseId: string) => api.delete<{ success: boolean }>(`/expenses/${expenseId}`),
};

// ── Public sharing ───────────────────────────────────────────────────────────

export const shareService = {
  /** Public read: works for signed-out visitors. */
  get: (slug: string) => api.get<{ trip: TripDetail }>(`/shared/${slug}`),

  /** Copies the itinerary into the signed-in traveller's account. */
  copy: (slug: string) => api.post<{ trip: TripDetail }>(`/shared/${slug}/copy`),
};

export type { Paginated };
