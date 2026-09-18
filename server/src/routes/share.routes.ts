import { Router } from 'express';
import { z } from 'zod';
import * as shareController from '../controllers/share.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'That share link is not valid.'),
});

// Public: anyone with the link can read a shared itinerary.
router.get(
  '/:slug',
  optionalAuth,
  validate({ params: slugParamSchema }),
  asyncHandler(shareController.getSharedTrip),
);

// Copying into your own account requires a session.
router.post(
  '/:slug/copy',
  requireAuth,
  validate({ params: slugParamSchema }),
  asyncHandler(shareController.copySharedTrip),
);

export default router;
