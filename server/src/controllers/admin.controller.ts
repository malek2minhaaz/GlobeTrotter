import type { Request, Response } from 'express';
import { getAdminAnalytics } from '../services/analytics.service';

/** Guarded by requireAuth + requireAdmin at the route level. */
export async function getAnalytics(_req: Request, res: Response) {
  const analytics = await getAdminAnalytics();
  res.json({ data: analytics });
}
