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
import { calculateMatchRatings, applyMatchRatings } from '../rating/ratingCalculationService';
import { updateMatchStandings } from '../rating/standingsCalculationService';
import { notifyAdminsDispute } from '../notification/adminNotificationService';
import { notifyBatchRatingChanges } from '../notification/playerNotificationService';
import { ScoreValidationService } from './validation/scoreValidationService';
import { MatchResultCreationService } from './calculation/matchResultCreationService';
import { Best6EventHandler } from './best6/best6EventHandler';
import { StandingsV2Service } from '../rating/standingsV2Service';

// Types
export interface SubmitResultInput {
  matchId: string;
  submittedById: string;
  setScores?: SetScore[];        // For Tennis/Padel
  gameScores?: PickleballScore[]; // For Pickleball
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

export interface PickleballScore {
  gameNumber: number;  // 1, 2, or 3
  team1Points: number;
  team2Points: number;
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
    const { matchId, submittedById, setScores, gameScores, comment, evidence } = input;

    // Get match with participants
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        scores: true,
        pickleballScores: true
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

    // Validate and calculate scores based on sport
    let team1Score: number, team2Score: number, winner: string;

    if (match.sport === 'PICKLEBALL') {
      // Pickleball validation and calculation
      if (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0) {
        throw new Error('gameScores array is required for Pickleball matches');
      }
      this.validatePickleballScores(gameScores);
      const pickleballResult = this.calculatePickleballFinalScore(gameScores);
      team1Score = pickleballResult.team1Score;
      team2Score = pickleballResult.team2Score;
      winner = pickleballResult.winner;
    } else {
      // Tennis/Padel validation and calculation
      if (!setScores || !Array.isArray(setScores) || setScores.length === 0) {
        throw new Error('setScores array is required for Tennis/Padel matches');
      }
      this.validateSetScores(setScores, match.sport, match.set3Format || undefined);
      const tennisResult = this.calculateFinalScore(setScores);
      team1Score = tennisResult.team1Score;
      team2Score = tennisResult.team2Score;
      winner = tennisResult.winner;
    }

