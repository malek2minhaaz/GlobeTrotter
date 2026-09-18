import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT, TEST_DATABASE_NAME, maintenanceUrl, testDatabaseUrl } from './testDatabase';

/**
 * Prepares an isolated test database before any suite runs:
 *   1. creates `globetrotter_test` if it does not exist
 *   2. applies migrations
 *   3. seeds it (tests rely on the real city/activity catalogue)
 *
 * Using a dedicated database means a test run can never damage development data,
 * and tests may delete rows freely.
 */
export default async function globalSetup() {
  const url = new URL(testDatabaseUrl());
  console.log(`\n🧪  Preparing isolated test database: ${TEST_DATABASE_NAME}\n`);

  const admin = new PrismaClient({ datasources: { db: { url: maintenanceUrl() } } });
  try {
    const existing = await admin.$queryRawUnsafe<Array<{ datname: string }>>(
      'SELECT datname FROM pg_database WHERE datname = $1',
      TEST_DATABASE_NAME,
    );
    if (existing.length === 0) {
      // Identifier cannot be parameterised, hence the manual quoting.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
      console.log(`   created ${TEST_DATABASE_NAME}`);
    } else {
      console.log(`   reusing existing ${TEST_DATABASE_NAME}`);
    }
  } finally {
    await admin.$disconnect();
  }

  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };
  const run = (args: string[]) =>
    execFileSync('npx', args, {
      cwd: REPO_ROOT,
      env,
      stdio: 'inherit',
      // npx is a shell script on Windows, so the command must go through a shell.
      shell: process.platform === 'win32',
    });

  run(['prisma', 'migrate', 'deploy', '--schema', path.join(REPO_ROOT, 'prisma/schema.prisma')]);
  run(['tsx', path.join(REPO_ROOT, 'prisma/seed.ts')]);

  console.log('✅  Test database ready\n');
}
