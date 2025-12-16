import { prismaTest, connectTestDb, disconnectTestDb } from './prismaTestClient';

// Extend Jest timeout for database operations
jest.setTimeout(30000);

/**
 * Transaction-based test isolation
 * Each test runs in a transaction that is rolled back after the test
 */

// Store the transaction client
let transactionClient: typeof prismaTest;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  // Start a new transaction for each test
  await prismaTest.$executeRawUnsafe('BEGIN');
});

afterEach(async () => {
  // Rollback the transaction after each test
  // This automatically cleans up all data created during the test
  await prismaTest.$executeRawUnsafe('ROLLBACK');
});

// Make prisma available globally for tests
declare global {
  var testPrisma: typeof prismaTest;
}

globalThis.testPrisma = prismaTest;

// Export for use in test files
export { prismaTest };
