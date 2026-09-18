import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './src/test/testDatabase';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    // Set before any test module loads, so Prisma connects to the test database.
    // dotenv does not override pre-existing variables, so this wins over .env.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
    },
    globalSetup: ['./src/test/globalSetup.ts'],
    // The suites share one database and mutate it, so they must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    restoreMocks: true,
  },
});
