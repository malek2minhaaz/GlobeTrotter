import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { buildPublicSlug } from '../utils/slug';
import { parseDateOnly, todayUTC, toDateOnly } from '../utils/dates';
import {
  serializeTripDetail,
  serializeTripListItem,
  type TripRelations,
} from '../utils/serializers';
import type {
  createTripSchema,
  listTripsQuerySchema,
  updateTripSchema,
} from '../validators/trip.validators';

type CreateTripInput = z.infer<typeof createTripSchema>;
type UpdateTripInput = z.infer<typeof updateTripSchema>;
type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;

// ── Shared include shapes ────────────────────────────────────────────────────

export const cityLiteSelect = {
  id: true,
  name: true,
  country: true,
  image: true,
  costIndex: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.CitySelect;

/** Everything a trip card needs, including the data behind `estimatedCost`. */
export const tripListInclude = {
  stops: { orderBy: { order: 'asc' }, include: { city: { select: cityLiteSelect } } },
  expenses: { select: { category: true, amount: true } },
  itineraryItems: {
    select: { customCost: true, category: true, activity: { select: { estimatedCost: true } } },
  },
} satisfies Prisma.TripInclude;

/** Full workspace payload: stops, scheduled entries and logged expenses. */
const tripDetailInclude = {
  user: { select: { id: true, name: true, avatar: true } },
  stops: {
    orderBy: { order: 'asc' },
    include: {
      city: { select: cityLiteSelect },
      itineraryItems: {
        include: { activity: true },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      },
    },
  },
  expenses: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.TripInclude;

// ── Guards ───────────────────────────────────────────────────────────────────

/**
 * Loads a trip and asserts the caller owns it. Returning 404 rather than 403 for
 * someone else's private trip avoids confirming that the id exists.
 */
export async function requireOwnedTrip(userId: string, tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.userId !== userId) {
    throw ApiError.notFound('That trip does not exist.');
  }
  return trip;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listTrips(userId: string, query: ListTripsQuery) {
  const today = todayUTC();
  const where: Prisma.TripWhereInput = { userId };

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { stops: { some: { city: { name: { contains: query.q, mode: 'insensitive' } } } } },
      { stops: { some: { city: { country: { contains: query.q, mode: 'insensitive' } } } } },
    ];
  }

  // Status is derived from dates, so it is expressed as a date predicate.
  if (query.status === 'UPCOMING') where.startDate = { gt: today };
  if (query.status === 'ONGOING') {
    where.startDate = { lte: today };
    where.endDate = { gte: today };
  }
  if (query.status === 'COMPLETED') where.endDate = { lt: today };

  if (query.visibility === 'PUBLIC') where.isPublic = true;
  if (query.visibility === 'PRIVATE') where.isPublic = false;

  const dir: Prisma.SortOrder = query.sort;
  const orderBy: Prisma.TripOrderByWithRelationInput =
    query.sortBy === 'name'
      ? { name: dir }
      : query.sortBy === 'createdAt'
        ? { createdAt: dir }
        : { startDate: dir };

  // Sorting by cost has to happen after serialization because the total is
  // derived from itinerary items and expenses.
  if (query.sortBy === 'cost') {
    const all = await prisma.trip.findMany({ where, include: tripListInclude });
    const serialized = all.map((trip) => serializeTripListItem(trip, trip as TripRelations));
    serialized.sort((a, b) =>
      query.sort === 'asc' ? a.estimatedCost - b.estimatedCost : b.estimatedCost - a.estimatedCost,
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: serialized.slice(start, start + query.pageSize),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: serialized.length,
        totalPages: Math.max(Math.ceil(serialized.length / query.pageSize), 1),
      },
    };
  }

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      include: tripListInclude,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: trips.map((trip) => serializeTripListItem(trip, trip as TripRelations)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
    },
  };
}

export async function getTripDetail(userId: string, tripId: string) {
  await requireOwnedTrip(userId, tripId);
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripDetailInclude,
  });
  return serializeTripDetail(trip, trip as never);
}

