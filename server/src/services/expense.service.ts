import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { diffInDaysUTC, parseDateOnly } from '../utils/dates';
import { serializeExpense } from '../utils/serializers';
import { requireOwnedTrip } from './trip.service';
import type { createExpenseSchema, updateExpenseSchema } from '../validators/trip.validators';

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * Expenses legitimately fall outside the trip window — flights are booked weeks
 * ahead — so the only guard is a sanity window that catches typos like 1900.
 */
function validateExpenseDate(date: Date, tripStart: Date, tripEnd: Date) {
  const withinStart = Math.abs(diffInDaysUTC(date, tripStart));
  const withinEnd = Math.abs(diffInDaysUTC(date, tripEnd));
  if (Math.min(withinStart, withinEnd) > 365) {
    throw ApiError.validation('That date is too far from the trip to be right.', {
      date: ['Pick a date within a year of the trip.'],
    });
  }
}

export async function addExpense(userId: string, tripId: string, input: CreateExpenseInput) {
  const trip = await requireOwnedTrip(userId, tripId);
  const date = parseDateOnly(input.date);
  validateExpenseDate(date, trip.startDate, trip.endDate);

  const expense = await prisma.expense.create({
    data: {
      tripId,
      category: input.category,
      amount: input.amount,
      description: input.description,
      date,
    },
  });

  return serializeExpense(expense);
}

export async function updateExpense(userId: string, expenseId: string, input: UpdateExpenseInput) {
  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) throw ApiError.notFound('That expense no longer exists.');

  const trip = await requireOwnedTrip(userId, existing.tripId);
  const date = input.date ? parseDateOnly(input.date) : existing.date;
  validateExpenseDate(date, trip.startDate, trip.endDate);

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      date,
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });

  return serializeExpense(expense);
}

export async function deleteExpense(userId: string, expenseId: string) {
  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) throw ApiError.notFound('That expense no longer exists.');

  await requireOwnedTrip(userId, existing.tripId);
  await prisma.expense.delete({ where: { id: expenseId } });
}
