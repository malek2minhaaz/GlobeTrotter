import type { ActivityCategory, ItineraryItem, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { parseDateOnly, timeToMinutes, toDateOnly } from '../utils/dates';
import {
  detectConflicts,
  toSchedulable,
  type Conflict,
  type ScheduleBounds,
} from './conflict.service';
import { cityLiteSelect, requireOwnedTrip } from './trip.service';
import type {
  createItineraryItemSchema,
  createStopSchema,
  reorderItinerarySchema,
  updateItineraryItemSchema,
  updateStopSchema,
} from '../validators/trip.validators';

/**
 * Item responses always carry their owning stop's city, so a client that just
 * added an activity to a day can label it without another request.
 */
const itemInclude = {
  activity: true,
  tripStop: { include: { city: { select: cityLiteSelect } } },
} satisfies Prisma.ItineraryItemInclude;

type CreateStopInput = z.infer<typeof createStopSchema>;
type UpdateStopInput = z.infer<typeof updateStopSchema>;
type CreateItemInput = z.infer<typeof createItineraryItemSchema>;
type UpdateItemInput = z.infer<typeof updateItineraryItemSchema>;
type ReorderInput = z.infer<typeof reorderItinerarySchema>;

// ── Schedule loading ─────────────────────────────────────────────────────────

interface Schedule {
  tripStart: Date;
  tripEnd: Date;
  stops: Array<{ id: string; startDate: Date; endDate: Date; cityName: string; cityId: string }>;
  items: ItineraryItem[];
}

async function loadSchedule(tripId: string): Promise<Schedule> {
  const [trip, stops, items] = await Promise.all([
    prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { startDate: true, endDate: true },
    }),
    prisma.tripStop.findMany({
      where: { tripId },
      include: { city: { select: { id: true, name: true } } },
      orderBy: { order: 'asc' },
    }),
    prisma.itineraryItem.findMany({ where: { tripId } }),
  ]);

  return {
    tripStart: trip.startDate,
    tripEnd: trip.endDate,
    stops: stops.map((stop) => ({
      id: stop.id,
      startDate: stop.startDate,
      endDate: stop.endDate,
      cityName: stop.city.name,
      cityId: stop.cityId,
    })),
    items,
  };
}

function boundsOf(schedule: Schedule): ScheduleBounds {
  return {
    tripStart: schedule.tripStart,
    tripEnd: schedule.tripEnd,
    stops: schedule.stops.map((stop) => ({
      id: stop.id,
      startDate: stop.startDate,
      endDate: stop.endDate,
      cityName: stop.cityName,
    })),
  };
}

/** Which city stay covers a given day. */
function stopForDate(schedule: Schedule, date: Date) {
  return schedule.stops.find(
    (stop) => date.getTime() >= stop.startDate.getTime() && date.getTime() <= stop.endDate.getTime(),
  );
}

/** Partitions detected conflicts so callers can decide what is fatal. */
function partition(conflicts: Conflict[]) {
  return {
    blocking: conflicts.filter((conflict) => conflict.severity === 'error'),
    warnings: conflicts.filter((conflict) => conflict.severity === 'warning'),
  };
}

// ── Stops ────────────────────────────────────────────────────────────────────

export async function addStop(userId: string, tripId: string, input: CreateStopInput) {
  await requireOwnedTrip(userId, tripId);
  const schedule = await loadSchedule(tripId);

  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);

  if (endDate.getTime() < startDate.getTime()) {
    throw ApiError.validation('The end date cannot be before the start date.', {
      endDate: ['The end date cannot be before the start date.'],
    });
  }
  if (
    startDate.getTime() < schedule.tripStart.getTime() ||
    endDate.getTime() > schedule.tripEnd.getTime()
  ) {
    throw ApiError.validation('Those dates fall outside the trip window.', {
      startDate: ['Keep city dates inside the trip dates.'],
    });
  }

  const city = await prisma.city.findUnique({ where: { id: input.cityId }, select: { name: true } });
  if (!city) throw ApiError.badRequest('That city could not be found.');

  if (schedule.stops.some((stop) => stop.cityId === input.cityId)) {
    throw ApiError.conflict(`${city.name} is already part of this trip.`);
  }

  // A city stay may not overlap another city stay.
  const clash = schedule.stops.find(
    (stop) =>
      startDate.getTime() <= stop.endDate.getTime() && stop.startDate.getTime() <= endDate.getTime(),
  );
  if (clash) {
    throw ApiError.conflict(
      `Those dates overlap your stay in ${clash.cityName}. Pick a window that does not clash.`,
    );
  }

  const order = input.order ?? schedule.stops.length;

  return prisma.tripStop.create({
    data: { tripId, cityId: input.cityId, startDate, endDate, order },
    include: { city: true },
  });
}

