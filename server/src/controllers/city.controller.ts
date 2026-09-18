import type { Request, Response } from 'express';
import type { z } from 'zod';
import * as cityService from '../services/city.service';
import { param } from '../utils/request';
import type { listCitiesQuerySchema } from '../validators/discovery.validators';

type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;

export async function listCities(req: Request, res: Response) {
  // Public endpoint: bookmark state is simply omitted when signed out.
  const result = await cityService.listCities(
    req.user?.id ?? null,
    req.query as unknown as ListCitiesQuery,
  );
  res.json({ data: result.items, meta: result.meta });
}

export async function getFacets(_req: Request, res: Response) {
  const facets = await cityService.getDiscoveryFacets();
  res.json({ data: facets });
}

export async function getPopularCities(_req: Request, res: Response) {
  const limit = Number((_req.query as { limit?: string }).limit ?? 8);
  const cities = await cityService.getPopularCities(
    Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 24) : 8,
  );
  res.json({ data: cities });
}

export async function getCity(req: Request, res: Response) {
  const city = await cityService.getCityDetail(req.user?.id ?? null, param(req, 'id'));
  res.json({ data: { city } });
}
