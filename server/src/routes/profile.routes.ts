import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  deleteAccountSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '../validators/profile.validators';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(profileController.getProfile));
router.put('/', validate({ body: updateProfileSchema }), asyncHandler(profileController.updateProfile));
router.put(
  '/preferences',
  validate({ body: updatePreferencesSchema }),
  asyncHandler(profileController.updatePreferences),
);
router.delete(
  '/',
  validate({ body: deleteAccountSchema }),
  asyncHandler(profileController.deleteAccount),
);

export default router;
