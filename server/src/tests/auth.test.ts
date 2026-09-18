import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_PASSWORD, app, prisma, setCookieOf, uniqueEmail } from '../test/helpers';

describe('Authentication', () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  async function register(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/auth/register')
      .send({
        name: 'New Traveller',
        email: uniqueEmail('signup'),
        password: DEFAULT_PASSWORD,
        confirmPassword: DEFAULT_PASSWORD,
        ...overrides,
      });
  }

  it('registers an account and starts a session', async () => {
    const email = uniqueEmail('signup');
    const response = await register({ email });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.id).toBeTruthy();
    createdIds.push(response.body.data.user.id);

    const cookies = setCookieOf(response);
    expect(cookies).toMatch(/gt_token=/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it('never returns the password hash', async () => {
    const response = await register();
    createdIds.push(response.body.data.user.id);
    expect(response.text).not.toMatch(/passwordHash/);
  });

  it('rejects a weak password', async () => {
    const response = await register({ password: 'short', confirmPassword: 'short' });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toHaveProperty('password');
  });

  it('rejects mismatched password confirmation', async () => {
    const response = await register({
      password: DEFAULT_PASSWORD,
      confirmPassword: 'Password1234!',
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toHaveProperty('confirmPassword');
  });

  it('rejects an invalid email address', async () => {
    const response = await register({ email: 'not-an-email' });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toHaveProperty('email');
  });

  it('rejects a duplicate email with 409', async () => {
    const first = await register();
    createdIds.push(first.body.data.user.id);

    const duplicate = await register({ email: first.body.data.user.email });
    expect(duplicate.status).toBe(409);
  });

  it('signs in with valid credentials', async () => {
    const email = uniqueEmail('login');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);

    const response = await request(app).post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(email);
    expect(setCookieOf(response)).toMatch(/gt_token=/);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const email = uniqueEmail('login');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'definitely-not-it' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: DEFAULT_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical wording prevents the endpoint being used to enumerate accounts.
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('keeps the session cookie off when "remember me" is not set', async () => {
    const email = uniqueEmail('session');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: DEFAULT_PASSWORD, rememberMe: false });
    const cookie = setCookieOf(response);
    // A session cookie has no Expires/Max-Age and dies with the browser.
    expect(cookie).not.toMatch(/Max-Age/i);
    expect(cookie).not.toMatch(/Expires/i);

    const remembered = await request(app)
      .post('/api/auth/login')
      .send({ email, password: DEFAULT_PASSWORD, rememberMe: true });
    expect(setCookieOf(remembered)).toMatch(/Max-Age/i);
  });

  it('returns the current user for an authenticated session', async () => {
    const email = uniqueEmail('me');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });
    const response = await agent.get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user).toHaveProperty('preferences');
  });

  it('protects private routes from anonymous callers', async () => {
    for (const path of ['/api/trips', '/api/dashboard', '/api/profile', '/api/saved']) {
      const response = await request(app).get(path);
      expect(response.status, `${path} should require a session`).toBe(401);
    }
  });

  it('signs out and invalidates the session', async () => {
    const email = uniqueEmail('logout');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });

    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('supports the forgot/reset password flow end to end', async () => {
    const email = uniqueEmail('reset');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.message).toMatch(/if an account exists/i);

    // Outside production the token is returned so the flow is testable without email.
    const token: string = forgot.body.data.developmentResetToken;
    expect(token).toBeTruthy();
    expect(forgot.body.data.developmentResetUrl).toContain('/reset-password?token=');

    const newPassword = 'BrandNewPass99';
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword, confirmPassword: newPassword });
    expect(reset.status).toBe(200);

    expect(
      (await request(app).post('/api/auth/login').send({ email, password: newPassword })).status,
    ).toBe(200);
    expect(
      (await request(app).post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD })).status,
    ).toBe(401);

    // Single use: the same token cannot be replayed.
    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'AnotherPass11', confirmPassword: 'AnotherPass11' });
    expect(replay.status).toBe(400);
  });

  it('does not reveal whether an address is registered', async () => {
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('nobody') });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.message).toMatch(/if an account exists/i);
    expect(unknown.body.data.developmentResetToken).toBeUndefined();
  });

  it('rejects an invalid reset token', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'a'.repeat(64),
        password: 'SomeValidPass1',
        confirmPassword: 'SomeValidPass1',
      });
    expect(response.status).toBe(400);
  });

  it('changes a password when the current one is supplied', async () => {
    const email = uniqueEmail('change');
    const registered = await register({ email });
    createdIds.push(registered.body.data.user.id);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });

    const wrong = await agent.post('/api/auth/change-password').send({
      currentPassword: 'not-the-password',
      password: 'ChangedPass22',
      confirmPassword: 'ChangedPass22',
    });
    expect(wrong.status).toBe(400);

    const ok = await agent.post('/api/auth/change-password').send({
      currentPassword: DEFAULT_PASSWORD,
      password: 'ChangedPass22',
      confirmPassword: 'ChangedPass22',
    });
    expect(ok.status).toBe(200);
    expect(
      (await request(app).post('/api/auth/login').send({ email, password: 'ChangedPass22' })).status,
    ).toBe(200);
  });
});
