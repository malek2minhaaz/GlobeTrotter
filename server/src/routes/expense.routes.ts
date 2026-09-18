import { Router } from 'express';
import * as budgetController from '../controllers/budget.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { expenseIdParamSchema, updateExpenseSchema } from '../validators/trip.validators';

const router = Router();

router.use(requireAuth);

router.put(
  '/:id',
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(budgetController.updateExpense),
);

router.delete(
  '/:id',
  validate({ params: expenseIdParamSchema }),
  asyncHandler(budgetController.deleteExpense),
);

export default router;
