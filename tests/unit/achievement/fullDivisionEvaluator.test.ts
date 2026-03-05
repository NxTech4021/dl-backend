/**
 * fullDivision Evaluator — Behavior Tests
 *
 * BUG 3: fullDivision() originally had an N+1 query — one matchResult.findMany
 * per division assignment inside a loop. Refactored to a single batch query.
 *
 * The evaluator counts how many finished divisions the user played
 * every opponent in. "Full division" = distinct opponents >= divisionSize - 1.
 */

// ============================================================
// Mock setup (must be before imports)
// ============================================================

jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    divisionAssignment: {
      findMany: jest.fn(),
    },
    matchResult: {
      findMany: jest.fn(),
    },
  },
}));

// ============================================================
// Import AFTER mocks
// ============================================================

import { getEvaluator } from '../../../src/services/achievement/achievementDefinitions';
import { prisma } from '../../../src/lib/prisma';

const mockPrisma = prisma as any;

// ============================================================
// Helpers
// ============================================================

/** Build a match result with divisionId for the batch query shape */
function mr(opponentId: string, divisionId: string) {
  return { opponentId, match: { divisionId } };
}

// ============================================================
// Tests
// ============================================================

describe('fullDivision evaluator — behavior', () => {
  const evaluator = getEvaluator('full_division')!;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('evaluator is registered', () => {
    expect(evaluator).toBeDefined();
    expect(typeof evaluator).toBe('function');
  });

  test('returns 0 when user has no division assignments', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([]);

    const result = await evaluator({ userId: 'user-1' }, 1);

    expect(result).toEqual({ currentValue: 0, isComplete: false });
  });

  test('counts 1 when user played all opponents in a division', async () => {
    // Division with 4 players (user + 3 opponents)
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-1' },
            { userId: 'opp-2' },
            { userId: 'opp-3' },
          ],
        },
      },
    ]);

    // User played all 3 opponents in div-1
    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
      mr('opp-2', 'div-1'),
      mr('opp-3', 'div-1'),
    ]);

    const result = await evaluator({ userId: 'user-1' }, 1);

    expect(result).toEqual({ currentValue: 1, isComplete: true });
  });

  test('does not count division where user missed an opponent', async () => {
    // Division with 4 players
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-1' },
            { userId: 'opp-2' },
            { userId: 'opp-3' },
          ],
        },
      },
    ]);

    // User only played 2 of 3 opponents
    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
      mr('opp-2', 'div-1'),
    ]);

    const result = await evaluator({ userId: 'user-1' }, 1);

    expect(result).toEqual({ currentValue: 0, isComplete: false });
  });

  test('counts multiple full divisions across different seasons', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-1' },
            { userId: 'opp-2' },
          ],
        },
      },
      {
        divisionId: 'div-2',
        division: {
          seasonId: 'season-2',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-3' },
            { userId: 'opp-4' },
          ],
        },
      },
    ]);

    // Both divisions fully played — single batch result
    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
      mr('opp-2', 'div-1'),
      mr('opp-3', 'div-2'),
      mr('opp-4', 'div-2'),
    ]);

    const result = await evaluator({ userId: 'user-1' }, 2);

    expect(result).toEqual({ currentValue: 2, isComplete: true });
  });

  test('mixed: one full division, one incomplete', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-1' },
            { userId: 'opp-2' },
          ],
        },
      },
      {
        divisionId: 'div-2',
        division: {
          seasonId: 'season-2',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-3' },
            { userId: 'opp-4' },
            { userId: 'opp-5' },
          ],
        },
      },
    ]);

    // div-1: played both (complete), div-2: played 2 of 3 (incomplete)
    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
      mr('opp-2', 'div-1'),
      mr('opp-3', 'div-2'),
      mr('opp-4', 'div-2'),
    ]);

    const result = await evaluator({ userId: 'user-1' }, 1);

    expect(result).toEqual({ currentValue: 1, isComplete: true });
  });

  test('skips divisions with 1 or fewer members', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-empty',
        division: {
          seasonId: 'season-1',
          assignments: [{ userId: 'user-1' }], // Only 1 member
        },
      },
    ]);

    const result = await evaluator({ userId: 'user-1' }, 1);

    // No matchResult.findMany should be called (skipped — no valid divisions)
    expect(mockPrisma.matchResult.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ currentValue: 0, isComplete: false });
  });

  test('threshold comparison: currentValue < threshold means isComplete false', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [
            { userId: 'user-1' },
            { userId: 'opp-1' },
          ],
        },
      },
    ]);

    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
    ]);

    // User has 1 full division but threshold is 3
    const result = await evaluator({ userId: 'user-1' }, 3);

    expect(result).toEqual({ currentValue: 1, isComplete: false });
  });

  test('uses single batch query instead of N+1', async () => {
    mockPrisma.divisionAssignment.findMany.mockResolvedValue([
      {
        divisionId: 'div-1',
        division: {
          seasonId: 'season-1',
          assignments: [{ userId: 'user-1' }, { userId: 'opp-1' }],
        },
      },
      {
        divisionId: 'div-2',
        division: {
          seasonId: 'season-2',
          assignments: [{ userId: 'user-1' }, { userId: 'opp-2' }],
        },
      },
      {
        divisionId: 'div-3',
        division: {
          seasonId: 'season-3',
          assignments: [{ userId: 'user-1' }, { userId: 'opp-3' }],
        },
      },
    ]);

    mockPrisma.matchResult.findMany.mockResolvedValue([
      mr('opp-1', 'div-1'),
      mr('opp-2', 'div-2'),
      mr('opp-3', 'div-3'),
    ]);

    await evaluator({ userId: 'user-1' }, 1);

    // KEY: only 1 matchResult.findMany call, not 3 (one per division)
    expect(mockPrisma.matchResult.findMany).toHaveBeenCalledTimes(1);
  });
});
