import { Router } from 'express';
import * as activityController from '../controllers/activity.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  activityIdParamSchema,
  listActivitiesQuerySchema,
} from '../validators/discovery.validators';

const router = Router();

router.get(
  '/',
  validate({ query: listActivitiesQuerySchema }),
  asyncHandler(activityController.listActivities),
);

router.get(
  '/:id',
  validate({ params: activityIdParamSchema }),
  asyncHandler(activityController.getActivity),
);

export default router;
