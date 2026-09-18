import { Router } from 'express';
import { z } from 'zod';
import * as savedController from '../controllers/saved.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { optionalQuery, paginationSchema } from '../validators/common.validators';
import { saveDestinationSchema } from '../validators/discovery.validators';

const router = Router();

router.use(requireAuth);

const listQuerySchema = paginationSchema.extend({
  q: optionalQuery(z.string().trim().max(120)),
});

router.get('/', validate({ query: listQuerySchema }), asyncHandler(savedController.listSaved));

router.post(
  '/',
  validate({ body: saveDestinationSchema }),
  asyncHandler(savedController.saveDestination),
);

// Keyed by city so the client can toggle a bookmark without knowing the row id.
router.delete('/:cityId', asyncHandler(savedController.removeSavedDestination));

export default router;
