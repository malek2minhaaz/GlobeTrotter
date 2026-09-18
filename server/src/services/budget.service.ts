import { EXPENSE_CATEGORIES } from '../config/constants';
import { prisma } from '../lib/prisma';
import { eachDayInclusive, toDateOnly } from '../utils/dates';
import { round2, toNumber } from '../utils/decimal';
import { serializeExpense } from '../utils/serializers';
import { computeCostBreakdown, itineraryItemCost } from '../utils/tripCost';
import { requireOwnedTrip } from './trip.service';

export const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transportation',
  ACCOMMODATION: 'Accommodation',
  ACTIVITIES: 'Activities',
  MEALS: 'Meals',
  MISCELLANEOUS: 'Miscellaneous',
};

/** Colour tokens the client maps to chart colours; kept stable across themes. */
export const CATEGORY_COLOURS: Record<string, string> = {
  TRANSPORT: '#0ea5e9',
  ACCOMMODATION: '#14b8a6',
  ACTIVITIES: '#f59e0b',
  MEALS: '#f43f5e',
  MISCELLANEOUS: '#8b5cf6',
};

/**
 * The full budget picture for a trip: combined totals, the category split, a
 * day-by-day cost series, and how the estimate compares with the traveller's
 * own ceiling (Sections 17 and 18).
 */
export async function getTripBudget(userId: string, tripId: string) {
  await requireOwnedTrip(userId, tripId);

  const [trip, items, expenses] = await Promise.all([
    prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { name: true, startDate: true, endDate: true, budgetLimit: true },
    }),
    prisma.itineraryItem.findMany({
      where: { tripId },
      include: { activity: { select: { estimatedCost: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.expense.findMany({ where: { tripId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
  ]);

  const breakdown = computeCostBreakdown(items, expenses);
  const days = eachDayInclusive(trip.startDate, trip.endDate);
  const totalDays = Math.max(days.length, 1);

  // Seed every day of the trip so the chart has no gaps.
  const perDayMap = new Map<string, { planned: number; logged: number }>();
  for (const day of days) perDayMap.set(toDateOnly(day), { planned: 0, logged: 0 });

  for (const item of items) {
    const key = toDateOnly(item.date);
    const entry = perDayMap.get(key) ?? { planned: 0, logged: 0 };
    entry.planned += itineraryItemCost(item);
    perDayMap.set(key, entry);
  }
  for (const expense of expenses) {
    const key = toDateOnly(expense.date);
    const entry = perDayMap.get(key) ?? { planned: 0, logged: 0 };
    entry.logged += toNumber(expense.amount);
    perDayMap.set(key, entry);
  }

  const perDay = [...perDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      date,
      planned: round2(value.planned),
      logged: round2(value.logged),
      total: round2(value.planned + value.logged),
    }));

  const spendDays = perDay.filter((day) => day.total > 0);
  const highest = spendDays.reduce<(typeof spendDays)[number] | null>(
    (best, day) => (!best || day.total > best.total ? day : best),
    null,
  );
  const cheapest = spendDays.reduce<(typeof spendDays)[number] | null>(
    (lowest, day) => (!lowest || day.total < lowest.total ? day : lowest),
    null,
  );

  const budgetLimit = trip.budgetLimit === null ? null : toNumber(trip.budgetLimit);
  const remaining = budgetLimit === null ? null : round2(budgetLimit - breakdown.total);
  const overBudgetBy = budgetLimit === null ? 0 : round2(Math.max(breakdown.total - budgetLimit, 0));
  const usedPercent =
    budgetLimit && budgetLimit > 0
      ? Math.round((breakdown.total / budgetLimit) * 1000) / 10
      : null;

  return {
    tripId,
    tripName: trip.name,
    startDate: toDateOnly(trip.startDate),
    endDate: toDateOnly(trip.endDate),
    totalDays,
    total: breakdown.total,
    planned: breakdown.planned,
    logged: breakdown.logged,
    currency: 'INR',
    budgetLimit,
    remaining,
    overBudgetBy,
    usedPercent,
    isOverBudget: overBudgetBy > 0,
    categories: EXPENSE_CATEGORIES.map((category) => {
      const amount = round2(breakdown.byCategory[category] ?? 0);
      return {
        category,
        label: CATEGORY_LABELS[category] ?? category,
        colour: CATEGORY_COLOURS[category] ?? '#64748b',
        amount,
        percent: breakdown.total > 0 ? Math.round((amount / breakdown.total) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.amount - a.amount),
    perDay,
    stats: {
      averagePerDay: round2(breakdown.total / totalDays),
      averagePerSpendDay: spendDays.length > 0 ? round2(breakdown.total / spendDays.length) : 0,
      highestDay: highest,
      cheapestDay: cheapest,
      spendDays: spendDays.length,
      activityCount: items.length,
      expenseCount: expenses.length,
    },
    expenses: expenses.map(serializeExpense),
  };
}
