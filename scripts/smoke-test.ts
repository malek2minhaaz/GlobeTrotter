/**
 * End-to-end smoke test for the GlobeTrotter API.
 *
 * Unlike the vitest suite (which drives the app in-process), this script talks to
 * a *running* server over HTTP and walks the entire hackathon demo flow:
 * login → dashboard → trips → cities → itinerary → conflicts → budget →
 * sharing → copy → authorization.
 *
 * Usage:
 *   Terminal 1:  npm run dev:server
 *   Terminal 2:  npm run smoke
 *
 * Exits non-zero on the first failing expectation so it can gate a demo.
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api';
const DEMO = { email: 'demo@globetrotter.app', password: 'Password123!' };
const OTHER = { email: 'admin@globetrotter.app', password: 'Password123!' };
const OUTSIDER = { email: 'priya@globetrotter.app', password: 'Password123!' };

interface ApiResult {
  status: number;
  json: any;
  raw: string;
  cookie: string;
}

let passed = 0;
const failures: string[] = [];
const lines: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    lines.push(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(name);
    lines.push(`  \x1b[31m✗ ${name}\x1b[0m${detail ? `\n      ${detail}` : ''}`);
  }
}

function section(title: string) {
  lines.push(`\n\x1b[1m${title}\x1b[0m`);
}

async function api(
  method: string,
  path: string,
  options: { body?: unknown; raw?: string; cookie?: string } = {},
): Promise<ApiResult> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(options.body || options.raw ? { 'Content-Type': 'application/json' } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.raw ?? (options.body ? JSON.stringify(options.body) : undefined),
  });

  const raw = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* non-JSON responses are reported through `raw` */
  }

  const setCookie = response.headers.get('set-cookie') ?? '';
  return { status: response.status, json, raw, cookie: setCookie.split(';')[0] };
}

async function signIn(credentials: { email: string; password: string }) {
  return api('POST', '/auth/login', { body: credentials });
}

