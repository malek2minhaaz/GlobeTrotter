import { TRIP_SOON_DAYS } from '../config/constants';
import { prisma } from '../lib/prisma';
import { diffInDaysUTC, todayUTC } from '../utils/dates';
import { detectConflicts, toSchedulable } from './conflict.service';
import { computeCostBreakdown } from '../utils/tripCost';

/**
 * In-app notifications (Section 43).
 *
 * These are *derived* rather than stored: an itinerary conflict or an upcoming
 * trip is a fact about the current data, so computing them on read means they can
 * never go stale or need a background job to clear.
 */

export type NotificationType =
  | 'UPCOMING_TRIP'
  | 'TRIP_STARTED'
  | 'BUDGET_EXCEEDED'
  | 'ITINERARY_CONFLICT'
  | 'EMPTY_ITINERARY';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  message: string;
  tripId: string | null;
  actionLabel: string | null;
  actionHref: string | null;
}

export async function getNotifications(userId: string, limit = 8): Promise<AppNotification[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyUpcomingTrips: true,
      notifyBudgetAlerts: true,
      notifyItineraryConflicts: true,
    },
  });
  if (!user) return [];

  const trips = await prisma.trip.findMany({
    where: { userId },
    include: {
      stops: { include: { city: { select: { id: true, name: true } } }, orderBy: { order: 'asc' } },
      expenses: { select: { category: true, amount: true } },
      itineraryItems: {
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          tripStopId: true,
          customCost: true,
          category: true,
          activity: { select: { estimatedCost: true } },
        },
      },
    },
    orderBy: { startDate: 'asc' },
  });

  const today = todayUTC();
  const notifications: AppNotification[] = [];

  for (const trip of trips) {
    const daysUntilStart = diffInDaysUTC(today, trip.startDate);
    const isOngoing = today.getTime() >= trip.startDate.getTime() && today.getTime() <= trip.endDate.getTime();

    if (user.notifyUpcomingTrips && daysUntilStart >= 0 && daysUntilStart <= TRIP_SOON_DAYS) {
      notifications.push({
        id: `upcoming-${trip.id}`,
        type: 'UPCOMING_TRIP',
        severity: daysUntilStart <= 2 ? 'warning' : 'info',
        title: daysUntilStart === 0 ? 'Your trip starts today' : `Trip in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`,
        message:
          daysUntilStart === 0
            ? `${trip.name} begins today. Have a wonderful journey.`
            : `${trip.name} starts on ${trip.startDate.toISOString().slice(0, 10)}. Finish planning your days.`,
        tripId: trip.id,
        actionLabel: 'Open itinerary',
        actionHref: `/trips/${trip.id}/itinerary`,
      });
    }

    if (user.notifyUpcomingTrips && isOngoing) {
      notifications.push({
        id: `ongoing-${trip.id}`,
        type: 'TRIP_STARTED',
        severity: 'success',
        title: 'Trip in progress',
        message: `You are currently travelling — ${trip.name}.`,
        tripId: trip.id,
        actionLabel: 'View calendar',
        actionHref: `/trips/${trip.id}/calendar`,
      });
    }

    const breakdown = computeCostBreakdown(trip.itineraryItems, trip.expenses);

    if (user.notifyBudgetAlerts && trip.budgetLimit !== null) {
      const limit = Number(trip.budgetLimit);
      if (breakdown.total > limit) {
        notifications.push({
          id: `budget-${trip.id}`,
          type: 'BUDGET_EXCEEDED',
          severity: 'danger',
          title: 'Estimated cost is over budget',
          message: `${trip.name} is estimated at ${Math.round(breakdown.total - limit).toLocaleString('en-IN')} over your set budget.`,
          tripId: trip.id,
          actionLabel: 'Review budget',
          actionHref: `/trips/${trip.id}/budget`,
        });
      }
    }

    if (user.notifyItineraryConflicts && trip.itineraryItems.length > 0) {
      const conflicts = detectConflicts(
        trip.itineraryItems.map(toSchedulable),
        {
          tripStart: trip.startDate,
          tripEnd: trip.endDate,
          stops: trip.stops.map((stop) => ({
            id: stop.id,
            startDate: stop.startDate,
            endDate: stop.endDate,
            cityName: stop.city.name,
          })),
        },
      );

      const overlaps = conflicts.filter((conflict) => conflict.type === 'OVERLAP');
      if (overlaps.length > 0) {
        notifications.push({
          id: `conflict-${trip.id}`,
          type: 'ITINERARY_CONFLICT',
          severity: 'warning',
          title: `${overlaps.length} scheduling clash${overlaps.length === 1 ? '' : 'es'}`,
          message: overlaps[0].message,
          tripId: trip.id,
          actionLabel: 'Resolve in builder',
          actionHref: `/trips/${trip.id}/itinerary`,
        });
      }
    }

    if (trip.itineraryItems.length === 0 && daysUntilStart >= 0 && daysUntilStart <= 30) {
      notifications.push({
        id: `empty-${trip.id}`,
        type: 'EMPTY_ITINERARY',
        severity: 'info',
        title: 'Your itinerary is empty',
        message: `${trip.name} has no activities planned yet.`,
        tripId: trip.id,
        actionLabel: 'Add activities',
        actionHref: `/trips/${trip.id}/itinerary`,
      });
    }
  }

  // Most urgent first, then soonest trip.
  const rank: Record<AppNotification['severity'], number> = {
    danger: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return notifications
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, limit);
}
