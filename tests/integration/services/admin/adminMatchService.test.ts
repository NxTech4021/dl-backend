/**
 * AdminMatchService Integration Tests
 *
 * Tests for admin match management: dashboard, disputes, editing, penalties.
 *
 * Note: Some tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so matches created via prismaTest are not visible to the service.
 */

import { prismaTest } from '../../../setup/prismaTestClient';
import { createTestUser, createTestAdmin } from '../../../helpers/factories';
import {
  MatchStatus,
  DisputeStatus,
  DisputeResolutionAction,
  DisputePriority,
  PenaltyType,
  PenaltySeverity,
} from '@prisma/client';

// Mock the logger
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the notification service
jest.mock('../../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(null),
    sendEmail: jest.fn().mockResolvedValue(null),
    sendPushNotification: jest.fn().mockResolvedValue(null),
  })),
}));

// Mock rating services to avoid complex dependencies
jest.mock('../../../../src/services/rating/dmrRatingService', () => ({
  DMRRatingService: jest.fn().mockImplementation(() => ({
    reverseMatchRatings: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../../../../src/services/rating/standingsV2Service', () => ({
  StandingsV2Service: jest.fn().mockImplementation(() => ({
    recalculateDivisionStandings: jest.fn().mockResolvedValue(null),
  })),
}));

// Import after mocking
import {
  AdminMatchService,
  getAdminMatchService,
} from '../../../../src/services/admin/adminMatchService';

describe('AdminMatchService', () => {
  let adminMatchService: AdminMatchService;

  beforeAll(() => {
    adminMatchService = getAdminMatchService();
  });

  describe('getAdminMatches', () => {
    it('should return empty list when no matches exist', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({});

      // Assert
      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should use default pagination values', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({});

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should respect custom pagination parameters', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({
        page: 2,
        limit: 10,
      });

      // Assert
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should filter by status', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({
        status: [MatchStatus.COMPLETED],
      });

      // Assert
      expect(result).toBeDefined();
      expect(
        result.matches.every((m: any) => m.status === MatchStatus.COMPLETED)
      ).toBeTruthy();
    });

    it('should filter by disputed flag', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({
        isDisputed: true,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.matches.every((m: any) => m.isDisputed === true)).toBeTruthy();
    });

    it('should filter by league context', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({
        matchContext: 'league',
      });

      // Assert
      expect(result).toBeDefined();
      // All returned matches should have at least one of: divisionId, leagueId, or seasonId
      result.matches.forEach((m: any) => {
        expect(m.divisionId || m.leagueId || m.seasonId).toBeTruthy();
      });
    });

    it('should filter by friendly context', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({
        matchContext: 'friendly',
      });

      // Assert
      expect(result).toBeDefined();
      // All returned matches should have none of: divisionId, leagueId, seasonId
      result.matches.forEach((m: any) => {
        expect(m.divisionId).toBeNull();
        expect(m.leagueId).toBeNull();
        expect(m.seasonId).toBeNull();
      });
    });

    it('should include stats in response', async () => {
      // Act
      const result = await adminMatchService.getAdminMatches({});

      // Assert
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalMatches).toBe('number');
      expect(result.stats.byStatus).toBeDefined();
      expect(typeof result.stats.disputed).toBe('number');
    });
  });

  describe('getMatchStats', () => {
    it('should return match statistics', async () => {
      // Act
      const stats = await adminMatchService.getMatchStats({});

      // Assert
      expect(stats).toBeDefined();
      expect(typeof stats.totalMatches).toBe('number');
      expect(stats.byStatus).toBeDefined();
      expect(typeof stats.disputed).toBe('number');
      expect(typeof stats.lateCancellations).toBe('number');
      expect(typeof stats.walkovers).toBe('number');
      expect(typeof stats.pendingConfirmation).toBe('number');
    });

    it('should include all match statuses', async () => {
      // Act
      const stats = await adminMatchService.getMatchStats({});

      // Assert
      const expectedStatuses = [
        'DRAFT',
        'SCHEDULED',
        'ONGOING',
        'COMPLETED',
        'UNFINISHED',
        'CANCELLED',
        'VOID',
      ];
      expectedStatuses.forEach((status) => {
        expect(typeof stats.byStatus[status]).toBe('number');
      });
    });
  });

  describe('getMatchById', () => {
    it('should return null for non-existent match', async () => {
      // Act
      const result = await adminMatchService.getMatchById('non-existent-match-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getDisputes', () => {
    it('should return empty list when no disputes exist', async () => {
      // Act
      const result = await adminMatchService.getDisputes({});

      // Assert
      expect(result).toBeDefined();
      expect(result.disputes).toBeDefined();
      expect(Array.isArray(result.disputes)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should use default pagination', async () => {
      // Act
      const result = await adminMatchService.getDisputes({});

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by dispute status', async () => {
      // Act
      const result = await adminMatchService.getDisputes({
        status: [DisputeStatus.OPEN],
      });

      // Assert
      expect(result).toBeDefined();
      expect(
        result.disputes.every((d: any) => d.status === DisputeStatus.OPEN)
      ).toBeTruthy();
    });

    it('should filter by priority', async () => {
      // Act
      const result = await adminMatchService.getDisputes({
        priority: DisputePriority.HIGH,
      });

      // Assert
      expect(result).toBeDefined();
      expect(
        result.disputes.every((d: any) => d.priority === DisputePriority.HIGH)
      ).toBeTruthy();
    });
  });

  describe('getDisputeById', () => {
    it('should return null for non-existent dispute', async () => {
      // Act
      const result = await adminMatchService.getDisputeById('non-existent-dispute-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('startDisputeReview', () => {
    it('should throw error for non-existent dispute', async () => {
      // Act & Assert
      await expect(
        adminMatchService.startDisputeReview('non-existent-dispute', 'admin-id')
      ).rejects.toThrow('Dispute not found');
    });
  });

  describe('resolveDispute', () => {
    it('should throw error for non-existent dispute', async () => {
      // Act & Assert
      await expect(
        adminMatchService.resolveDispute({
          disputeId: 'non-existent-dispute',
          adminId: 'admin-id',
          action: DisputeResolutionAction.UPHOLD_ORIGINAL,
          reason: 'Test resolution',
        })
      ).rejects.toThrow('Dispute not found');
    });
  });

  describe('editMatchResult', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.editMatchResult({
          matchId: 'non-existent-match',
          adminId: 'admin-id',
          team1Score: 2,
          team2Score: 1,
          reason: 'Test edit',
        })
      ).rejects.toThrow('Match not found');
    });
  });

  describe('voidMatch', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.voidMatch('non-existent-match', 'admin-id', 'Test void')
      ).rejects.toThrow('Match not found');
    });
  });

  describe('getPendingCancellations', () => {
    it('should return empty array when no pending cancellations', async () => {
      // Act
      const result = await adminMatchService.getPendingCancellations();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('reviewCancellation', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.reviewCancellation({
          matchId: 'non-existent-match',
          adminId: 'admin-id',
          approved: true,
        })
      ).rejects.toThrow('Match not found');
    });
  });

  describe('getPlayerPenalties', () => {
    it('should return empty array for user with no penalties', async () => {
      // Act
      const result = await adminMatchService.getPlayerPenalties('non-existent-user');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('hideMatch', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.hideMatch('non-existent-match', 'admin-id', 'Test reason')
      ).rejects.toThrow('Match not found');
    });
  });

  describe('unhideMatch', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.unhideMatch('non-existent-match', 'admin-id')
      ).rejects.toThrow('Match not found');
    });
  });

  describe('reportMatchAbuse', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.reportMatchAbuse(
          'non-existent-match',
          'admin-id',
          'Suspicious activity',
          'MATCH_FIXING'
        )
      ).rejects.toThrow('Match not found');
    });
  });

  describe('clearMatchReport', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.clearMatchReport('non-existent-match', 'admin-id')
      ).rejects.toThrow('Match not found');
    });
  });

  describe('convertToWalkover', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.convertToWalkover({
          matchId: 'non-existent-match',
          adminId: 'admin-id',
          winnerId: 'some-user-id',
          reason: 'No show',
        })
      ).rejects.toThrow('Match not found');
    });
  });

  describe('messageParticipants', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        adminMatchService.messageParticipants('non-existent-match', 'admin-id', {
          subject: 'Test Subject',
          message: 'Test message',
          sendEmail: false,
          sendPush: false,
        })
      ).rejects.toThrow('Match not found');
    });
  });

  describe('getAdminMatchService singleton', () => {
    it('should return same instance when called multiple times', () => {
      // Act
      const instance1 = getAdminMatchService();
      const instance2 = getAdminMatchService();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
