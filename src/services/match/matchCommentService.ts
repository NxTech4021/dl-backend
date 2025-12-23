/**
 * Match Comment Service
 * Handles comment CRUD operations with participant validation and real-time updates
 */

import { prisma } from '../../lib/prisma';
import { MatchStatus, InvitationStatus } from '@prisma/client';
import { logger } from '../../utils/logger';
import { io } from '../../app';

// Types
export interface CreateCommentInput {
  matchId: string;
  userId: string;
  comment: string;
}

export interface UpdateCommentInput {
  commentId: string;
  userId: string;
  comment: string;
}

export interface DeleteCommentInput {
  commentId: string;
  userId: string;
}

export interface MatchCommentWithUser {
  id: string;
  matchId: string;
  userId: string;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    username: string;
    image: string | null;
  };
}

// Allowed statuses for commenting
const COMMENTABLE_STATUSES: MatchStatus[] = [
  MatchStatus.ONGOING,
  MatchStatus.COMPLETED,
  MatchStatus.UNFINISHED,
];

const MAX_COMMENT_LENGTH = 1000;

export class MatchCommentService {
  /**
   * Validate that a user can comment on a match
   * Returns the match if valid, throws error if not
   */
  async validateCommentAccess(matchId: string, userId: string): Promise<{ match: any; canComment: boolean }> {
    // Get match with participants
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          where: { userId },
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Check if user is a participant with ACCEPTED status
    const participant = match.participants.find(
      (p) => p.userId === userId && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!participant) {
      throw new Error('Only match participants can comment');
    }

    // Check match status
    if (!COMMENTABLE_STATUSES.includes(match.status)) {
      throw new Error(
        `Cannot comment on matches with status ${match.status}. Comments are only allowed for ongoing or completed matches.`
      );
    }

    return { match, canComment: true };
  }

  /**
   * Validate comment text
   */
  private validateCommentText(comment: string): void {
    if (!comment || comment.trim().length === 0) {
      throw new Error('Comment cannot be empty');
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      throw new Error(`Comment exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`);
    }
  }

  /**
   * Create a new comment
   */
  async createComment(input: CreateCommentInput): Promise<MatchCommentWithUser> {
    const { matchId, userId, comment } = input;

    // Validate access
    await this.validateCommentAccess(matchId, userId);

    // Validate comment text
    this.validateCommentText(comment);

    // Create comment
    const newComment = await prisma.matchComment.create({
      data: {
        matchId,
        userId,
        comment: comment.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    // Emit real-time event
    this.emitCommentEvent(matchId, 'match_comment_added', { comment: newComment });

    logger.info(`Comment created on match ${matchId} by user ${userId}`);

    return newComment;
  }

  /**
   * Get all comments for a match
   */
  async getComments(matchId: string): Promise<MatchCommentWithUser[]> {
    // Verify match exists
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const comments = await prisma.matchComment.findMany({
      where: { matchId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  /**
   * Update an existing comment
   */
  async updateComment(input: UpdateCommentInput): Promise<MatchCommentWithUser> {
    const { commentId, userId, comment } = input;

    // Validate comment text
    this.validateCommentText(comment);

    // Get existing comment
    const existingComment = await prisma.matchComment.findUnique({
      where: { id: commentId },
      include: {
        match: true,
      },
    });

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    // Verify ownership
    if (existingComment.userId !== userId) {
      throw new Error('You can only edit your own comments');
    }

    // Update comment
    const updatedComment = await prisma.matchComment.update({
      where: { id: commentId },
      data: {
        comment: comment.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    // Emit real-time event
    this.emitCommentEvent(existingComment.matchId, 'match_comment_updated', { comment: updatedComment });

    logger.info(`Comment ${commentId} updated by user ${userId}`);

    return updatedComment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(input: DeleteCommentInput): Promise<void> {
    const { commentId, userId } = input;

    // Get existing comment
    const existingComment = await prisma.matchComment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    // Verify ownership
    if (existingComment.userId !== userId) {
      throw new Error('You can only delete your own comments');
    }

    // Delete comment
    await prisma.matchComment.delete({
      where: { id: commentId },
    });

    // Emit real-time event
    this.emitCommentEvent(existingComment.matchId, 'match_comment_deleted', { commentId });

    logger.info(`Comment ${commentId} deleted by user ${userId}`);
  }

  /**
   * Emit socket event for real-time updates
   */
  private emitCommentEvent(matchId: string, eventName: string, data: any): void {
    try {
      if (io) {
        io.to(`match:${matchId}`).emit(eventName, data);
        logger.debug(`Emitted ${eventName} for match ${matchId}`);
      }
    } catch (error) {
      // Socket emission is non-critical, log and continue
      logger.warn(`Failed to emit ${eventName} for match ${matchId}`, {}, error as Error);
    }
  }
}

// Export singleton instance
let matchCommentService: MatchCommentService | null = null;

export function getMatchCommentService(): MatchCommentService {
  if (!matchCommentService) {
    matchCommentService = new MatchCommentService();
  }
  return matchCommentService;
}
