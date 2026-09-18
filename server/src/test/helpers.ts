import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

/**
 * Shared fixtures for the integration suites.
 *
 * These drive the real Express app in-process through supertest, so every request
 * passes through the actual middleware stack — validation, authentication,
 * cookies, ownership checks and the error handler — rather than calling services
 * directly. That makes the tests a genuine check of the API contract.
 */
export const app = createApp();

export const DEFAULT_PASSWORD = 'Password123!';

/** A cookie-preserving client, so a login persists across requests. */
export type Agent = ReturnType<typeof request.agent>;

let counter = 0;

export function uniqueEmail(prefix = 'tester'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.test`;
}

/** `YYYY-MM-DD` relative to today, for trips that are genuinely upcoming. */
export function dateOffset(days: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  agent: Agent;
}

/**
 * Reads `Set-Cookie` as a single string. Node types it as `string` while other
 * runtimes hand back an array, so both shapes are handled.
 */
export function setCookieOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  if (Array.isArray(raw)) return raw.join('; ');
  return typeof raw === 'string' ? raw : '';
}

export async function createUser(
  options: { name?: string; email?: string; role?: 'USER' | 'ADMIN' } = {},
): Promise<TestUser> {
  const email = options.email ?? uniqueEmail();
  const password = DEFAULT_PASSWORD;

  const registered = await request(app)
    .post('/api/auth/register')
    .send({
      name: options.name ?? 'Test Traveller',
      email,
      password,
      confirmPassword: password,
    });

  if (registered.status !== 201) {
    throw new Error(`Could not register test user: ${registered.status} ${registered.text}`);
  }

  const id: string = registered.body.data.user.id;

  if (options.role === 'ADMIN') {
    await prisma.user.update({ where: { id }, data: { role: 'ADMIN' } });
  }

  // A dedicated agent keeps each user's session cookie separate.
  const agent = request.agent(app);
  const loggedIn = await agent.post('/api/auth/login').send({ email, password });
  if (loggedIn.status !== 200) {
    throw new Error(`Could not sign in test user: ${loggedIn.status} ${loggedIn.text}`);
  }

  return { id, email, password, agent };
}

export async function signInAs(email: string, password = DEFAULT_PASSWORD): Promise<Agent> {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Could not sign in ${email}: ${response.status} ${response.text}`);
  }
  return agent;
}

/** Deletes the users created by a suite, cascading their trips and expenses. */
export async function removeUsers(users: TestUser[]): Promise<void> {
  const ids = users.map((user) => user.id).filter(Boolean);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** A seeded city that definitely has activities, for building trips. */
export async function cityWithActivities() {
  const city = await prisma.city.findFirst({
    where: { activities: { some: {} } },
    include: { activities: { orderBy: { popularity: 'desc' }, take: 4 } },
    orderBy: { popularity: 'desc' },
  });
  if (!city) {
    throw new Error('No seeded cities found — the test database was not seeded.');
  }
  return city;
}

/** A second city in a different country, for multi-city trips. */
export async function anotherCityWithActivities(excludeCityId: string) {
  const city = await prisma.city.findFirst({
    where: { id: { not: excludeCityId }, activities: { some: {} } },
    include: { activities: { orderBy: { popularity: 'desc' }, take: 2 } },
    orderBy: { popularity: 'desc' },
  });
  if (!city) throw new Error('No second seeded city found.');
  return city;
}

/** Creates a trip with one stop and returns both ids. */
export async function createTripWithStop(
  agent: Agent,
  options: {
    name?: string;
    startOffset?: number;
    days?: number;
    isPublic?: boolean;
    budgetLimit?: number;
  } = {},
) {
  const city = await cityWithActivities();
  const startOffset = options.startOffset ?? 30;
  const days = options.days ?? 4;

  const created = await agent.post('/api/trips').send({
    name: options.name ?? 'Test Trip',
    description: 'Created by an automated test',
    startDate: dateOffset(startOffset),
    endDate: dateOffset(startOffset + days - 1),
    isPublic: options.isPublic ?? false,
    ...(options.budgetLimit !== undefined ? { budgetLimit: options.budgetLimit } : {}),
  });

  if (created.status !== 201) {
    throw new Error(`Could not create trip: ${created.status} ${created.text}`);
  }

  const tripId: string = created.body.data.trip.id;

  const stop = await agent.post(`/api/trips/${tripId}/stops`).send({
    cityId: city.id,
    startDate: dateOffset(startOffset),
    endDate: dateOffset(startOffset + days - 1),
  });

  if (stop.status !== 201) {
    throw new Error(`Could not add stop: ${stop.status} ${stop.text}`);
  }

  return { tripId, stopId: stop.body.data.stop.id as string, city, trip: created.body.data.trip };
}

export { prisma };
