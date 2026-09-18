import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';

/**
 * A single PrismaClient per process. In development the instance is cached on
 * `globalThis` so `tsx watch` reloads do not exhaust the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
