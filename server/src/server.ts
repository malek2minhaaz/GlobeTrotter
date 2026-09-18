import { createApp } from './app';
import { env, isProduction } from './config/env';
import { prisma } from './lib/prisma';

async function start() {
  const app = createApp();

  // Fail fast with an actionable message rather than serving 500s on every
  // request because the database is unreachable.
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅  Database connection established');
  } catch (error) {
    console.error(
      '\n❌  Could not connect to the database.\n' +
        '    Check DATABASE_URL in .env, then run `npm run prisma:migrate && npm run seed`.\n',
    );
    if (!isProduction) console.error(error);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`\n🌍  GlobeTrotter API ready`);
    console.log(`    → http://localhost:${env.PORT}/api/health`);
    console.log(`    → accepting requests from ${env.CLIENT_URL}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Don't hang forever if a connection refuses to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void start();
