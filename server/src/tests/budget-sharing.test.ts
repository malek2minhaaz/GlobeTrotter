import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type TestUser,
  app,
  createTripWithStop,
  createUser,
  dateOffset,
  removeUsers,
} from '../test/helpers';

describe('Budget management', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser({ name: 'Budget Keeper' });
  });

  afterAll(async () => {
    await removeUsers([user]);
  });

  it('starts a fresh trip at zero cost', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Zero Budget', days: 3 });
    const budget = await user.agent.get(`/api/trips/${tripId}/budget`);

    expect(budget.status).toBe(200);
    expect(budget.body.data.total).toBe(0);
    expect(budget.body.data.categories).toHaveLength(5);
    expect(budget.body.data.stats.expenseCount).toBe(0);
    // Every day of the trip appears in the series, even with no spend.
    expect(budget.body.data.perDay).toHaveLength(3);
  });

  it('adds an expense and rolls it into the totals', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Expenses', days: 3 });

    const added = await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'ACCOMMODATION',
      amount: 5000,
      description: 'Hotel booking',
      date: dateOffset(30),
    });
    expect(added.status).toBe(201);
    expect(added.body.data.expense.amount).toBe(5000);

    await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: 1500,
      description: 'Dinners',
      date: dateOffset(31),
    });

    const budget = await user.agent.get(`/api/trips/${tripId}/budget`);
    const data = budget.body.data;
    expect(data.logged).toBe(6500);
    expect(data.total).toBe(6500);
    expect(data.categories.find((c: { category: string }) => c.category === 'ACCOMMODATION').amount).toBe(5000);
    expect(data.categories.find((c: { category: string }) => c.category === 'MEALS').amount).toBe(1500);
    expect(data.stats.expenseCount).toBe(2);
  });

  it('includes planned activity costs in the estimate', async () => {
    const { tripId, city } = await createTripWithStop(user.agent, { name: 'Planned', days: 3 });
    const activity = city.activities[0];

    await user.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: activity.id,
      date: dateOffset(30),
      startTime: '10:00',
      endTime: '12:00',
    });

    const budget = await user.agent.get(`/api/trips/${tripId}/budget`);
    expect(budget.body.data.planned).toBe(Number(activity.estimatedCost));
    expect(budget.body.data.total).toBe(Number(activity.estimatedCost));
  });

  it('rejects negative and zero amounts', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Bad Amounts', days: 2 });

    const negative = await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: -100,
      description: 'Negative',
      date: dateOffset(30),
    });
    expect(negative.status).toBe(422);

    const zero = await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: 0,
      description: 'Zero',
      date: dateOffset(30),
    });
    expect(zero.status).toBe(422);
  });

  it('rejects an invalid expense category', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Bad Category', days: 2 });
    const response = await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'SPACEFLIGHT',
      amount: 100,
      description: 'Nope',
      date: dateOffset(30),
    });
    expect(response.status).toBe(422);
  });

  it('updates and deletes expenses', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Edit Expense', days: 3 });
    const created = await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'TRANSPORT',
      amount: 2000,
      description: 'Taxi',
      date: dateOffset(30),
    });
    const expenseId = created.body.data.expense.id;

    const updated = await user.agent.put(`/api/expenses/${expenseId}`).send({ amount: 2500 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.expense.amount).toBe(2500);

    expect((await user.agent.delete(`/api/expenses/${expenseId}`)).status).toBe(200);
    expect((await user.agent.delete(`/api/expenses/${expenseId}`)).status).toBe(404);

    const budget = await user.agent.get(`/api/trips/${tripId}/budget`);
    expect(budget.body.data.total).toBe(0);
  });

  it('computes daily statistics', async () => {
    const { tripId } = await createTripWithStop(user.agent, { name: 'Daily Stats', days: 4 });

    await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: 1000,
      description: 'Big day',
      date: dateOffset(30),
    });
    await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'MEALS',
      amount: 200,
      description: 'Cheap day',
      date: dateOffset(31),
    });

    const budget = await user.agent.get(`/api/trips/${tripId}/budget`);
    const stats = budget.body.data.stats;

    expect(stats.highestDay.total).toBe(1000);
    expect(stats.cheapestDay.total).toBe(200);
    // 1200 across four days.
    expect(stats.averagePerDay).toBe(300);
    expect(stats.spendDays).toBe(2);
  });

  it('flags an over-budget trip and reports the overspend', async () => {
    const { tripId } = await createTripWithStop(user.agent, {
      name: 'Over Budget',
      days: 3,
      budgetLimit: 30000,
    });

    const within = await user.agent.get(`/api/trips/${tripId}/budget`);
    expect(within.body.data.isOverBudget).toBe(false);
    expect(within.body.data.remaining).toBe(30000);

    await user.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'ACCOMMODATION',
      amount: 32500,
      description: 'Luxury hotel',
      date: dateOffset(30),
    });

    const over = await user.agent.get(`/api/trips/${tripId}/budget`);
    const data = over.body.data;
    expect(data.isOverBudget).toBe(true);
    expect(data.overBudgetBy).toBe(2500);
    expect(data.remaining).toBe(-2500);
    expect(data.usedPercent).toBeGreaterThan(100);
    expect(data.budgetLimit).toBe(30000);
  });

  it("refuses to budget another user's trip", async () => {
    const other = await createUser({ name: 'Budget Intruder' });
    try {
      const { tripId } = await createTripWithStop(user.agent, { name: 'Private Budget', days: 2 });
      expect((await other.agent.get(`/api/trips/${tripId}/budget`)).status).toBe(404);
      expect(
        (
          await other.agent.post(`/api/trips/${tripId}/expenses`).send({
            category: 'MEALS',
            amount: 10,
            description: 'Sneaky',
            date: dateOffset(30),
          })
        ).status,
      ).toBe(404);
    } finally {
      await removeUsers([other]);
    }
  });
});

