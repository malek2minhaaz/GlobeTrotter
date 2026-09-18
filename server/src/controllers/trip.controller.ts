import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import { param } from '../utils/request';
import * as tripService from '../services/trip.service';
import * as itineraryService from '../services/itinerary.service';
import type {
  createTripSchema,
  listTripsQuerySchema,
  updateTripSchema,
} from '../validators/trip.validators';

type CreateBody = z.infer<typeof createTripSchema>;
type UpdateBody = z.infer<typeof updateTripSchema>;
type ListQuery = z.infer<typeof listTripsQuerySchema>;

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export async function listTrips(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await tripService.listTrips(user.id, req.query as unknown as ListQuery);
  res.json({ data: result.items, meta: result.meta });
}

export async function createTrip(req: Request, res: Response) {
  const user = currentUser(req);
  const trip = await tripService.createTrip(user.id, req.body as CreateBody);
  res.status(201).json({ data: { trip } });
}

export async function getTrip(req: Request, res: Response) {
  const user = currentUser(req);
  const trip = await tripService.getTripDetail(user.id, param(req, 'id'));
  res.json({ data: { trip } });
}

export async function updateTrip(req: Request, res: Response) {
  const user = currentUser(req);
  const trip = await tripService.updateTrip(user.id, param(req, 'id'), req.body as UpdateBody);
  res.json({ data: { trip } });
}

export async function deleteTrip(req: Request, res: Response) {
  const user = currentUser(req);
  await tripService.deleteTrip(user.id, param(req, 'id'));
  res.json({ data: { success: true } });
}

/** Toggles PUBLIC/PRIVATE and mints a share slug on first share (Section 20). */
export async function shareTrip(req: Request, res: Response) {
  const user = currentUser(req);
  const { isPublic } = req.body as { isPublic: boolean };
  const trip = await tripService.setTripVisibility(user.id, param(req, 'id'), isPublic);
  res.json({ data: { trip } });
}

/** Smart-itinerary report: overlaps and entries outside the trip window. */
export async function getConflicts(req: Request, res: Response) {
  const user = currentUser(req);
  const conflicts = await itineraryService.getTripConflicts(user.id, param(req, 'id'));
  res.json({ data: conflicts });
}
