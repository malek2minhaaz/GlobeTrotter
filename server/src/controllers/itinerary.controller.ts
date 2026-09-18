import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import { serializeItineraryItem, serializeTripStop } from '../utils/serializers';
import * as itineraryService from '../services/itinerary.service';
import { param } from '../utils/request';
import type {
  createItineraryItemSchema,
  createStopSchema,
  reorderItinerarySchema,
  reorderStopsSchema,
  updateItineraryItemSchema,
  updateStopSchema,
} from '../validators/trip.validators';

type CreateStopBody = z.infer<typeof createStopSchema>;
type UpdateStopBody = z.infer<typeof updateStopSchema>;
type ReorderStopsBody = z.infer<typeof reorderStopsSchema>;
type CreateItemBody = z.infer<typeof createItineraryItemSchema>;
type UpdateItemBody = z.infer<typeof updateItineraryItemSchema>;
type ReorderBody = z.infer<typeof reorderItinerarySchema>;

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

// ── City stays ───────────────────────────────────────────────────────────────

export async function addStop(req: Request, res: Response) {
  const user = currentUser(req);
  const stop = await itineraryService.addStop(user.id, param(req, 'id'), req.body as CreateStopBody);
  res.status(201).json({ data: { stop: serializeTripStop(stop) } });
}

export async function updateStop(req: Request, res: Response) {
  const user = currentUser(req);
  const stop = await itineraryService.updateStop(user.id, param(req, 'id'), req.body as UpdateStopBody);
  res.json({ data: { stop: serializeTripStop(stop) } });
}

export async function deleteStop(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await itineraryService.deleteStop(user.id, param(req, 'id'));
  res.json({ data: { success: true, removedItems: result.removedItems } });
}

export async function reorderStops(req: Request, res: Response) {
  const user = currentUser(req);
  const { stopIds } = req.body as ReorderStopsBody;
  const result = await itineraryService.reorderStops(user.id, param(req, 'id'), stopIds);
  res.json({ data: result });
}

// ── Scheduled entries ────────────────────────────────────────────────────────

export async function addItineraryItem(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await itineraryService.addItineraryItem(
    user.id,
    param(req, 'id'),
    req.body as CreateItemBody,
  );
  res.status(201).json({
    data: { item: serializeItineraryItem(result.item), warnings: result.warnings },
  });
}

export async function updateItineraryItem(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await itineraryService.updateItineraryItem(
    user.id,
    param(req, 'id'),
    req.body as UpdateItemBody,
  );
  res.json({ data: { item: serializeItineraryItem(result.item), warnings: result.warnings } });
}

export async function deleteItineraryItem(req: Request, res: Response) {
  const user = currentUser(req);
  await itineraryService.deleteItineraryItem(user.id, param(req, 'id'));
  res.json({ data: { success: true } });
}

/** Bulk reorder after a drag-and-drop gesture (Section 13). */
export async function reorderItinerary(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await itineraryService.reorderItinerary(
    user.id,
    param(req, 'id'),
    req.body as ReorderBody,
  );
  res.json({ data: result });
}
