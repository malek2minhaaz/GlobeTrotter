import { Router } from 'express';
import authRoutes from './auth.routes';
import tripRoutes from './trip.routes';
import stopRoutes from './stop.routes';
import itineraryItemRoutes from './itineraryItem.routes';
import expenseRoutes from './expense.routes';
import cityRoutes from './city.routes';
import activityRoutes from './activity.routes';
import shareRoutes from './share.routes';
import profileRoutes from './profile.routes';
import savedRoutes from './saved.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';

/**
 * Every API route, mounted under `/api`.
 *
 * Authentication is applied per-router rather than globally so that public
 * surfaces — landing-page data, city discovery, shared itineraries — stay open.
 *
 * The uploads router is intentionally NOT mounted here: it needs a larger body
 * limit and is mounted directly in `app.ts`, before the global JSON parser.
 */
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', uptime: Math.round(process.uptime()) } });
});

router.use('/auth', authRoutes);
router.use('/trips', tripRoutes);
router.use('/stops', stopRoutes);
router.use('/itinerary-items', itineraryItemRoutes);
router.use('/expenses', expenseRoutes);
router.use('/cities', cityRoutes);
router.use('/activities', activityRoutes);
router.use('/shared', shareRoutes);
router.use('/profile', profileRoutes);
router.use('/saved', savedRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);

export default router;
