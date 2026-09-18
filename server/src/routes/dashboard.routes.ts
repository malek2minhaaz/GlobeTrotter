import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(analyticsController.getDashboard));
router.get('/notifications', asyncHandler(analyticsController.listNotifications));

export default router;
