import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Locates the repository root by walking up from the working directory until the
 * Prisma schema is found. This deliberately avoids `import.meta.url`, which the
 * server's CommonJS-targeting tsconfig rejects.
 */
function findRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'prisma', 'schema.prisma'))) return candidate;
  }
  throw new Error('Could not locate the repository root (prisma/schema.prisma not found).');
}

export const REPO_ROOT = findRepoRoot();

loadEnv({ path: path.join(REPO_ROOT, '.env') });

/** Tests never touch the development database. */
export const TEST_DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? 'globetrotter_test';

function baseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  }
  return url;
}

/** The database the test run uses, e.g. `.../globetrotter_test`. */
export function testDatabaseUrl(): string {
  const url = new URL(baseUrl());
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

/** The maintenance database, used only to CREATE the test database. */
export function maintenanceUrl(): string {
  const url = new URL(baseUrl());
  url.pathname = '/postgres';
  return url.toString();
}
