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
import { formatMatchDate, formatMatchTime } from '../../utils/timezone';
import { NotificationService, notificationService as notificationServiceSingleton } from '../notificationService';
import { matchManagementNotifications } from '../../helpers/notifications/matchManagementNotifications';

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
    this.notificationService = notificationService || notificationServiceSingleton;
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
          participants: {
            select: {
              userId: true,
              user: { select: { name: true } }
            }
          },
          division: { select: { name: true } },
          season: { select: { name: true } },
          createdBy: { select: { name: true } }
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

      // Use notification types and templates
      const isLeagueMatch = !!match.seasonId;
      const isDoublesMatch = match.matchType === 'DOUBLES';
      const opponentName = canceller?.name || 'Opponent';
      const date = match.matchDate ? formatMatchDate(match.matchDate) : '';
      const time = match.matchDate ? formatMatchTime(match.matchDate) : '';
      const venue = match.venue || '';

      let notificationPayload;
      if (isLeagueMatch) {
        // League match cancellation
        notificationPayload = matchManagementNotifications.leagueMatchCancelledByOpponent(
          opponentName,
          date,
          time,
          venue
        );
      } else if (isDoublesMatch) {
        // Friendly doubles match cancellation
        notificationPayload = matchManagementNotifications.friendlyMatchCancelled(
          opponentName,
          date,
          time
        );
      } else {
        // Friendly singles match cancellation
        notificationPayload = matchManagementNotifications.matchCancelled(
          opponentName
        );
      }

      await this.notificationService.createNotification({
        ...notificationPayload,
        matchId,
        userIds: otherParticipants,
        metadata: {
          cancelledBy: canceller?.name,
          matchType: match.matchType,
          isLateCancellation: isLate,
          divisionName: match.division?.name,
          seasonName: match.season?.name
        }
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

  // recordWalkover REMOVED — duplicate of matchResultService.submitWalkover which is the
  // active walkover endpoint (POST /:id/walkover via matchResultController.submitWalkover).
  // This method was never reachable because the route was never mounted (matchRoutes.ts:105).
  // See docs/issues/dissections/111-singles-match-deep-stress.md §5 D-2.

  /**
   * Request to reschedule a match
   * STUB - Time slot feature not yet implemented
   */
  async requestReschedule(input: RequestRescheduleInput) {
    throw new Error('Reschedule feature not yet implemented');
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
