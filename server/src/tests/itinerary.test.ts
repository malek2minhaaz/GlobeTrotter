import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type TestUser,
  anotherCityWithActivities,
  cityWithActivities,
  createTripWithStop,
  createUser,
  dateOffset,
  removeUsers,
} from '../test/helpers';

describe('Itinerary building', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser({ name: 'Itinerary Planner' });
  });

  afterAll(async () => {
    await removeUsers([user]);
  });

  async function trip() {
    return createTripWithStop(user.agent, {
      name: `Itinerary ${Math.random().toString(36).slice(2, 8)}`,
      startOffset: 25,
      days: 4,
    });
  }

  it('adds a city stay to a trip', async () => {
    const second = await anotherCityWithActivities('');
    const created = await user.agent.post('/api/trips').send({
      name: 'Stop Test',
      startDate: dateOffset(20),
      endDate: dateOffset(24),
    });
    const tripId = created.body.data.trip.id;

    const stop = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: second.id,
      startDate: dateOffset(20),
      endDate: dateOffset(22),
    });

    expect(stop.status).toBe(201);
    expect(stop.body.data.stop.city.id).toBe(second.id);
    expect(stop.body.data.stop.dayCount).toBe(3);
    expect(stop.body.data.stop.order).toBe(0);
  });

  it('rejects a city stay outside the trip window', async () => {
    const city = await cityWithActivities();
    const created = await user.agent.post('/api/trips').send({
      name: 'Outside Stop',
      startDate: dateOffset(30),
      endDate: dateOffset(33),
    });
    const tripId = created.body.data.trip.id;

    const response = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: city.id,
      startDate: dateOffset(40),
      endDate: dateOffset(41),
    });
    expect(response.status).toBe(422);
  });

  it('rejects two stays that overlap in time', async () => {
    const city = await cityWithActivities();
    const second = await anotherCityWithActivities(city.id);
    const created = await user.agent.post('/api/trips').send({
      name: 'Overlapping Cities',
      startDate: dateOffset(30),
      endDate: dateOffset(36),
    });
    const tripId = created.body.data.trip.id;

    await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: city.id,
      startDate: dateOffset(30),
      endDate: dateOffset(33),
    });

    const clash = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: second.id,
      startDate: dateOffset(32),
      endDate: dateOffset(35),
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(/overlap/i);
  });

  it('rejects the same city twice in one trip', async () => {
    const { tripId, city } = await trip();
    const duplicate = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: city.id,
      startDate: dateOffset(27),
      endDate: dateOffset(28),
    });
    expect(duplicate.status).toBe(409);
  });

  it('adds an activity from the catalogue to a day', async () => {
    const { tripId, city, trip: created } = await trip();
    const activity = city.activities[0];

    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: activity.id,
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '12:00',
    });

    expect(response.status).toBe(201);
    const item = response.body.data.item;
    expect(item.activityId).toBe(activity.id);
    // Title and category are inherited from the catalogue entry.
    expect(item.title).toBe(activity.name);
    expect(item.category).toBe(activity.category);
    expect(item.date).toBe(created.startDate);
    expect(item.effectiveCost).toBe(Number(activity.estimatedCost));
  });

  it('adds a free-form entry with no catalogue activity', async () => {
    const { tripId } = await trip();
    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Breakfast at the hotel',
      category: 'FOOD',
      date: dateOffset(25),
      startTime: '08:30',
      endTime: '09:30',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.item.activityId).toBeNull();
    expect(response.body.data.item.title).toBe('Breakfast at the hotel');
  });

  it('requires either an activity or a title', async () => {
    const { tripId } = await trip();
    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(response.status).toBe(422);
  });

  it('rejects an end time before the start time', async () => {
    const { tripId } = await trip();
    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Backwards',
      date: dateOffset(25),
      startTime: '14:00',
      endTime: '13:00',
    });
    expect(response.status).toBe(422);
  });

  it('flags an overlapping activity with the clashing entry named', async () => {
    const { tripId, city } = await trip();
    const activity = city.activities[0];

    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: activity.id,
      date: dateOffset(26),
      startTime: '10:00',
      endTime: '12:00',
    });

    const overlap = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Conflicting tour',
      date: dateOffset(26),
      startTime: '11:00',
      endTime: '13:00',
    });

    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('CONFLICT');
    // The payload carries enough detail for the UI to show a resolvable warning.
    const conflicts = overlap.body.error.details.conflicts;
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('OVERLAP');
    expect(conflicts[0].message).toContain(activity.name);
    expect(conflicts[0].resolution).toBeTruthy();
  });

  it('allows an overlap when it is deliberate', async () => {
    const { tripId, city } = await trip();
    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: city.activities[0].id,
      date: dateOffset(26),
      startTime: '10:00',
      endTime: '12:00',
    });

    const permitted = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Intentional overlap',
      date: dateOffset(26),
      startTime: '11:00',
      endTime: '13:00',
      allowOverlap: true,
    });

    expect(permitted.status).toBe(201);
    // The server still reports the clash so the UI can keep warning about it.
    expect(permitted.body.data.warnings.length).toBeGreaterThan(0);
  });

  it('treats adjacent activities as non-overlapping', async () => {
    const { tripId } = await trip();
    const first = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Morning walk',
      date: dateOffset(25),
      startTime: '09:00',
      endTime: '10:00',
    });
    const second = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Coffee',
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '11:00',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('rejects an activity scheduled outside the trip', async () => {
    const { tripId } = await trip();
    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Way too late',
      date: dateOffset(200),
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(response.status).toBe(422);
  });

  it("rejects an activity that belongs to another city", async () => {
    const { tripId, city } = await trip();
    const elsewhere = await anotherCityWithActivities(city.id);

    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: elsewhere.activities[0].id,
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(response.status).toBe(422);
  });

  it('updates an entry, including its notes and custom cost', async () => {
    const { tripId, city } = await trip();
    const created = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: city.activities[0].id,
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '12:00',
    });
    const itemId = created.body.data.item.id;

    const updated = await user.agent.put(`/api/itinerary-items/${itemId}`).send({
      startTime: '14:00',
      endTime: '16:00',
      notes: 'Book tickets in advance',
      customCost: 750,
    });

    expect(updated.status).toBe(200);
    expect(updated.body.data.item.startTime).toBe('14:00');
    expect(updated.body.data.item.notes).toBe('Book tickets in advance');
    // An explicit cost overrides the catalogue price.
    expect(updated.body.data.item.effectiveCost).toBe(750);
  });

  it('moves an entry to another day and re-files it under the right city', async () => {
    const { tripId, city, trip: created } = await trip();
    const item = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Flexible plan',
      date: created.startDate,
      startTime: '10:00',
      endTime: '11:00',
    });
    const itemId = item.body.data.item.id;

    const moved = await user.agent.put(`/api/trips/${tripId}/itinerary/reorder`).send({
      items: [{ id: itemId, date: dateOffset(27), order: 0, startTime: '15:00' }],
    });

    expect(moved.status).toBe(200);
    expect(moved.body.data.updated).toBe(1);

    const detail = await user.agent.get(`/api/trips/${tripId}`);
    const after = detail.body.data.trip.itineraryItems.find(
      (entry: { id: string }) => entry.id === itemId,
    );
    expect(after.date).toBe(dateOffset(27));
    expect(after.startTime).toBe('15:00');
    expect(after.city.id).toBe(city.id);
  });

  it('rejects a reorder referencing an entry from another trip', async () => {
    const other = await createUser({ name: 'Other Planner' });
    try {
      const otherTrip = await createTripWithStop(other.agent, { name: 'Foreign Trip' });
      const foreignItem = await other.agent.post(`/api/trips/${otherTrip.tripId}/itinerary`).send({
        title: 'Foreign entry',
        date: otherTrip.trip.startDate,
        startTime: '10:00',
        endTime: '11:00',
      });

      const mine = await trip();
      const response = await user.agent.put(`/api/trips/${mine.tripId}/itinerary/reorder`).send({
        items: [{ id: foreignItem.body.data.item.id, order: 0 }],
      });

      expect(response.status).toBe(400);
    } finally {
      await removeUsers([other]);
    }
  });

  it('deletes an entry', async () => {
    const { tripId } = await trip();
    const created = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Temporary',
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '11:00',
    });
    const itemId = created.body.data.item.id;

    expect((await user.agent.delete(`/api/itinerary-items/${itemId}`)).status).toBe(200);
    expect((await user.agent.delete(`/api/itinerary-items/${itemId}`)).status).toBe(404);
  });

  it('reorders city stays', async () => {
    const first = await cityWithActivities();
    const second = await anotherCityWithActivities(first.id);
    const created = await user.agent.post('/api/trips').send({
      name: 'Reorder Cities',
      startDate: dateOffset(90),
      endDate: dateOffset(97),
    });
    const tripId = created.body.data.trip.id;

    const a = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: first.id,
      startDate: dateOffset(90),
      endDate: dateOffset(92),
    });
    const b = await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: second.id,
      startDate: dateOffset(93),
      endDate: dateOffset(96),
    });

    const reordered = await user.agent.put(`/api/trips/${tripId}/stops/reorder`).send({
      stopIds: [b.body.data.stop.id, a.body.data.stop.id],
    });
    expect(reordered.status).toBe(200);

    const detail = await user.agent.get(`/api/trips/${tripId}`);
    expect(detail.body.data.trip.stops[0].city.id).toBe(second.id);
    expect(detail.body.data.trip.stops[1].city.id).toBe(first.id);
  });

  it('removes a city stay together with the entries planned inside it', async () => {
    const { tripId, stopId } = await trip();
    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'Will be removed',
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '11:00',
    });

    const removed = await user.agent.delete(`/api/stops/${stopId}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.removedItems).toBe(1);

    const detail = await user.agent.get(`/api/trips/${tripId}`);
    expect(detail.body.data.trip.stops).toHaveLength(0);
    expect(detail.body.data.trip.itineraryItems).toHaveLength(0);
  });

  it('reports all conflicts for a trip', async () => {
    const { tripId } = await trip();
    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'A',
      date: dateOffset(25),
      startTime: '10:00',
      endTime: '12:00',
    });
    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'B',
      date: dateOffset(25),
      startTime: '11:00',
      endTime: '13:00',
      allowOverlap: true,
    });

    const conflicts = await user.agent.get(`/api/trips/${tripId}/conflicts`);
    expect(conflicts.status).toBe(200);
    expect(conflicts.body.data.some((c: { type: string }) => c.type === 'OVERLAP')).toBe(true);
  });

  it('adds a catalogue activity directly onto a stop', async () => {
    const { tripId, stopId, city } = await trip();
    const response = await user.agent.post(`/api/stops/${stopId}/activities`).send({
      activityId: city.activities[1].id,
      date: dateOffset(25),
      startTime: '09:00',
      endTime: '10:30',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.item.activityId).toBe(city.activities[1].id);

    // The stop's city activities endpoint powers the builder's search panel.
    const available = await user.agent.get(`/api/stops/${stopId}/activities`);
    expect(available.status).toBe(200);
    expect(available.body.data.length).toBeGreaterThan(0);
    expect(available.body.data.every((a: { cityId: string }) => a.cityId === city.id)).toBe(true);

    // Keep the trip tidy for later assertions.
    expect((await user.agent.delete(`/api/trips/${tripId}`)).status).toBe(200);
  });
});
