import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

/**
 * Prisma client instance for tests
 * Uses the test database from .env.test
 */
export const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.DEBUG_PRISMA ? ['query', 'info', 'warn', 'error'] : ['error'],
});

/**
 * Connect to the test database
 */
export async function connectTestDb() {
  await prismaTest.$connect();
}

/**
 * Disconnect from the test database
 */
export async function disconnectTestDb() {
  await prismaTest.$disconnect();
}

/**
 * Clean all tables in the test database
 * Use with caution - this deletes all data
 */
export async function cleanTestDb() {
  const tablenames = await prismaTest.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }
}
