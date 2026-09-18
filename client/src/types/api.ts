/**
 * Types mirroring the server's serializers.
 *
 * Money is always a `number` and dates are always `YYYY-MM-DD` strings — the API
 * guarantees both, so nothing here has to defend against Decimal or ISO timestamps.
 */

export type Role = 'USER' | 'ADMIN';

export type ActivityCategory =
  | 'ADVENTURE'
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'CULTURE'
  | 'SHOPPING'
  | 'NATURE'
  | 'ENTERTAINMENT'
  | 'RELAXATION';

export type ExpenseCategory =
  | 'TRANSPORT'
  | 'ACCOMMODATION'
  | 'ACTIVITIES'
  | 'MEALS'
  | 'MISCELLANEOUS';

export type TripStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';
export type TripVisibilityFilter = 'PUBLIC' | 'PRIVATE' | 'ALL';
export type TripStatusFilter = TripStatus | 'ALL';
export type SortDirection = 'asc' | 'desc';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── People ───────────────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: ThemePreference;
  tripsPublicByDefault: boolean;
  notifyUpcomingTrips: boolean;
  notifyBudgetAlerts: boolean;
  notifyItineraryConflicts: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  language: string;
  currency: string;
  role: Role;
  createdAt: string;
  preferences: UserPreferences;
}

/** What a shared itinerary reveals about its owner — never an email. */
export interface PublicUser {
  id: string;
  name: string;
  avatar: string | null;
  language: string;
}

// ── Geography ────────────────────────────────────────────────────────────────

export interface City {
  id: string;
  name: string;
  country: string;
  region: string;
  description: string;
  image: string;
  costIndex: number;
  popularity: number;
  latitude: number;
  longitude: number;
  estimatedDailyCost: number;
  isSaved?: boolean;
}

export interface CityDetail extends City {
  isSaved: boolean;
  activityCount: number;
  activities: Activity[];
  highlights: Activity[];
}

export interface CityLite {
  id: string;
  name: string;
  country: string;
  image: string;
}

export interface Activity {
  id: string;
  cityId: string;
  name: string;
  description: string;
  category: ActivityCategory;
  image: string;
  duration: number;
  estimatedCost: number;
  latitude: number | null;
  longitude: number | null;
  popularity: number;
  city?: CityLite;
}

export interface DiscoveryFacets {
  countries: Array<{ value: string; count: number }>;
  regions: Array<{ value: string; count: number }>;
  costIndexRange: { min: number; max: number };
  popular: CityLite[];
}

export interface SavedDestination {
  id: string;
  savedAt: string;
  city: City;
}

// ── Trips ────────────────────────────────────────────────────────────────────

export interface TripSummaryMetrics {
  status: TripStatus;
  durationDays: number;
  cityCount: number;
  plannedDays: number;
  estimatedCost: number;
  plannedCost: number;
  loggedCost: number;
  budgetLimit: number | null;
  daysUntilStart: number;
  activityCount: number;
}

export interface TripListItem extends TripSummaryMetrics {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  publicSlug: string | null;
  viewCount: number;
  sourceTripId: string | null;
  createdAt: string;
  updatedAt: string;
  cities: CityLite[];
}

export interface TripStop {
  id: string;
  tripId: string;
  cityId: string;
  order: number;
  startDate: string;
  endDate: string;
  dayCount: number;
  city: CityLite & { costIndex: number; latitude: number; longitude: number };
  itemCount: number;
  estimatedCost?: number;
}

export interface ItineraryItem {
  id: string;
  tripId: string;
  tripStopId: string;
  activityId: string | null;
  title: string;
  category: ActivityCategory | null;
  date: string;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  order: number;
  customCost: number | null;
  effectiveCost: number;
  city: { id: string; name: string; country: string } | null;
  activity: {
    id: string;
    name: string;
    image: string;
    category: ActivityCategory;
    duration: number;
    estimatedCost: number;
  } | null;
}

export interface TripDetail extends TripListItem {
  owner?: PublicUser;
  stops: TripStop[];
  itineraryItems: ItineraryItem[];
}

// ── Budget ───────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface BudgetCategorySlice {
  category: ExpenseCategory;
  label: string;
  colour: string;
  amount: number;
  percent: number;
}

export interface BudgetDay {
  date: string;
  planned: number;
  logged: number;
  total: number;
}

export interface Budget {
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  total: number;
  planned: number;
  logged: number;
  currency: string;
  budgetLimit: number | null;
  remaining: number | null;
  overBudgetBy: number;
  usedPercent: number | null;
  isOverBudget: boolean;
  categories: BudgetCategorySlice[];
  perDay: BudgetDay[];
  stats: {
    averagePerDay: number;
    averagePerSpendDay: number;
    highestDay: BudgetDay | null;
    cheapestDay: BudgetDay | null;
    spendDays: number;
    activityCount: number;
    expenseCount: number;
  };
  expenses: Expense[];
}

// ── Conflicts & notifications ────────────────────────────────────────────────

export type ConflictType = 'OVERLAP' | 'OUTSIDE_TRIP' | 'OUTSIDE_STOP';

export interface Conflict {
  type: ConflictType;
  severity: 'warning' | 'error';
  message: string;
  itemIds: string[];
  date: string;
  resolution: string;
}

export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success';

export interface AppNotification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  tripId: string | null;
  actionLabel: string | null;
  actionHref: string | null;
}

// ── Dashboard & admin ────────────────────────────────────────────────────────

export interface Dashboard {
  stats: {
    upcomingTrips: number;
    totalTrips: number;
    completedTrips: number;
    citiesPlanned: number;
    citiesVisited: number;
    savedDestinations: number;
    publicTrips: number;
  };
  analytics: {
    plannedDays: number;
    cities: number;
    activities: number;
    estimatedTotalCost: number;
    averageDailyCost: number;
  };
  focusTrip: TripListItem | null;
  upcomingTrip: TripListItem | null;
  upcomingTrips: TripListItem[];
  ongoingTrips: TripListItem[];
  recentTrips: TripListItem[];
  popularDestinations: City[];
  savedDestinations: Array<{ id: string; city: City }>;
  notifications: AppNotification[];
}

export interface AdminAnalytics {
  totals: {
    users: number;
    trips: number;
    cities: number;
    activities: number;
    publicTrips: number;
    expenses: number;
    upcomingTrips: number;
    savedDestinations: number;
  };
  tripsOverTime: Array<{ month: string; count: number }>;
  registrationsOverTime: Array<{ month: string; count: number }>;
  popularCities: Array<CityLite & { tripCount: number; savedCount: number }>;
  popularActivities: Array<{
    id: string;
    name: string;
    category: ActivityCategory;
    image: string;
    cityName: string;
    timesPlanned: number;
  }>;
  generatedAt: string;
}

export interface ProfileResponse {
  profile: UserProfile;
  stats: {
    totalTrips: number;
    publicTrips: number;
    citiesPlanned: number;
    savedDestinations: number;
  };
}

export interface UploadConfig {
  provider: string;
  configured: boolean;
  maxBytes: number;
  acceptsUrls: boolean;
  acceptsInlineUploads: boolean;
}

/** Field-level errors keyed by form field, as returned on a 422. */
export type FieldErrors = Record<string, string[]>;
