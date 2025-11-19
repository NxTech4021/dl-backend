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

  // Configurable: hours before match that counts as "late"
  private lateCancellationThresholdHours = 24;

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
        participants: true,
        timeSlots: {
          where: { status: 'CONFIRMED' },
          take: 1
        }
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

    // Check if it's a late cancellation
    const scheduledTime = match.scheduledTime || match.timeSlots[0]?.proposedTime;
    let isLateCancellation = false;

    if (scheduledTime) {
      const hoursUntilMatch = (scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
      isLateCancellation = hoursUntilMatch < this.lateCancellationThresholdHours;
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.CANCELLED,
        cancellationRequestedAt: new Date(),
        isLateCancellation,
        cancellationReason: reason,
        cancelledById,
        cancelledAt: new Date(),
        cancellationComment: comment
      }
    });

    // Send notifications
    await this.sendCancellationNotification(matchId, cancelledById, isLateCancellation);

    logger.info(`Match ${matchId} cancelled by user ${cancelledById}. Late: ${isLateCancellation}`);

    return this.getMatchById(matchId);
  }

  /**
   * Request to reschedule a match (creates new time proposals)
   */
  async requestReschedule(input: RequestRescheduleInput) {
    const { matchId, requestedById, proposedTimes, reason } = input;

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
      throw new Error('Only match participants can request rescheduling');
    }

    // Check match status
    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new Error('Cannot reschedule a completed or cancelled match');
    }

    // Check reschedule limit
    const maxReschedules = 3;
    if (match.rescheduleCount >= maxReschedules) {
      throw new Error(`Maximum reschedule limit (${maxReschedules}) reached`);
    }

    await prisma.$transaction(async (tx) => {
      // Mark existing time slots as rejected
      await tx.matchTimeSlot.updateMany({
        where: { matchId },
        data: { status: 'REJECTED' }
      });

      // Create new proposed time slots
      for (const time of proposedTimes) {
        await tx.matchTimeSlot.create({
          data: {
            matchId,
            proposedById: requestedById,
            proposedTime: time,
            status: 'PROPOSED',
            notes: reason,
            votes: [requestedById],
            voteCount: 1
          }
        });
      }

      // Update match
      await tx.match.update({
        where: { id: matchId },
        data: {
          scheduledTime: null,
          scheduledStartTime: null,
          rescheduleCount: { increment: 1 }
        }
      });
    });

    // Notify other participants
    await this.sendRescheduleRequestNotification(matchId, requestedById);

    logger.info(`Reschedule requested for match ${matchId} by user ${requestedById}`);

    return this.getMatchById(matchId);
  }

  /**
   * Reschedule a match (admin or mutual agreement)
   */
  async rescheduleMatch(input: RescheduleMatchInput) {
    const { matchId, requestedById, newProposedTimes, reason } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Create a new match as the rescheduled version
    const rescheduledMatch = await prisma.$transaction(async (tx) => {
      // Mark original as cancelled
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.CANCELLED,
          cancellationComment: reason || 'Rescheduled to new match'
        }
      });

      // Create new match
      const newMatch = await tx.match.create({
        data: {
          divisionId: match.divisionId,
          seasonId: match.seasonId,
          leagueId: match.leagueId,
          sport: match.sport,
          matchType: match.matchType,
          format: match.format,
          createdById: match.createdById,
          location: match.location,
          venue: match.venue,
          notes: match.notes,
          status: MatchStatus.SCHEDULED,
          rescheduledFromId: matchId,
          rescheduleCount: match.rescheduleCount + 1,
          proposedTimes: newProposedTimes.map(t => t.toISOString())
        }
      });

      // Copy participants
      for (const participant of match.participants) {
        await tx.matchParticipant.create({
          data: {
            matchId: newMatch.id,
            userId: participant.userId,
            role: participant.role,
            team: participant.team,
            invitationStatus: participant.invitationStatus,
            acceptedAt: participant.acceptedAt
          }
        });
      }

      // Create new time slots
      for (const time of newProposedTimes) {
        await tx.matchTimeSlot.create({
          data: {
            matchId: newMatch.id,
            proposedById: requestedById,
            proposedTime: time,
            status: 'PROPOSED',
            votes: [requestedById],
            voteCount: 1
          }
        });
      }

      return newMatch;
    });

    // Notify participants
    await this.sendRescheduledNotification(matchId, rescheduledMatch.id);

    logger.info(`Match ${matchId} rescheduled to new match ${rescheduledMatch.id}`);

    return this.getMatchById(rescheduledMatch.id);
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
        timeSlots: {
          orderBy: { proposedTime: 'asc' }
        },
        rescheduledFrom: {
          select: { id: true, matchDate: true }
        },
        rescheduledTo: {
          select: { id: true, scheduledTime: true }
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
        include: { participants: { select: { userId: true } } }
      });

      if (!match) return;

      const canceller = await prisma.user.findUnique({
        where: { id: cancelledById },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== cancelledById)
        .map(p => p.userId);

      const lateWarning = isLate ? ' (Late cancellation - penalties may apply)' : '';

      await this.notificationService.createNotification({
        title: 'Match Cancelled',
        message: `${canceller?.name} has cancelled the match.${lateWarning}`,
        category: 'MATCH',
        matchId,
        recipientIds: otherParticipants
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
        title: 'Reschedule Requested',
        message: `${requester?.name} has requested to reschedule the match. Please vote on new times.`,
        category: 'MATCH',
        matchId,
        recipientIds: otherParticipants
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
        title: 'Match Rescheduled',
        message: 'Your match has been rescheduled. Please confirm the new time.',
        category: 'MATCH',
        matchId: newMatchId,
        recipientIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending rescheduled notification', {}, error as Error);
    }
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
