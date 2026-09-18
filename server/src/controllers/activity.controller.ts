import type { Request, Response } from 'express';
import type { z } from 'zod';
import * as activityService from '../services/activity.service';
import { param } from '../utils/request';
import type { listActivitiesQuerySchema } from '../validators/discovery.validators';

type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export async function listActivities(req: Request, res: Response) {
  const result = await activityService.listActivities(req.query as unknown as ListActivitiesQuery);
  res.json({ data: result.items, meta: result.meta });
}

export async function listCityActivities(req: Request, res: Response) {
  const activities = await activityService.listActivitiesForCity(param(req, 'cityId'));
  res.json({ data: activities });
}

export async function getActivity(req: Request, res: Response) {
  const activity = await activityService.getActivityDetail(param(req, 'id'));
  res.json({ data: { activity } });
}
