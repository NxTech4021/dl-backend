/**
 * Match Comment Service Tests
 *
 * Tests for match comment CRUD operations
 * - Create, read, update, delete comments
 * - Participant validation
 * - Match status validation
 * - Comment length validation
 */

// Mock socket.io before importing the service
jest.mock('../../../src/app', () => ({
  io: {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  },
}));

import { MatchCommentService } from '../../../src/services/match/matchCommentService';
import {
  createTestUser,
  createMatchWithOpponent,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { MatchStatus, InvitationStatus } from '@prisma/client';

describe('MatchCommentService', () => {
  let service: MatchCommentService;

  beforeAll(() => {
    service = new MatchCommentService();
  });

  // ============================================================================
  // VALIDATE COMMENT ACCESS
  // ============================================================================
  describe('validateCommentAccess', () => {
    it('should allow accepted participant to comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match to ONGOING (commentable status)
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act
      const result = await service.validateCommentAccess(match.id, creator.id);

      // Assert
      expect(result.canComment).toBe(true);
      expect(result.match).toBeDefined();
    });

    it('should reject non-participant', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();
      const nonParticipant = await createTestUser({ name: 'Non Participant' });

      // Accept opponent
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match to ONGOING
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act & Assert
      await expect(service.validateCommentAccess(match.id, nonParticipant.id)).rejects.toThrow(
        'Only match participants can comment'
      );
    });

    it('should reject participant with PENDING status', async () => {
      // Arrange
      const { match, opponent } = await createMatchWithOpponent();

      // Set match to ONGOING but opponent is still PENDING
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act & Assert
      await expect(service.validateCommentAccess(match.id, opponent.id)).rejects.toThrow(
        'Only match participants can comment'
      );
    });

    it('should reject comments on DRAFT match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match to DRAFT
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.DRAFT },
      });

      // Act & Assert
      await expect(service.validateCommentAccess(match.id, creator.id)).rejects.toThrow(
        'Cannot comment on matches with status DRAFT'
      );
    });

    it('should reject comments on CANCELLED match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match to CANCELLED
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.CANCELLED },
      });

      // Act & Assert
      await expect(service.validateCommentAccess(match.id, creator.id)).rejects.toThrow(
        'Cannot comment on matches with status CANCELLED'
      );
    });

    it('should allow comments on COMPLETED match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Set match to COMPLETED
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.COMPLETED },
      });

      // Act
      const result = await service.validateCommentAccess(match.id, creator.id);

      // Assert
      expect(result.canComment).toBe(true);
    });

    it('should throw error for non-existent match', async () => {
      // Arrange
      const user = await createTestUser({ name: 'User' });

      // Act & Assert
      await expect(service.validateCommentAccess('non-existent-id', user.id)).rejects.toThrow(
        'Match not found'
      );
    });
  });

  // ============================================================================
  // CREATE COMMENT
  // ============================================================================
  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent and set match to ONGOING
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act
      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Great match!',
      });

      // Assert
      expect(comment).toBeDefined();
      expect(comment.comment).toBe('Great match!');
      expect(comment.userId).toBe(creator.id);
      expect(comment.matchId).toBe(match.id);
      expect(comment.user).toBeDefined();
      expect(comment.user.name).toBe(creator.name);
    });

    it('should trim whitespace from comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act
      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: '  Nice game!  ',
      });

      // Assert
      expect(comment.comment).toBe('Nice game!');
    });

    it('should reject empty comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act & Assert
      await expect(
        service.createComment({
          matchId: match.id,
          userId: creator.id,
          comment: '',
        })
      ).rejects.toThrow('Comment cannot be empty');
    });

    it('should reject whitespace-only comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Act & Assert
      await expect(
        service.createComment({
          matchId: match.id,
          userId: creator.id,
          comment: '   ',
        })
      ).rejects.toThrow('Comment cannot be empty');
    });

    it('should reject comment exceeding max length', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const longComment = 'a'.repeat(1001); // Max is 1000

      // Act & Assert
      await expect(
        service.createComment({
          matchId: match.id,
          userId: creator.id,
          comment: longComment,
        })
      ).rejects.toThrow('Comment exceeds maximum length of 1000 characters');
    });
  });

  // ============================================================================
  // GET COMMENTS
  // ============================================================================
  describe('getComments', () => {
    it('should return all comments for a match', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent and set match to ONGOING
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Create comments
      await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'First comment',
      });
      await service.createComment({
        matchId: match.id,
        userId: opponent.id,
        comment: 'Second comment',
      });

      // Act
      const comments = await service.getComments(match.id);

      // Assert
      expect(comments).toHaveLength(2);
      expect(comments[0].comment).toBe('First comment');
      expect(comments[1].comment).toBe('Second comment');
    });

    it('should return comments in chronological order', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      // Create comments with slight delay
      await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Older comment',
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.createComment({
        matchId: match.id,
        userId: opponent.id,
        comment: 'Newer comment',
      });

      // Act
      const comments = await service.getComments(match.id);

      // Assert
      expect(comments[0].createdAt.getTime()).toBeLessThan(comments[1].createdAt.getTime());
    });

    it('should return empty array for match with no comments', async () => {
      // Arrange
      const { match } = await createMatchWithOpponent();

      // Act
      const comments = await service.getComments(match.id);

      // Assert
      expect(comments).toHaveLength(0);
    });

    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(service.getComments('non-existent-id')).rejects.toThrow('Match not found');
    });

    it('should include user info with comments', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Test comment',
      });

      // Act
      const comments = await service.getComments(match.id);

      // Assert
      expect(comments[0].user).toBeDefined();
      expect(comments[0].user.id).toBe(creator.id);
      expect(comments[0].user.name).toBeDefined();
      expect(comments[0].user.username).toBeDefined();
    });
  });

  // ============================================================================
  // UPDATE COMMENT
  // ============================================================================
  describe('updateComment', () => {
    it('should update own comment successfully', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const original = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Original comment',
      });

      // Act
      const updated = await service.updateComment({
        commentId: original.id,
        userId: creator.id,
        comment: 'Updated comment',
      });

      // Assert
      expect(updated.comment).toBe('Updated comment');
      expect(updated.id).toBe(original.id);
    });

    it('should reject update from non-owner', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Original comment',
      });

      // Act & Assert
      await expect(
        service.updateComment({
          commentId: comment.id,
          userId: opponent.id, // Different user
          comment: 'Trying to update',
        })
      ).rejects.toThrow('You can only edit your own comments');
    });

    it('should reject update for non-existent comment', async () => {
      // Arrange
      const user = await createTestUser({ name: 'User' });

      // Act & Assert
      await expect(
        service.updateComment({
          commentId: 'non-existent-id',
          userId: user.id,
          comment: 'Trying to update',
        })
      ).rejects.toThrow('Comment not found');
    });

    it('should reject empty update', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Original comment',
      });

      // Act & Assert
      await expect(
        service.updateComment({
          commentId: comment.id,
          userId: creator.id,
          comment: '',
        })
      ).rejects.toThrow('Comment cannot be empty');
    });
  });

  // ============================================================================
  // DELETE COMMENT
  // ============================================================================
  describe('deleteComment', () => {
    it('should delete own comment successfully', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Comment to delete',
      });

      // Act
      await service.deleteComment({
        commentId: comment.id,
        userId: creator.id,
      });

      // Assert
      const comments = await service.getComments(match.id);
      expect(comments).toHaveLength(0);
    });

    it('should reject deletion from non-owner', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: 'Comment to delete',
      });

      // Act & Assert
      await expect(
        service.deleteComment({
          commentId: comment.id,
          userId: opponent.id, // Different user
        })
      ).rejects.toThrow('You can only delete your own comments');
    });

    it('should reject deletion for non-existent comment', async () => {
      // Arrange
      const user = await createTestUser({ name: 'User' });

      // Act & Assert
      await expect(
        service.deleteComment({
          commentId: 'non-existent-id',
          userId: user.id,
        })
      ).rejects.toThrow('Comment not found');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle special characters in comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const specialComment = 'Great match! <script>alert("xss")</script> & "quotes" \'single\'';

      // Act
      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: specialComment,
      });

      // Assert
      expect(comment.comment).toBe(specialComment);
    });

    it('should handle unicode characters', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const unicodeComment = 'Great game! Best match ever!';

      // Act
      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: unicodeComment,
      });

      // Assert
      expect(comment.comment).toBe(unicodeComment);
    });

    it('should handle exactly max length comment', async () => {
      // Arrange
      const { match, creator, opponent } = await createMatchWithOpponent();

      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });
      await prismaTest.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.ONGOING },
      });

      const maxLengthComment = 'a'.repeat(1000);

      // Act
      const comment = await service.createComment({
        matchId: match.id,
        userId: creator.id,
        comment: maxLengthComment,
      });

      // Assert
      expect(comment.comment).toHaveLength(1000);
    });
  });
});
