import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import * as budgetService from '../services/budget.service';
import { param } from '../utils/request';
import * as expenseService from '../services/expense.service';
import type { createExpenseSchema, updateExpenseSchema } from '../validators/trip.validators';

type CreateExpenseBody = z.infer<typeof createExpenseSchema>;
type UpdateExpenseBody = z.infer<typeof updateExpenseSchema>;

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export async function getBudget(req: Request, res: Response) {
  const user = currentUser(req);
  const budget = await budgetService.getTripBudget(user.id, param(req, 'id'));
  res.json({ data: budget });
}

export async function addExpense(req: Request, res: Response) {
  const user = currentUser(req);
  const expense = await expenseService.addExpense(
    user.id,
    param(req, 'id'),
    req.body as CreateExpenseBody,
  );
  res.status(201).json({ data: { expense } });
}

export async function updateExpense(req: Request, res: Response) {
  const user = currentUser(req);
  const expense = await expenseService.updateExpense(
    user.id,
    param(req, 'id'),
    req.body as UpdateExpenseBody,
  );
  res.json({ data: { expense } });
}

export async function deleteExpense(req: Request, res: Response) {
  const user = currentUser(req);
  await expenseService.deleteExpense(user.id, param(req, 'id'));
  res.json({ data: { success: true } });
}
