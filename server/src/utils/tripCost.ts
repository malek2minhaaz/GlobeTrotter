import type { Activity, Expense, ItineraryItem } from '@prisma/client';
import { EXPENSE_CATEGORIES } from '../config/constants';
import { toNumber, round2 } from './decimal';

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number];

export interface CostBreakdown {
  /** Everything the trip is expected to cost: planned + logged. */
  total: number;
  /** Cost implied by the itinerary's activities. */
  planned: number;
  /** Cost of expenses the traveller entered by hand. */
  logged: number;
  byCategory: Record<ExpenseCategoryKey, number>;
}

type CostedItem = Pick<ItineraryItem, 'customCost' | 'category'> & {
  activity?: Pick<Activity, 'estimatedCost'> | null;
};

/**
 * Effective cost of one itinerary entry: an explicit override wins, otherwise
 * fall back to the catalogue price, otherwise free.
 */
export function itineraryItemCost(item: CostedItem): number {
  if (item.customCost !== null && item.customCost !== undefined) {
    return toNumber(item.customCost);
  }
  if (item.activity) return toNumber(item.activity.estimatedCost);
  return 0;
}

/**
 * Which expense bucket an itinerary entry contributes to. Meals stay separate
 * because travellers budget food very differently from activities.
 */
export function itineraryCategoryBucket(item: CostedItem): ExpenseCategoryKey {
  return item.category === 'FOOD' ? 'MEALS' : 'ACTIVITIES';
}

export function emptyCategoryMap(): Record<ExpenseCategoryKey, number> {
  return EXPENSE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: 0 }),
    {} as Record<ExpenseCategoryKey, number>,
  );
}

export function computeCostBreakdown(
  items: CostedItem[] = [],
  expenses: Pick<Expense, 'category' | 'amount'>[] = [],
): CostBreakdown {
  const byCategory = emptyCategoryMap();
  let planned = 0;
  let logged = 0;

  for (const item of items) {
    const cost = itineraryItemCost(item);
    if (cost <= 0) continue;
    planned += cost;
    byCategory[itineraryCategoryBucket(item)] += cost;
  }

  for (const expense of expenses) {
    const amount = toNumber(expense.amount);
    logged += amount;
    const key = expense.category as ExpenseCategoryKey;
    if (key in byCategory) {
      byCategory[key] += amount;
    } else {
      byCategory.MISCELLANEOUS += amount;
    }
  }

  return {
    total: round2(planned + logged),
    planned: round2(planned),
    logged: round2(logged),
    byCategory,
  };
}

/** Total planned days across a trip's stops, inclusive of both endpoints. */
export function totalPlannedDays(stops: Array<{ startDate: Date; endDate: Date }>): number {
  return stops.reduce((sum, stop) => {
    const days = Math.round((stop.endDate.getTime() - stop.startDate.getTime()) / 86_400_000) + 1;
    return sum + Math.max(days, 0);
  }, 0);
}
