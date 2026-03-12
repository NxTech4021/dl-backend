/**
 * Score Submission Race Condition Tests — Issue #101
 *
 * Tests for guards that prevent race conditions in score submission,
 * confirmation, and walkover flows.
 *
 * Each test proves a specific race condition guard exists and works.
 */

// ── Mocks ── Must be BEFORE any imports that use them ──

jest.mock('../../../src/lib/prisma', () => {
  const mockTx = {
    match: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    matchScore: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    pickleballGameScore: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    matchComment: {
      create: jest.fn(),
    },
    matchDispute: {
      create: jest.fn(),
    },
    matchWalkover: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  return {
    prisma: {
      match: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      matchParticipant: {
        findMany: jest.fn(),
      },
      matchScore: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      pickleballGameScore: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      matchComment: {
        create: jest.fn(),
      },
      matchDispute: {
        create: jest.fn(),
      },
      matchWalkover: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      matchResult: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') {
          return fn(mockTx);
        }
        return Promise.resolve(fn);
      }),
    },
  };
});

jest.mock('../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn(),
  })),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/services/matchService', () => ({
  handlePostMatchCreation: jest.fn(),
  createMatchFeedPost: jest.fn(),
}));

jest.mock('../../../src/services/rating/dmrRatingService', () => ({
  DMRRatingService: jest.fn().mockImplementation(() => ({
    processMatch: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../../src/services/notification/adminNotificationService', () => ({
  notifyAdminsDispute: jest.fn(),
}));

jest.mock('../../../src/services/notification/playerNotificationService', () => ({
  notifyBatchRatingChanges: jest.fn(),
}));

jest.mock('../../../src/services/match/validation/scoreValidationService', () => ({
  ScoreValidationService: jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  })),
}));

jest.mock('../../../src/services/match/calculation/matchResultCreationService', () => ({
  MatchResultCreationService: jest.fn().mockImplementation(() => ({
    createMatchResults: jest.fn(),
  })),
}));

jest.mock('../../../src/services/match/best6/best6EventHandler', () => ({
  Best6EventHandler: jest.fn().mockImplementation(() => ({
    onMatchCompleted: jest.fn(),
  })),
}));

jest.mock('../../../src/services/rating/standingsV2Service', () => ({
  StandingsV2Service: jest.fn().mockImplementation(() => ({
    recalculateDivisionStandings: jest.fn(),
  })),
}));

jest.mock('../../../src/services/achievement/achievementEvaluationService', () => ({
  evaluateMatchAchievementsSafe: jest.fn(),
}));

// ── Imports ──

import { prisma } from '../../../src/lib/prisma';
import { MatchResultService } from '../../../src/services/match/matchResultService';

// ── Helpers ──

function createMockMatch(overrides: Record<string, any> = {}) {
  return {
    id: 'match-1',
    sport: 'PICKLEBALL',
    matchType: 'SINGLES',
    status: 'SCHEDULED',
    isFriendly: false,
    divisionId: 'div-1',
    seasonId: 'season-1',
    createdById: 'user-creator',
    resultSubmittedById: null,
    resultSubmittedAt: null,
    resultConfirmedById: null,
    resultConfirmedAt: null,
    isWalkover: false,
    isDisputed: false,
    set3Format: null,
    team1Score: null,
    team2Score: null,
    matchDate: new Date('2026-04-01'),
    participants: [
      {
        userId: 'user-creator',
        role: 'CREATOR',
        team: 'team1',
        invitationStatus: 'ACCEPTED',
      },
      {
        userId: 'user-opponent',
        role: 'OPPONENT',
        team: 'team2',
        invitationStatus: 'ACCEPTED',
      },
    ],
    scores: [],
    pickleballScores: [],
    disputes: [],
    ...overrides,
  };
}

// ── Tests ──

