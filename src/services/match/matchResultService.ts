/**
 * Match Result Service
 * Handles result submission, confirmation, and dispute handling
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  MatchType,
  WalkoverReason,
  DisputeCategory,
  DisputeStatus,
  InvitationStatus
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';
import { handlePostMatchCreation } from '../matchService';
import { DMRRatingService, SetScore as DMRSetScore } from '../rating/dmrRatingService';
import { SportType, GameType } from '@prisma/client';
// NOTE: updateMatchStandings removed - V2 standings handles everything now
import { notifyAdminsDispute } from '../notification/adminNotificationService';
import { notifyBatchRatingChanges } from '../notification/playerNotificationService';
import {
  sendOpponentSubmittedScoreNotification,
  sendScoreDisputeAlert,
  checkAndSendWinningStreakNotification,
} from '../notification/matchNotificationService';
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
  evidence?: string;
  isUnfinished?: boolean;        // Mark match as unfinished (bypasses validation)
}

export interface SetScore {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  team1Tiebreak?: number;
  team2Tiebreak?: number;
  tiebreakType?: 'STANDARD_7PT' | 'MATCH_10PT';
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
   * Submit match result (Any Participant)
   * Either team's captain can submit the score, the OTHER team must approve/deny
   * If isUnfinished=true, match is marked UNFINISHED and score validation is skipped
   */
  async submitResult(input: SubmitResultInput) {
    const { matchId, submittedById, setScores, gameScores, comment, evidence, isUnfinished } = input;

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

    // Verify submitter is a participant with ACCEPTED status
    const submitterParticipant = match.participants.find(
      p => p.userId === submittedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!submitterParticipant) {
      throw new Error('Submitter must be a participant in the match');
    }

    // Check match status
    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Match has already been completed');
    }

    if (match.status === MatchStatus.ONGOING) {
      throw new Error('Match result is pending opponent confirmation');
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
      // Skip validation for unfinished matches
      if (!isUnfinished) {
        this.validatePickleballScores(gameScores);
      }
      const pickleballResult = this.calculatePickleballFinalScore(gameScores);
      team1Score = pickleballResult.team1Score;
      team2Score = pickleballResult.team2Score;
      winner = isUnfinished ? 'unfinished' : pickleballResult.winner;
    } else {
      // Tennis/Padel validation and calculation
      if (!setScores || !Array.isArray(setScores) || setScores.length === 0) {
        throw new Error('setScores array is required for Tennis/Padel matches');
      }
      // Skip validation for unfinished matches
      if (!isUnfinished) {
        this.validateSetScores(setScores, match.sport, match.set3Format || undefined);
      }
      const tennisResult = this.calculateFinalScore(setScores);
      team1Score = tennisResult.team1Score;
      team2Score = tennisResult.team2Score;
      winner = isUnfinished ? 'unfinished' : tennisResult.winner;
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

        // Update match - Set to ONGOING (awaiting opponent approval) or UNFINISHED
        const matchUpdateData: any = {
          status: isUnfinished ? MatchStatus.UNFINISHED : MatchStatus.ONGOING,
          team1Score,
          team2Score,
          setScores: JSON.stringify(gameScores),
          outcome: winner,
          resultSubmittedById: submittedById,
          resultSubmittedAt: new Date(),
          requiresAdminReview: false
        };
        if (comment) {
          await tx.matchComment.create({
            data: {
              matchId,
              userId: submittedById,
              comment,
            }
          });
        }
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
          // Add tiebreakType if provided (for Set 3 match tiebreaks)
          if (score.tiebreakType) {
            scoreData.tiebreakType = score.tiebreakType;
          }

          await tx.matchScore.create({ data: scoreData });
        }

        // Update match - Set to ONGOING (awaiting opponent approval) or UNFINISHED
        const matchUpdateData: any = {
          status: isUnfinished ? MatchStatus.UNFINISHED : MatchStatus.ONGOING,
          team1Score,
          team2Score,
          setScores: JSON.stringify(setScores),
          outcome: winner,
          resultSubmittedById: submittedById,
          resultSubmittedAt: new Date(),
          requiresAdminReview: false
        };
        if (comment) {
          await tx.matchComment.create({
            data: {
              matchId,
              userId: submittedById,
              comment,
            }
          });
        }
        if (evidence) matchUpdateData.resultEvidence = evidence;

        await tx.match.update({
          where: { id: matchId },
          data: matchUpdateData
        });
      }
    });

    // Notify participants based on whether match is complete or unfinished
    if (isUnfinished) {
      // For unfinished matches, notify all participants that the match was marked incomplete
      await this.sendMatchUnfinishedNotification(matchId, submittedById);
      logger.info(`Match ${matchId} marked as UNFINISHED by ${submittedById}`);
    } else {
      // Notify opponent participants to confirm/deny the submitted result
      await this.sendResultSubmittedNotification(matchId, submittedById);
      logger.info(`Result submitted for match ${matchId} by creator ${submittedById}, awaiting opponent confirmation`);
    }

    return this.getMatchWithResults(matchId);
  }

  /**
   * Confirm or dispute match result (Opposing Team Only)
   * - The team that DIDN'T submit must confirm/dispute
   * - Opponent confirms: Match completed, standings updated
   * - Opponent denies: Dispute created, sent to division admin
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
    const userParticipant = match.participants.find(
      p => p.userId === userId && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!userParticipant) {
      throw new Error('Only match participants can confirm results');
    }

    // Check that result has been submitted
    if (!match.resultSubmittedAt) {
      throw new Error('No result has been submitted for this match');
    }

    // Get the submitter's team to ensure confirmer is from opposing team
    const submitterParticipant = match.participants.find(
      p => p.userId === match.resultSubmittedById
    );

    // CRITICAL: User must be from the OPPOSING team (not the team that submitted)
    if (submitterParticipant && userParticipant.team === submitterParticipant.team) {
      throw new Error('Only the opposing team can confirm or dispute the submitted result');
    }

    // Also check: the person who submitted cannot confirm their own submission
    if (match.resultSubmittedById === userId) {
      throw new Error('You cannot confirm your own submission. The opposing team must approve or deny.');
    }

    // Check match is in correct status
    if (match.status !== MatchStatus.ONGOING) {
      throw new Error(`Match is not pending confirmation (current status: ${match.status})`);
    }

    if (confirmed) {
      // Opponent APPROVED - Complete the match and update standings
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          resultConfirmedById: userId,
          resultConfirmedAt: new Date(),
          isAutoApproved: false
        }
      });

      // Process match completion: update standings for ALL participants (including partnerships)
      await this.processMatchCompletion(matchId);

      // Notify all participants of completion
      await this.sendResultConfirmedNotification(matchId, userId);

      logger.info(`Match ${matchId} confirmed and completed by opponent ${userId}`);
    } else {
      // Opponent DENIED - Create dispute and notify division admin
      if (!disputeReason || !disputeCategory) {
        throw new Error('Dispute reason and category are required when denying result');
      }

      // Check if dispute already exists
      if (match.disputes.length > 0 && match.disputes.some(d => d.status !== DisputeStatus.RESOLVED)) {
        throw new Error('A dispute already exists for this match');
      }

      await prisma.$transaction(async (tx) => {
        // Create dispute with HIGH priority (score disputes are critical)
        const disputeData: any = {
          matchId,
          raisedByUserId: userId,
          disputeCategory,
          disputeComment: disputeReason,
          status: DisputeStatus.OPEN,
          priority: 'HIGH'
        };
        if (disputerScore) disputeData.disputerScore = JSON.stringify(disputerScore);
        if (evidenceUrl) disputeData.evidenceUrl = evidenceUrl;

        await tx.matchDispute.create({
          data: disputeData
        });

        // Mark match as disputed and under admin review
        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.ONGOING,
            isDisputed: true,
            requiresAdminReview: true
          }
        });
      });

      // Notify division admin and match creator of dispute
      await this.sendDisputeCreatedNotification(matchId, userId, disputeReason);

      logger.info(`Opponent denied result for match ${matchId}, dispute created for division admin review`);
    }

    return this.getMatchWithResults(matchId);
  }

  /**
   * Process match completion - Update standings for ALL participants including partnerships
   * CRITICAL: For doubles matches, BOTH partners on each team get their standings updated
   */
  private async processMatchCompletion(matchId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: {
            include: { user: true }
          },
          scores: true,
          pickleballScores: true,
          division: true
        }
      });

      if (!match || !match.divisionId) {
        logger.error(`Cannot process completion - match ${matchId} not found or has no division`);
        return;
      }

      // Step 1: Create MatchResult records for all participants
      try {
        const matchResultService = new MatchResultCreationService();
        await matchResultService.createMatchResults(matchId);
        logger.info(`Created MatchResult records for match ${matchId}`);
      } catch (error) {
        logger.error(`CRITICAL: Failed to create MatchResult records for match ${matchId}`, {}, error as Error);
        await prisma.match.update({
          where: { id: matchId },
          data: { requiresAdminReview: true }
        });
        throw error; // This is critical, must succeed
      }

      // Step 2: Update Best 6 System
      try {
        const best6Handler = new Best6EventHandler();
        await best6Handler.onMatchCompleted(matchId);
        logger.info(`Updated Best 6 for match ${matchId}`);
      } catch (error) {
        logger.error(`Failed to update Best 6 for match ${matchId}`, {}, error as Error);
      }

      // Step 3: Update Division Standings (V2 - Best 6 Compliant)
      if (match.divisionId && match.seasonId) {
        try {
          const standingsV2 = new StandingsV2Service();
          await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
          logger.info(`Updated V2 standings for division ${match.divisionId}`);
        } catch (error) {
          logger.error(`Failed to update V2 standings`, {}, error as Error);
        }

        // NOTE: Legacy standings (updateMatchStandings) REMOVED
        // V2 standings now handles all standings updates correctly by recalculating from MatchResult records
        // The legacy approach was causing double/triple counting because it increments instead of recalculates
      }

      // Step 5: For DOUBLES matches - Partnership standings are now handled by V2
      // NOTE: updatePartnershipStandings REMOVED - it was causing triple counting
      // V2 service already counts all participants correctly from MatchResult records
      if (match.matchType === MatchType.DOUBLES) {
        logger.info(`Doubles match ${matchId} - standings handled by V2 service`);
      }

      // Step 6: Update Ratings (DMR - Glicko-2 based)
      try {
        await this.processMatchRatings(match);
        logger.info(`Applied DMR rating updates for match ${matchId}`);
      } catch (error) {
        logger.error(`Failed to update DMR ratings for match ${matchId}`, {}, error as Error);
      }

      // Step 7: Trigger post-match actions (reactivation, etc.)
      try {
        await handlePostMatchCreation(matchId);
      } catch (error) {
        logger.error(`Failed post-match actions for match ${matchId}`, {}, error as Error);
      }

      // Step 8: Check for winning streaks and send notifications
      try {
        const winnerIds = ratingUpdates ? [ratingUpdates.winner.userId] : [];
        for (const winnerId of winnerIds) {
          await checkAndSendWinningStreakNotification(winnerId, matchId);
        }
      } catch (error) {
        logger.error(`Failed to check winning streaks for match ${matchId}`, {}, error as Error);
      }

      logger.info(`Match ${matchId} processing completed successfully`);

    } catch (error) {
      logger.error(`Failed to process match completion for ${matchId}`, {}, error as Error);
      await prisma.match.update({
        where: { id: matchId },
        data: { requiresAdminReview: true }
      });
      throw error;
    }
  }

  /**
   * Update standings for partnerships in doubles matches
   * CRITICAL: Both partners on winning team AND both partners on losing team get standings updated
   */
  private async updatePartnershipStandings(matchId: string, match: any) {
    try {
      if (!match.divisionId) return;

      // Get participants by team
      const team1Participants = match.participants.filter((p: any) => p.team === 'team1');
      const team2Participants = match.participants.filter((p: any) => p.team === 'team2');

      // Calculate sets and games won by each team
      let team1SetsWon = 0, team2SetsWon = 0;
      let team1GamesWon = 0, team2GamesWon = 0;

      if (match.sport === 'PICKLEBALL') {
        for (const game of match.pickleballScores) {
          if (game.player1Points > game.player2Points) {
            team1SetsWon++;
            team1GamesWon += game.player1Points;
            team2GamesWon += game.player2Points;
          } else {
            team2SetsWon++;
            team1GamesWon += game.player1Points;
            team2GamesWon += game.player2Points;
          }
        }
      } else {
        // Tennis/Padel
        for (const set of match.scores) {
          if (set.player1Games > set.player2Games) {
            team1SetsWon++;
          } else {
            team2SetsWon++;
          }
          team1GamesWon += set.player1Games;
          team2GamesWon += set.player2Games;
        }
      }

      const team1Won = match.outcome === 'team1';

      // Import standings update function
      const { updatePlayerStanding } = await import('../rating/standingsCalculationService');

      // Update BOTH partners on team1
      for (const participant of team1Participants) {
        // Each partner's standing is updated against each opponent
        const opponentIds = team2Participants.map((p: any) => p.userId);
        for (const opponentId of opponentIds) {
          try {
            await updatePlayerStanding(participant.userId, match.divisionId, {
              odlayerId: participant.userId,
              odversaryId: opponentId,
              userWon: team1Won,
              userSetsWon: team1SetsWon,
              userSetsLost: team2SetsWon,
              userGamesWon: team1GamesWon,
              userGamesLost: team2GamesWon
            });
          } catch (error) {
            logger.error(`Failed to update standings for player ${participant.userId}`, {}, error as Error);
          }
        }
      }

      // Update BOTH partners on team2
      for (const participant of team2Participants) {
        const opponentIds = team1Participants.map((p: any) => p.userId);
        for (const opponentId of opponentIds) {
          try {
            await updatePlayerStanding(participant.userId, match.divisionId, {
              odlayerId: participant.userId,
              odversaryId: opponentId,
              userWon: !team1Won,
              userSetsWon: team2SetsWon,
              userSetsLost: team1SetsWon,
              userGamesWon: team2GamesWon,
              userGamesLost: team1GamesWon
            });
          } catch (error) {
            logger.error(`Failed to update standings for player ${participant.userId}`, {}, error as Error);
          }
        }
      }

      logger.info(`Updated partnership standings for all ${team1Participants.length + team2Participants.length} participants in match ${matchId}`);

    } catch (error) {
      logger.error(`Failed to update partnership standings for match ${matchId}`, {}, error as Error);
    }
  }

  /**
   * Process match ratings using DMR (Glicko-2 based) algorithm
   * Handles both singles and doubles matches
   */
  private async processMatchRatings(match: any): Promise<void> {
    try {
      if (!match.seasonId) {
        logger.warn(`Match ${match.id} has no seasonId, skipping rating update`);
        return;
      }

      // Determine sport type
      const sportType = match.sport === 'PICKLEBALL' ? SportType.PICKLEBALL :
                        match.sport === 'TENNIS' ? SportType.TENNIS : SportType.PADEL;

      // Create DMR service instance for this sport
      const dmrService = new DMRRatingService(sportType);

      // Convert scores to DMR format
      let setScores: DMRSetScore[] = [];

      if (match.sport === 'PICKLEBALL') {
        // Pickleball uses pickleballScores or parsed setScores
        const scores = match.pickleballScores?.length > 0
          ? match.pickleballScores
          : (match.setScores ? JSON.parse(match.setScores) : []);

        setScores = scores.map((s: any) => ({
          score1: s.player1Points ?? s.team1Points,
          score2: s.player2Points ?? s.team2Points,
        }));
      } else {
        // Tennis/Padel uses matchScores
        const scores = match.scores?.length > 0
          ? match.scores
          : (match.setScores ? JSON.parse(match.setScores) : []);

        setScores = scores.map((s: any) => ({
          score1: s.player1Games ?? s.team1Games,
          score2: s.player2Games ?? s.team2Games,
        }));
      }

      if (setScores.length === 0) {
        logger.warn(`Match ${match.id} has no scores, skipping rating update`);
        return;
      }

      // Get participants by team
      const team1Participants = match.participants.filter((p: any) => p.team === 'team1');
      const team2Participants = match.participants.filter((p: any) => p.team === 'team2');

      // Determine winner based on outcome
      const team1Won = match.outcome === 'team1' || match.outcome === 'team1_win';

      if (match.matchType === MatchType.DOUBLES) {
        // Doubles match - need both players from each team
        if (team1Participants.length < 2 || team2Participants.length < 2) {
          logger.warn(`Doubles match ${match.id} doesn't have enough participants on each team`);
          return;
        }

        const team1Ids: [string, string] = [team1Participants[0].userId, team1Participants[1].userId];
        const team2Ids: [string, string] = [team2Participants[0].userId, team2Participants[1].userId];

        // Adjust scores based on winner
        const adjustedScores = team1Won ? setScores : setScores.map(s => ({
          score1: s.score2,
          score2: s.score1,
        }));

        const result = await dmrService.processDoublesMatch({
          team1Ids: team1Won ? team1Ids : team2Ids,
          team2Ids: team1Won ? team2Ids : team1Ids,
          setScores: adjustedScores,
          seasonId: match.seasonId,
          matchId: match.id,
          isWalkover: match.isWalkover ?? false,
        });

        // Notify participants of rating changes
        const ratingChanges = Object.entries(result.ratingChanges).map(([userId, update]) => ({
          userId,
          oldRating: update.oldRating,
          newRating: update.newRating,
          matchId: match.id,
        }));
        await notifyBatchRatingChanges(this.notificationService, ratingChanges);

        logger.info(`DMR doubles ratings updated for match ${match.id}`, {
          winnerIds: result.winnerIds,
          loserIds: result.loserIds,
          scoreFactor: result.scoreFactor,
        });

      } else {
        // Singles match
        if (team1Participants.length === 0 || team2Participants.length === 0) {
          logger.warn(`Singles match ${match.id} doesn't have participants on each team`);
          return;
        }

        const winnerId = team1Won ? team1Participants[0].userId : team2Participants[0].userId;
        const loserId = team1Won ? team2Participants[0].userId : team1Participants[0].userId;

        // Adjust scores so winner's score is always score1
        const adjustedScores = team1Won ? setScores : setScores.map(s => ({
          score1: s.score2,
          score2: s.score1,
        }));

        const result = await dmrService.processsinglesMatch({
          winnerId,
          loserId,
          setScores: adjustedScores,
          seasonId: match.seasonId,
          matchId: match.id,
          isWalkover: match.isWalkover ?? false,
        });

        // Notify participants of rating changes
        const ratingChanges = [
          { userId: winnerId, oldRating: result.winner.oldRating, newRating: result.winner.newRating, matchId: match.id },
          { userId: loserId, oldRating: result.loser.oldRating, newRating: result.loser.newRating, matchId: match.id },
        ];
        await notifyBatchRatingChanges(this.notificationService, ratingChanges);

        logger.info(`DMR singles ratings updated for match ${match.id}`, {
          winnerId,
          loserId,
          winnerDelta: result.winner.delta,
          loserDelta: result.loser.delta,
          scoreFactor: result.scoreFactor,
        });
      }

    } catch (error) {
      logger.error(`DMR rating update failed for match ${match.id}`, {}, error as Error);
      throw error;
    }
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
        },
        comments: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
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

      const otherParticipants = match.participants
        .filter(p => p.userId !== submitterId)
        .map(p => p.userId);

      // Send notification to each opponent
      for (const opponentId of otherParticipants) {
        await sendOpponentSubmittedScoreNotification(matchId, submitterId, opponentId);
      }
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
          participants: {
            select: { userId: true, user: { select: { name: true } } }
          }
        }
      });

      if (!match) return;

      // Get player names
      const player1 = match.participants[0];
      const player2 = match.participants[1];
      if (!player1 || !player2) return;

      // Send score dispute alert to both participants
      await sendScoreDisputeAlert(matchId, player1.userId, player2.userId);

      // Notify admins
      const disputer = await prisma.user.findUnique({
        where: { id: disputerId },
        select: { name: true }
      });
      const disputeInfo: any = { disputerName: disputer?.name || 'A player', matchId };
      if (reason) disputeInfo.reason = reason;
      await notifyAdminsDispute(this.notificationService, disputeInfo);
    } catch (error) {
      logger.error('Error sending dispute created notification', {}, error as Error);
    }
  }

  /**
   * Send notification when match is marked as unfinished
   */
  private async sendMatchUnfinishedNotification(matchId: string, submitterId: string) {
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

      const participantIds = match.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        type: 'MATCH_UNFINISHED',
        title: 'Match Marked Incomplete',
        message: `${submitter?.name} has marked the match as incomplete. Partial scores have been recorded.`,
        category: 'MATCH',
        matchId,
        userIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending match unfinished notification', {}, error as Error);
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

  /**
   * Auto-approve results submitted more than 24 hours ago
   * Called by cron job
   */
  async autoApproveResults() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find matches with submitted results that haven't been confirmed/disputed after 24 hours
      const matches = await prisma.match.findMany({
        where: {
          status: MatchStatus.COMPLETED,
          resultSubmittedAt: { lte: twentyFourHoursAgo },
          resultConfirmedAt: null,
          isDisputed: false,
          isAutoApproved: false
        },
        include: {
          participants: true,
          division: true,
          season: true,
          scores: true,
          pickleballScores: true
        }
      });

      let autoApprovedCount = 0;

      for (const match of matches) {
        try {
          // Auto-approve the match
          await prisma.match.update({
            where: { id: match.id },
            data: {
              isAutoApproved: true,
              resultConfirmedAt: new Date()
            }
          });

          // Process ratings and standings (same as manual confirmation)
          try {
            // Best 6 system integration
            const matchResultService = new MatchResultCreationService();
            await matchResultService.createMatchResults(match.id);
            logger.info(`Auto-approved: Created MatchResult records for match ${match.id}`);

            const best6Handler = new Best6EventHandler();
            await best6Handler.onMatchCompleted(match.id);
            logger.info(`Auto-approved: Recalculated Best 6 for match ${match.id}`);

            if (match.divisionId && match.seasonId) {
              const standingsV2 = new StandingsV2Service();
              await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
              logger.info(`Auto-approved: Recalculated standings for division ${match.divisionId}`);
            }
          } catch (error) {
            logger.error(`Failed to process Best 6 for auto-approved match ${match.id}:`, {}, error as Error);
            await prisma.match.update({
              where: { id: match.id },
              data: { requiresAdminReview: true }
            });
          }

          // Update ratings using DMR (Glicko-2)
          try {
            await this.processMatchRatings(match);
            logger.info(`Auto-approved: Applied DMR rating updates for match ${match.id}`);
          } catch (error) {
            logger.error(`Failed to update DMR ratings for auto-approved match ${match.id}:`, {}, error as Error);
          }

          // Update V2 standings (replaces old updateMatchStandings)
          if (match.divisionId && match.seasonId) {
            try {
              const standingsV2 = new StandingsV2Service();
              await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
              logger.info(`Auto-approved: Updated V2 standings for match ${match.id}`);
            } catch (error) {
              logger.error(`Failed to update V2 standings for auto-approved match ${match.id}:`, {}, error as Error);
            }
          }

          // Notify all participants
          const participantIds = match.participants.map(p => p.userId);
          await this.notificationService.createNotification({
            type: 'MATCH_RESULT_AUTO_APPROVED',
            title: 'Match Result Auto-Approved',
            message: 'The match result has been automatically approved after 24 hours.',
            category: 'MATCH',
            matchId: match.id,
            userIds: participantIds
          });

          autoApprovedCount++;
          logger.info(`Auto-approved match ${match.id} after 24 hours`);
        } catch (error) {
          logger.error(`Failed to auto-approve match ${match.id}:`, {}, error as Error);
        }
      }

      return {
        matchesChecked: matches.length,
        autoApprovedCount
      };
    } catch (error) {
      logger.error('Error in autoApproveResults:', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get dispute by ID with full details
   */
  async getDisputeById(disputeId: string) {
    const dispute = await prisma.matchDispute.findUnique({
      where: { id: disputeId },
      include: {
        match: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, image: true }
                }
              }
            },
            division: { select: { id: true, name: true } },
            resultSubmittedBy: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        raisedByUser: {
          select: { id: true, name: true, username: true, image: true }
        },
        comments: {
          include: {
            sender: {
              select: { id: true, name: true, username: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    return dispute;
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