describe('Public sharing and copying', () => {
  let owner: TestUser;
  let visitor: TestUser;

  beforeAll(async () => {
    owner = await createUser({ name: 'Sharing Owner' });
    visitor = await createUser({ name: 'Curious Visitor' });
  });

  afterAll(async () => {
    await removeUsers([owner, visitor]);
  });

  /** A public trip with one itinerary entry, ready to share. */
  async function publicTrip() {
    const { tripId, city, trip } = await createTripWithStop(owner.agent, {
      name: 'Goa Adventure',
      startOffset: 15,
      days: 4,
    });
    await owner.agent.post(`/api/trips/${tripId}/itinerary`).send({
      activityId: city.activities[0].id,
      date: trip.startDate,
      startTime: '10:00',
      endTime: '12:00',
    });
    await owner.agent.post(`/api/trips/${tripId}/expenses`).send({
      category: 'ACCOMMODATION',
      amount: 8000,
      description: 'Beach resort',
      date: trip.startDate,
    });

    const shared = await owner.agent.post(`/api/trips/${tripId}/share`).send({ isPublic: true });
    return { tripId, slug: shared.body.data.trip.publicSlug as string, city };
  }

  it('mints a URL-safe slug when a trip is shared', async () => {
    const { slug, tripId } = await publicTrip();
    expect(slug).toBeTruthy();
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).toContain('goa');

    const detail = await owner.agent.get(`/api/trips/${tripId}`);
    expect(detail.body.data.trip.isPublic).toBe(true);
  });

  it('serves a shared itinerary to anonymous visitors', async () => {
    const { slug } = await publicTrip();
    const response = await request(app).get(`/api/shared/${slug}`);

    expect(response.status).toBe(200);
    const trip = response.body.data.trip;
    expect(trip.name).toBe('Goa Adventure');
    expect(trip.itineraryItems.length).toBeGreaterThan(0);
    expect(trip.stops.length).toBeGreaterThan(0);
    expect(trip.estimatedCost).toBeGreaterThan(0);
    expect(trip.owner.name).toBe('Sharing Owner');
  });

  it('never exposes private account information on a public itinerary', async () => {
    const { slug } = await publicTrip();
    const response = await request(app).get(`/api/shared/${slug}`);

    // Emails, password hashes and preference flags must not appear anywhere.
    expect(response.text).not.toContain(owner.email);
    expect(response.text).not.toContain('passwordHash');
    expect(response.text).not.toContain('preferences');
  });

  it('counts views of a shared itinerary', async () => {
    const { slug } = await publicTrip();
    await request(app).get(`/api/shared/${slug}`);
    await request(app).get(`/api/shared/${slug}`);

    const response = await request(app).get(`/api/shared/${slug}`);
    expect(response.body.data.trip.viewCount).toBeGreaterThanOrEqual(2);
  });

  it('404s an unknown share link', async () => {
    expect((await request(app).get('/api/shared/does-not-exist-abcde')).status).toBe(404);
  });

  it('revokes access when a trip is made private again', async () => {
    const { tripId, slug } = await publicTrip();

    const unshared = await owner.agent.post(`/api/trips/${tripId}/share`).send({ isPublic: false });
    expect(unshared.body.data.trip.publicSlug).toBeNull();
    expect((await request(app).get(`/api/shared/${slug}`)).status).toBe(404);
  });

  it('copies a shared itinerary into another account', async () => {
    const { slug, tripId } = await publicTrip();

    const response = await visitor.agent.post(`/api/shared/${slug}/copy`);
    expect(response.status).toBe(201);

    const copy = response.body.data.trip;
    expect(copy.id).not.toBe(tripId);
    expect(copy.name).toBe('Goa Adventure (copy)');
    // The copy is private and traceable to its source.
    expect(copy.isPublic).toBe(false);
    expect(copy.publicSlug).toBeNull();
    expect(copy.sourceTripId).toBe(tripId);
    // Content comes across: cities, itinerary and expenses.
    expect(copy.stops.length).toBeGreaterThan(0);
    expect(copy.itineraryItems.length).toBeGreaterThan(0);
    expect(copy.estimatedCost).toBeGreaterThan(0);
  });

  it('leaves the original untouched when it is copied', async () => {
    const { slug, tripId } = await publicTrip();
    const before = await request(app).get(`/api/shared/${slug}`);

    await visitor.agent.post(`/api/shared/${slug}/copy`);

    const after = await request(app).get(`/api/shared/${slug}`);
    expect(after.body.data.trip.name).toBe(before.body.data.trip.name);
    expect(after.body.data.trip.itineraryItems.length).toBe(
      before.body.data.trip.itineraryItems.length,
    );
    expect(after.body.data.trip.estimatedCost).toBe(before.body.data.trip.estimatedCost);
    expect(after.body.data.trip.stops.length).toBe(before.body.data.trip.stops.length);

    // And the original still belongs to its owner.
    const detail = await owner.agent.get(`/api/trips/${tripId}`);
    expect(detail.status).toBe(200);
  });

  it('produces an editable copy', async () => {
    const { slug } = await publicTrip();
    const copy = await visitor.agent.post(`/api/shared/${slug}/copy`);
    const copyId = copy.body.data.trip.id;

    const renamed = await visitor.agent
      .put(`/api/trips/${copyId}`)
      .send({ name: 'My Own Version' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.trip.name).toBe('My Own Version');

    const itemId = copy.body.data.trip.itineraryItems[0].id;
    const edited = await visitor.agent
      .put(`/api/itinerary-items/${itemId}`)
      .send({ notes: 'Changed on my copy' });
    expect(edited.status).toBe(200);
  });

  it('refuses to copy your own trip', async () => {
    const { slug } = await publicTrip();
    const response = await owner.agent.post(`/api/shared/${slug}/copy`);
    expect(response.status).toBe(409);
  });

  it('requires a session to copy', async () => {
    const { slug } = await publicTrip();
    const response = await request(app).post(`/api/shared/${slug}/copy`);
    expect(response.status).toBe(401);
  });

  it('refuses to copy a private trip', async () => {
    const { tripId } = await createTripWithStop(owner.agent, { name: 'Not Shared' });
    const detail = await owner.agent.get(`/api/trips/${tripId}`);
    expect(detail.body.data.trip.publicSlug).toBeNull();
    expect((await visitor.agent.post('/api/shared/not-shared-00000/copy')).status).toBe(404);
  });
});
