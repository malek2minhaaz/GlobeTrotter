import { Router } from 'express';
import * as itineraryController from '../controllers/itinerary.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  itineraryItemIdParamSchema,
  updateItineraryItemSchema,
} from '../validators/trip.validators';

const router = Router();

router.use(requireAuth);

router.put(
  '/:id',
  validate({ params: itineraryItemIdParamSchema, body: updateItineraryItemSchema }),
  asyncHandler(itineraryController.updateItineraryItem),
);

router.delete(
  '/:id',
  validate({ params: itineraryItemIdParamSchema }),
  asyncHandler(itineraryController.deleteItineraryItem),
);

export default router;
