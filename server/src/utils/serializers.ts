import type {
  Activity,
  ActivityCategory,
  City,
  Expense,
  ItineraryItem,
  Trip,
  TripStop,
  User,
} from '@prisma/client';
import { toDateOnly, tripStatus, diffInDaysUTC, todayUTC } from './dates';
import { toNumber, toNumberOrNull, round2 } from './decimal';
import { estimateDailyCost } from './estimate';
import { computeCostBreakdown, itineraryItemCost, totalPlannedDays } from './tripCost';

/**
 * Response serializers.
 *
 * Every field the client consumes is shaped here, which gives us three things:
 * money is always a number, dates are always `YYYY-MM-DD`, and private columns
 * (passwordHash above all) can never leak by accident.
 */

// ── Users ────────────────────────────────────────────────────────────────────

/** Public view: used on shared itineraries. Deliberately excludes email. */
export function serializeUserPublic(
  user: Pick<User, 'id' | 'name' | 'avatar'> & { language?: string | null },
) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    language: user.language ?? 'en',
  };
}

/** The signed-in user's own profile, including preferences. */
export function serializeProfile(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    language: user.language,
    currency: user.currency,
    role: user.role,
    createdAt: toDateOnly(user.createdAt),
    preferences: {
      theme: user.theme,
      tripsPublicByDefault: user.tripsPublicByDefault,
      notifyUpcomingTrips: user.notifyUpcomingTrips,
      notifyBudgetAlerts: user.notifyBudgetAlerts,
      notifyItineraryConflicts: user.notifyItineraryConflicts,
    },
  };
}

// ── Geography ────────────────────────────────────────────────────────────────

export function serializeCity(city: City) {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    region: city.region,
    description: city.description,
    image: city.image,
    costIndex: city.costIndex,
    popularity: city.popularity,
    latitude: city.latitude,
    longitude: city.longitude,
    estimatedDailyCost: estimateDailyCost(city.costIndex),
  };
}

export function serializeActivity(activity: Activity) {
  return {
    id: activity.id,
    cityId: activity.cityId,
    name: activity.name,
    description: activity.description,
    category: activity.category,
    image: activity.image,
    duration: activity.duration,
    estimatedCost: toNumber(activity.estimatedCost),
    latitude: activity.latitude,
    longitude: activity.longitude,
    popularity: activity.popularity,
  };
}

// ── Trips ────────────────────────────────────────────────────────────────────

type CityLite = Pick<City, 'id' | 'name' | 'country' | 'image' | 'costIndex' | 'latitude' | 'longitude'>;
type StopWithCity = TripStop & { city: CityLite };
type CostedItemLite = {
  customCost: ItineraryItem['customCost'];
  category: ActivityCategory | null;
  activity: { estimatedCost: Activity['estimatedCost'] } | null;
};

export interface TripRelations {
  stops?: StopWithCity[];
  expenses?: Pick<Expense, 'category' | 'amount'>[];
  itineraryItems?: CostedItemLite[];
}

function tripMetrics(trip: Trip, relations: TripRelations) {
  const stops = relations.stops ?? [];
  const breakdown = computeCostBreakdown(relations.itineraryItems, relations.expenses);
  const today = todayUTC();

  return {
    status: tripStatus(trip.startDate, trip.endDate),
    durationDays: diffInDaysUTC(trip.startDate, trip.endDate) + 1,
    cityCount: stops.length,
    plannedDays: totalPlannedDays(stops),
    estimatedCost: breakdown.total,
    plannedCost: breakdown.planned,
    loggedCost: breakdown.logged,
    budgetLimit: toNumberOrNull(trip.budgetLimit),
    /** Negative once the trip has started. Drives "in 12 days" copy. */
    daysUntilStart: diffInDaysUTC(today, trip.startDate),
    activityCount: relations.itineraryItems?.length ?? 0,
  };
}

/** Compact card shape used by trip lists, dashboards and the copy flow. */
export function serializeTripListItem(trip: Trip, relations: TripRelations = {}) {
  const stops = relations.stops ?? [];
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    coverImage: trip.coverImage,
    startDate: toDateOnly(trip.startDate),
    endDate: toDateOnly(trip.endDate),
    isPublic: trip.isPublic,
    publicSlug: trip.publicSlug,
    viewCount: trip.viewCount,
    sourceTripId: trip.sourceTripId,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    cities: stops.map((stop) => ({
      id: stop.city.id,
      name: stop.city.name,
      country: stop.city.country,
      image: stop.city.image,
    })),
    ...tripMetrics(trip, relations),
  };
}