    await prisma.$transaction(async (tx) => {
      if (match.sport === 'PICKLEBALL') {
        // Delete existing Pickleball scores if any
        await tx.pickleballGameScore.deleteMany({
          where: { matchId }
        });

        // Create new Pickleball scores
        for (const score of gameScores!) {
          await tx.pickleballGameScore.create({
            data: {
              matchId,
              gameNumber: score.gameNumber,
              player1Points: score.team1Points,
              player2Points: score.team2Points
            }
          });
        }

        // Update match
        const matchUpdateData: any = {
          status: MatchStatus.COMPLETED,
          team1Score,
          team2Score,
          setScores: JSON.stringify(gameScores),
          outcome: winner,
          resultSubmittedById: submittedById,
          resultSubmittedAt: new Date(),
          requiresAdminReview: false
        };
        if (comment) matchUpdateData.resultComment = comment;
        if (evidence) matchUpdateData.resultEvidence = evidence;

        await tx.match.update({
          where: { id: matchId },
          data: matchUpdateData
        });
      } else {
        // Delete existing Tennis/Padel scores if any
        await tx.matchScore.deleteMany({
          where: { matchId }
        });

        // Create new Tennis/Padel scores
        for (const score of setScores!) {
          const scoreData: any = {
            matchId,
            setNumber: score.setNumber,
            player1Games: score.team1Games,
            player2Games: score.team2Games,
            hasTiebreak: !!(score.team1Tiebreak || score.team2Tiebreak)
          };
          if (score.team1Tiebreak !== undefined) scoreData.player1Tiebreak = score.team1Tiebreak;
          if (score.team2Tiebreak !== undefined) scoreData.player2Tiebreak = score.team2Tiebreak;

          await tx.matchScore.create({ data: scoreData });
        }

        // Update match
        const matchUpdateData: any = {
          status: MatchStatus.COMPLETED,
          team1Score,
          team2Score,
          setScores: JSON.stringify(setScores),
          outcome: winner,
          resultSubmittedById: submittedById,
          resultSubmittedAt: new Date(),
          requiresAdminReview: false
        };
        if (comment) matchUpdateData.resultComment = comment;
        if (evidence) matchUpdateData.resultEvidence = evidence;

        await tx.match.update({
          where: { id: matchId },
          data: matchUpdateData
        });
      }
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

      // NEW: Best 6 System Integration with improved error handling
      const best6Results = {
        matchResultsCreated: false,
        best6Recalculated: false,
        standingsRecalculated: false
      };

      try {
        // Step 1: Create MatchResult records (CRITICAL - must succeed)
        const matchResultService = new MatchResultCreationService();
        await matchResultService.createMatchResults(matchId);
        best6Results.matchResultsCreated = true;
        logger.info(`Created MatchResult records for match ${matchId}`);

        // Step 2: Recalculate Best 6 (Important - try but don't block)
        try {
          const best6Handler = new Best6EventHandler();
          await best6Handler.onMatchCompleted(matchId);
          best6Results.best6Recalculated = true;
          logger.info(`Recalculated Best 6 for match ${matchId}`);
        } catch (error) {
          logger.error(`Failed to recalculate Best 6 for match ${matchId}:`, {}, error as Error);
          // Continue - can be fixed with admin recalculation
        }

        // Step 3: Recalculate standings (Important - try but don't block)
        try {
          if (match.divisionId && match.seasonId) {
            const standingsV2 = new StandingsV2Service();
            await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
            best6Results.standingsRecalculated = true;
            logger.info(`Recalculated standings for division ${match.divisionId}`);
          }
        } catch (error) {
          logger.error(`Failed to recalculate standings:`, {}, error as Error);
          // Continue - can be fixed with admin recalculation
        }

      } catch (error) {
        // Critical error in MatchResult creation
        logger.error(`CRITICAL: Failed to create MatchResult records for match ${matchId}`,
          best6Results, error as Error);

        // This is a critical failure - match results won't count for standings
        // Mark match for admin review
        await prisma.match.update({
          where: { id: matchId },
          data: { requiresAdminReview: true }
        });

        // Still allow match confirmation but log the issue
        logger.warn(`Match ${matchId} confirmed but marked for admin review due to Best 6 processing failure`);
      }

      // Update ratings after confirmation (keep existing for now)
      try {
        const ratingUpdates = await calculateMatchRatings(matchId);
        if (ratingUpdates) {
          await applyMatchRatings(matchId, ratingUpdates);
          logger.info(`Applied rating updates for match ${matchId}`);

          // Send rating change notifications
          const ratingChanges = [ratingUpdates.winner, ratingUpdates.loser].map((update: any) => ({
            userId: update.userId,
            oldRating: update.previousSinglesRating ?? update.previousDoublesRating ?? 1500,
            newRating: update.newSinglesRating ?? update.newDoublesRating ?? 1500,
            matchId
          }));
          await notifyBatchRatingChanges(this.notificationService, ratingChanges);
        }
      } catch (error) {
        logger.error(`Failed to update ratings for match ${matchId}:`, {}, error as Error);
        // Don't throw - ratings failure shouldn't block confirmation
      }

      // OLD standings update (keep for backward compatibility)
      try {
        await updateMatchStandings(matchId);
        logger.info(`Updated old standings for match ${matchId}`);
      } catch (error) {
        logger.error(`Failed to update old standings for match ${matchId}:`, {}, error as Error);
        // Don't throw - standings failure shouldn't block confirmation
      }

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
        const disputeData: any = {
          matchId,
          raisedByUserId: userId,
          disputeCategory,
          disputeComment: disputeReason,
          status: DisputeStatus.OPEN
        };
        if (disputerScore) disputeData.disputerScore = JSON.stringify(disputerScore);
        if (evidenceUrl) disputeData.evidenceUrl = evidenceUrl;

        await tx.matchDispute.create({
          data: disputeData
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
      await this.sendDisputeCreatedNotification(matchId, userId, disputeReason);

      logger.info(`Dispute raised for match ${matchId} by user ${userId}`);
    }

    return this.getMatchWithResults(matchId);
  }

  /**
   * Generate sport-specific walkover scores
   */
  private getWalkoverScores(sport: string) {
    if (sport === 'PICKLEBALL') {
      // Pickleball: 15-0, 15-0, 15-0 (best of 3 games)
      return {
        walkoverScore: {
          games: [
            { gameNumber: 1, winner: 15, loser: 0 },
            { gameNumber: 2, winner: 15, loser: 0 },
            { gameNumber: 3, winner: 15, loser: 0 }
          ]
        },
        setsWon: 3
      };
    } else {
      // Tennis/Padel: 6-0, 6-0
      return {
        walkoverScore: {
          sets: [
            { setNumber: 1, winner: 6, loser: 0 },
            { setNumber: 2, winner: 6, loser: 0 }
          ]
        },
        setsWon: 2
      };
    }
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

    // Get sport-specific walkover scores
    const walkoverScores = this.getWalkoverScores(match.sport);

    await prisma.$transaction(async (tx) => {
      // Create walkover record
      const walkoverData: any = {
        matchId,
        walkoverReason: reason,
        defaultingPlayerId: defaultingUserId,
        winningPlayerId: winningUserId,
        reportedBy: reportedById,
        adminVerified: false
      };
      if (reasonDetail) walkoverData.walkoverReasonDetail = reasonDetail;

      await tx.matchWalkover.create({
        data: walkoverData
      });

      // Update match with sport-specific walkover scores
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          isWalkover: true,
          walkoverReason: reason,
          walkoverRecordedById: reportedById,
          outcome: `Walkover - ${reason}`,
          walkoverScore: walkoverScores.walkoverScore,
          team1Score: reporterParticipant?.team === 'team1' ? walkoverScores.setsWon : 0,
          team2Score: reporterParticipant?.team === 'team1' ? 0 : walkoverScores.setsWon
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
   * Validate set scores using new validation service
   */
  private validateSetScores(
    setScores: SetScore[],
    sport: string = 'TENNIS',
    set3Format?: string
  ) {
    const validator = new ScoreValidationService();

    const validationInput: any = {
      sport: sport as any,
      setScores: setScores.map(s => ({
        setNumber: s.setNumber,
        team1Games: s.team1Games,
        team2Games: s.team2Games,
        ...(s.team1Tiebreak !== undefined && { team1Tiebreak: s.team1Tiebreak }),
        ...(s.team2Tiebreak !== undefined && { team2Tiebreak: s.team2Tiebreak })
      }))
    };

    if (set3Format) {
      validationInput.set3Format = set3Format as 'MATCH_TIEBREAK' | 'FULL_SET';
    }

    const result = validator.validate(validationInput);

    if (!result.valid) {
      throw new Error(`Invalid scores: ${result.errors.join(', ')}`);
    }

    // Log warnings if any
    if (result.warnings.length > 0) {
      logger.warn('Score validation warnings', { warnings: result.warnings });
    }
  }

  /**
   * Validate Pickleball scores using validation service
   */
  private validatePickleballScores(gameScores: PickleballScore[]) {
    const validator = new ScoreValidationService();

    const result = validator.validate({
      sport: 'PICKLEBALL',
      pickleballScores: gameScores.map(g => ({
        gameNumber: g.gameNumber,
        team1Points: g.team1Points,
        team2Points: g.team2Points
      }))
    });

    if (!result.valid) {
      throw new Error(`Invalid Pickleball scores: ${result.errors.join(', ')}`);
    }

    // Log warnings if any
    if (result.warnings.length > 0) {
      logger.warn('Pickleball score validation warnings', { warnings: result.warnings });
    }
  }

  /**
   * Calculate final score from Pickleball game scores
   */
  private calculatePickleballFinalScore(gameScores: PickleballScore[]): {
    team1Score: number;
    team2Score: number;
    winner: string;
  } {
    let team1Games = 0;
    let team2Games = 0;

    for (const game of gameScores) {
      if (game.team1Points > game.team2Points) {
        team1Games++;
      } else {
        team2Games++;
      }
    }

    return {
      team1Score: team1Games,
      team2Score: team2Games,
      winner: team1Games > team2Games ? 'team1' : 'team2'
    };
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
        type: 'MATCH_RESULT_SUBMITTED',
        title: 'Match Result Submitted',
        message: `${submitter?.name} has submitted the match result. Please confirm or dispute.`,
        category: 'MATCH',
        matchId,
        userIds: otherParticipants
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
        type: 'MATCH_RESULT_CONFIRMED',
        title: 'Match Result Confirmed',
        message: `${confirmer?.name} has confirmed the match result.`,
        category: 'MATCH',
        matchId,
        userIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending result confirmed notification', {}, error as Error);
    }
  }

  /**
   * Send notification when dispute is created
   */
  private async sendDisputeCreatedNotification(matchId: string, disputerId: string, reason?: string) {
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

      const disputerName = disputer?.name || 'A player';

      // Notify other participants
      const otherParticipants = match.participants
        .filter(p => p.userId !== disputerId)
        .map(p => p.userId);

      await this.notificationService.createNotification({
        type: 'MATCH_DISPUTED',
        title: 'Match Result Disputed',
        message: `${disputerName} has disputed the match result. An admin will review.`,
        category: 'MATCH',
        matchId,
        userIds: otherParticipants
      });

      // Notify admins
      const disputeInfo: any = { disputerName, matchId };
      if (reason) disputeInfo.reason = reason;
      await notifyAdminsDispute(this.notificationService, disputeInfo);
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
        type: 'MATCH_WALKOVER',
        title: 'Walkover Reported',
        message: `${reporter?.name} has reported a walkover for this match.`,
        category: 'MATCH',
        matchId,
        userIds: participantIds
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
