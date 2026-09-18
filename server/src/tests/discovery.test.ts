import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type TestUser,
  app,
  cityWithActivities,
  createTripWithStop,
  createUser,
  dateOffset,
  removeUsers,
} from '../test/helpers';

describe('City discovery', () => {
  it('searches cities by name, country and region', async () => {
    const byName = await request(app).get('/api/cities?q=goa');
    expect(byName.status).toBe(200);
    expect(byName.body.data.some((city: { name: string }) => city.name === 'Goa')).toBe(true);

    const byCountry = await request(app).get('/api/cities?q=India');
    expect(byCountry.body.data.length).toBeGreaterThan(1);

    const byRegion = await request(app).get('/api/cities?q=Rajasthan');
    expect(byRegion.body.data.length).toBeGreaterThan(0);
  });

  it('filters by country and sorts by cost or popularity', async () => {
    const facets = await request(app).get('/api/cities/facets');
    const country = facets.body.data.countries[0].value;

    const filtered = await request(app).get(`/api/cities?country=${encodeURIComponent(country)}`);
    expect(filtered.body.data.length).toBeGreaterThan(0);
    for (const city of filtered.body.data) expect(city.country).toBe(country);

    const cheapFirst = await request(app).get('/api/cities?sortBy=costIndex&sort=asc&pageSize=20');
    const costs = cheapFirst.body.data.map((city: { costIndex: number }) => city.costIndex);
    expect(costs).toEqual([...costs].sort((a: number, b: number) => a - b));

    const popular = await request(app).get('/api/cities?sortBy=popularity&sort=desc&pageSize=5');
    const pops = popular.body.data.map((city: { popularity: number }) => city.popularity);
    expect(pops).toEqual([...pops].sort((a: number, b: number) => b - a));
  });

  it('paginates and reports an accurate total', async () => {
    const response = await request(app).get('/api/cities?page=1&pageSize=5');
    expect(response.body.data).toHaveLength(5);
    expect(response.body.meta.total).toBeGreaterThan(5);
    expect(response.body.meta.totalPages).toBeGreaterThan(1);

    const second = await request(app).get('/api/cities?page=2&pageSize=5');
    expect(second.body.data[0].id).not.toBe(response.body.data[0].id);
  });

  it('returns a city with its activities and an estimated daily cost', async () => {
    const city = await cityWithActivities();
    const response = await request(app).get(`/api/cities/${city.id}`);

    expect(response.status).toBe(200);
    const detail = response.body.data.city;
    expect(detail.name).toBe(city.name);
    expect(detail.activities.length).toBeGreaterThan(0);
    expect(detail.highlights.length).toBeLessThanOrEqual(3);
    expect(detail.estimatedDailyCost).toBeGreaterThan(0);
    expect(detail.isSaved).toBe(false);
  });

  it('404s an unknown city', async () => {
    expect((await request(app).get('/api/cities/not-a-real-city')).status).toBe(404);
  });
});

