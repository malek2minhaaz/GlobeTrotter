import { Router } from 'express';
import type { Request, Response } from 'express';
import * as itineraryController from '../controllers/itinerary.controller';
import * as itineraryService from '../services/itinerary.service';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { param } from '../utils/request';
import { asyncHandler } from '../utils/asyncHandler';
import { serializeActivity, serializeItineraryItem } from '../utils/serializers';
import {
  addStopActivitySchema,
  stopIdParamSchema,
  updateStopSchema,
} from '../validators/trip.validators';

const router = Router();

router.use(requireAuth);

/** Activities available in this stop's city — powers the builder's search panel. */
router.get(
  '/:id/activities',
  validate({ params: stopIdParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const activities = await itineraryService.listStopActivities(req.user.id, param(req, 'id'));
    res.json({ data: activities.map(serializeActivity) });
  }),
);

/** Adds a catalogue activity straight onto this city stay (Section 33). */
router.post(
  '/:id/activities',
  validate({ params: stopIdParamSchema, body: addStopActivitySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await itineraryService.addActivityToStop(
      req.user.id,
      param(req, 'id'),
      req.body as { activityId: string },
    );
    res.status(201).json({
      data: { item: serializeItineraryItem(result.item), warnings: result.warnings },
    });
  }),
);

router.put(
  '/:id',
  validate({ params: stopIdParamSchema, body: updateStopSchema }),
  asyncHandler(itineraryController.updateStop),
);

router.delete(
  '/:id',
  validate({ params: stopIdParamSchema }),
  asyncHandler(itineraryController.deleteStop),
);

export default router;
