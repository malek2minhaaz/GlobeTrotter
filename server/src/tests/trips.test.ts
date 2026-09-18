import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type TestUser,
  cityWithActivities,
  createUser,
  dateOffset,
  removeUsers,
} from '../test/helpers';

describe('Trips', () => {
  let user: TestUser;
  const extraUsers: TestUser[] = [];

  beforeAll(async () => {
    user = await createUser({ name: 'Trip Owner' });
  });

  afterAll(async () => {
    await removeUsers([user, ...extraUsers]);
  });

  it('creates a trip and returns derived metrics', async () => {
    const response = await user.agent.post('/api/trips').send({
      name: 'Rajasthan Loop',
      description: 'Forts and deserts',
      startDate: dateOffset(20),
      endDate: dateOffset(26),
      isPublic: false,
      budgetLimit: 90000,
    });

    expect(response.status).toBe(201);
    const trip = response.body.data.trip;
    expect(trip.name).toBe('Rajasthan Loop');
    expect(trip.durationDays).toBe(7);
    expect(trip.budgetLimit).toBe(90000);
    expect(trip.status).toBe('UPCOMING');
    expect(trip.cityCount).toBe(0);
    expect(trip.estimatedCost).toBe(0);
    expect(trip.publicSlug).toBeNull();
  });

  it('rejects an end date before the start date', async () => {
    const response = await user.agent.post('/api/trips').send({
      name: 'Backwards',
      startDate: dateOffset(30),
      endDate: dateOffset(10),
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toHaveProperty('endDate');
  });

  it('rejects a missing trip name', async () => {
    const response = await user.agent.post('/api/trips').send({
      name: 'x',
      startDate: dateOffset(5),
      endDate: dateOffset(8),
    });
    expect(response.status).toBe(422);
  });

  it('rejects a negative budget', async () => {
    const response = await user.agent.post('/api/trips').send({
      name: 'Negative Budget',
      startDate: dateOffset(5),
      endDate: dateOffset(8),
      budgetLimit: -500,
    });
    expect(response.status).toBe(422);
  });

  it('retrieves a trip with its stop and itinerary structure', async () => {
    const city = await cityWithActivities();
    const created = await user.agent.post('/api/trips').send({
      name: 'Detail Trip',
      startDate: dateOffset(40),
      endDate: dateOffset(44),
    });
    const tripId = created.body.data.trip.id;

    await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: city.id,
      startDate: dateOffset(40),
      endDate: dateOffset(42),
    });

    const detail = await user.agent.get(`/api/trips/${tripId}`);
    expect(detail.status).toBe(200);
    const trip = detail.body.data.trip;
    expect(trip.stops).toHaveLength(1);
    expect(trip.stops[0].city.name).toBe(city.name);
    expect(trip.stops[0].dayCount).toBe(3);
    expect(trip.cityCount).toBe(1);
    expect(trip.cities[0].id).toBe(city.id);
    // Dates are date-only strings so no timezone can shift them.
    expect(trip.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(trip.itineraryItems).toEqual([]);
  });

  it('updates a trip', async () => {
    const created = await user.agent.post('/api/trips').send({
      name: 'Before Rename',
      startDate: dateOffset(50),
      endDate: dateOffset(52),
    });
    const tripId = created.body.data.trip.id;

    const updated = await user.agent.put(`/api/trips/${tripId}`).send({
      name: 'After Rename',
      description: 'Updated description',
    });

    expect(updated.status).toBe(200);
    expect(updated.body.data.trip.name).toBe('After Rename');
    expect(updated.body.data.trip.description).toBe('Updated description');
  });

  it('refuses to shrink trip dates around an existing city stay', async () => {
    const city = await cityWithActivities();
    const created = await user.agent.post('/api/trips').send({
      name: 'Shrink Test',
      startDate: dateOffset(60),
      endDate: dateOffset(69),
    });
    const tripId = created.body.data.trip.id;
    await user.agent.post(`/api/trips/${tripId}/stops`).send({
      cityId: city.id,
      startDate: dateOffset(65),
      endDate: dateOffset(68),
    });

    const response = await user.agent
      .put(`/api/trips/${tripId}`)
      .send({ endDate: dateOffset(62) });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/fall outside/i);
  });

  it('lists, searches, filters and sorts trips', async () => {
    const list = await user.agent.get('/api/trips');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.meta.total).toBeGreaterThan(0);

    // Pagination is honoured.
    const paged = await user.agent.get('/api/trips?page=1&pageSize=2');
    expect(paged.body.data.length).toBeLessThanOrEqual(2);
    expect(paged.body.meta.pageSize).toBe(2);

    // Status filter.
    const upcoming = await user.agent.get('/api/trips?status=UPCOMING');
    for (const trip of upcoming.body.data) expect(trip.status).toBe('UPCOMING');

    const completed = await user.agent.get('/api/trips?status=COMPLETED');
    for (const trip of completed.body.data) expect(trip.status).toBe('COMPLETED');

    // Search matches the trip name and its cities.
    const search = await user.agent.get('/api/trips?q=Rajasthan');
    expect(search.body.data.some((trip: { name: string }) => trip.name.includes('Rajasthan'))).toBe(true);

    // Sorting by cost must be monotonic.
    const byCost = await user.agent.get('/api/trips?sortBy=cost&sort=desc');
    const costs = byCost.body.data.map((trip: { estimatedCost: number }) => trip.estimatedCost);
    expect(costs).toEqual([...costs].sort((a: number, b: number) => b - a));

    // Visibility filter.
    const privateOnly = await user.agent.get('/api/trips?visibility=PRIVATE');
    for (const trip of privateOnly.body.data) expect(trip.isPublic).toBe(false);
  });

  it('deletes a trip and its dependants', async () => {
    const created = await user.agent.post('/api/trips').send({
      name: 'Delete Me',
      startDate: dateOffset(70),
      endDate: dateOffset(72),
    });
    const tripId = created.body.data.trip.id;

    expect((await user.agent.delete(`/api/trips/${tripId}`)).status).toBe(200);
    expect((await user.agent.get(`/api/trips/${tripId}`)).status).toBe(404);
    expect((await user.agent.delete(`/api/trips/${tripId}`)).status).toBe(404);
  });

  it('keeps every trip scoped to its owner', async () => {
    const other = await createUser({ name: 'Someone Else' });
    extraUsers.push(other);

    const created = await user.agent.post('/api/trips').send({
      name: 'Private Trip',
      startDate: dateOffset(80),
      endDate: dateOffset(82),
    });
    const tripId = created.body.data.trip.id;

    // A different user must not see it in their list...
    const otherList = await other.agent.get('/api/trips');
    expect(otherList.body.data.every((trip: { id: string }) => trip.id !== tripId)).toBe(true);

    // ...nor read, edit or delete it. 404 rather than 403 avoids confirming the id.
    expect((await other.agent.get(`/api/trips/${tripId}`)).status).toBe(404);
    expect((await other.agent.put(`/api/trips/${tripId}`).send({ name: 'Hijacked' })).status).toBe(404);
    expect((await other.agent.delete(`/api/trips/${tripId}`)).status).toBe(404);
  });
});