describe('Activity discovery', () => {
  it('searches activities', async () => {
    const response = await request(app).get('/api/activities?q=beach');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].city.name).toBeTruthy();
  });

  it('filters activities by category, cost and duration', async () => {
    const food = await request(app).get('/api/activities?category=FOOD&pageSize=20');
    expect(food.body.data.length).toBeGreaterThan(0);
    for (const activity of food.body.data) expect(activity.category).toBe('FOOD');

    const cheap = await request(app).get('/api/activities?maxCost=500&pageSize=20');
    for (const activity of cheap.body.data) expect(activity.estimatedCost).toBeLessThanOrEqual(500);

    const short = await request(app).get('/api/activities?maxDuration=2&pageSize=20');
    for (const activity of short.body.data) expect(activity.duration).toBeLessThanOrEqual(2);
  });

  it('lists activities for a city', async () => {
    const city = await cityWithActivities();
    const response = await request(app).get(`/api/cities/${city.id}/activities`);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const activity of response.body.data) expect(activity.cityId).toBe(city.id);
  });

  it('returns a single activity with its city', async () => {
    const city = await cityWithActivities();
    const response = await request(app).get(`/api/activities/${city.activities[0].id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.activity.city.name).toBe(city.name);
  });
});

describe('Saved destinations', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser({ name: 'Bookmarker' });
  });

  afterAll(async () => {
    await removeUsers([user]);
  });

  it('saves, lists and removes a destination', async () => {
    const city = await cityWithActivities();

    const saved = await user.agent.post('/api/saved').send({ cityId: city.id });
    expect(saved.status).toBe(201);
    expect(saved.body.data.saved.city.id).toBe(city.id);

    const list = await user.agent.get('/api/saved');
    expect(list.body.data.some((row: { city: { id: string } }) => row.city.id === city.id)).toBe(true);

    // City cards show bookmark state for signed-in users.
    const cities = await user.agent.get(`/api/cities?q=${encodeURIComponent(city.name)}`);
    expect(cities.body.data.find((c: { id: string }) => c.id === city.id).isSaved).toBe(true);

    const detail = await user.agent.get(`/api/cities/${city.id}`);
    expect(detail.body.data.city.isSaved).toBe(true);

    expect((await user.agent.delete(`/api/saved/${city.id}`)).status).toBe(200);
    expect((await user.agent.delete(`/api/saved/${city.id}`)).status).toBe(404);
  });

  it('treats saving the same city twice as a no-op', async () => {
    const city = await cityWithActivities();
    expect((await user.agent.post('/api/saved').send({ cityId: city.id })).status).toBe(201);
    expect((await user.agent.post('/api/saved').send({ cityId: city.id })).status).toBe(201);

    const list = await user.agent.get('/api/saved');
    const matches = list.body.data.filter((row: { city: { id: string } }) => row.city.id === city.id);
    expect(matches).toHaveLength(1);

    await user.agent.delete(`/api/saved/${city.id}`);
  });

  it('404s saving an unknown city', async () => {
    expect((await user.agent.post('/api/saved').send({ cityId: 'nope' })).status).toBe(404);
  });

  it('requires a session', async () => {
    expect((await request(app).get('/api/saved')).status).toBe(401);
  });
});

describe('Dashboard and analytics', () => {
  let user: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    user = await createUser({ name: 'Dashboard User' });
    admin = await createUser({ name: 'Platform Admin', role: 'ADMIN' });
  });

  afterAll(async () => {
    await removeUsers([user, admin]);
  });

  it('returns an empty-but-valid dashboard for a brand new account', async () => {
    const response = await user.agent.get('/api/dashboard');
    expect(response.status).toBe(200);

    const data = response.body.data;
    expect(data.stats.totalTrips).toBe(0);
    expect(data.stats.savedDestinations).toBe(0);
    expect(data.recentTrips).toEqual([]);
    expect(data.focusTrip).toBeNull();
    expect(data.popularDestinations.length).toBeGreaterThan(0);
    expect(data.analytics.estimatedTotalCost).toBe(0);
    expect(data.analytics.averageDailyCost).toBe(0);
  });

  it('summarises trips once they exist', async () => {
    const { tripId } = await createTripWithStop(user.agent, {
      name: 'Dashboard Trip',
      days: 4,
      startOffset: 10,
    });
    await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: 4000,
      description: 'Food',
      date: dateOffset(10),
    });

    const response = await user.agent.get('/api/dashboard');
    const data = response.body.data;

    expect(data.stats.totalTrips).toBe(1);
    expect(data.stats.upcomingTrips).toBe(1);
    expect(data.focusTrip.name).toBe('Dashboard Trip');
    expect(data.focusTrip.status).toBe('UPCOMING');
    expect(data.focusTrip.daysUntilStart).toBeGreaterThan(0);
    expect(data.analytics.cities).toBe(1);
    expect(data.analytics.plannedDays).toBe(4);
    expect(data.analytics.estimatedTotalCost).toBe(4000);
    expect(data.analytics.averageDailyCost).toBe(1000);
  });

  it('derives notifications from trip state', async () => {
    await createTripWithStop(user.agent, {
      name: 'Starting Soon',
      days: 3,
      startOffset: 3,
      budgetLimit: 100,
    });

    const response = await user.agent.get('/api/dashboard');
    const notifications = response.body.data.notifications;
    expect(Array.isArray(notifications)).toBe(true);
    // A trip three days away should surface an upcoming-trip reminder.
    expect(notifications.some((n: { type: string }) => n.type === 'UPCOMING_TRIP')).toBe(true);
  });

  it('blocks non-admins from the admin area', async () => {
    expect((await user.agent.get('/api/admin/analytics')).status).toBe(403);
    expect((await request(app).get('/api/admin/analytics')).status).toBe(401);
  });

  it('serves platform analytics to an admin', async () => {
    const response = await admin.agent.get('/api/admin/analytics');
    expect(response.status).toBe(200);

    const data = response.body.data;
    expect(data.totals.users).toBeGreaterThan(0);
    expect(data.totals.cities).toBeGreaterThan(0);
    expect(data.totals.activities).toBeGreaterThan(0);
    expect(data.tripsOverTime).toHaveLength(6);
    expect(data.registrationsOverTime).toHaveLength(6);
    expect(Array.isArray(data.popularCities)).toBe(true);
    expect(Array.isArray(data.popularActivities)).toBe(true);

    // Popular cities blend planning with bookmarking.
    if (data.popularCities.length > 0) {
      expect(data.popularCities[0]).toHaveProperty('tripCount');
      expect(data.popularCities[0]).toHaveProperty('savedCount');
    }
  });

  it('promotes an admin role immediately, without a new session', async () => {
    const promoted = await createUser({ name: 'Promoted User' });
    try {
      expect((await promoted.agent.get('/api/admin/analytics')).status).toBe(403);
      const { prisma } = await import('../test/helpers');
      await prisma.user.update({ where: { id: promoted.id }, data: { role: 'ADMIN' } });
      // The role is read from the database per request, so no re-login is needed.
      expect((await promoted.agent.get('/api/admin/analytics')).status).toBe(200);
    } finally {
      await removeUsers([promoted]);
    }
  });
});

/**
 * Regression coverage for a validation bug that made every filtered list fail.
 *
 * `z.preprocess(fn, schema)` on its own still requires a value, so an *omitted*
 * filter produced a 422 — `GET /api/trips` with no query string was invalid.
 * Adding `.optional()` outside the preprocess fixed that but not an *empty*
 * filter (`?q=`), which still failed. Both states are pinned here.
 */
describe('Optional query and body parameters', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser({ name: 'Validator' });
  });

  afterAll(async () => {
    await removeUsers([user]);
  });

  it('accepts list endpoints with no query string at all', async () => {
    expect((await user.agent.get('/api/trips')).status).toBe(200);
    expect((await user.agent.get('/api/saved')).status).toBe(200);
    expect((await request(app).get('/api/cities')).status).toBe(200);
    expect((await request(app).get('/api/activities')).status).toBe(200);
  });

  it('treats empty-string filters as "not provided"', async () => {
    expect((await user.agent.get('/api/trips?q=&status=&visibility=&sortBy=')).status).toBe(200);
    expect((await request(app).get('/api/cities?q=&country=&region=&minCostIndex=&maxCostIndex=')).status).toBe(200);
    expect(
      (await request(app).get('/api/activities?q=&category=&cityId=&minCost=&maxCost=&maxDuration=')).status,
    ).toBe(200);
    expect((await user.agent.get('/api/saved?q=')).status).toBe(200);
  });

  it('still validates a bad value when one is supplied', async () => {
    expect((await request(app).get('/api/activities?category=NOT_A_CATEGORY')).status).toBe(422);
    expect((await request(app).get('/api/cities?sortBy=nonsense')).status).toBe(422);
    expect((await user.agent.get('/api/trips?status=NONSENSE')).status).toBe(422);
  });

  it('accepts empty-string body fields as absent', async () => {
    const created = await user.agent.post('/api/trips').send({
      name: 'Empty Fields Trip',
      description: '',
      coverImage: '',
      budgetLimit: '',
      startDate: dateOffset(12),
      endDate: dateOffset(15),
    });

    expect(created.status).toBe(201);
    expect(created.body.data.trip.description).toBeNull();
    expect(created.body.data.trip.coverImage).toBeNull();
    expect(created.body.data.trip.budgetLimit).toBeNull();
  });

  it('accepts an empty activityId when a title is given', async () => {
    const { tripId } = await createTripWithStop(user.agent, {
      name: 'Empty Activity Id',
      startOffset: 12,
      days: 3,
    });

    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: '',
      title: 'Free-form entry',
      date: dateOffset(12),
      startTime: '10:00',
      endTime: '11:00',
      notes: '',
      customCost: '',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.item.activityId).toBeNull();
    expect(response.body.data.item.notes).toBeNull();
    expect(response.body.data.item.customCost).toBeNull();
  });

  it('accepts an empty endTime for an open-ended entry', async () => {
    const { tripId } = await createTripWithStop(user.agent, {
      name: 'Open Ended',
      startOffset: 12,
      days: 3,
    });

    const response = await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      title: 'No end time',
      date: dateOffset(12),
      startTime: '10:00',
      endTime: '',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.item.endTime).toBeNull();
  });

  it('treats a zero-length body as no change', async () => {
    const response = await user.agent.put('/api/profile').send({});
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/nothing to update/i);
  });
});
