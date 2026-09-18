import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import * as analyticsService from '../services/analytics.service';
import { getNotifications } from '../services/notification.service';

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export async function getDashboard(req: Request, res: Response) {
  const user = currentUser(req);
  const dashboard = await analyticsService.getDashboard(user.id);
  res.json({ data: dashboard });
}

export async function listNotifications(req: Request, res: Response) {
  const user = currentUser(req);
  const limit = Number((req.query as { limit?: string }).limit ?? 8);
  const notifications = await getNotifications(
    user.id,
    Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 8,
  );
  res.json({ data: notifications });
}
