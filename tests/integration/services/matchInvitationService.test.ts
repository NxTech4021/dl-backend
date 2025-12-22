/**
 * Match Invitation Service Tests
 *
 * Tests for match creation, invitations, and joining functionality
 */

import { MatchInvitationService } from '../../../src/services/match/matchInvitationService';
import {
  createTestUser,
  createTestDivision,
  createTestMatch,
  createMatchWithOpponent,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { MatchType, MatchFormat, MatchStatus, InvitationStatus } from '@prisma/client';

describe('MatchInvitationService', () => {
  let service: MatchInvitationService;

  beforeAll(() => {
    service = new MatchInvitationService();
  });

  describe('createMatch', () => {
    it('should create a singles match in SCHEDULED status', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Match Creator' });
      const division = await createTestDivision();

      // Create membership for creator in this division
      await prismaTest.seasonMembership.create({
        data: {
          userId: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act
      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
        format: MatchFormat.STANDARD,
        matchDate: new Date('2025-01-20T10:00:00Z'),
        location: 'Test Court',
        venue: 'Court 1',
      });

      // Assert
      expect(match).toBeDefined();
      expect(match.id).toBeDefined();
      expect(match.status).toBe(MatchStatus.SCHEDULED);
      expect(match.matchType).toBe(MatchType.SINGLES);
      expect(match.divisionId).toBe(division.id);
      expect(match.createdById).toBe(creator.id);
    });

    it('should add creator as participant with CREATOR role', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Match Creator' });
      const division = await createTestDivision();

      await prismaTest.seasonMembership.create({
        data: {
          userId: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act
      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
      });

      // Assert - Check participant was created
      const participants = await prismaTest.matchParticipant.findMany({
        where: { matchId: match.id },
      });

      expect(participants).toHaveLength(1);
      expect(participants[0].userId).toBe(creator.id);
      expect(participants[0].role).toBe('CREATOR');
      expect(participants[0].invitationStatus).toBe(InvitationStatus.ACCEPTED);
      expect(participants[0].team).toBe('team1');
    });

    it('should throw error if creator is not a member of the division', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Non-Member Creator' });
      const division = await createTestDivision();
      // Note: NOT creating membership

      // Act & Assert
      await expect(
        service.createMatch({
          createdById: creator.id,
          divisionId: division.id,
          matchType: MatchType.SINGLES,
        })
      ).rejects.toThrow('You must be an active member of this division to create a match');
    });

    it('should throw error if division does not exist', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });

      // Act & Assert
      await expect(
        service.createMatch({
          createdById: creator.id,
          divisionId: 'non-existent-division-id',
          matchType: MatchType.SINGLES,
        })
      ).rejects.toThrow('Division not found');
    });

    it('should create match with opponent and send invitation', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const opponent = await createTestUser({ name: 'Opponent' });
      const division = await createTestDivision();

      // Create memberships for both
      await prismaTest.seasonMembership.createMany({
        data: [
          {
            userId: creator.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
          {
            userId: opponent.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
        ],
      });

      // Act
      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
        opponentId: opponent.id,
        message: 'Let\'s play!',
      });

      // Assert
      const participants = await prismaTest.matchParticipant.findMany({
        where: { matchId: match.id },
        orderBy: { team: 'asc' },
      });

      expect(participants).toHaveLength(2);

      // Creator
      expect(participants[0].userId).toBe(creator.id);
      expect(participants[0].role).toBe('CREATOR');
      expect(participants[0].invitationStatus).toBe(InvitationStatus.ACCEPTED);

      // Opponent
      expect(participants[1].userId).toBe(opponent.id);
      expect(participants[1].role).toBe('OPPONENT');
      expect(participants[1].invitationStatus).toBe(InvitationStatus.PENDING);

      // Check invitation was created
      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      expect(invitation).toBeDefined();
      expect(invitation?.status).toBe(InvitationStatus.PENDING);
      expect(invitation?.message).toBe('Let\'s play!');
    });

    it('should throw error when opponent is not in the same division', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const opponent = await createTestUser({ name: 'Opponent in different division' });
      const division = await createTestDivision();

      // Only create membership for creator
      await prismaTest.seasonMembership.create({
        data: {
          userId: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act & Assert
      await expect(
        service.createMatch({
          createdById: creator.id,
          divisionId: division.id,
          matchType: MatchType.SINGLES,
          opponentId: opponent.id,
        })
      ).rejects.toThrow('Opponent must be an active member of this division');
    });

    it('should require partner for doubles matches', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const division = await createTestDivision({ gameType: 'DOUBLES' });

      await prismaTest.seasonMembership.create({
        data: {
          userId: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act & Assert
      await expect(
        service.createMatch({
          createdById: creator.id,
          divisionId: division.id,
          matchType: MatchType.DOUBLES,
          // No partnerId provided
        })
      ).rejects.toThrow('Partner is required for doubles matches');
    });

    it('should set correct fee information', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const division = await createTestDivision();

      await prismaTest.seasonMembership.create({
        data: {
          userId: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act
      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
        fee: 'SPLIT',
        feeAmount: 25,
      });

      // Assert
      expect(match.fee).toBe('SPLIT');
      expect(Number(match.feeAmount)).toBe(25);
    });
  });

  describe('getMatchById', () => {
    it('should return match with all related data', async () => {
      // Arrange
      const match = await createTestMatch();

      // Act
      const result = await service.getMatchById(match.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(match.id);
      expect(result?.participants).toBeDefined();
      expect(result?.division).toBeDefined();
      expect(result?.createdBy).toBeDefined();
    });

    it('should return null for non-existent match', async () => {
      // Act
      const result = await service.getMatchById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should include dispute information if match is disputed', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Create dispute
      const opponent = match.participants.find(p => p.role === 'OPPONENT');
      await prismaTest.matchDispute.create({
        data: {
          matchId: match.id,
          raisedByUserId: opponent!.userId,
          disputeCategory: 'WRONG_SCORE',
          disputeComment: 'Score is incorrect',
          status: 'OPEN',
        },
      });

      await prismaTest.match.update({
        where: { id: match.id },
        data: { isDisputed: true },
      });

      // Act
      const result = await service.getMatchById(match.id);

      // Assert
      expect(result?.isDisputed).toBe(true);
      expect(result?.dispute).toBeDefined();
      expect(result?.dispute?.disputeCategory).toBe('WRONG_SCORE');
    });
  });

  describe('getMatches', () => {
    it('should return matches filtered by division', async () => {
      // Arrange
      const division1 = await createTestDivision();
      const division2 = await createTestDivision();

      const user = await createTestUser();

      // Create matches in different divisions
      await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          status: 'SCHEDULED',
          divisionId: division1.id,
          leagueId: division1.leagueId,
          seasonId: division1.seasonId,
          createdById: user.id,
        },
      });

      await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          status: 'SCHEDULED',
          divisionId: division2.id,
          leagueId: division2.leagueId,
          seasonId: division2.seasonId,
          createdById: user.id,
        },
      });

      // Act
      const result = await service.getMatches({ divisionId: division1.id });

      // Assert
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].divisionId).toBe(division1.id);
    });

    it('should return matches filtered by status', async () => {
      // Arrange
      const division = await createTestDivision();
      const user = await createTestUser();

      // Create matches with different statuses
      await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          status: 'SCHEDULED',
          divisionId: division.id,
          leagueId: division.leagueId,
          seasonId: division.seasonId,
          createdById: user.id,
        },
      });

      await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          status: 'COMPLETED',
          divisionId: division.id,
          leagueId: division.leagueId,
          seasonId: division.seasonId,
          createdById: user.id,
        },
      });

      // Act
      const result = await service.getMatches({ status: MatchStatus.SCHEDULED });

      // Assert
      expect(result.matches.every(m => m.status === 'SCHEDULED')).toBe(true);
    });

    it('should return paginated results', async () => {
      // Arrange
      const division = await createTestDivision();
      const user = await createTestUser();

      // Create multiple matches in this specific division
      for (let i = 0; i < 15; i++) {
        await prismaTest.match.create({
          data: {
            sport: 'PICKLEBALL',
            matchType: 'SINGLES',
            status: 'SCHEDULED',
            divisionId: division.id,
            leagueId: division.leagueId,
            seasonId: division.seasonId,
            createdById: user.id,
          },
        });
      }

      // Act - Filter by division to get only matches created in this test
      const page1 = await service.getMatches({ divisionId: division.id }, 1, 10);
      const page2 = await service.getMatches({ divisionId: division.id }, 2, 10);

      // Assert
      expect(page1.matches.length).toBe(10);
      expect(page2.matches.length).toBe(5);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
    });
  });

  describe('respondToInvitation', () => {
    it('should accept invitation and update participant status', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const opponent = await createTestUser({ name: 'Opponent' });
      const division = await createTestDivision();

      // Create memberships
      await prismaTest.seasonMembership.createMany({
        data: [
          {
            userId: creator.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
          {
            userId: opponent.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
        ],
      });

      // Create match with opponent
      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
        opponentId: opponent.id,
      });

      // Get invitation
      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      // Act
      const result = await service.respondToInvitation({
        invitationId: invitation!.id,
        userId: opponent.id,
        accept: true,
      });

      // Assert
      expect(result).toBeDefined();

      // Check invitation status
      const updatedInvitation = await prismaTest.matchInvitation.findUnique({
        where: { id: invitation!.id },
      });
      expect(updatedInvitation?.status).toBe(InvitationStatus.ACCEPTED);

      // Check participant status
      const participant = await prismaTest.matchParticipant.findFirst({
        where: {
          matchId: match.id,
          userId: opponent.id,
        },
      });
      expect(participant?.invitationStatus).toBe(InvitationStatus.ACCEPTED);
    });

    it('should decline invitation with reason', async () => {
      // Arrange
      const creator = await createTestUser({ name: 'Creator' });
      const opponent = await createTestUser({ name: 'Opponent' });
      const division = await createTestDivision();

      await prismaTest.seasonMembership.createMany({
        data: [
          {
            userId: creator.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
          {
            userId: opponent.id,
            seasonId: division.seasonId!,
            divisionId: division.id,
            status: 'ACTIVE',
          },
        ],
      });

      const match = await service.createMatch({
        createdById: creator.id,
        divisionId: division.id,
        matchType: MatchType.SINGLES,
        opponentId: opponent.id,
      });

      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      // Act
      await service.respondToInvitation({
        invitationId: invitation!.id,
        userId: opponent.id,
        accept: false,
        declineReason: 'Not available at that time',
      });

      // Assert
      const updatedInvitation = await prismaTest.matchInvitation.findUnique({
        where: { id: invitation!.id },
      });
      expect(updatedInvitation?.status).toBe(InvitationStatus.DECLINED);
      expect(updatedInvitation?.declineReason).toBe('Not available at that time');

      // Check participant was removed or status updated
      const participant = await prismaTest.matchParticipant.findFirst({
        where: {
          matchId: match.id,
          userId: opponent.id,
        },
      });
      expect(participant?.invitationStatus).toBe(InvitationStatus.DECLINED);
    });
  });
});
