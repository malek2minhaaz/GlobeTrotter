import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/analytics', asyncHandler(adminController.getAnalytics));

export default router;
