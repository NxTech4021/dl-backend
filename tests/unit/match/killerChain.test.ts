/**
 * Killer Chain Unit Tests — Issue #003: Singles Match Join Failure
 *
 * These tests prove and prevent the "killer chain" bug:
 * BUG 8: League details endpoint must NOT return friendly matches
 * BUG 9: League join service must NOT process friendly matches
 * BUG 5: League join service must reject join when singles match is full
 *
 * The chain: notification → fetch → league returns friendly as isFriendly:false
 *   → join goes to league endpoint → division check fails → user can't join
 */

// Mock prisma BEFORE importing modules that use it
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    match: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    seasonMembership: {
      findFirst: jest.fn(),
    },
    matchParticipant: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn({
      matchParticipant: { create: jest.fn() },
      matchInvitation: { create: jest.fn() },
      match: { update: jest.fn() },
    })),
  },
}));

// Mock services that matchInvitationService depends on
jest.mock('../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn(),
  })),
}));

jest.mock('../../../src/services/match/matchCommentService', () => ({
  getMatchCommentService: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/utils/response', () => ({
  sendSuccess: jest.fn((res: any, data: any) => {
    res.status(200).json({ success: true, data });
    return res;
  }),
  sendError: jest.fn((res: any, message: string, status = 400) => {
    res.status(status).json({ success: false, error: message });
    return res;
  }),
}));

import { prisma } from '../../../src/lib/prisma';
import { sendError } from '../../../src/utils/response';

