import { Router } from 'express';
import * as cityController from '../controllers/city.controller';
import * as activityController from '../controllers/activity.controller';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  cityActivitiesParamSchema,
  cityIdParamSchema,
  listCitiesQuerySchema,
} from '../validators/discovery.validators';

const router = Router();

// Discovery is public; optionalAuth only adds bookmark state for signed-in users.
router.get(
  '/',
  optionalAuth,
  validate({ query: listCitiesQuerySchema }),
  asyncHandler(cityController.listCities),
);

router.get('/facets', asyncHandler(cityController.getFacets));
router.get('/popular', asyncHandler(cityController.getPopularCities));

router.get(
  '/:cityId/activities',
  validate({ params: cityActivitiesParamSchema }),
  asyncHandler(activityController.listCityActivities),
);

router.get(
  '/:id',
  optionalAuth,
  validate({ params: cityIdParamSchema }),
  asyncHandler(cityController.getCity),
);

export default router;
