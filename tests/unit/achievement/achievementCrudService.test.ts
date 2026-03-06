/**
 * Achievement CRUD Service — grantAchievement userId Validation Tests
 *
 * BUG 5: grantAchievement() validates the achievement exists but does NOT
 * validate the userId. If admin grants to a non-existent user, Prisma
 * throws a FK constraint violation, resulting in a generic error instead
 * of a clear "User not found" message.
 *
 * These tests verify that grantAchievement throws a descriptive error
 * when the userId doesn't exist.
 */

// ============================================================
// Mock setup (must be before imports)
// ============================================================

jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    achievement: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userAchievement: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================
// Import AFTER mocks
// ============================================================

import { grantAchievement } from '../../../src/services/achievement/achievementCrudService';
import { prisma } from '../../../src/lib/prisma';

const mockPrisma = prisma as any;

// ============================================================
// Tests
// ============================================================

describe('grantAchievement — userId validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws descriptive error when userId does not exist', async () => {
    // Achievement exists
    mockPrisma.achievement.findUnique.mockResolvedValue({
      id: 'ach-1',
      title: 'Test',
      threshold: 1,
    });

    // User does NOT exist
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      grantAchievement('ach-1', 'nonexistent-user-id')
    ).rejects.toThrow('User nonexistent-user-id not found');
  });

  test('proceeds to upsert when both achievement and user exist', async () => {
    // Achievement exists
    mockPrisma.achievement.findUnique.mockResolvedValue({
      id: 'ach-1',
      title: 'Test',
      threshold: 5,
    });

    // User exists
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // Upsert succeeds
    mockPrisma.userAchievement.upsert.mockResolvedValue({
      userId: 'user-1',
      achievementId: 'ach-1',
      isCompleted: true,
    });

    const result = await grantAchievement('ach-1', 'user-1');

    expect(result).toBeDefined();
    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalled();
  });

  test('still throws for non-existent achievement', async () => {
    // Achievement does NOT exist
    mockPrisma.achievement.findUnique.mockResolvedValue(null);

    await expect(
      grantAchievement('nonexistent-ach', 'user-1')
    ).rejects.toThrow('Achievement nonexistent-ach not found');
  });
});
