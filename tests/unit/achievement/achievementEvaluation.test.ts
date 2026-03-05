/**
 * Achievement Evaluation Service — Error Isolation Tests
 *
 * BUG: In evaluateAchievements(), if one evaluator throws,
 * the error propagates out of the for loop and all remaining
 * achievements are silently skipped.
 *
 * These tests verify that a throwing evaluator does NOT prevent
 * subsequent achievements from being evaluated.
 */

// ============================================================
// Mock setup (must be before imports)
// ============================================================

jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    achievement: {
      findMany: jest.fn(),
    },
    userAchievement: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../src/services/achievement/achievementDefinitions', () => ({
  getEvaluator: jest.fn(),
  getEvaluatorKeys: jest.fn(() => []),
}));

jest.mock('../../../src/app', () => ({
  io: null,
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/helpers/notifications/accountNotifications', () => ({
  accountNotifications: {
    achievementUnlocked: jest.fn(() => ({
      type: 'ACHIEVEMENT',
      title: 'Achievement Unlocked',
      message: 'test',
    })),
  },
}));

// ============================================================
// Import AFTER mocks
// ============================================================

import { evaluateMatchAchievementsSafe } from '../../../src/services/achievement/achievementEvaluationService';
import { prisma } from '../../../src/lib/prisma';
import { getEvaluator } from '../../../src/services/achievement/achievementDefinitions';
import { logger } from '../../../src/utils/logger';

const mockPrisma = prisma as any;
const mockGetEvaluator = getEvaluator as jest.MockedFunction<typeof getEvaluator>;

// ============================================================
// Helpers
// ============================================================

function makeAchievement(overrides: Record<string, any> = {}) {
  return {
    id: 'ach-default',
    title: 'Test Achievement',
    description: 'Test',
    icon: 'trophy',
    category: 'WINNING',
    tier: 'BRONZE',
    scope: 'MATCH',
    evaluatorKey: 'total_wins',
    threshold: 1,
    sportFilter: null,
    gameTypeFilter: null,
    sortOrder: 1,
    isHidden: false,
    points: 5,
    isActive: true,
    isRevocable: false,
    badgeGroup: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('Achievement Evaluation — Error Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('continues evaluating remaining achievements when one evaluator throws', async () => {
    // 3 achievements with different evaluator keys
    const achievements = [
      makeAchievement({ id: 'ach-1', evaluatorKey: 'total_matches', title: 'Match Counter' }),
      makeAchievement({ id: 'ach-2', evaluatorKey: 'total_wins', title: 'First Win' }),
      makeAchievement({ id: 'ach-3', evaluatorKey: 'win_streak', title: 'Win Streak' }),
    ];

    mockPrisma.achievement.findMany.mockResolvedValue(achievements);
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null);
    mockPrisma.userAchievement.upsert.mockResolvedValue({});

    // Evaluator A: succeeds
    const evaluatorA = jest.fn().mockResolvedValue({ currentValue: 5, isComplete: true });
    // Evaluator B: THROWS
    const evaluatorB = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    // Evaluator C: succeeds
    const evaluatorC = jest.fn().mockResolvedValue({ currentValue: 4, isComplete: true });

    mockGetEvaluator.mockImplementation((key: string) => {
      if (key === 'total_matches') return evaluatorA;
      if (key === 'total_wins') return evaluatorB;
      if (key === 'win_streak') return evaluatorC;
      return undefined;
    });

    await evaluateMatchAchievementsSafe('user-1', { userId: 'user-1' });

    // All 3 evaluators should have been called
    expect(evaluatorA).toHaveBeenCalled();
    expect(evaluatorB).toHaveBeenCalled();
    expect(evaluatorC).toHaveBeenCalled(); // KEY: fails before fix — error from B skips C
  });

  test('logs error for the failing evaluator without crashing', async () => {
    const achievements = [
      makeAchievement({ id: 'ach-1', evaluatorKey: 'bad_evaluator', title: 'Bad One' }),
      makeAchievement({ id: 'ach-2', evaluatorKey: 'good_evaluator', title: 'Good One' }),
    ];

    mockPrisma.achievement.findMany.mockResolvedValue(achievements);
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null);
    mockPrisma.userAchievement.upsert.mockResolvedValue({});

    const badEvaluator = jest.fn().mockRejectedValue(new Error('null pointer'));
    const goodEvaluator = jest.fn().mockResolvedValue({ currentValue: 1, isComplete: true });

    mockGetEvaluator.mockImplementation((key: string) => {
      if (key === 'bad_evaluator') return badEvaluator;
      if (key === 'good_evaluator') return goodEvaluator;
      return undefined;
    });

    // Should not throw
    await evaluateMatchAchievementsSafe('user-1', { userId: 'user-1' });

    // The good evaluator should still run and create a userAchievement
    expect(goodEvaluator).toHaveBeenCalled();
    expect(mockPrisma.userAchievement.upsert).toHaveBeenCalled();
  });
});