export async function updateStop(userId: string, stopId: string, input: UpdateStopInput) {
  const stop = await prisma.tripStop.findUnique({ where: { id: stopId } });
  if (!stop) throw ApiError.notFound('That city stay no longer exists.');
  await requireOwnedTrip(userId, stop.tripId);

  const schedule = await loadSchedule(stop.tripId);
  const startDate = input.startDate ? parseDateOnly(input.startDate) : stop.startDate;
  const endDate = input.endDate ? parseDateOnly(input.endDate) : stop.endDate;

  if (endDate.getTime() < startDate.getTime()) {
    throw ApiError.validation('The end date cannot be before the start date.', {
      endDate: ['The end date cannot be before the start date.'],
    });
  }
  if (
    startDate.getTime() < schedule.tripStart.getTime() ||
    endDate.getTime() > schedule.tripEnd.getTime()
  ) {
    throw ApiError.validation('Those dates fall outside the trip window.', {
      startDate: ['Keep city dates inside the trip dates.'],
    });
  }

  const clash = schedule.stops.find(
    (other) =>
      other.id !== stopId &&
      startDate.getTime() <= other.endDate.getTime() &&
      other.startDate.getTime() <= endDate.getTime(),
  );
  if (clash) {
    throw ApiError.conflict(`Those dates overlap your stay in ${clash.cityName}.`);
  }

  // Moving a city stay can orphan entries scheduled inside its old window.
  const orphan = await prisma.itineraryItem.findFirst({
    where: {
      tripStopId: stopId,
      OR: [{ date: { lt: startDate } }, { date: { gt: endDate } }],
    },
    select: { title: true, date: true },
  });
  if (orphan) {
    throw ApiError.conflict(
      `"${orphan.title}" would fall outside the new dates for this city. Move or remove it first.`,
    );
  }

  return prisma.tripStop.update({
    where: { id: stopId },
    data: { startDate, endDate, ...(input.order !== undefined ? { order: input.order } : {}) },
    include: { city: true },
  });
}

export async function deleteStop(userId: string, stopId: string) {
  const stop = await prisma.tripStop.findUnique({ where: { id: stopId } });
  if (!stop) throw ApiError.notFound('That city stay no longer exists.');
  await requireOwnedTrip(userId, stop.tripId);

  // Removing a city removes the entries planned inside it, so confirm explicitly.
  const itemCount = await prisma.itineraryItem.count({ where: { tripStopId: stopId } });
  if (itemCount > 0) {
    await prisma.itineraryItem.deleteMany({ where: { tripStopId: stopId } });
  }

  await prisma.tripStop.delete({ where: { id: stopId } });

  // Close the gap left in the ordering.
  const remaining = await prisma.tripStop.findMany({
    where: { tripId: stop.tripId },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((row, index) =>
      prisma.tripStop.update({ where: { id: row.id }, data: { order: index } }),
    ),
  );

  return { removedItems: itemCount };
}

export async function reorderStops(userId: string, tripId: string, stopIds: string[]) {
  await requireOwnedTrip(userId, tripId);
  const stops = await prisma.tripStop.findMany({ where: { tripId }, select: { id: true } });
  const known = new Set(stops.map((stop) => stop.id));

  if (stopIds.length !== stops.length || stopIds.some((id) => !known.has(id))) {
    throw ApiError.badRequest('That ordering does not match the cities in this trip.');
  }

  await prisma.$transaction(
    stopIds.map((id, index) => prisma.tripStop.update({ where: { id }, data: { order: index } })),
  );

  return { reordered: stopIds.length };
}

// ── Itinerary items ──────────────────────────────────────────────────────────

async function resolveStopAndActivity(
  schedule: Schedule,
  date: Date,
  activityId: string | null | undefined,
  // Nullable because an optional body field may be sent as an empty string.
  requestedStopId: string | null | undefined,
) {
  const stop =
    (requestedStopId ? schedule.stops.find((candidate) => candidate.id === requestedStopId) : null) ??
    stopForDate(schedule, date);

  if (!stop) {
    throw ApiError.validation(
      'No city in this trip covers that date. Add a city for those days first.',
      { date: ['No city covers this date.'] },
    );
  }

  if (!activityId) return { stop, activity: null };

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, name: true, category: true, cityId: true, estimatedCost: true },
  });
  if (!activity) throw ApiError.badRequest('That activity could not be found.');

  if (activity.cityId !== stop.cityId) {
    throw ApiError.validation(
      `"${activity.name}" is in a different city than this day of the trip.`,
      { activityId: ['This activity belongs to another city.'] },
    );
  }

  return { stop, activity };
}