export async function getPublicTripBySlug(slug: string) {
  const trip = await prisma.trip.findUnique({
    where: { publicSlug: slug },
    include: tripDetailInclude,
  });

  if (!trip || !trip.isPublic) {
    throw ApiError.notFound('That shared itinerary is no longer available.');
  }
  return trip;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Validates a proposed set of city stays against the trip window: every stay must
 * sit inside the trip, and stays may not overlap each other.
 */
function validateStopsAgainstTrip(
  tripStart: Date,
  tripEnd: Date,
  stops: Array<{ cityId: string; startDate: string; endDate: string }>,
  cityNames: Map<string, string>,
) {
  const parsed = stops.map((stop) => ({
    cityId: stop.cityId,
    cityName: cityNames.get(stop.cityId) ?? 'A city',
    start: parseDateOnly(stop.startDate),
    end: parseDateOnly(stop.endDate),
  }));

  for (const stop of parsed) {
    if (stop.start.getTime() < tripStart.getTime() || stop.end.getTime() > tripEnd.getTime()) {
      throw ApiError.validation(
        `${stop.cityName} falls outside the trip dates (${toDateOnly(tripStart)} to ${toDateOnly(tripEnd)}).`,
        { stops: [`${stop.cityName} is outside the trip dates.`] },
      );
    }
  }

  const ordered = [...parsed].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.start.getTime() <= previous.end.getTime()) {
      throw ApiError.validation(
        `Your stays in ${previous.cityName} and ${current.cityName} overlap. Adjust the dates so each city has its own window.`,
        { stops: [`${previous.cityName} and ${current.cityName} overlap.`] },
      );
    }
  }

  return ordered.map((stop, index) => ({
    cityId: stop.cityId,
    startDate: stop.start,
    endDate: stop.end,
    order: index,
  }));
}

export async function createTrip(userId: string, input: CreateTripInput) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);

  let stopsToCreate: Array<{ cityId: string; startDate: Date; endDate: Date; order: number }> = [];

  if (input.stops.length > 0) {
    const cities = await prisma.city.findMany({
      where: { id: { in: input.stops.map((stop) => stop.cityId) } },
      select: { id: true, name: true },
    });
    if (cities.length !== new Set(input.stops.map((s) => s.cityId)).size) {
      throw ApiError.badRequest('One or more selected cities could not be found.');
    }
    const cityNames = new Map(cities.map((city) => [city.id, city.name]));
    stopsToCreate = validateStopsAgainstTrip(startDate, endDate, input.stops, cityNames);
  }

  const trip = await prisma.trip.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      coverImage: input.coverImage ?? null,
      startDate,
      endDate,
      isPublic: input.isPublic ?? false,
      publicSlug: input.isPublic ? buildPublicSlug(input.name) : null,
      budgetLimit: input.budgetLimit ?? null,
      stops: stopsToCreate.length > 0 ? { create: stopsToCreate } : undefined,
    },
    include: tripDetailInclude,
  });

  return serializeTripDetail(trip, trip as never);
}

export async function updateTrip(userId: string, tripId: string, input: UpdateTripInput) {
  const existing = await requireOwnedTrip(userId, tripId);

  const startDate = input.startDate ? parseDateOnly(input.startDate) : existing.startDate;
  const endDate = input.endDate ? parseDateOnly(input.endDate) : existing.endDate;

  if (endDate.getTime() < startDate.getTime()) {
    throw ApiError.validation('The end date cannot be before the start date.', {
      endDate: ['The end date cannot be before the start date.'],
    });
  }

  // Shrinking a trip can orphan city stays; surface that instead of silently
  // leaving stops outside the window.
  if (input.startDate || input.endDate) {
    const stops = await prisma.tripStop.findMany({
      where: { tripId },
      include: { city: { select: { name: true } } },
    });
    const orphan = stops.find(
      (stop) => stop.startDate.getTime() < startDate.getTime() || stop.endDate.getTime() > endDate.getTime(),
    );
    if (orphan) {
      throw ApiError.conflict(
        `Your stay in ${orphan.city.name} (${toDateOnly(orphan.startDate)}–${toDateOnly(orphan.endDate)}) would fall outside the new trip dates. Adjust the city dates first.`,
        { stops: [`${orphan.city.name} would be outside the trip.`] },
      );
    }
  }

  const isPublic = input.isPublic ?? existing.isPublic;

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      startDate,
      endDate,
      isPublic,
      // Generate a slug the first time a trip is shared; keep it stable after.
      publicSlug: isPublic ? (existing.publicSlug ?? buildPublicSlug(input.name ?? existing.name)) : null,
      ...(input.budgetLimit !== undefined ? { budgetLimit: input.budgetLimit } : {}),
    },
    include: tripDetailInclude,
  });

  return serializeTripDetail(trip, trip as never);
}

