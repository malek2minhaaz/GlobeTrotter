import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { verifyPassword } from '../utils/crypto';
import { serializeProfile } from '../utils/serializers';
import type {
  deleteAccountSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '../validators/profile.validators';

type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** Profile plus the headline numbers shown on the profile page (Section 22). */
export async function getProfileWithStats(userId: string) {
  const [user, trips, savedCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.trip.findMany({
      where: { userId },
      select: { id: true, isPublic: true, stops: { select: { cityId: true } } },
    }),
    prisma.savedDestination.count({ where: { userId } }),
  ]);

  if (!user) throw ApiError.notFound('We could not find your account.');

  const cityIds = new Set(trips.flatMap((trip) => trip.stops.map((stop) => stop.cityId)));

  return {
    profile: serializeProfile(user),
    stats: {
      totalTrips: trips.length,
      publicTrips: trips.filter((trip) => trip.isPublic).length,
      citiesPlanned: cityIds.size,
      savedDestinations: savedCount,
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.email) {
    const clash = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (clash) throw ApiError.conflict('That email is already in use by another account.');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    },
  });

  return serializeProfile(user);
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.tripsPublicByDefault !== undefined
        ? { tripsPublicByDefault: input.tripsPublicByDefault }
        : {}),
      ...(input.notifyUpcomingTrips !== undefined
        ? { notifyUpcomingTrips: input.notifyUpcomingTrips }
        : {}),
      ...(input.notifyBudgetAlerts !== undefined
        ? { notifyBudgetAlerts: input.notifyBudgetAlerts }
        : {}),
      ...(input.notifyItineraryConflicts !== undefined
        ? { notifyItineraryConflicts: input.notifyItineraryConflicts }
        : {}),
    },
  });

  return serializeProfile(user);
}

/**
 * Deactivates the account.
 *
 * Data is retained but unreachable rather than hard-deleted, because other
 * travellers may have copied this user's public itineraries and a dangling
 * reference would break their trips. The email is released so it can be reused,
 * and every public itinerary is unshared.
 */
export async function deleteAccount(userId: string, input: DeleteAccountInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('We could not find your account.');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw ApiError.badRequest('That password is incorrect.');

  await prisma.$transaction([
    prisma.trip.updateMany({
      where: { userId },
      data: { isPublic: false, publicSlug: null },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.savedDestination.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        // Release the address so the person could register again later.
        email: `deleted-${userId}@removed.globetrotter.app`,
        avatar: null,
        name: 'Deleted traveller',
        tripsPublicByDefault: false,
      },
    }),
  ]);
}
