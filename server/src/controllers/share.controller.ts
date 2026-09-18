import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { serializeTripDetail } from '../utils/serializers';
import { getPublicTripBySlug, recordTripView, copyTripFromSlug } from '../services/trip.service';
import { param } from '../utils/request';

/**
 * Public itinerary by slug. Exposes only what a share is meant to expose —
 * the owner appears as a display name and avatar, never an email (Section 20).
 */
export async function getSharedTrip(req: Request, res: Response) {
  const trip = await getPublicTripBySlug(param(req, 'slug'));

  // Best-effort engagement metric; a failure here must not break the page.
  await recordTripView(trip.id);

  res.json({ data: { trip: serializeTripDetail(trip, trip as never) } });
}

/** Copies a shared itinerary into the signed-in traveller's account (Section 21). */
export async function copySharedTrip(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized('Sign in to save this itinerary to your account.');
  const trip = await copyTripFromSlug(req.user.id, param(req, 'slug'));
  res.status(201).json({ data: { trip } });
}
