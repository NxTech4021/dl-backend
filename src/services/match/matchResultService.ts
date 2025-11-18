/**
 * Match Result Service
 * Handles result submission, confirmation, and dispute handling
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  WalkoverReason,
  DisputeCategory,
  DisputeStatus,
  InvitationStatus
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';
import { handlePostMatchCreation } from '../matchService';

// Types
export interface SubmitResultInput {
  matchId: string;
  submittedById: string;
  setScores: SetScore[];
  comment?: string;
  evidence?: string;   // URL to photo evidence
}

export interface SetScore {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  team1Tiebreak?: number;
  team2Tiebreak?: number;
}

export interface ConfirmResultInput {
  matchId: string;
  userId: string;
  confirmed: boolean;
  disputeReason?: string;
  disputeCategory?: DisputeCategory;
  disputerScore?: SetScore[];
  evidenceUrl?: string;
}

export interface SubmitWalkoverInput {
  matchId: string;
  reportedById: string;
  defaultingUserId: string;
  reason: WalkoverReason;
  reasonDetail?: string;
}

export class MatchResultService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Submit match result
   */
  async submitResult(input: SubmitResultInput) {
    const { matchId, submittedById, setScores, comment, evidence } = input;

    // Get match with participants
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        scores: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify submitter is a participant
    const isParticipant = match.participants.some(
      p => p.userId === submittedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!isParticipant) {
      throw new Error('Only match participants can submit results');
    }

    // Check match status
    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Match result has already been submitted');
    }

    if (match.status === MatchStatus.CANCELLED || match.status === MatchStatus.VOID) {
      throw new Error('Cannot submit result for a cancelled or void match');
    }

    // Validate set scores
    this.validateSetScores(setScores);

    // Calculate final scores
    const { team1Score, team2Score, winner } = this.calculateFinalScore(setScores);

    await prisma.$transaction(async (tx) => {
      // Delete existing scores if any
      await tx.matchScore.deleteMany({
        where: { matchId }
      });

      // Create new scores
      for (const score of setScores) {
        await tx.matchScore.create({
          data: {
            matchId,
            setNumber: score.setNumber,
            player1Games: score.team1Games,
            player2Games: score.team2Games,
            hasTiebreak: !!(score.team1Tiebreak || score.team2Tiebreak),
            player1Tiebreak: score.team1Tiebreak,
            player2Tiebreak: score.team2Tiebreak
          }
        });
      }

      // Update match
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          team1Score,
          team2Score,
          setScores: JSON.stringify(setScores),
          outcome: winner,
          resultSubmittedById: submittedById,
          resultSubmittedAt: new Date(),
          resultComment: comment,
          resultEvidence: evidence,
          // If only 2 participants (singles) or result submitted by creator, may auto-approve
          requiresAdminReview: false
        }
      });
    });

    // Trigger post-match processing (reactivation, etc.)
    await handlePostMatchCreation(matchId);

    // Notify other participants
    await this.sendResultSubmittedNotification(matchId, submittedById);

    logger.info(`Result submitted for match ${matchId} by user ${submittedById}`);

    return this.getMatchWithResults(matchId);
  }

  /**
   * Confirm or dispute match result
   */
  async confirmResult(input: ConfirmResultInput) {
    const {
      matchId,
      userId,
      confirmed,
      disputeReason,
      disputeCategory,
      disputerScore,
      evidenceUrl
    } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true, disputes: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify user is a participant
    const isParticipant = match.participants.some(
      p => p.userId === userId && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!isParticipant) {
      throw new Error('Only match participants can confirm results');
    }

    // Check that result has been submitted
    if (!match.resultSubmittedAt) {
      throw new Error('No result has been submitted for this match');
    }

    // Can't confirm your own submission
    if (match.resultSubmittedById === userId && confirmed) {
      throw new Error('You cannot confirm your own result submission');
    }

    if (confirmed) {
      // Confirm the result
      await prisma.match.update({
        where: { id: matchId },
        data: {
          resultConfirmedById: userId,
          resultConfirmedAt: new Date(),
          isAutoApproved: false
        }
      });

      // Notify submitter
      await this.sendResultConfirmedNotification(matchId, userId);

      logger.info(`Result confirmed for match ${matchId} by user ${userId}`);
    } else {
      // Create dispute
      if (!disputeReason || !disputeCategory) {
        throw new Error('Dispute reason and category are required');
      }

      // Check if dispute already exists
      if (match.disputes.length > 0 && match.disputes.some(d => d.status !== DisputeStatus.RESOLVED)) {
        throw new Error('A dispute already exists for this match');
      }

      await prisma.$transaction(async (tx) => {
        // Create dispute
        await tx.matchDispute.create({
          data: {
            matchId,
            raisedByUserId: userId,
            disputeCategory,
            disputeComment: disputeReason,
            disputerScore: disputerScore ? JSON.stringify(disputerScore) : null,
            evidenceUrl,
            status: DisputeStatus.OPEN
          }
        });

        // Mark match as disputed
        await tx.match.update({
          where: { id: matchId },
          data: {
            isDisputed: true,
            requiresAdminReview: true
          }
        });
      });

      // Notify admin and other participants
      await this.sendDisputeCreatedNotification(matchId, userId);

      logger.info(`Dispute raised for match ${matchId} by user ${userId}`);
    }

    return this.getMatchWithResults(matchId);
  }

  /**
   * Submit walkover
   */
  async submitWalkover(input: SubmitWalkoverInput) {
    const { matchId, reportedById, defaultingUserId, reason, reasonDetail } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify reporter is a participant
    const isParticipant = match.participants.some(
      p => p.userId === reportedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!isParticipant) {
      throw new Error('Only match participants can report walkovers');
    }

    // Verify defaulting user is also a participant
    const defaultingParticipant = match.participants.find(
      p => p.userId === defaultingUserId
    );

    if (!defaultingParticipant) {
      throw new Error('Defaulting user is not a participant in this match');
    }

    // Determine winner (opposite team)
    const reporterParticipant = match.participants.find(p => p.userId === reportedById);
    const winningUserId = reportedById; // Reporter wins the walkover

    await prisma.$transaction(async (tx) => {
      // Create walkover record
      await tx.matchWalkover.create({
        data: {
          matchId,
          walkoverReason: reason,
          walkoverReasonDetail: reasonDetail,
          defaultingPlayerId: defaultingUserId,
          winningPlayerId: winningUserId,
          reportedBy: reportedById,
          adminVerified: false
        }
      });

      // Update match
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          isWalkover: true,
          walkoverReason: reason,
          walkoverRecordedById: reportedById,
          outcome: `Walkover - ${reason}`,
          // Standard walkover score (e.g., 6-0, 6-0)
          walkoverScore: { sets: [[6, 0], [6, 0]] },
          team1Score: reporterParticipant?.team === 'team1' ? 2 : 0,
          team2Score: reporterParticipant?.team === 'team1' ? 0 : 2
        }
      });
    });

    // Notify participants
    await this.sendWalkoverNotification(matchId, reportedById, defaultingUserId);

    logger.info(`Walkover reported for match ${matchId} by user ${reportedById}`);

    return this.getMatchWithResults(matchId);
  }

  /**
   * Get match with full results
   */
  async getMatchWithResults(matchId: string) {
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
        scores: { orderBy: { setNumber: 'asc' } },
        disputes: {
          include: {
            raisedByUser: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        walkover: true,
        resultSubmittedBy: {
          select: { id: true, name: true, username: true }
        },
        resultConfirmedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  }

  /**
   * Validate set scores
   */
  private validateSetScores(setScores: SetScore[]) {
    if (!setScores || setScores.length === 0) {
      throw new Error('At least one set score is required');
    }

    for (const score of setScores) {
      if (score.team1Games < 0 || score.team2Games < 0) {
        throw new Error('Game scores cannot be negative');
      }

      // Validate tennis/padel scoring rules
      const maxGames = Math.max(score.team1Games, score.team2Games);
      const minGames = Math.min(score.team1Games, score.team2Games);

      // Standard set: need at least 6 games and 2 game lead, or tiebreak at 6-6
      if (maxGames < 6) {
        throw new Error(`Set ${score.setNumber}: Winner must have at least 6 games`);
      }

      // Tiebreak validation
      if (score.team1Games === 6 && score.team2Games === 6) {
        if (!score.team1Tiebreak && !score.team2Tiebreak) {
          throw new Error(`Set ${score.setNumber}: Tiebreak scores required for 6-6 sets`);
        }
      }
    }
  }

  /**
   * Calculate final score from set scores
   */
  private calculateFinalScore(setScores: SetScore[]): {
    team1Score: number;
    team2Score: number;
    winner: string;
  } {
    let team1Sets = 0;
    let team2Sets = 0;

    for (const score of setScores) {
      if (score.team1Games > score.team2Games) {
        team1Sets++;
      } else if (score.team2Games > score.team1Games) {
        team2Sets++;
      } else {
        // Tiebreak
        if ((score.team1Tiebreak || 0) > (score.team2Tiebreak || 0)) {
          team1Sets++;
        } else {
          team2Sets++;
        }
      }
    }

    return {
      team1Score: team1Sets,
      team2Score: team2Sets,
      winner: team1Sets > team2Sets ? 'team1' : 'team2'
    };
  }

  /**
   * Send notification when result is submitted
   */
  private async sendResultSubmittedNotification(matchId: string, submitterId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: { select: { userId: true } }
        }
      });

      if (!match) return;

      const submitter = await prisma.user.findUnique({
        where: { id: submitterId },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== submitterId)
        .map(p => p.userId);

      await this.notificationService.createNotification({
        title: 'Match Result Submitted',
        message: `${submitter?.name} has submitted the match result. Please confirm or dispute.`,
        category: 'MATCH',
        matchId,
        recipientIds: otherParticipants
      });
    } catch (error) {
      logger.error('Error sending result submitted notification', {}, error as Error);
    }
  }

  /**
   * Send notification when result is confirmed
   */
  private async sendResultConfirmedNotification(matchId: string, confirmerId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: { select: { userId: true } }
        }
      });

      if (!match) return;

      const confirmer = await prisma.user.findUnique({
        where: { id: confirmerId },
        select: { name: true }
      });

      const participantIds = match.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        title: 'Match Result Confirmed',
        message: `${confirmer?.name} has confirmed the match result.`,
        category: 'MATCH',
        matchId,
        recipientIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending result confirmed notification', {}, error as Error);
    }
  }

  /**
   * Send notification when dispute is created
   */
  private async sendDisputeCreatedNotification(matchId: string, disputerId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: { select: { userId: true } }
        }
      });

      if (!match) return;

      const disputer = await prisma.user.findUnique({
        where: { id: disputerId },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== disputerId)
        .map(p => p.userId);

      await this.notificationService.createNotification({
        title: 'Match Result Disputed',
        message: `${disputer?.name} has disputed the match result. An admin will review.`,
        category: 'MATCH',
        matchId,
        recipientIds: otherParticipants
      });
    } catch (error) {
      logger.error('Error sending dispute created notification', {}, error as Error);
    }
  }

  /**
   * Send notification for walkover
   */
  private async sendWalkoverNotification(matchId: string, reporterId: string, defaulterId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: { select: { userId: true } }
        }
      });

      if (!match) return;

      const reporter = await prisma.user.findUnique({
        where: { id: reporterId },
        select: { name: true }
      });

      const participantIds = match.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        title: 'Walkover Reported',
        message: `${reporter?.name} has reported a walkover for this match.`,
        category: 'MATCH',
        matchId,
        recipientIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending walkover notification', {}, error as Error);
    }
  }
}

// Export singleton instance
let matchResultService: MatchResultService | null = null;

export function getMatchResultService(notificationService?: NotificationService): MatchResultService {
  if (!matchResultService) {
    matchResultService = new MatchResultService(notificationService);
  }
  return matchResultService;
}
