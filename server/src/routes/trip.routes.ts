import { Router } from 'express';
import * as tripController from '../controllers/trip.controller';
import * as itineraryController from '../controllers/itinerary.controller';
import * as budgetController from '../controllers/budget.controller';
import { requireAuth } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createExpenseSchema,
  createItineraryItemSchema,
  createStopSchema,
  createTripSchema,
  listTripsQuerySchema,
  reorderItinerarySchema,
  reorderStopsSchema,
  shareTripBodySchema,
  tripIdParamSchema,
  updateTripSchema,
} from '../validators/trip.validators';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listTripsQuerySchema }), asyncHandler(tripController.listTrips));

router.post(
  '/',
  writeLimiter,
  validate({ body: createTripSchema }),
  asyncHandler(tripController.createTrip),
);

router.get('/:id', validate({ params: tripIdParamSchema }), asyncHandler(tripController.getTrip));

router.put(
  '/:id',
  validate({ params: tripIdParamSchema, body: updateTripSchema }),
  asyncHandler(tripController.updateTrip),
);

router.delete('/:id', validate({ params: tripIdParamSchema }), asyncHandler(tripController.deleteTrip));

// ── Sharing ──
router.post(
  '/:id/share',
  validate({ params: tripIdParamSchema, body: shareTripBodySchema }),
  asyncHandler(tripController.shareTrip),
);

// ── Smart itinerary ──
router.get(
  '/:id/conflicts',
  validate({ params: tripIdParamSchema }),
  asyncHandler(tripController.getConflicts),
);

// ── City stays ──
router.post(
  '/:id/stops',
  validate({ params: tripIdParamSchema, body: createStopSchema }),
  asyncHandler(itineraryController.addStop),
);

router.put(
  '/:id/stops/reorder',
  validate({ params: tripIdParamSchema, body: reorderStopsSchema }),
  asyncHandler(itineraryController.reorderStops),
);

// ── Scheduled entries ──
router.post(
  '/:id/itinerary',
  validate({ params: tripIdParamSchema, body: createItineraryItemSchema }),
  asyncHandler(itineraryController.addItineraryItem),
);

router.put(
  '/:id/itinerary/reorder',
  validate({ params: tripIdParamSchema, body: reorderItinerarySchema }),
  asyncHandler(itineraryController.reorderItinerary),
);

// ── Budget ──
router.get('/:id/budget', validate({ params: tripIdParamSchema }), asyncHandler(budgetController.getBudget));

router.post(
  '/:id/expenses',
  validate({ params: tripIdParamSchema, body: createExpenseSchema }),
  asyncHandler(budgetController.addExpense),
);

export default router;
