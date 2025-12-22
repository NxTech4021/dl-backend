/**
 * Match API Integration Tests
 *
 * Tests for match API endpoints
 */

import {
  createTestUser,
  createTestDivision,
  createMatchWithOpponent,
  authenticatedRequest,
  unauthenticatedRequest,
  expectUnauthorized,
  expectSuccess,
  prismaTest,
} from '../../helpers';
import { MatchType, InvitationStatus } from '@prisma/client';

describe('Match API', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      // Act
      const response = await unauthenticatedRequest().get('/api/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });
  });

  describe('POST /api/match/create', () => {
    it('should create a match when authenticated', async () => {
      // Arrange
      const user = await createTestUser({ name: 'Match Creator' });
      const division = await createTestDivision();

      // Create membership
      await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act
      const response = await authenticatedRequest(user.id)
        .post('/api/match/create')
        .send({
          divisionId: division.id,
          matchType: MatchType.SINGLES,
          matchDate: new Date('2025-02-01T10:00:00Z').toISOString(),
          location: 'Test Court',
        });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.divisionId).toBe(division.id);
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await unauthenticatedRequest()
        .post('/api/match/create')
        .send({
          divisionId: 'some-division',
          matchType: MatchType.SINGLES,
        });

      // Assert
      expectUnauthorized(response);
    });

    it('should return error when not a division member', async () => {
      // Arrange
      const user = await createTestUser({ name: 'Non Member' });
      const division = await createTestDivision();
      // Note: NOT creating membership

      // Act
      const response = await authenticatedRequest(user.id)
        .post('/api/match/create')
        .send({
          divisionId: division.id,
          matchType: MatchType.SINGLES,
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/match/:id', () => {
    it('should get match by ID when authenticated', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act
      const response = await authenticatedRequest(creator.id)
        .get(`/api/match/${match.id}`);

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(match.id);
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const response = await unauthenticatedRequest()
        .get(`/api/match/${match.id}`);

      // Assert
      expectUnauthorized(response);
    });

    it('should return 404 for non-existent match', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const response = await authenticatedRequest(user.id)
        .get('/api/match/non-existent-id');

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/match/my', () => {
    it('should get user matches when authenticated', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act
      const response = await authenticatedRequest(creator.id)
        .get('/api/match/my');

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await unauthenticatedRequest()
        .get('/api/match/my');

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('POST /api/match/:id/result', () => {
    it('should submit result when authenticated as participant', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 6, team2Games: 3 },
      ];

      // Act
      const response = await authenticatedRequest(creator.id)
        .post(`/api/match/${match.id}/result`)
        .send({ setScores });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const response = await unauthenticatedRequest()
        .post(`/api/match/${match.id}/result`)
        .send({
          setScores: [
            { setNumber: 1, team1Games: 6, team2Games: 4 },
          ],
        });

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('POST /api/match/:id/confirm', () => {
    it('should confirm result when authenticated as opponent', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result first
      await authenticatedRequest(creator.id)
        .post(`/api/match/${match.id}/result`)
        .send({
          setScores: [
            { setNumber: 1, team1Games: 6, team2Games: 4 },
            { setNumber: 2, team1Games: 6, team2Games: 3 },
          ],
        });

      // Act - Opponent confirms
      const response = await authenticatedRequest(opponent.id)
        .post(`/api/match/${match.id}/confirm`)
        .send({ confirmed: true });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const response = await unauthenticatedRequest()
        .post(`/api/match/${match.id}/confirm`)
        .send({ confirmed: true });

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('POST /api/match/:id/cancel', () => {
    it('should cancel match when authenticated as participant', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const response = await authenticatedRequest(creator.id)
        .post(`/api/match/${match.id}/cancel`)
        .send({
          reason: 'INJURY',
          comment: 'Unable to play',
        });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const response = await unauthenticatedRequest()
        .post(`/api/match/${match.id}/cancel`)
        .send({ reason: 'OTHER' });

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('GET /api/match/:id/cancel-impact', () => {
    it('should get cancellation impact when authenticated', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act
      const response = await authenticatedRequest(creator.id)
        .get(`/api/match/${match.id}/cancel-impact`);

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('canCancel');
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const response = await unauthenticatedRequest()
        .get(`/api/match/${match.id}/cancel-impact`);

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('POST /api/match/invitations/:id/respond', () => {
    it('should accept invitation when authenticated as invitee', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();

      // Get the invitation
      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      // Act
      const response = await authenticatedRequest(opponent.id)
        .post(`/api/match/invitations/${invitation!.id}/respond`)
        .send({ accept: true });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
    });

    it('should decline invitation with reason', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();

      // Get the invitation
      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      // Act
      const response = await authenticatedRequest(opponent.id)
        .post(`/api/match/invitations/${invitation!.id}/respond`)
        .send({
          accept: false,
          declineReason: 'Not available at that time',
        });

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();

      const invitation = await prismaTest.matchInvitation.findFirst({
        where: {
          matchId: match.id,
          inviteeId: opponent.id,
        },
      });

      // Act
      const response = await unauthenticatedRequest()
        .post(`/api/match/invitations/${invitation!.id}/respond`)
        .send({ accept: true });

      // Assert
      expectUnauthorized(response);
    });
  });

  describe('GET /api/match/invitations/pending', () => {
    it('should get pending invitations when authenticated', async () => {
      // Arrange
      const { opponent } = await createMatchWithOpponent();

      // Act
      const response = await authenticatedRequest(opponent.id)
        .get('/api/match/invitations/pending');

      // Assert
      expectSuccess(response);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await unauthenticatedRequest()
        .get('/api/match/invitations/pending');

      // Assert
      expectUnauthorized(response);
    });
  });
});
