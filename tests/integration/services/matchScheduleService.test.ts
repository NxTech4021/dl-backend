/**
 * Match Schedule Service Tests
 *
 * Tests for match cancellation, rescheduling, and walkovers
 */

import { MatchScheduleService } from '../../../src/services/match/matchScheduleService';
import {
  createTestUser,
  createMatchWithOpponent,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { MatchStatus, InvitationStatus, CancellationReason } from '@prisma/client';

describe('MatchScheduleService', () => {
  let service: MatchScheduleService;

  beforeAll(() => {
    service = new MatchScheduleService();
  });

  describe('cancelMatch', () => {
    it('should cancel a scheduled match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const result = await service.cancelMatch({
        matchId: match.id,
        cancelledById: creator.id,
        reason: CancellationReason.INJURY,
        comment: 'Unable to play due to injury',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe(MatchStatus.CANCELLED);
      expect(result?.cancelledById).toBe(creator.id);
      expect(result?.cancellationReason).toBe(CancellationReason.INJURY);
    });

    it('should allow opponent to cancel match', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const result = await service.cancelMatch({
        matchId: match.id,
        cancelledById: opponent.id,
        reason: CancellationReason.SCHEDULE_CONFLICT,
      });

      // Assert
      expect(result?.status).toBe(MatchStatus.CANCELLED);
      expect(result?.cancelledById).toBe(opponent.id);
    });

    it('should throw error if canceller is not a participant', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act & Assert
      await expect(
        service.cancelMatch({
          matchId: match.id,
          cancelledById: nonParticipant.id,
          reason: CancellationReason.OTHER,
        })
      ).rejects.toThrow('Only match participants can cancel the match');
    });

    it('should throw error if match is already completed', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

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

      // Act & Assert
      await expect(
        service.cancelMatch({
          matchId: match.id,
          cancelledById: creator.id,
          reason: CancellationReason.OTHER,
        })
      ).rejects.toThrow('Cannot cancel a completed match');
    });

    it('should throw error if match is already cancelled', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

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

      // Act & Assert
      await expect(
        service.cancelMatch({
          matchId: match.id,
          cancelledById: creator.id,
          reason: CancellationReason.OTHER,
        })
      ).rejects.toThrow('Match is already cancelled');
    });

    it('should throw error for non-existent match', async () => {
      // Arrange
      const user = await createTestUser();

      // Act & Assert
      await expect(
        service.cancelMatch({
          matchId: 'non-existent-id',
          cancelledById: user.id,
          reason: CancellationReason.OTHER,
        })
      ).rejects.toThrow('Match not found');
    });

    it('should mark late cancellation when less than 4 hours before match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Set match time to 2 hours from now
      const matchDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const result = await service.cancelMatch({
        matchId: match.id,
        cancelledById: creator.id,
        reason: CancellationReason.WEATHER,
      });

      // Assert
      expect(result?.isLateCancellation).toBe(true);
      expect(result?.requiresAdminReview).toBe(true);
    });

    it('should NOT mark late cancellation when more than 4 hours before match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Set match time to 24 hours from now
      const matchDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Act
      const result = await service.cancelMatch({
        matchId: match.id,
        cancelledById: creator.id,
        reason: CancellationReason.SCHEDULE_CONFLICT,
      });

      // Assert
      expect(result?.isLateCancellation).toBe(false);
      expect(result?.requiresAdminReview).toBe(false);
    });
  });

  describe('getCancellationRuleImpact', () => {
    it('should return no warnings for early cancellation', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Set match time to 24 hours from now
      const matchDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act
      const result = await service.getCancellationRuleImpact(match.id);

      // Assert
      expect(result.canCancel).toBe(true);
      expect(result.isLateCancellation).toBe(false);
      expect(result.requiresAdminReview).toBe(false);
      expect(result.warningMessage).toBeNull();
    });

    it('should return warning for late cancellation', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Set match time to 2 hours from now
      const matchDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act
      const result = await service.getCancellationRuleImpact(match.id);

      // Assert
      expect(result.canCancel).toBe(true);
      expect(result.isLateCancellation).toBe(true);
      expect(result.requiresAdminReview).toBe(true);
      expect(result.warningMessage).toContain('late cancellation');
    });

    // Note: This test is intentionally skipped because the database schema requires
    // matchDate to be non-null (DateTime). The test scenario of "no scheduled time"
    // is not possible with the current schema design. This is a valid business constraint.
    // If the schema is ever changed to allow nullable matchDate, this test can be enabled.
    it.skip('should return no warning when no scheduled time (schema requires matchDate)', async () => {
      // This test cannot be implemented because matchDate is required in the schema
    });

    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        service.getCancellationRuleImpact('non-existent-id')
      ).rejects.toThrow('Match not found');
    });
  });

  describe('recordWalkover', () => {
    it('should record walkover for late opponent', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match time to 30 minutes ago (past threshold)
      const matchDate = new Date(Date.now() - 30 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act
      const result = await service.recordWalkover(
        match.id,
        creator.id,
        opponent.id,
        'Opponent did not show up'
      );

      // Assert
      expect(result?.status).toBe(MatchStatus.COMPLETED);
      expect(result?.isWalkover).toBe(true);
      expect(result?.requiresAdminReview).toBe(true);

      // Check walkover record
      const walkover = await prismaTest.matchWalkover.findUnique({
        where: { matchId: match.id },
      });

      expect(walkover).toBeDefined();
      expect(walkover?.defaultingPlayerId).toBe(opponent.id);
      expect(walkover?.winningPlayerId).toBe(creator.id);
    });

    it('should throw error if opponent is not late enough', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match time to 10 minutes ago (not past threshold)
      const matchDate = new Date(Date.now() - 10 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act & Assert
      await expect(
        service.recordWalkover(
          match.id,
          creator.id,
          opponent.id,
          'Opponent is late'
        )
      ).rejects.toThrow('Opponent must be at least 20 minutes late to record a walkover');
    });

    it('should throw error if reporter is not a participant', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Set match time to 30 minutes ago
      const matchDate = new Date(Date.now() - 30 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act & Assert
      await expect(
        service.recordWalkover(
          match.id,
          nonParticipant.id,
          opponent.id,
          'Opponent did not show'
        )
      ).rejects.toThrow('Only match participants can report a walkover');
    });

    it('should throw error if defaulting player is not a participant', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match time to 30 minutes ago
      const matchDate = new Date(Date.now() - 30 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act & Assert
      await expect(
        service.recordWalkover(
          match.id,
          creator.id,
          nonParticipant.id,
          'Non-participant did not show'
        )
      ).rejects.toThrow('Defaulting player must be a participant');
    });

    it('should throw error for completed match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Mark match as completed
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.COMPLETED },
      });

      // Set match time to 30 minutes ago
      const matchDate = new Date(Date.now() - 30 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act & Assert
      await expect(
        service.recordWalkover(
          match.id,
          creator.id,
          opponent.id,
          'Opponent did not show'
        )
      ).rejects.toThrow('Can only record walkover for scheduled or ongoing matches');
    });

    it('should throw error if walkover already exists', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match time to 30 minutes ago
      const matchDate = new Date(Date.now() - 30 * 60 * 1000);
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Create existing walkover
      await prismaTest.matchWalkover.create({
        data: {
          matchId: match.id,
          walkoverReason: 'NO_SHOW',
          defaultingPlayerId: opponent.id,
          winningPlayerId: creator.id,
          reportedBy: creator.id,
        },
      });

      // Act & Assert
      await expect(
        service.recordWalkover(
          match.id,
          creator.id,
          opponent.id,
          'Already recorded'
        )
      ).rejects.toThrow('Walkover already recorded for this match');
    });
  });

  describe('requestReschedule', () => {
    it('should throw error - feature not implemented', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act & Assert
      await expect(
        service.requestReschedule({
          matchId: match.id,
          requestedById: creator.id,
          proposedTimes: [new Date()],
          reason: 'Need to reschedule',
        })
      ).rejects.toThrow('Time slot feature not yet implemented');
    });
  });

  describe('rescheduleMatch', () => {
    it('should throw error - feature not implemented', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act & Assert
      await expect(
        service.rescheduleMatch({
          matchId: match.id,
          requestedById: creator.id,
          newProposedTimes: [new Date()],
        })
      ).rejects.toThrow('Time slot feature not yet implemented');
    });
  });

  describe('continueUnfinishedMatch', () => {
    it('should throw error - feature not implemented', async () => {
      // Arrange
      const { match, creator } = await createMatchWithOpponent();

      // Act & Assert
      await expect(
        service.continueUnfinishedMatch(
          match.id,
          creator.id,
          [new Date()],
          'Continuing match'
        )
      ).rejects.toThrow('Time slot feature not yet implemented');
    });
  });
});
