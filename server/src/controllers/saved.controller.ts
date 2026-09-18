import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import * as savedService from '../services/saved.service';
import { param } from '../utils/request';

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export async function listSaved(req: Request, res: Response) {
  const user = currentUser(req);
  const query = req.query as unknown as { q?: string; page: number; pageSize: number; sort: 'asc' | 'desc' };
  const result = await savedService.listSavedDestinations(user.id, {
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort as Prisma.SortOrder,
  });
  res.json({ data: result.items, meta: result.meta });
}

export async function saveDestination(req: Request, res: Response) {
  const user = currentUser(req);
  const { cityId } = req.body as { cityId: string };
  const saved = await savedService.saveDestination(user.id, cityId);
  res.status(201).json({ data: { saved } });
}

export async function removeSavedDestination(req: Request, res: Response) {
  const user = currentUser(req);
  await savedService.removeSavedDestination(user.id, param(req, 'cityId'));
  res.json({ data: { success: true } });
}
