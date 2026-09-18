import { ACCOMMODATION_BASE_PER_NIGHT } from '../config/constants';

/**
 * Indicative daily spend for a city: accommodation plus a food/local-transport
 * baseline, both scaled by the city's cost index. Shared by the city detail page
 * and the budget estimator so the two can never disagree.
 */
export function estimateDailyCost(costIndex: number): number {
  const baseline = ACCOMMODATION_BASE_PER_NIGHT + 1800;
  return Math.round(baseline * costIndex);
}

/** Accommodation-only estimate, used when building a day-by-day cost chart. */
export function estimateAccommodationPerNight(costIndex: number): number {
  return Math.round(ACCOMMODATION_BASE_PER_NIGHT * costIndex);
}