export async function deleteTrip(userId: string, tripId: string) {
  await requireOwnedTrip(userId, tripId);
  // Related stops, items and expenses cascade at the database level.
  await prisma.trip.delete({ where: { id: tripId } });
}

export async function setTripVisibility(userId: string, tripId: string, isPublic: boolean) {
  const existing = await requireOwnedTrip(userId, tripId);

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      isPublic,
      publicSlug: isPublic
        ? (existing.publicSlug ?? buildPublicSlug(existing.name))
        : null,
    },
    include: tripDetailInclude,
  });

  return serializeTripDetail(trip, trip as never);
}

/** Increments the public view counter without failing the page render. */
export async function recordTripView(tripId: string) {
  try {
    await prisma.trip.update({ where: { id: tripId }, data: { viewCount: { increment: 1 } } });
  } catch {
    // View counting is best-effort telemetry and must never break a page load.
  }
}

/**
 * Deep-copies a public itinerary into the caller's account (Section 21).
 * The original is never touched, and the copy is private so the traveller can
 * edit it before choosing to share.
 */
export async function copyTripFromSlug(userId: string, slug: string) {
  const source = await prisma.trip.findUnique({
    where: { publicSlug: slug },
    include: {
      stops: {
        orderBy: { order: 'asc' },
        include: { itineraryItems: { orderBy: [{ date: 'asc' }, { startTime: 'asc' }] } },
      },
      expenses: true,
    },
  });

  if (!source || !source.isPublic) {
    throw ApiError.notFound('That shared itinerary is no longer available to copy.');
  }
  if (source.userId === userId) {
    throw ApiError.conflict('This itinerary is already yours — open it from My Trips to edit.');
  }

  return prisma.$transaction(async (tx) => {
    const copy = await tx.trip.create({
      data: {
        userId,
        name: `${source.name} (copy)`,
        description: source.description,
        coverImage: source.coverImage,
        startDate: source.startDate,
        endDate: source.endDate,
        isPublic: false,
        publicSlug: null,
        budgetLimit: source.budgetLimit,
        sourceTripId: source.id,
      },
    });

    // Rebuild stops and remap itinerary items onto the new stop ids.
    for (const stop of source.stops) {
      const newStop = await tx.tripStop.create({
        data: {
          tripId: copy.id,
          cityId: stop.cityId,
          startDate: stop.startDate,
          endDate: stop.endDate,
          order: stop.order,
        },
      });

      if (stop.itineraryItems.length > 0) {
        await tx.itineraryItem.createMany({
          data: stop.itineraryItems.map((item) => ({
            tripStopId: newStop.id,
            tripId: copy.id,
            activityId: item.activityId,
            title: item.title,
            category: item.category,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            notes: item.notes,
            order: item.order,
            customCost: item.customCost,
          })),
        });
      }
    }

    if (source.expenses.length > 0) {
      await tx.expense.createMany({
        data: source.expenses.map((expense) => ({
          tripId: copy.id,
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
        })),
      });
    }

    const created = await tx.trip.findUniqueOrThrow({
      where: { id: copy.id },
      include: tripDetailInclude,
    });

    return serializeTripDetail(created, created as never);
  });
}
