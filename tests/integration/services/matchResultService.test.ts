/**
 * Match Result Service Tests
 *
 * Tests for result submission, confirmation, disputes, and walkovers
 */

import { MatchResultService } from '../../../src/services/match/matchResultService';
import {
  createTestUser,
  createTestDivision,
  createMatchWithOpponent,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { MatchStatus, InvitationStatus, DisputeCategory } from '@prisma/client';

describe('MatchResultService', () => {
  let service: MatchResultService;

  beforeAll(() => {
    service = new MatchResultService();
  });

  describe('submitResult', () => {
    it('should submit tennis scores and set match to ONGOING status', async () => {
      // Arrange - Use TENNIS sport for setScores format
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation first
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 6, team2Games: 3 },
      ];

      // Act
      const result = await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe(MatchStatus.ONGOING);
      expect(result?.team1Score).toBe(2); // 2 sets won
      expect(result?.team2Score).toBe(0);
      expect(result?.outcome).toBe('team1');
      expect(result?.resultSubmittedById).toBe(creator.id);
    });

    it('should submit pickleball scores with gameScores format', async () => {
      // Arrange - Use PICKLEBALL sport (default) with gameScores format
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation first
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Pickleball requires winner to have at least 15 points and win by 2
      const gameScores = [
        { gameNumber: 1, team1Points: 15, team2Points: 10 },
        { gameNumber: 2, team1Points: 15, team2Points: 12 },
      ];

      // Act
      const result = await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        gameScores,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe(MatchStatus.ONGOING);
      expect(result?.team1Score).toBe(2); // 2 games won
      expect(result?.team2Score).toBe(0);
      expect(result?.outcome).toBe('team1');
      expect(result?.resultSubmittedById).toBe(creator.id);
    });

    it('should throw error if submitter is not a participant', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent({ sport: 'TENNIS' });
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 6, team2Games: 3 },
      ];

      // Act & Assert
      await expect(
        service.submitResult({
          matchId: match.id,
          submittedById: nonParticipant.id,
          setScores,
        })
      ).rejects.toThrow('Submitter must be a participant in the match');
    });

    it('should throw error for already completed match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Mark match as completed
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.COMPLETED },
      });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 6, team2Games: 3 },
      ];

      // Act & Assert
      await expect(
        service.submitResult({
          matchId: match.id,
          submittedById: creator.id,
          setScores,
        })
      ).rejects.toThrow('Match has already been completed');
    });

    it('should throw error for cancelled match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Mark match as cancelled
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.CANCELLED },
      });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 6, team2Games: 3 },
      ];

      // Act & Assert
      await expect(
        service.submitResult({
          matchId: match.id,
          submittedById: creator.id,
          setScores,
        })
      ).rejects.toThrow('Cannot submit result for a cancelled or void match');
    });

    it('should require setScores for tennis matches', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert
      await expect(
        service.submitResult({
          matchId: match.id,
          submittedById: creator.id,
          // No setScores provided
        })
      ).rejects.toThrow('setScores array is required for Tennis/Padel matches');
    });

    it('should require gameScores for pickleball matches', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent(); // Default is PICKLEBALL

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert
      await expect(
        service.submitResult({
          matchId: match.id,
          submittedById: creator.id,
          // No gameScores provided
        })
      ).rejects.toThrow('gameScores array is required for Pickleball matches');
    });

    it('should mark match as UNFINISHED when isUnfinished flag is true', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      const setScores = [
        { setNumber: 1, team1Games: 4, team2Games: 3 }, // Incomplete set
      ];

      // Act
      const result = await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores,
        isUnfinished: true,
      });

      // Assert
      expect(result?.status).toBe(MatchStatus.UNFINISHED);
      expect(result?.outcome).toBe('unfinished');
    });

    it('should create score records in database', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Use valid tennis scores - third set tiebreak requires 10+ points
      const setScores = [
        { setNumber: 1, team1Games: 6, team2Games: 4 },
        { setNumber: 2, team1Games: 4, team2Games: 6 },
        { setNumber: 3, team1Games: 10, team2Games: 8, isTiebreak: true }, // Match tiebreak with valid score
      ];

      // Act
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores,
      });

      // Assert - Check scores in database
      const scores = await prismaTest.matchScore.findMany({
        where: { matchId: match.id },
        orderBy: { setNumber: 'asc' },
      });

      expect(scores).toHaveLength(3);
      expect(scores[0].player1Games).toBe(6);
      expect(scores[0].player2Games).toBe(4);
      expect(scores[1].player1Games).toBe(4);
      expect(scores[1].player2Games).toBe(6);
      expect(scores[2].player1Games).toBe(10);
      expect(scores[2].player2Games).toBe(8);
    });
  });

  describe('confirmResult', () => {
    it('should confirm result and complete match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result first
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Act - Opponent confirms
      const result = await service.confirmResult({
        matchId: match.id,
        userId: opponent.id,
        confirmed: true,
      });

      // Assert
      expect(result?.status).toBe(MatchStatus.COMPLETED);
      expect(result?.resultConfirmedById).toBe(opponent.id);
      expect(result?.isAutoApproved).toBe(false);
    });

    it('should not allow submitter to confirm own result', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Act & Assert - Creator tries to confirm own submission
      await expect(
        service.confirmResult({
          matchId: match.id,
          userId: creator.id,
          confirmed: true,
        })
      ).rejects.toThrow('Only the opposing team can confirm or dispute the submitted result');
    });

    it('should create dispute when opponent declines', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Act - Opponent disputes
      const result = await service.confirmResult({
        matchId: match.id,
        userId: opponent.id,
        confirmed: false,
        disputeCategory: DisputeCategory.WRONG_SCORE,
        disputeReason: 'Score was 6-4, 4-6, 7-5 not 6-4, 6-3',
      });

      // Assert
      expect(result?.isDisputed).toBe(true);
      expect(result?.requiresAdminReview).toBe(true);

      // Check dispute was created
      const dispute = await prismaTest.matchDispute.findFirst({
        where: { matchId: match.id },
      });

      expect(dispute).toBeDefined();
      expect(dispute?.raisedByUserId).toBe(opponent.id);
      expect(dispute?.disputeCategory).toBe(DisputeCategory.WRONG_SCORE);
      expect(dispute?.disputeComment).toBe('Score was 6-4, 4-6, 7-5 not 6-4, 6-3');
    });

    it('should require reason and category when declining', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Act & Assert
      await expect(
        service.confirmResult({
          matchId: match.id,
          userId: opponent.id,
          confirmed: false,
          // Missing disputeReason and disputeCategory
        })
      ).rejects.toThrow('Dispute reason and category are required when denying result');
    });

    it('should throw error if no result has been submitted', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert - Try to confirm without submitted result
      await expect(
        service.confirmResult({
          matchId: match.id,
          userId: opponent.id,
          confirmed: true,
        })
      ).rejects.toThrow('No result has been submitted for this match');
    });

    it('should throw error for non-participant', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Act & Assert
      await expect(
        service.confirmResult({
          matchId: match.id,
          userId: nonParticipant.id,
          confirmed: true,
        })
      ).rejects.toThrow('Only match participants can confirm results');
    });
  });

  describe('submitWalkover', () => {
    it('should submit walkover and complete match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const result = await service.submitWalkover({
        matchId: match.id,
        reportedById: creator.id,
        defaultingUserId: opponent.id,
        reason: 'NO_SHOW',
        reasonDetail: 'Opponent did not show up',
      });

      // Assert
      expect(result?.status).toBe(MatchStatus.COMPLETED);
      expect(result?.isWalkover).toBe(true);
      expect(result?.walkoverReason).toBe('NO_SHOW');

      // Check walkover record
      const walkover = await prismaTest.matchWalkover.findUnique({
        where: { matchId: match.id },
      });

      expect(walkover).toBeDefined();
      expect(walkover?.defaultingPlayerId).toBe(opponent.id);
      expect(walkover?.winningPlayerId).toBe(creator.id);
    });

    it('should throw error if reporter is not a participant', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert
      await expect(
        service.submitWalkover({
          matchId: match.id,
          reportedById: nonParticipant.id,
          defaultingUserId: opponent.id,
          reason: 'NO_SHOW',
        })
      ).rejects.toThrow('Only match participants can report walkovers');
    });

    it('should throw error if defaulting user is not a participant', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert
      await expect(
        service.submitWalkover({
          matchId: match.id,
          reportedById: creator.id,
          defaultingUserId: nonParticipant.id,
          reason: 'NO_SHOW',
        })
      ).rejects.toThrow('Defaulting user is not a participant in this match');
    });
  });

  describe('getMatchWithResults', () => {
    it('should return match with full result details', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit and confirm result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      await service.confirmResult({
        matchId: match.id,
        userId: opponent.id,
        confirmed: true,
      });

      // Act
      const result = await service.getMatchWithResults(match.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.participants).toBeDefined();
      expect(result?.scores).toBeDefined();
      expect(result?.scores).toHaveLength(2);
      expect(result?.division).toBeDefined();
      expect(result?.resultSubmittedBy).toBeDefined();
      expect(result?.resultConfirmedBy).toBeDefined();
    });

    it('should return null for non-existent match', async () => {
      // Act
      const result = await service.getMatchWithResults('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should include dispute information', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      // Dispute result
      await service.confirmResult({
        matchId: match.id,
        userId: opponent.id,
        confirmed: false,
        disputeCategory: DisputeCategory.WRONG_SCORE,
        disputeReason: 'Incorrect score',
      });

      // Act
      const result = await service.getMatchWithResults(match.id);

      // Assert
      expect(result?.isDisputed).toBe(true);
      expect(result?.disputes).toBeDefined();
      expect(result?.disputes?.length).toBeGreaterThan(0);
      expect(result?.disputes?.[0].disputeCategory).toBe(DisputeCategory.WRONG_SCORE);
    });
  });

  describe('getDisputeById', () => {
    it('should return dispute with full details', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent({ sport: 'TENNIS' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Submit and dispute result
      await service.submitResult({
        matchId: match.id,
        submittedById: creator.id,
        setScores: [
          { setNumber: 1, team1Games: 6, team2Games: 4 },
          { setNumber: 2, team1Games: 6, team2Games: 3 },
        ],
      });

      await service.confirmResult({
        matchId: match.id,
        userId: opponent.id,
        confirmed: false,
        disputeCategory: DisputeCategory.WRONG_SCORE,
        disputeReason: 'Score is incorrect',
      });

      const disputes = await prismaTest.matchDispute.findMany({
        where: { matchId: match.id },
      });

      // Act
      const result = await service.getDisputeById(disputes[0].id);

      // Assert
      expect(result).toBeDefined();
      expect(result.match).toBeDefined();
      expect(result.raisedByUser).toBeDefined();
      expect(result.disputeCategory).toBe(DisputeCategory.WRONG_SCORE);
    });

    it('should throw error for non-existent dispute', async () => {
      // Act & Assert
      await expect(
        service.getDisputeById('non-existent-id')
      ).rejects.toThrow('Dispute not found');
    });
  });
});