// ============================================================================
// Helper: create a mock Express request/response
// ============================================================================
function mockReqRes(params: Record<string, string> = {}, body: any = {}, userId?: string) {
  const req: any = {
    params,
    body,
    user: userId ? { id: userId } : undefined,
    headers: {},
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ============================================================================
// A fake "league match" returned by Prisma (isFriendly: false)
// ============================================================================
const fakeLeagueMatch = {
  id: 'match-league-1',
  isFriendly: false,
  divisionId: 'div-1',
  leagueId: 'league-1',
  seasonId: 'season-1',
  sport: 'PICKLEBALL',
  matchType: 'SINGLES',
  matchDate: new Date('2026-04-01T10:00:00Z'),
  status: 'SCHEDULED',
  createdById: 'user-creator',
  participants: [
    {
      userId: 'user-creator',
      role: 'CREATOR',
      team: 'team1',
      invitationStatus: 'ACCEPTED',
      user: { id: 'user-creator', name: 'Creator', username: 'creator', image: null },
    },
  ],
  division: { id: 'div-1', name: 'Division A', season: { id: 'season-1' }, league: { id: 'league-1' } },
  createdBy: { id: 'user-creator', name: 'Creator', username: 'creator', image: null },
  scores: [],
  pickleballScores: [],
  disputes: [],
  comments: [],
  location: 'Test Court',
  venue: 'Court 1',
  format: 'STANDARD',
  fee: 'FREE',
  feeAmount: 0,
  duration: 60,
  notes: null,
  courtBooked: false,
  description: null,
  isWalkover: false,
  walkoverReason: null,
  walkover: null,
  isDisputed: false,
  playerScore: null,
  opponentScore: null,
  setScores: null,
  resultSubmittedById: null,
  resultSubmittedAt: null,
  resultConfirmedById: null,
  outcome: null,
};

// ============================================================================
// A fake "friendly match" returned by Prisma (isFriendly: true, no division)
// ============================================================================
const fakeFriendlyMatch = {
  ...fakeLeagueMatch,
  id: 'match-friendly-1',
  isFriendly: true,
  divisionId: null,
  leagueId: null,
  seasonId: null,
  division: null,
};

describe('Killer Chain: League endpoints must not return/process friendly matches', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // BUG 8: GET /api/match/:id/details must NOT return friendly matches
  // ==========================================================================
  describe('BUG 8: getMatchDetails controller', () => {
    let getMatchDetails: any;

    beforeAll(async () => {
      // Dynamic import to get the controller after mocks are set up
      const controller = await import('../../../src/controllers/matchController');
      getMatchDetails = controller.getMatchDetails;
    });

    it('should return 404 when match is a friendly match (isFriendly: true)', async () => {
      // Arrange: Prisma returns a friendly match
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fakeFriendlyMatch);

      const { req, res } = mockReqRes({ id: 'match-friendly-1' });

      // Act
      await getMatchDetails(req, res);

      // Assert: Should return 404, NOT 200
      expect(sendError).toHaveBeenCalledWith(res, "Match not found.", 404);
    });

    it('should return 200 when match is a league match (isFriendly: false)', async () => {
      // Arrange: Prisma returns a league match
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fakeLeagueMatch);

      const { req, res } = mockReqRes({ id: 'match-league-1' });

      // Act
      await getMatchDetails(req, res);

      // Assert: Should return success (200), not 404
      expect(sendError).not.toHaveBeenCalledWith(res, "Match not found.", 404);
      expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('should still return 404 when match does not exist at all', async () => {
      // Arrange: Prisma returns null
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(null);

      const { req, res } = mockReqRes({ id: 'nonexistent' });

      // Act
      await getMatchDetails(req, res);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "Match not found.", 404);
    });
  });

  // ==========================================================================
  // BUG 9: joinMatch service must NOT process friendly matches
  // ==========================================================================
  describe('BUG 9: joinMatch service', () => {
    let service: any;

    beforeAll(async () => {
      const mod = await import('../../../src/services/match/matchInvitationService');
      service = mod.getMatchInvitationService();
    });

    it('should throw "Match not found" when match is a friendly match', async () => {
      // Arrange: Prisma returns a friendly match
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fakeFriendlyMatch);

      // Act & Assert: Should throw — NOT with "division" error, but with "not found"
      await expect(
        service.joinMatch('match-friendly-1', 'user-joiner')
      ).rejects.toThrow('Match not found');
    });

    it('should NOT throw "division" error for a friendly match (the confusing error)', async () => {
      // Arrange: Prisma returns a friendly match
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fakeFriendlyMatch);

      // Act & Assert: Must NOT see the confusing division error
      await expect(
        service.joinMatch('match-friendly-1', 'user-joiner')
      ).rejects.not.toThrow('You must be an active member of this division to join');
    });

    it('should proceed normally for a league match', async () => {
      // Arrange: Prisma returns a league match, user has membership
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fakeLeagueMatch);
      (prisma.seasonMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'membership-1',
        userId: 'user-joiner',
        divisionId: 'div-1',
        seasonId: 'season-1',
        status: 'ACTIVE',
      });

      // Act & Assert: Should NOT throw "Match not found"
      // (it will proceed to further checks and may throw for other reasons,
      // but we verify it doesn't reject at the isFriendly check)
      try {
        await service.joinMatch('match-league-1', 'user-joiner');
      } catch (e: any) {
        // Acceptable errors: anything EXCEPT "Match not found" — the match IS a league match
        expect(e.message).not.toBe('Match not found');
      }
    });
  });

  // ==========================================================================
  // BUG 5: joinMatch must reject when singles match already has 2 participants
  // ==========================================================================
  describe('BUG 5: Singles max participants guard', () => {
    let service: any;

    beforeAll(async () => {
      const mod = await import('../../../src/services/match/matchInvitationService');
      service = mod.getMatchInvitationService();
    });

    it('should reject join when singles match already has 2 accepted participants', async () => {
      // Arrange: League singles match with 2 participants (full)
      const fullMatch = {
        ...fakeLeagueMatch,
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
      };
      (prisma.match.findUnique as jest.Mock).mockResolvedValue(fullMatch);
      (prisma.seasonMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'membership-1',
        userId: 'user-third',
        divisionId: 'div-1',
        status: 'ACTIVE',
      });

      // Act & Assert: Third user should be rejected with SPECIFIC "full" error
      await expect(
        service.joinMatch('match-league-1', 'user-third')
      ).rejects.toThrow('This match is already full');
    });
  });
});