describe('Score Submission Race Condition Guards', () => {
  let service: MatchResultService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchResultService();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SS-5: League submitResult — resultSubmittedById guard
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('submitResult — duplicate submission guard (SS-5)', () => {
    it('should reject when result already submitted by another participant', async () => {
      const matchWithSubmission = createMockMatch({
        status: 'SCHEDULED',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      // Pre-fetch returns SCHEDULED (race: status not yet updated)
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(matchWithSubmission);

      // Inside transaction, also returns the match with resultSubmittedById set
      const mockTxMatch = { ...matchWithSubmission };
      // The $transaction mock calls the function with mockTx
      // We need the inner findUnique to return the match with resultSubmittedById
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(mockTxMatch),
            update: jest.fn(),
          },
          pickleballGameScore: {
            deleteMany: jest.fn(),
            create: jest.fn(),
          },
          matchComment: {
            create: jest.fn(),
          },
        };
        return fn(tx);
      });

      await expect(
        service.submitResult({
          matchId: 'match-1',
          submittedById: 'user-opponent',
          gameScores: [
            { gameNumber: 1, team1Points: 11, team2Points: 15 },
            { gameNumber: 2, team1Points: 9, team2Points: 15 },
          ],
        })
      ).rejects.toThrow(/already.*submitted/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SS-4: submitWalkover — status check guard
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('submitWalkover — status check guard (SS-4)', () => {
    it('should reject walkover when match is COMPLETED', async () => {
      const completedMatch = createMockMatch({
        status: 'COMPLETED',
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(completedMatch);

      await expect(
        service.submitWalkover({
          matchId: 'match-1',
          reportedById: 'user-creator',
          defaultingUserId: 'user-opponent',
          reason: 'NO_SHOW' as any,
        })
      ).rejects.toThrow(/scheduled.*ongoing|cannot.*walkover.*completed/i);
    });

    it('should reject walkover when match is CANCELLED', async () => {
      const cancelledMatch = createMockMatch({
        status: 'CANCELLED',
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(cancelledMatch);

      await expect(
        service.submitWalkover({
          matchId: 'match-1',
          reportedById: 'user-creator',
          defaultingUserId: 'user-opponent',
          reason: 'NO_SHOW' as any,
        })
      ).rejects.toThrow(/scheduled.*ongoing|cannot.*walkover.*cancelled/i);
    });

    it('should reject walkover when result already submitted', async () => {
      const ongoingMatch = createMockMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      await expect(
        service.submitWalkover({
          matchId: 'match-1',
          reportedById: 'user-opponent',
          defaultingUserId: 'user-creator',
          reason: 'NO_SHOW' as any,
        })
      ).rejects.toThrow(/result.*already.*submitted|cannot.*walkover/i);
    });

    it('should allow walkover when match is SCHEDULED', async () => {
      const scheduledMatch = createMockMatch({
        status: 'SCHEDULED',
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(scheduledMatch);

      // Mock the transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          matchWalkover: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          match: {
            findUnique: jest.fn().mockResolvedValue(scheduledMatch),
            update: jest.fn(),
          },
        };
        return fn(tx);
      });

      // Should NOT throw for status check (may throw later for other reasons)
      // We just verify the status check doesn't block SCHEDULED matches
      try {
        await service.submitWalkover({
          matchId: 'match-1',
          reportedById: 'user-creator',
          defaultingUserId: 'user-opponent',
          reason: 'NO_SHOW' as any,
        });
      } catch (error: any) {
        // Should NOT be a status-related error
        expect(error.message).not.toMatch(/scheduled.*ongoing|cannot.*walkover.*status/i);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SS-3: confirmResult — transaction guard
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('confirmResult — confirm path must use transaction (SS-3)', () => {
    it('should reject confirm when match is already COMPLETED (inner tx check)', async () => {
      // Outside read: status = ONGOING (stale)
      const ongoingMatch = createMockMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      // Inside transaction: status = COMPLETED (another request already confirmed)
      const completedMatch = { ...ongoingMatch, status: 'COMPLETED' };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(completedMatch),
            update: jest.fn(),
          },
        };
        return fn(tx);
      });

      await expect(
        service.confirmResult({
          matchId: 'match-1',
          userId: 'user-opponent',
          confirmed: true,
        })
      ).rejects.toThrow(/not pending confirmation|already.*completed/i);
    });

    it('should use $transaction for the confirm path', async () => {
      const ongoingMatch = createMockMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      // Transaction succeeds
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(ongoingMatch),
            update: jest.fn(),
          },
        };
        return fn(tx);
      });

      // Mock getMatchWithResults to return something
      (prisma.match.findUnique as jest.Mock)
        .mockResolvedValueOnce(ongoingMatch) // first call: initial fetch
        .mockResolvedValueOnce({ ...ongoingMatch, status: 'COMPLETED' }); // second call: getMatchWithResults

      try {
        await service.confirmResult({
          matchId: 'match-1',
          userId: 'user-opponent',
          confirmed: true,
        });
      } catch {
        // May throw due to processMatchCompletion mocks — that's fine
      }

      // The confirm path MUST use $transaction
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
