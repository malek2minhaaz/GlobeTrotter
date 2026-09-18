import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { serializeActivity } from '../utils/serializers';
import type { listActivitiesQuerySchema } from '../validators/discovery.validators';

type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export async function listActivities(query: ListActivitiesQuery) {
  const where: Prisma.ActivityWhereInput = {};

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { city: { name: { contains: query.q, mode: 'insensitive' } } },
    ];
  }
  if (query.cityId) where.cityId = query.cityId;
  if (query.category) where.category = query.category;
  if (query.maxDuration !== undefined) where.duration = { lte: query.maxDuration };
  if (query.minCost !== undefined || query.maxCost !== undefined) {
    where.estimatedCost = {
      ...(query.minCost !== undefined ? { gte: query.minCost } : {}),
      ...(query.maxCost !== undefined ? { lte: query.maxCost } : {}),
    };
  }

  const dir: Prisma.SortOrder = query.sort;
  const orderBy: Prisma.ActivityOrderByWithRelationInput =
    query.sortBy === 'name'
      ? { name: dir }
      : query.sortBy === 'estimatedCost'
        ? { estimatedCost: dir }
        : query.sortBy === 'duration'
          ? { duration: dir }
          : { popularity: dir };

  const [total, activities] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: { city: { select: { id: true, name: true, country: true, image: true } } },
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: activities.map((activity) => ({
      ...serializeActivity(activity),
      city: {
        id: activity.city.id,
        name: activity.city.name,
        country: activity.city.country,
        image: activity.city.image,
      },
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
    },
  };
}

/** Activities for one city, used by the city detail page. */
export async function listActivitiesForCity(cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
  if (!city) throw ApiError.notFound('We could not find that destination.');

  const activities = await prisma.activity.findMany({
    where: { cityId },
    orderBy: { popularity: 'desc' },
  });
  return activities.map(serializeActivity);
}

export async function getActivityDetail(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { city: true },
  });
  if (!activity) throw ApiError.notFound('We could not find that activity.');

  return {
    ...serializeActivity(activity),
    city: {
      id: activity.city.id,
      name: activity.city.name,
      country: activity.city.country,
      image: activity.city.image,
      costIndex: activity.city.costIndex,
    },
  };
}
