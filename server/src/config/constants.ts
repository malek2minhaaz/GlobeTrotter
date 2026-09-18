/** Shared constants that define application behaviour. */

/** Cookie name for the JWT session. */
export const AUTH_COOKIE = 'gt_token';

/** Session lifetime in milliseconds, used for cookie maxAge. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Categories that appear on the budget page, in display order. */
export const EXPENSE_CATEGORIES = [
  'TRANSPORT',
  'ACCOMMODATION',
  'ACTIVITIES',
  'MEALS',
  'MISCELLANEOUS',
] as const;

export const ACTIVITY_CATEGORIES = [
  'ADVENTURE',
  'SIGHTSEEING',
  'FOOD',
  'CULTURE',
  'SHOPPING',
  'NATURE',
  'ENTERTAINMENT',
  'RELAXATION',
] as const;

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'fr', 'ja', 'es'] as const;

/** Default page size for list endpoints; capped to protect the database. */
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 60;

/**
 * Fraction of the cost index applied per traveller per day when estimating an
 * accommodation cost we cannot know precisely. Kept here so the budget service
 * and the city detail page agree.
 */
export const ACCOMMODATION_BASE_PER_NIGHT = 2800;

/** How many days ahead we consider a trip "upcoming" in notifications. */
export const TRIP_SOON_DAYS = 7;