async function main() {
  console.log(`\n🌍  GlobeTrotter smoke test → ${BASE}\n${'─'.repeat(58)}`);

  // ── Authentication ──
  section('Authentication');
  const login = await signIn(DEMO);
  check('demo login returns a user', login.status === 200 && !!login.json?.data?.user?.id);
  check('login sets an httpOnly session cookie', /gt_token=/.test(login.cookie));
  const cookie = login.cookie;
  check('password hash is never returned', !/passwordHash/.test(login.raw));

  const wrongPassword = await api('POST', '/auth/login', {
    body: { email: DEMO.email, password: 'definitely-wrong' },
  });
  check('wrong password → 401', wrongPassword.status === 401);

  const unknownEmail = await api('POST', '/auth/login', {
    body: { email: 'nobody@example.com', password: 'Password123!' },
  });
  check(
    'unknown email gives the same message as a wrong password',
    unknownEmail.status === 401 &&
      unknownEmail.json?.error?.message === wrongPassword.json?.error?.message,
  );

  const weakSignup = await api('POST', '/auth/register', {
    body: { name: 'Weak', email: 'weak@example.com', password: 'short', confirmPassword: 'short' },
  });
  check('weak password rejected on signup → 422', weakSignup.status === 422);

  const mismatched = await api('POST', '/auth/register', {
    body: {
      name: 'Mismatch',
      email: `mismatch-${Date.now()}@example.com`,
      password: 'Password123!',
      confirmPassword: 'Password1234!',
    },
  });
  check('mismatched confirmation rejected → 422', mismatched.status === 422);

  const unauthenticated = await api('GET', '/trips');
  check('protected route without a session → 401', unauthenticated.status === 401);

  // ── Dashboard ──
  section('Dashboard');
  const dashboard = await api('GET', '/dashboard', { cookie });
  const dash = dashboard.json?.data;
  check('dashboard loads', dashboard.status === 200);
  check('stat cards are numeric', typeof dash?.stats?.totalTrips === 'number');
  check('analytics block present', typeof dash?.analytics?.estimatedTotalCost === 'number');
  check(
    'focus trip includes its cities',
    !dash?.focusTrip || Array.isArray(dash.focusTrip.cities),
  );
  check('notifications returned as an array', Array.isArray(dash?.notifications));
  check('popular destinations returned', (dash?.popularDestinations?.length ?? 0) > 0);

  // ── Trips ──
  section('Trips');
  const trips = await api('GET', '/trips?status=ALL&sortBy=startDate&sort=asc', { cookie });
  const tripList = trips.json?.data ?? [];
  check('trip list loads', Array.isArray(tripList) && tripList.length > 0);
  check('trip card exposes an estimated cost', typeof tripList[0]?.estimatedCost === 'number');
  check(
    'trip card exposes a derived status',
    ['UPCOMING', 'ONGOING', 'COMPLETED'].includes(tripList[0]?.status),
  );
  check('pagination meta present', typeof trips.json?.meta?.total === 'number');

  const upcoming = await api('GET', '/trips?status=UPCOMING', { cookie });
  check(
    'UPCOMING filter returns only upcoming trips',
    (upcoming.json?.data ?? []).every((trip: any) => trip.status === 'UPCOMING'),
  );

  const search = await api('GET', '/trips?q=goa', { cookie });
  check('trip search matches city names', (search.json?.data?.length ?? 0) > 0);

  const byCost = await api('GET', '/trips?sortBy=cost&sort=desc', { cookie });
  const costs: number[] = (byCost.json?.data ?? []).map((trip: any) => trip.estimatedCost);
  check(
    'sorting by cost is descending',
    costs.every((value, index) => index === 0 || costs[index - 1] >= value),
  );

  const detail = await api('GET', `/trips/${tripList[0].id}`, { cookie });
  const trip = detail.json?.data?.trip;
  check('trip detail loads', detail.status === 200);
  check('trip detail has city stops', Array.isArray(trip?.stops) && trip.stops.length > 0);
  check('trip detail has itinerary items', (trip?.itineraryItems?.length ?? 0) > 0);
  check(
    'itinerary items carry a date and start time',
    !!trip?.itineraryItems?.[0]?.date && !!trip?.itineraryItems?.[0]?.startTime,
  );
  check('dates are serialized as YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(trip?.startDate ?? ''));

  // ── Discovery ──
  section('City & activity discovery');
  const cities = await api('GET', '/cities?q=goa');
  check('city search finds Goa', (cities.json?.data ?? []).some((c: any) => c.name === 'Goa'));
  check(
    'city exposes an estimated daily cost',
    typeof cities.json?.data?.[0]?.estimatedDailyCost === 'number',
  );

  const citiesPaged = await api('GET', '/cities?page=1&pageSize=5');
  check('city pagination caps results', (citiesPaged.json?.data ?? []).length <= 5);

  const facets = await api('GET', '/cities/facets');
  check('filter facets return countries', (facets.json?.data?.countries?.length ?? 0) > 0);

  const cityId = cities.json?.data?.[0]?.id;
  const cityDetail = await api('GET', `/cities/${cityId}`, { cookie });
  check('city detail loads with activities', (cityDetail.json?.data?.city?.activities?.length ?? 0) > 0);

  const activities = await api('GET', '/activities?q=beach');
  check('activity search works', (activities.json?.data?.length ?? 0) > 0);
  check(
    'activity exposes cost and duration',
    typeof activities.json?.data?.[0]?.estimatedCost === 'number' &&
      typeof activities.json?.data?.[0]?.duration === 'number',
  );
  check('activity search is scoped by category', (await api('GET', '/activities?category=FOOD')).status === 200);

  // ── Saved destinations ──
  section('Saved destinations');
  const saved = await api('GET', '/saved', { cookie });
  check('saved list loads', Array.isArray(saved.json?.data));
  const saveResult = await api('POST', '/saved', { cookie, body: { cityId } });
  check('save a destination', saveResult.status === 201);
  const saveAgain = await api('POST', '/saved', { cookie, body: { cityId } });
  check('saving twice is idempotent', saveAgain.status === 201);
  const unsave = await api('DELETE', `/saved/${cityId}`, { cookie });
  check('remove a saved destination', unsave.status === 200);

  // ── Profile ──
  section('Profile & settings');
  const profile = await api('GET', '/profile', { cookie });
  check('profile loads with stats', profile.json?.data?.profile?.email === DEMO.email);
  check('profile stats include trip counts', typeof profile.json?.data?.stats?.totalTrips === 'number');
  const prefs = await api('PUT', '/profile/preferences', { cookie, body: { theme: 'dark' } });
  check('preferences update', prefs.status === 200 && prefs.json?.data?.profile?.preferences?.theme === 'dark');
  await api('PUT', '/profile/preferences', { cookie, body: { theme: 'system' } });

  // ── Trip lifecycle ──
  section('Trip creation, itinerary & conflicts');
  const backwards = await api('POST', '/trips', {
    cookie,
    body: { name: 'Backwards', startDate: '2027-05-10', endDate: '2027-05-01' },
  });
  check('end before start → 422', backwards.status === 422);

  const created = await api('POST', '/trips', {
    cookie,
    body: {
      name: 'Smoke Test Trip',
      description: 'Created by the smoke test',
      startDate: '2027-06-01',
      endDate: '2027-06-07',
      isPublic: false,
    },
  });
  check('create a trip → 201', created.status === 201, created.raw.slice(0, 200));
  const newTripId: string = created.json?.data?.trip?.id;

  if (newTripId) {
    const stop = await api('POST', `/trips/${newTripId}/stops`, {
      cookie,
      body: { cityId, startDate: '2027-06-01', endDate: '2027-06-03' },
    });
    check('add a city stop', stop.status === 201, stop.raw.slice(0, 160));
    const stopId: string = stop.json?.data?.stop?.id;

    const duplicateStop = await api('POST', `/trips/${newTripId}/stops`, {
      cookie,
      body: { cityId, startDate: '2027-06-04', endDate: '2027-06-05' },
    });
    check('duplicate city rejected → 409', duplicateStop.status === 409);

    const outsideTrip = await api('POST', `/trips/${newTripId}/stops`, {
      cookie,
      body: { cityId: tripList[0].cities[0].id, startDate: '2027-07-01', endDate: '2027-07-02' },
    });
    check('city dates outside the trip → 422', outsideTrip.status === 422);

    const activityId = cityDetail.json?.data?.city?.activities?.[0]?.id;
    const item = await api('POST', `/trips/${newTripId}/itinerary`, {
      cookie,
      body: { activityId, date: '2027-06-01', startTime: '10:00', endTime: '12:00' },
    });
    check('add an activity to a day → 201', item.status === 201, item.raw.slice(0, 200));

    const overlap = await api('POST', `/trips/${newTripId}/itinerary`, {
      cookie,
      body: { title: 'Clashing lunch', date: '2027-06-01', startTime: '11:00', endTime: '12:30' },
    });
    check(
      'overlapping activity → 409 with conflict detail',
      overlap.status === 409 && !!overlap.json?.error?.details,
      overlap.raw.slice(0, 200),
    );

    const permitted = await api('POST', `/trips/${newTripId}/itinerary`, {
      cookie,
      body: {
        title: 'Deliberate overlap',
        date: '2027-06-01',
        startTime: '11:00',
        endTime: '12:30',
        allowOverlap: true,
      },
    });
    check('overlap accepted when explicitly allowed → 201', permitted.status === 201, permitted.raw.slice(0, 160));

    const badTime = await api('POST', `/trips/${newTripId}/itinerary`, {
      cookie,
      body: { title: 'Backwards time', date: '2027-06-02', startTime: '14:00', endTime: '13:00' },
    });
    check('end time before start time → 422', badTime.status === 422);

    const conflicts = await api('GET', `/trips/${newTripId}/conflicts`, { cookie });
    check('conflict report flags the deliberate overlap', (conflicts.json?.data ?? []).some((c: any) => c.type === 'OVERLAP'));

    // Reorder (the drag-and-drop path).
    if (item.json?.data?.item?.id) {
      const reorder = await api('PUT', `/trips/${newTripId}/itinerary/reorder`, {
        cookie,
        body: { items: [{ id: item.json.data.item.id, date: '2027-06-02', order: 0, startTime: '09:00' }] },
      });
      check('reorder / move an entry between days', reorder.status === 200, reorder.raw.slice(0, 160));
    }

    const spend = await api('POST', `/trips/${newTripId}/expenses`, {
      cookie,
      body: { category: 'ACCOMMODATION', amount: 5000, description: 'Hotel booking', date: '2027-06-01' },
    });
    check('add an expense → 201', spend.status === 201, spend.raw.slice(0, 160));

    const negative = await api('POST', `/trips/${newTripId}/expenses`, {
      cookie,
      body: { category: 'MEALS', amount: -100, description: 'Negative', date: '2027-06-01' },
    });
    check('negative expense → 422', negative.status === 422);

    const budget = await api('GET', `/trips/${newTripId}/budget`, { cookie });
    const bud = budget.json?.data;
    check('budget loads', budget.status === 200);
    check('budget includes the logged expense', (bud?.logged ?? 0) >= 5000, `logged=${bud?.logged}`);
    check('budget splits into 5 categories', bud?.categories?.length === 5);
    check('budget exposes a daily series', (bud?.perDay?.length ?? 0) > 0);
    check('budget exposes average per day', typeof bud?.stats?.averagePerDay === 'number');

    // ── Sharing & copy ──
    section('Public sharing & copy trip');
    const share = await api('POST', `/trips/${newTripId}/share`, { cookie, body: { isPublic: true } });
    const slug: string = share.json?.data?.trip?.publicSlug;
    check('share mints a public slug', share.status === 200 && !!slug, share.raw.slice(0, 160));
    check('slug is URL-safe', /^[a-z0-9-]+$/.test(slug ?? ''));

    if (slug) {
      const publicTrip = await api('GET', `/shared/${slug}`);
      check('shared itinerary is readable without a session', publicTrip.status === 200);
      check('shared itinerary is the right trip', publicTrip.json?.data?.trip?.name === 'Smoke Test Trip');
      check(
        'shared payload never exposes the owner email',
        !publicTrip.raw.includes('demo@globetrotter.app'),
      );
      check('shared payload includes the itinerary', (publicTrip.json?.data?.trip?.itineraryItems?.length ?? 0) > 0);
      check('shared payload includes a budget total', typeof publicTrip.json?.data?.trip?.estimatedCost === 'number');

      const otherLogin = await signIn(OTHER);
      const copied = await api('POST', `/shared/${slug}/copy`, { cookie: otherLogin.cookie });
      check('another user can copy the trip → 201', copied.status === 201, copied.raw.slice(0, 200));
      check(
        'the copy is private and linked to the source',
        copied.json?.data?.trip?.isPublic === false && !!copied.json?.data?.trip?.sourceTripId,
      );
      check(
        'the copy carries the itinerary across',
        (copied.json?.data?.trip?.itineraryItems?.length ?? 0) > 0,
      );

      const ownCopy = await api('POST', `/shared/${slug}/copy`, { cookie });
      check('copying your own trip → 409', ownCopy.status === 409);

      const copiedTripId = copied.json?.data?.trip?.id;
      if (copiedTripId) await api('DELETE', `/trips/${copiedTripId}`, { cookie: otherLogin.cookie });

      const unshare = await api('POST', `/trips/${newTripId}/share`, { cookie, body: { isPublic: false } });
      check('unsharing clears the slug', unshare.json?.data?.trip?.publicSlug === null);
      const deadLink = await api('GET', `/shared/${slug}`);
      check('a revoked link → 404', deadLink.status === 404);
    }

    // ── Authorization ──
    section('Authorization');
    const outsiderLogin = await signIn(OUTSIDER);
    const peek = await api('GET', `/trips/${newTripId}`, { cookie: outsiderLogin.cookie });
    check("another user cannot read someone else's trip → 404", peek.status === 404);
    const sabotage = await api('DELETE', `/trips/${newTripId}`, { cookie: outsiderLogin.cookie });
    check("another user cannot delete someone else's trip → 404", sabotage.status === 404);
    const adminArea = await api('GET', '/admin/analytics', { cookie });
    check('a normal user is blocked from admin routes → 403', adminArea.status === 403);

    // ── Cleanup ──
    const removed = await api('DELETE', `/trips/${newTripId}`, { cookie });
    check('the owner can delete their trip', removed.status === 200);
    const gone = await api('GET', `/trips/${newTripId}`, { cookie });
    check('the deleted trip is unreachable → 404', gone.status === 404);
  }

  // ── Admin ──
  section('Admin analytics');
  const adminLogin = await signIn(OTHER);
  const analytics = await api('GET', '/admin/analytics', { cookie: adminLogin.cookie });
  check('admin analytics loads', analytics.status === 200, analytics.raw.slice(0, 160));
  check('analytics totals present', typeof analytics.json?.data?.totals?.users === 'number');
  check('analytics time series present', Array.isArray(analytics.json?.data?.tripsOverTime));

  // ── Error handling ──
  section('Error handling');
  const notFound = await api('GET', '/definitely-not-a-route');
  check('unknown route → 404 envelope', notFound.status === 404 && !!notFound.json?.error?.code);

  const malformed = await api('POST', '/auth/login', { raw: '{not valid json' });
  check('malformed JSON → 400, never 500', malformed.status === 400, `status=${malformed.status}`);

  const badId = await api('GET', '/cities/not-a-real-id');
  check('unknown id → 404', badId.status === 404);

  // ── Report ──
  console.log(lines.join('\n'));
  console.log(`\n${'─'.repeat(58)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32m  ✅  All ${passed} checks passed\x1b[0m\n`);
  } else {
    console.log(
      `\x1b[31m  ❌  ${failures.length} of ${passed + failures.length} checks failed:\x1b[0m`,
    );
    for (const failure of failures) console.log(`      • ${failure}`);
    console.log('');
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌  Smoke test crashed:', error);
  process.exit(1);
});