export async function addItineraryItem(userId: string, tripId: string, input: CreateItemInput) {
  await requireOwnedTrip(userId, tripId);
  const schedule = await loadSchedule(tripId);
  const date = parseDateOnly(input.date);

  const { stop, activity } = await resolveStopAndActivity(
    schedule,
    date,
    input.activityId,
    input.tripStopId,
  );

  const startTime = input.startTime;
  const endTime = input.endTime ?? null;

  // Check the proposal against both persisted entries and itself.
  const proposal = {
    id: '__new__',
    title: activity?.name ?? input.title ?? 'New activity',
    date,
    startTime,
    endTime,
    tripStopId: stop.id,
  };
  const conflicts = detectConflicts(
    [...schedule.items.map(toSchedulable), proposal],
    boundsOf(schedule),
  );
  const { blocking, warnings } = partition(conflicts);

  if (blocking.length > 0) {
    throw ApiError.validation(blocking[0].message, { conflicts: blocking });
  }
  const overlaps = warnings.filter((conflict) => conflict.itemIds.includes('__new__'));
  if (overlaps.length > 0 && !input.allowOverlap) {
    throw ApiError.conflict(overlaps[0].message, { conflicts: overlaps });
  }

  const sameSlot = await prisma.itineraryItem.findMany({
    where: { tripId, date },
    select: { order: true },
  });
  const nextOrder =
    sameSlot.length === 0 ? 0 : Math.max(...sameSlot.map((row) => row.order)) + 1;

  const created = await prisma.itineraryItem.create({
    data: {
      tripStopId: stop.id,
      tripId,
      activityId: activity?.id ?? null,
      title: activity?.name ?? input.title ?? 'Activity',
      category: (activity?.category ?? input.category ?? null) as ActivityCategory | null,
      date,
      startTime,
      endTime,
      notes: input.notes ?? null,
      order: nextOrder,
      customCost: input.customCost ?? null,
    },
    include: itemInclude,
  });

  return { item: created, warnings: overlaps };
}

export async function updateItineraryItem(userId: string, itemId: string, input: UpdateItemInput) {
  const existing = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
  if (!existing) throw ApiError.notFound('That itinerary entry no longer exists.');
  await requireOwnedTrip(userId, existing.tripId);

  const schedule = await loadSchedule(existing.tripId);
  const date = input.date ? parseDateOnly(input.date) : existing.date;
  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime !== undefined ? input.endTime : existing.endTime;

  if (endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw ApiError.validation('The end time must be after the start time.', {
      endTime: ['The end time must be after the start time.'],
    });
  }

  const targetStop =
    (input.tripStopId ? schedule.stops.find((stop) => stop.id === input.tripStopId) : null) ??
    (input.date ? stopForDate(schedule, date) : null) ??
    schedule.stops.find((stop) => stop.id === existing.tripStopId);

  if (!targetStop) {
    throw ApiError.validation('No city in this trip covers that date.', {
      date: ['No city covers this date.'],
    });
  }

  const others = schedule.items.filter((item) => item.id !== itemId).map(toSchedulable);
  const proposal = {
    id: itemId,
    title: input.title ?? existing.title,
    date,
    startTime,
    endTime,
    tripStopId: targetStop.id,
  };

  const conflicts = detectConflicts([...others, proposal], boundsOf(schedule));
  const { blocking, warnings } = partition(conflicts);

  if (blocking.length > 0) throw ApiError.validation(blocking[0].message, { conflicts: blocking });
  const overlaps = warnings.filter((conflict) => conflict.itemIds.includes(itemId));
  if (overlaps.length > 0 && !input.allowOverlap) {
    throw ApiError.conflict(overlaps[0].message, { conflicts: overlaps });
  }

  // Only activities in the destination city may be attached.
  if (input.activityId) {
    const activity = await prisma.activity.findUnique({
      where: { id: input.activityId },
      select: { cityId: true, name: true, category: true },
    });
    if (!activity) throw ApiError.badRequest('That activity could not be found.');
    if (activity.cityId !== targetStop.cityId) {
      throw ApiError.validation(`"${activity.name}" belongs to a different city.`, {
        activityId: ['This activity belongs to another city.'],
      });
    }
  }

  const updated = await prisma.itineraryItem.update({
    where: { id: itemId },
    data: {
      date,
      startTime,
      endTime,
      tripStopId: targetStop.id,
      // `title` is a non-nullable column, so null must mean "leave unchanged".
      ...(input.title != null ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.customCost !== undefined ? { customCost: input.customCost } : {}),
      ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
    },
    include: itemInclude,
  });

  return { item: updated, warnings: overlaps };
}

