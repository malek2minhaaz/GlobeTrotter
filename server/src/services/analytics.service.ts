import { prisma } from '../lib/prisma';
import { toDateOnly } from '../utils/dates';
import { serializeTripListItem, serializeCity } from '../utils/serializers';
import type { TripRelations } from '../utils/serializers';
import { getNotifications } from './notification.service';
import { tripListInclude } from './trip.service';
import { getPopularCities } from './city.service';

/** Dashboard hub data (Sections 9 and 39). */
export async function getDashboard(userId: string) {
  const [trips, savedRows, savedCount, popularDestinations, notifications] = await Promise.all([
    prisma.trip.findMany({
      where: { userId },
      include: tripListInclude,
      orderBy: { startDate: 'asc' },
    }),
    prisma.savedDestination.findMany({
      where: { userId },
      include: { city: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.savedDestination.count({ where: { userId } }),
    getPopularCities(8),
    getNotifications(userId, 5),
  ]);

  const serialized = trips.map((trip) => serializeTripListItem(trip, trip as TripRelations));

  const upcoming = serialized
    .filter((trip) => trip.status === 'UPCOMING')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ongoing = serialized.filter((trip) => trip.status === 'ONGOING');
  const completed = serialized.filter((trip) => trip.status === 'COMPLETED');

  const allCityIds = new Set(serialized.flatMap((trip) => trip.cities.map((city) => city.id)));
  const visitedCityIds = new Set(
    [...ongoing, ...completed].flatMap((trip) => trip.cities.map((city) => city.id)),
  );

  const plannedDays = serialized.reduce((sum, trip) => sum + trip.plannedDays, 0);
  const estimatedTotalCost = serialized.reduce((sum, trip) => sum + trip.estimatedCost, 0);
  const activityCount = serialized.reduce((sum, trip) => sum + trip.activityCount, 0);

  // "Up next" prefers a trip already under way, then the soonest upcoming one.
  const focusTrip = ongoing[0] ?? upcoming[0] ?? null;

  return {
    stats: {
      upcomingTrips: upcoming.length + ongoing.length,
      totalTrips: serialized.length,
      completedTrips: completed.length,
      citiesPlanned: allCityIds.size,
      citiesVisited: visitedCityIds.size,
      savedDestinations: savedCount,
      publicTrips: serialized.filter((trip) => trip.isPublic).length,
    },
    analytics: {
      plannedDays,
      cities: allCityIds.size,
      activities: activityCount,
      estimatedTotalCost: Math.round(estimatedTotalCost),
      averageDailyCost: plannedDays > 0 ? Math.round(estimatedTotalCost / plannedDays) : 0,
    },
    focusTrip,
    upcomingTrip: focusTrip,
    upcomingTrips: upcoming.slice(0, 4),
    ongoingTrips: ongoing,
    recentTrips: [...serialized]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6),
    popularDestinations,
    savedDestinations: savedRows.map((row) => ({
      id: row.id,
      city: serializeCity(row.city),
    })),
    notifications,
  };
}

// ── Admin ────────────────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Last `count` months as `YYYY-MM`, oldest first, so charts have no gaps. */
function recentMonths(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    keys.push(monthKey(date));
  }
  return keys;
}

function bucketByMonth(dates: Date[], months: number) {
  const keys = recentMonths(months);
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const date of dates) {
    const key = monthKey(date);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((key) => ({ month: key, count: counts.get(key) ?? 0 }));
}

/** Platform analytics for the admin area (Section 25). */
export async function getAdminAnalytics() {
  const [totalUsers, totalTrips, totalCities, totalActivities, publicTrips, totalExpenses] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.trip.count(),
      prisma.city.count(),
      prisma.activity.count(),
      prisma.trip.count({ where: { isPublic: true } }),
      prisma.expense.count(),
    ]);

  const [trips, users, cityGroups, activityGroups, savedGroups] = await Promise.all([
    prisma.trip.findMany({ select: { createdAt: true, startDate: true } }),
    prisma.user.findMany({ where: { deletedAt: null }, select: { createdAt: true } }),
    prisma.tripStop.groupBy({
      by: ['cityId'],
      _count: { _all: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: 8,
    }),
    prisma.itineraryItem.groupBy({
      by: ['activityId'],
      where: { activityId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { activityId: 'desc' } },
      take: 8,
    }),
    prisma.savedDestination.groupBy({
      by: ['cityId'],
      _count: { _all: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: 8,
    }),
  ]);

  const [cityRows, activityRows] = await Promise.all([
    prisma.city.findMany({
      where: { id: { in: cityGroups.map((row) => row.cityId) } },
      select: { id: true, name: true, country: true, image: true },
    }),
    prisma.activity.findMany({
      where: { id: { in: activityGroups.map((row) => row.activityId ?? '') } },
      select: { id: true, name: true, category: true, image: true, city: { select: { name: true } } },
    }),
  ]);

  const cityById = new Map(cityRows.map((city) => [city.id, city]));
  const activityById = new Map(activityRows.map((activity) => [activity.id, activity]));

  const savedCounts = await prisma.savedDestination.groupBy({
    by: ['cityId'],
    _count: { _all: true },
  });
  const savedByCity = new Map(savedCounts.map((row) => [row.cityId, row._count._all]));

  // "Most popular" blends how often a city is planned with how often it is saved.
  const popularCities = cityGroups
    .map((row) => {
      const city = cityById.get(row.cityId);
      if (!city) return null;
      return {
        ...city,
        tripCount: row._count._all,
        savedCount: savedByCity.get(row.cityId) ?? 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const popularActivities = activityGroups
    .map((row) => {
      const activity = row.activityId ? activityById.get(row.activityId) : null;
      if (!activity) return null;
      return {
        id: activity.id,
        name: activity.name,
        category: activity.category,
        image: activity.image,
        cityName: activity.city.name,
        timesPlanned: row._count._all,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const today = new Date();
  const upcoming = trips.filter((trip) => trip.startDate.getTime() > today.getTime()).length;

  return {
    totals: {
      users: totalUsers,
      trips: totalTrips,
      cities: totalCities,
      activities: totalActivities,
      publicTrips,
      expenses: totalExpenses,
      upcomingTrips: upcoming,
      savedDestinations: savedGroups.reduce((sum, row) => sum + row._count._all, 0),
    },
    tripsOverTime: bucketByMonth(trips.map((trip) => trip.createdAt), 6),
    registrationsOverTime: bucketByMonth(users.map((user) => user.createdAt), 6),
    popularCities,
    popularActivities,
    generatedAt: toDateOnly(today),
  };
}
