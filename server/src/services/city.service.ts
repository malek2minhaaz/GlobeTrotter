import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { serializeActivity, serializeCity } from '../utils/serializers';
import type { listCitiesQuerySchema } from '../validators/discovery.validators';

type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;

export async function listCities(userId: string | null, query: ListCitiesQuery) {
  const where: Prisma.CityWhereInput = {};

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { country: { contains: query.q, mode: 'insensitive' } },
      { region: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  if (query.country) where.country = { equals: query.country, mode: 'insensitive' };
  if (query.region) where.region = { equals: query.region, mode: 'insensitive' };
  if (query.minPopularity !== undefined) where.popularity = { gte: query.minPopularity };
  if (query.minCostIndex !== undefined || query.maxCostIndex !== undefined) {
    where.costIndex = {
      ...(query.minCostIndex !== undefined ? { gte: query.minCostIndex } : {}),
      ...(query.maxCostIndex !== undefined ? { lte: query.maxCostIndex } : {}),
    };
  }

  const dir: Prisma.SortOrder = query.sort;
  const orderBy: Prisma.CityOrderByWithRelationInput =
    query.sortBy === 'name'
      ? { name: dir }
      : query.sortBy === 'costIndex' || query.sortBy === 'estimatedDailyCost'
        ? { costIndex: dir }
        : { popularity: dir };

  const [total, cities, saved] = await Promise.all([
    prisma.city.count({ where }),
    prisma.city.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    userId
      ? prisma.savedDestination.findMany({ where: { userId }, select: { cityId: true } })
      : Promise.resolve([] as Array<{ cityId: string }>),
  ]);

  const savedIds = new Set(saved.map((row) => row.cityId));

  return {
    items: cities.map((city) => ({ ...serializeCity(city), isSaved: savedIds.has(city.id) })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
    },
  };
}

/** Filter options for the discovery sidebar, derived from the data itself. */
export async function getDiscoveryFacets() {
  const [countries, regions, costRange, top] = await Promise.all([
    prisma.city.groupBy({ by: ['country'], _count: { _all: true }, orderBy: { country: 'asc' } }),
    prisma.city.groupBy({ by: ['region'], _count: { _all: true }, orderBy: { region: 'asc' } }),
    prisma.city.aggregate({ _min: { costIndex: true }, _max: { costIndex: true } }),
    prisma.city.findMany({
      orderBy: { popularity: 'desc' },
      take: 8,
      select: { id: true, name: true, country: true, image: true },
    }),
  ]);

  return {
    countries: countries.map((row) => ({ value: row.country, count: row._count._all })),
    regions: regions.map((row) => ({ value: row.region, count: row._count._all })),
    costIndexRange: {
      min: costRange._min.costIndex ?? 0,
      max: costRange._max.costIndex ?? 3,
    },
    popular: top,
  };
}

export async function getCityDetail(userId: string | null, cityId: string) {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { activities: { orderBy: { popularity: 'desc' } } },
  });

  if (!city) throw ApiError.notFound('We could not find that destination.');

  const saved = userId
    ? await prisma.savedDestination.findUnique({
        where: { userId_cityId: { userId, cityId } },
        select: { id: true },
      })
    : null;

  return {
    ...serializeCity(city),
    isSaved: Boolean(saved),
    activityCount: city.activities.length,
    activities: city.activities.map(serializeActivity),
    /** Highest-rated experiences, used for the "don't miss" strip. */
    highlights: city.activities.slice(0, 3).map(serializeActivity),
  };
}

/** Popular destinations for the landing page and dashboard rails. */
export async function getPopularCities(limit = 8) {
  const cities = await prisma.city.findMany({
    orderBy: { popularity: 'desc' },
    take: limit,
  });
  return cities.map(serializeCity);
}
