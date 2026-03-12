/**
 * Friendly Match Score Submission Race Condition Tests — Issue #101 (SS-1, SS-2, SS-6, SS-7)
 *
 * Tests that friendly match score submission, confirmation, and dispute
 * are wrapped in transactions with proper guards.
 */

// ── Mocks ──

jest.mock('../../../src/lib/prisma', () => {
  return {
    prisma: {
      match: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      matchParticipant: {
        updateMany: jest.fn(),
      },
      pickleballGameScore: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      matchScore: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      matchComment: {
        create: jest.fn(),
      },
      matchDispute: {
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') {
          return fn({
            match: { findUnique: jest.fn(), update: jest.fn() },
            matchParticipant: { updateMany: jest.fn() },
            pickleballGameScore: { deleteMany: jest.fn(), create: jest.fn() },
            matchScore: { deleteMany: jest.fn(), create: jest.fn() },
            matchComment: { create: jest.fn() },
            matchDispute: { create: jest.fn() },
          });
        }
        // Batch transaction (array of promises)
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

jest.mock('../../../src/services/match/matchCommentService', () => ({
  getMatchCommentService: jest.fn().mockReturnValue({
    getMatchComments: jest.fn(),
  }),
}));

// ── Imports ──

import { prisma } from '../../../src/lib/prisma';
import { FriendlyMatchService } from '../../../src/services/match/friendlyMatchService';

// ── Helpers ──

function createMockFriendlyMatch(overrides: Record<string, any> = {}) {
  return {
    id: 'friendly-1',
    sport: 'PICKLEBALL',
    matchType: 'SINGLES',
    status: 'SCHEDULED',
    isFriendly: true,
    divisionId: null,
    seasonId: null,
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
    ...overrides,
  };
}

// ── Tests ──

describe('Friendly Match Race Condition Guards', () => {
  let service: FriendlyMatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FriendlyMatchService();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SS-1 + SS-2: submitFriendlyResult must use transaction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('submitFriendlyResult — transaction wrapping (SS-1, SS-2)', () => {
    it('should reject when result already submitted by another participant', async () => {
      const matchWithSubmission = createMockFriendlyMatch({
        status: 'SCHEDULED',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      // Pre-fetch returns match
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(matchWithSubmission);

      // Inside transaction, match has resultSubmittedById set
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(matchWithSubmission),
            update: jest.fn(),
          },
          matchParticipant: { updateMany: jest.fn() },
          pickleballGameScore: { deleteMany: jest.fn(), create: jest.fn() },
          matchScore: { deleteMany: jest.fn(), create: jest.fn() },
          matchComment: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        service.submitFriendlyResult({
          matchId: 'friendly-1',
          submittedById: 'user-opponent',
          gameScores: [
            { gameNumber: 1, team1Points: 11, team2Points: 15 },
            { gameNumber: 2, team1Points: 9, team2Points: 15 },
          ],
        })
      ).rejects.toThrow(/already.*submitted/i);
    });

    it('should use $transaction for score writes and match update', async () => {
      const scheduledMatch = createMockFriendlyMatch({ status: 'SCHEDULED' });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(scheduledMatch);

      // Track what happens inside the transaction
      let transactionCalled = false;
      let txUpdateCalled = false;
      let txScoreWritten = false;

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        transactionCalled = true;
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(scheduledMatch),
            update: jest.fn().mockImplementation(() => {
              txUpdateCalled = true;
              return { ...scheduledMatch, status: 'ONGOING' };
            }),
          },
          matchParticipant: { updateMany: jest.fn() },
          pickleballGameScore: {
            deleteMany: jest.fn(),
            create: jest.fn().mockImplementation(() => {
              txScoreWritten = true;
            }),
          },
          matchScore: { deleteMany: jest.fn(), create: jest.fn() },
          matchComment: { create: jest.fn() },
        };
        return fn(tx);
      });

      try {
        await service.submitFriendlyResult({
          matchId: 'friendly-1',
          submittedById: 'user-creator',
          gameScores: [
            { gameNumber: 1, team1Points: 15, team2Points: 11 },
            { gameNumber: 2, team1Points: 15, team2Points: 9 },
          ],
        });
      } catch {
        // May throw from getFriendlyMatchById mock — that's fine
      }

      // Score writes AND match update MUST be inside $transaction
      expect(transactionCalled).toBe(true);
      expect(txScoreWritten).toBe(true);
      expect(txUpdateCalled).toBe(true);
    });

    it('should re-check status inside transaction', async () => {
      // Outside: status = SCHEDULED
      const scheduledMatch = createMockFriendlyMatch({ status: 'SCHEDULED' });
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(scheduledMatch);

      // Inside transaction: status = COMPLETED (race — another request completed it)
      const completedMatch = { ...scheduledMatch, status: 'COMPLETED' };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(completedMatch),
            update: jest.fn(),
          },
          matchParticipant: { updateMany: jest.fn() },
          pickleballGameScore: { deleteMany: jest.fn(), create: jest.fn() },
          matchScore: { deleteMany: jest.fn(), create: jest.fn() },
          matchComment: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        service.submitFriendlyResult({
          matchId: 'friendly-1',
          submittedById: 'user-creator',
          gameScores: [
            { gameNumber: 1, team1Points: 15, team2Points: 11 },
            { gameNumber: 2, team1Points: 15, team2Points: 9 },
          ],
        })
      ).rejects.toThrow(/already.*completed/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SS-6 + SS-7: confirmFriendlyResult must use transaction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('confirmFriendlyResult — transaction wrapping (SS-6, SS-7)', () => {
    it('should reject confirm when match is already COMPLETED (inner tx check)', async () => {
      // Outside: ONGOING
      const ongoingMatch = createMockFriendlyMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      // Inside transaction: COMPLETED (race)
      const completedMatch = { ...ongoingMatch, status: 'COMPLETED' };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(completedMatch),
            update: jest.fn(),
          },
          matchDispute: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        service.confirmFriendlyResult({
          matchId: 'friendly-1',
          userId: 'user-opponent',
          confirmed: true,
        })
      ).rejects.toThrow(/not pending|already.*completed/i);
    });

    it('should use $transaction for the confirm path', async () => {
      const ongoingMatch = createMockFriendlyMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(ongoingMatch),
            update: jest.fn().mockResolvedValue({ ...ongoingMatch, status: 'COMPLETED' }),
          },
          matchDispute: { create: jest.fn() },
        };
        return fn(tx);
      });

      try {
        await service.confirmFriendlyResult({
          matchId: 'friendly-1',
          userId: 'user-opponent',
          confirmed: true,
        });
      } catch {
        // May throw from getFriendlyMatchById — fine
      }

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should use $transaction for the dispute path', async () => {
      const ongoingMatch = createMockFriendlyMatch({
        status: 'ONGOING',
        resultSubmittedById: 'user-creator',
        resultSubmittedAt: new Date(),
      });

      (prisma.match.findUnique as jest.Mock).mockResolvedValue(ongoingMatch);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn !== 'function') return Promise.resolve(fn);
        const tx = {
          match: {
            findUnique: jest.fn().mockResolvedValue(ongoingMatch),
            update: jest.fn(),
          },
          matchDispute: { create: jest.fn() },
        };
        return fn(tx);
      });

      try {
        await service.confirmFriendlyResult({
          matchId: 'friendly-1',
          userId: 'user-opponent',
          confirmed: false,
          disputeReason: 'Wrong scores',
        });
      } catch {
        // May throw from getFriendlyMatchById — fine
      }

      // Dispute path MUST also use $transaction
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
