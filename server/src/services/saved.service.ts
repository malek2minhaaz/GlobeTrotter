import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { serializeCity, serializeSavedDestination } from '../utils/serializers';

export async function listSavedDestinations(
  userId: string,
  options: { q?: string; page: number; pageSize: number; sort: Prisma.SortOrder },
) {
  const where: Prisma.SavedDestinationWhereInput = {
    userId,
    ...(options.q
      ? {
          city: {
            OR: [
              { name: { contains: options.q, mode: 'insensitive' } },
              { country: { contains: options.q, mode: 'insensitive' } },
              { region: { contains: options.q, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.savedDestination.count({ where }),
    prisma.savedDestination.findMany({
      where,
      include: { city: true },
      orderBy: { createdAt: options.sort },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
  ]);

  return {
    items: rows.map(serializeSavedDestination),
    meta: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / options.pageSize), 1),
    },
  };
}

/**
 * Bookmarks a city. Idempotent: saving an already-saved city returns the existing
 * row rather than erroring, so a double tap cannot fail.
 */
export async function saveDestination(userId: string, cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw ApiError.notFound('That destination does not exist.');

  const saved = await prisma.savedDestination.upsert({
    where: { userId_cityId: { userId, cityId } },
    create: { userId, cityId },
    update: {},
    include: { city: true },
  });

  return serializeSavedDestination(saved);
}

export async function removeSavedDestination(userId: string, cityId: string) {
  const existing = await prisma.savedDestination.findUnique({
    where: { userId_cityId: { userId, cityId } },
  });
  if (!existing) throw ApiError.notFound('That destination is not in your saved list.');

  await prisma.savedDestination.delete({ where: { id: existing.id } });
}

/** Lightweight check used by city cards to render the bookmark state. */
export async function isCitySaved(userId: string, cityId: string) {
  const saved = await prisma.savedDestination.findUnique({
    where: { userId_cityId: { userId, cityId } },
    select: { id: true },
  });
  return Boolean(saved);
}

export async function listSavedCityIds(userId: string) {
  const rows = await prisma.savedDestination.findMany({
    where: { userId },
    select: { cityId: true },
  });
  return rows.map((row) => row.cityId);
}

export { serializeCity };
