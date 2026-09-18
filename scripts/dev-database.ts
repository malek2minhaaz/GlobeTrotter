/**
 * Optional zero-setup local PostgreSQL.
 *
 * GlobeTrotter works with any PostgreSQL — a local server, Docker, or a hosted
 * provider such as Neon. For contributors who have none of those, this script
 * downloads a real PostgreSQL binary and runs it on a spare port, so `npm run
 * db:local` is all that stands between a fresh clone and a working database.
 *
 * It writes nothing to the project except a gitignored `.pgdata` directory, and
 * it is never used by the application itself — only by whoever runs it manually.
 *
 *   Terminal 1:  npm run db:local
 *   Terminal 2:  npm run prisma:push && npm run seed && npm run dev
 *
 * Press Ctrl+C to stop the server. Data persists between runs.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.LOCAL_DB_PORT ?? 55432);
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASE = 'globetrotter';
const DATA_DIR = path.resolve(__dirname, '../.pgdata');

function isInitialised(): boolean {
  // initdb drops a PG_VERSION file; its presence means the cluster already exists.
  return fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Without this, initdb inherits the Windows system locale and creates a
    // WIN1252 database, which cannot store characters such as "œ" or Japanese
    // text. UTF-8 matches what a hosted Postgres gives you, so local behaviour
    // does not diverge from production.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (!isInitialised()) {
    console.log('📦  Initialising a new PostgreSQL cluster in .pgdata …');
    await pg.initialise();
  }

  await pg.start();
  console.log(`✅  PostgreSQL is running on port ${PORT}`);

  try {
    await pg.createDatabase(DATABASE);
    console.log(`✅  Created database "${DATABASE}"`);
  } catch {
    // Already created on a previous run — entirely expected.
    console.log(`ℹ️   Database "${DATABASE}" already exists`);
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`;
  console.log(
    '\n─────────────────────────────────────────────────────────────\n' +
      'Put this in your .env as DATABASE_URL:\n\n' +
      `  DATABASE_URL=${url}\n` +
      '─────────────────────────────────────────────────────────────\n' +
      '\nThen, in another terminal:\n' +
      '  npm run prisma:push && npm run seed && npm run dev\n' +
      '\nCtrl+C to stop the database.\n',
  );

  const shutdown = async () => {
    console.log('\nStopping PostgreSQL …');
    await pg.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Park here so the database stays up until the user interrupts.
  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error('\n❌  Could not start the local database:\n', error);
  process.exit(1);
});
