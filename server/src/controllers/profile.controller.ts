import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ApiError } from '../utils/ApiError';
import { clearAuthCookie } from '../utils/cookies';
import * as profileService from '../services/profile.service';
import type {
  deleteAccountSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '../validators/profile.validators';

type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
type UpdatePreferencesBody = z.infer<typeof updatePreferencesSchema>;
type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;

function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export async function getProfile(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await profileService.getProfileWithStats(user.id);
  res.json({ data: result });
}

export async function updateProfile(req: Request, res: Response) {
  const user = currentUser(req);
  const profile = await profileService.updateProfile(user.id, req.body as UpdateProfileBody);
  res.json({ data: { profile } });
}

export async function updatePreferences(req: Request, res: Response) {
  const user = currentUser(req);
  const profile = await profileService.updatePreferences(
    user.id,
    req.body as UpdatePreferencesBody,
  );
  res.json({ data: { profile } });
}

/** Destructive: requires the password and a typed confirmation. */
export async function deleteAccount(req: Request, res: Response) {
  const user = currentUser(req);
  await profileService.deleteAccount(user.id, req.body as DeleteAccountBody);
  clearAuthCookie(res);
  res.json({ data: { success: true } });
}
