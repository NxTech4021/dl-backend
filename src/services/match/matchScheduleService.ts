/**
 * Match Schedule Service
 * Handles match cancellation and rescheduling
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  CancellationReason,
  InvitationStatus
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';

// Types
export interface CancelMatchInput {
  matchId: string;
  cancelledById: string;
  reason: CancellationReason;
  comment?: string;
}

export interface RescheduleMatchInput {
  matchId: string;
  requestedById: string;
  newProposedTimes: Date[];
  reason?: string;
}

export interface RequestRescheduleInput {
  matchId: string;
  requestedById: string;
  proposedTimes: Date[];
  reason: string;
}

export class MatchScheduleService {
  private notificationService: NotificationService;

  // Configurable: hours before match that counts as "late" and requires admin review
  private lateCancellationThresholdHours = 4;

  // Minutes after scheduled time to consider opponent as "late" for walkover
  private walkoverLateThresholdMinutes = 20;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Cancel a match
   */
  async cancelMatch(input: CancelMatchInput) {
    const { matchId, cancelledById, reason, comment } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify user is a participant
    const isParticipant = match.participants.some(
      p => p.userId === cancelledById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!isParticipant) {
      throw new Error('Only match participants can cancel the match');
    }

    // Check if match can be cancelled
    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed match');
    }

    if (match.status === MatchStatus.CANCELLED) {
      throw new Error('Match is already cancelled');
    }

    // Check if it's a late cancellation and requires admin review
    const scheduledTime = match.matchDate;
    let isLateCancellation = false;
    let requiresAdminReview = false;

    if (scheduledTime) {
      const hoursUntilMatch = (scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
      isLateCancellation = hoursUntilMatch < this.lateCancellationThresholdHours;
      requiresAdminReview = hoursUntilMatch < this.lateCancellationThresholdHours;
    }

    const updateData: any = {
      status: MatchStatus.CANCELLED,
      cancellationRequestedAt: new Date(),
      isLateCancellation,
      cancellationReason: reason,
      cancelledById,
      cancelledAt: new Date(),
      requiresAdminReview
    };
    if (comment) updateData.cancellationComment = comment;

    await prisma.match.update({
      where: { id: matchId },
      data: updateData
    });

    // Send notifications
    await this.sendCancellationNotification(matchId, cancelledById, isLateCancellation);

    logger.info(`Match ${matchId} cancelled by user ${cancelledById}. Late: ${isLateCancellation}`);

    return this.getMatchById(matchId);
  }


  /**
   * Get match by ID with schedule info
   */
  private async getMatchById(matchId: string) {
    return prisma.match.findUnique({
      where: { id: matchId },
      include: {
        division: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        rescheduledFrom: {
          select: { id: true, matchDate: true }
        },
        rescheduledTo: {
          select: { id: true, matchDate: true }
        }
      }
    });
  }

  /**
   * Send cancellation notification
   */
  private async sendCancellationNotification(matchId: string, cancelledById: string, isLate: boolean) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { 
          participants: { select: { userId: true } },
          division: { select: { name: true } },
          season: { select: { name: true } }
        }
      });

      if (!match) return;

      const canceller = await prisma.user.findUnique({
        where: { id: cancelledById },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== cancelledById)
        .map(p => p.userId);

      if (otherParticipants.length === 0) return;

      const lateWarning = isLate ? ' (Late cancellation - penalties may apply)' : '';
      
      // Determine if this is a league match
      const isLeagueMatch = !!match.seasonId;
      
      const notificationType = isLeagueMatch ? 'LEAGUE_MATCH_CANCELLED_BY_OPPONENT' : 'MATCH_CANCELLED';
      const title = isLeagueMatch ? 'League Match Cancelled' : 'Match Cancelled';
      const message = isLeagueMatch 
        ? `${canceller?.name} cancelled your league match${match.division ? ` in ${match.division.name}` : ''}${lateWarning}`
        : `${canceller?.name} has cancelled the match.${lateWarning}`;

      await this.notificationService.createNotification({
        type: notificationType,
        title,
        message,
        category: 'MATCH',
        matchId,
        userIds: otherParticipants
      });
    } catch (error) {
      logger.error('Error sending cancellation notification', {}, error as Error);
    }
  }

  /**
   * Send reschedule request notification
   */
  private async sendRescheduleRequestNotification(matchId: string, requesterId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { participants: { select: { userId: true } } }
      });

      if (!match) return;

      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== requesterId)
        .map(p => p.userId);

      await this.notificationService.createNotification({
        type: 'MATCH_RESCHEDULED',
        title: 'Reschedule Requested',
        message: `${requester?.name} has requested to reschedule the match. Please vote on new times.`,
        category: 'MATCH',
        matchId,
        userIds: otherParticipants
      });
    } catch (error) {
      logger.error('Error sending reschedule request notification', {}, error as Error);
    }
  }

  /**
   * Send notification when match is rescheduled
   */
  private async sendRescheduledNotification(oldMatchId: string, newMatchId: string) {
    try {
      const newMatch = await prisma.match.findUnique({
        where: { id: newMatchId },
        include: { participants: { select: { userId: true } } }
      });

      if (!newMatch) return;

      const participantIds = newMatch.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        type: 'MATCH_RESCHEDULED',
        title: 'Match Rescheduled',
        message: 'Your match has been rescheduled. Please confirm the new time.',
        category: 'MATCH',
        matchId: newMatchId,
        userIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending rescheduled notification', {}, error as Error);
    }
  }

  /**
   * Get cancellation rule impact (shows warnings/penalties)
   */
  async getCancellationRuleImpact(matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const scheduledTime = match.matchDate;

    if (!scheduledTime) {
      return {
        canCancel: true,
        isLateCancellation: false,
        requiresAdminReview: false,
        hoursUntilMatch: null,
        warningMessage: null
      };
    }

    const hoursUntilMatch = (scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilMatch < this.lateCancellationThresholdHours;
    const requiresAdminReview = isLateCancellation;

    let warningMessage = null;
    if (isLateCancellation) {
      warningMessage = `This is a late cancellation (less than ${this.lateCancellationThresholdHours} hours before match). It will require admin review and may result in penalties.`;
    }

    return {
      canCancel: true,
      isLateCancellation,
      requiresAdminReview,
      hoursUntilMatch: Math.round(hoursUntilMatch * 10) / 10,
      warningMessage
    };
  }

  /**
   * Record a walkover (opponent 20+ minutes late)
   */
  async recordWalkover(matchId: string, reportedById: string, defaultingPlayerId: string, reason: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify reporter is a participant
    const reporter = match.participants.find(p => p.userId === reportedById);
    if (!reporter) {
      throw new Error('Only match participants can report a walkover');
    }

    // Verify defaulting player is a participant
    const defaultingPlayer = match.participants.find(p => p.userId === defaultingPlayerId);
    if (!defaultingPlayer) {
      throw new Error('Defaulting player must be a participant');
    }

    // Check if match is scheduled/ongoing
    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.ONGOING) {
      throw new Error('Can only record walkover for scheduled or ongoing matches');
    }

    // Check if opponent is actually late
    const scheduledTime = match.matchDate;
    if (scheduledTime) {
      const minutesSinceScheduled = (Date.now() - scheduledTime.getTime()) / (1000 * 60);
      if (minutesSinceScheduled < this.walkoverLateThresholdMinutes) {
        throw new Error(`Opponent must be at least ${this.walkoverLateThresholdMinutes} minutes late to record a walkover`);
      }
    }

    // Determine winning player
    const winningPlayerId = reportedById;

    // Create walkover record
    await prisma.$transaction(async (tx) => {
      // Check if walkover already exists
      const existingWalkover = await tx.matchWalkover.findUnique({
        where: { matchId }
      });

      if (existingWalkover) {
        throw new Error('Walkover already recorded for this match');
      }

      // Create walkover
      await tx.matchWalkover.create({
        data: {
          matchId,
          walkoverReason: 'NO_SHOW',
          walkoverReasonDetail: reason,
          defaultingPlayerId,
          winningPlayerId,
          reportedBy: reportedById
        }
      });

      // Update match status
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          isWalkover: true,
          walkoverReason: 'NO_SHOW',
          walkoverRecordedById: reportedById,
          outcome: reporter.team || 'team1',
          requiresAdminReview: true // Walkovers require admin confirmation
        }
      });
    });

    // Notify participants
    const otherParticipants = match.participants
      .filter(p => p.userId !== reportedById)
      .map(p => p.userId);

    await this.notificationService.createNotification({
      type: 'MATCH_WALKOVER_WON',
      title: 'Walkover Recorded',
      message: 'A walkover has been recorded for this match. Admin will review.',
      category: 'MATCH',
      matchId,
      userIds: otherParticipants
    });

    logger.info(`Walkover recorded for match ${matchId} by user ${reportedById}`);

    return this.getMatchById(matchId);
  }

  /**
   * Continue an unfinished match (reschedule for completion)
   * COMMENTED OUT - matchTimeSlot model doesn't exist in schema
   */
  async continueUnfinishedMatch(matchId: string, requestedById: string, proposedTimes: Date[], notes?: string) {
    throw new Error('Time slot feature not yet implemented');
    /*
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify user is a participant
    const isParticipant = match.participants.some(
      p => p.userId === requestedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!isParticipant) {
      throw new Error('Only match participants can continue the match');
    }

    // Check if match is unfinished
    if (match.status !== MatchStatus.UNFINISHED) {
      throw new Error('Only unfinished matches can be continued');
    }

    // Update match status and add new time proposals
    await prisma.$transaction(async (tx) => {
      // Update match to scheduled
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.SCHEDULED,
          scheduledTime: null,
          notes: notes ? `${match.notes || ''}\nContinuing match: ${notes}` : match.notes
        }
      });

      // Create new time slot proposals
      for (const time of proposedTimes) {
        await tx.matchTimeSlot.create({
          data: {
            matchId,
            proposedById: requestedById,
            proposedTime: time,
            status: 'PROPOSED',
            notes: 'Continuation of unfinished match',
            votes: [requestedById],
            voteCount: 1
          }
        });
      }
    });

    // Notify other participants
    const otherParticipants = match.participants
      .filter(p => p.userId !== requestedById)
      .map(p => p.userId);

    const requester = await prisma.user.findUnique({
      where: { id: requestedById },
      select: { name: true }
    });

    await this.notificationService.createNotification({
      type: 'MATCH_RESCHEDULED',
      title: 'Match Continuation Proposed',
      message: `${requester?.name} has proposed times to continue the unfinished match.`,
      category: 'MATCH',
      matchId,
      userIds: otherParticipants
    });

    logger.info(`Unfinished match ${matchId} continuation requested by user ${requestedById}`);

    return this.getMatchById(matchId);
    */
  }
}

// Export singleton instance
let matchScheduleService: MatchScheduleService | null = null;

export function getMatchScheduleService(notificationService?: NotificationService): MatchScheduleService {
  if (!matchScheduleService) {
    matchScheduleService = new MatchScheduleService(notificationService);
  }
  return matchScheduleService;
}