export async function deleteItineraryItem(userId: string, itemId: string) {
  const existing = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
  if (!existing) throw ApiError.notFound('That itinerary entry no longer exists.');
  await requireOwnedTrip(userId, existing.tripId);

  await prisma.itineraryItem.delete({ where: { id: itemId } });

  // Re-pack the remaining entries for that day so order stays dense.
  const remaining = await prisma.itineraryItem.findMany({
    where: { tripId: existing.tripId, date: existing.date },
    orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((row, index) =>
      prisma.itineraryItem.update({ where: { id: row.id }, data: { order: index } }),
    ),
  );
}

/**
 * Applies a drag-and-drop reorder. Items may move within a day or onto a
 * different day, which is why the date (and therefore the owning city) is
 * re-resolved for anything that changed day.
 */
export async function reorderItinerary(userId: string, tripId: string, input: ReorderInput) {
  await requireOwnedTrip(userId, tripId);
  const schedule = await loadSchedule(tripId);
  const known = new Map(schedule.items.map((item) => [item.id, item]));

  // The "unchecked" variant is the one that exposes scalar foreign keys such as
  // `tripStopId` directly, which is exactly what a move between cities needs.
  const pending: Array<{ id: string; data: Prisma.ItineraryItemUncheckedUpdateInput }> = [];

  for (const change of input.items) {
    const existing = known.get(change.id);
    if (!existing) throw ApiError.badRequest('One of those entries is not part of this trip.');

    const date = change.date ? parseDateOnly(change.date) : existing.date;
    const stop = stopForDate(schedule, date);
    if (!stop) {
      throw ApiError.validation('One of those entries would fall outside every city stay.', {
        items: ['Move it inside a city window.'],
      });
    }

    pending.push({
      id: change.id,
      data: {
        order: change.order,
        date,
        tripStopId: stop.id,
        ...(change.startTime ? { startTime: change.startTime } : {}),
        ...(change.endTime !== undefined ? { endTime: change.endTime } : {}),
      },
    });
  }

  const ids = pending.map((change) => change.id);

  // Applied atomically: a partial reorder would leave the day in a mixed state.
  await prisma.$transaction(
    pending.map((change) =>
      prisma.itineraryItem.update({ where: { id: change.id }, data: change.data }),
    ),
  );

  // Report whatever the new arrangement clashes with, without blocking the move.
  const refreshed = await prisma.itineraryItem.findMany({ where: { tripId } });
  const conflicts = detectConflicts(refreshed.map(toSchedulable), boundsOf(schedule));

  return {
    updated: ids.length,
    conflicts: conflicts.filter((conflict) =>
      conflict.type === 'OVERLAP' && conflict.itemIds.some((id) => ids.includes(id)),
    ),
  };
}

/**
 * Convenience wrapper for `POST /api/stops/:id/activities`: the client picks a
 * stop and an activity, and the date defaults to the first day of that city.
 */
export async function addActivityToStop(
  userId: string,
  stopId: string,
  input: {
    activityId: string;
    date?: string;
    startTime?: string;
    endTime?: string | null;
    notes?: string | null;
    customCost?: number | null;
    allowOverlap?: boolean;
  },
) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { tripId: true, startDate: true },
  });
  if (!stop) throw ApiError.notFound('That city stay no longer exists.');
  await requireOwnedTrip(userId, stop.tripId);

  return addItineraryItem(userId, stop.tripId, {
    activityId: input.activityId,
    date: input.date ?? toDateOnly(stop.startDate),
    startTime: input.startTime ?? '10:00',
    endTime: input.endTime ?? null,
    notes: input.notes ?? null,
    customCost: input.customCost ?? null,
    tripStopId: stopId,
    allowOverlap: input.allowOverlap ?? false,
  });
}

/** Activities in the city this stop belongs to, for the builder's search panel. */
export async function listStopActivities(userId: string, stopId: string) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { cityId: true, tripId: true },
  });
  if (!stop) throw ApiError.notFound('That city stay no longer exists.');
  await requireOwnedTrip(userId, stop.tripId);

  return prisma.activity.findMany({
    where: { cityId: stop.cityId },
    orderBy: { popularity: 'desc' },
  });
}

/** Full conflict report for a trip, including non-overlap violations. */
export async function getTripConflicts(userId: string, tripId: string) {
  await requireOwnedTrip(userId, tripId);
  const schedule = await loadSchedule(tripId);
  return detectConflicts(schedule.items.map(toSchedulable), boundsOf(schedule));
}
