import 'server-only';
import { PrismaClient } from '@prisma/client';

// One PrismaClient per process. In development Next.js re-evaluates modules on
// every change, so the instance is cached on globalThis to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