export function serializeTripStop(
  stop: TripStop & { city: CityLite; itineraryItems?: ItineraryItem[] },
) {
  return {
    id: stop.id,
    tripId: stop.tripId,
    cityId: stop.cityId,
    order: stop.order,
    startDate: toDateOnly(stop.startDate),
    endDate: toDateOnly(stop.endDate),
    dayCount: diffInDaysUTC(stop.startDate, stop.endDate) + 1,
    city: {
      id: stop.city.id,
      name: stop.city.name,
      country: stop.city.country,
      image: stop.city.image,
      costIndex: stop.city.costIndex,
      latitude: stop.city.latitude,
      longitude: stop.city.longitude,
    },
    itemCount: stop.itineraryItems?.length ?? 0,
    ...(stop.itineraryItems
      ? { estimatedCost: round2(stop.itineraryItems.reduce((sum, item) => sum + itineraryItemCost(item), 0)) }
      : {}),
  };
}

export function serializeItineraryItem(
  item: ItineraryItem & {
    activity?: (Activity & { city?: CityLite }) | null;
    tripStop?: (TripStop & { city?: CityLite }) | null;
  },
  /**
   * The owning city, when the caller already knows it. Trip detail loads entries
   * nested under their stops, so the city is in hand and does not need to be
   * fetched again — but free-form entries have no activity to fall back on.
   */
  cityOverride?: CityLite | null,
) {
  const city = cityOverride ?? item.activity?.city ?? item.tripStop?.city ?? null;
  return {
    id: item.id,
    tripId: item.tripId,
    tripStopId: item.tripStopId,
    activityId: item.activityId,
    title: item.title,
    category: item.category,
    date: toDateOnly(item.date),
    startTime: item.startTime,
    endTime: item.endTime,
    notes: item.notes,
    order: item.order,
    customCost: toNumberOrNull(item.customCost),
    effectiveCost: itineraryItemCost(item),
    city: city ? { id: city.id, name: city.name, country: city.country } : null,
    activity: item.activity
      ? {
          id: item.activity.id,
          name: item.activity.name,
          image: item.activity.image,
          category: item.activity.category,
          duration: item.activity.duration,
          estimatedCost: toNumber(item.activity.estimatedCost),
        }
      : null,
  };
}

/** A stop together with its scheduled entries, as loaded by the trip service. */
export type DetailStop = StopWithCity & {
  itineraryItems?: Array<ItineraryItem & { activity?: Activity | null }>;
};

/** Full trip payload: the workspace, itinerary, budget and calendar all use this. */
export function serializeTripDetail(
  trip: Trip & { user?: Pick<User, 'id' | 'name' | 'avatar'> },
  // `Omit` avoids intersecting two incompatible array types on `stops`.
  relations: Omit<TripRelations, 'stops'> & { stops?: DetailStop[] } = {},
) {
  const stops = relations.stops ?? [];
  const items = stops.flatMap((stop) => stop.itineraryItems ?? []);
  const costedItems = items.map((item) => ({
    customCost: item.customCost,
    category: item.category,
    activity: item.activity ? { estimatedCost: item.activity.estimatedCost } : null,
  }));

  const metrics = tripMetrics(trip, {
    stops,
    expenses: relations.expenses,
    itineraryItems: costedItems,
  });

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    coverImage: trip.coverImage,
    startDate: toDateOnly(trip.startDate),
    endDate: toDateOnly(trip.endDate),
    isPublic: trip.isPublic,
    publicSlug: trip.publicSlug,
    viewCount: trip.viewCount,
    sourceTripId: trip.sourceTripId,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    ...metrics,
    ...(trip.user ? { owner: serializeUserPublic(trip.user) } : {}),
    cities: stops.map((stop) => ({
      id: stop.city.id,
      name: stop.city.name,
      country: stop.city.country,
      image: stop.city.image,
    })),
    stops: stops.map((stop) =>
      serializeTripStop({ ...stop, itineraryItems: stop.itineraryItems }),
    ),
    // Entries are serialized alongside their owning stop's city, so the calendar
    // and timeline views can label an entry without a second lookup.
    itineraryItems: stops
      .flatMap((stop) =>
        (stop.itineraryItems ?? []).map((item) => serializeItineraryItem(item, stop.city)),
      )
      .sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
      ),
  };
}

export function serializeExpense(expense: Expense) {
  return {
    id: expense.id,
    tripId: expense.tripId,
    category: expense.category,
    amount: toNumber(expense.amount),
    description: expense.description,
    date: toDateOnly(expense.date),
    createdAt: expense.createdAt.toISOString(),
  };
}

export function serializeSavedDestination(
  saved: { id: string; createdAt: Date; city: City },
) {
  return {
    id: saved.id,
    savedAt: saved.createdAt.toISOString(),
    city: serializeCity(saved.city),
  };
}
