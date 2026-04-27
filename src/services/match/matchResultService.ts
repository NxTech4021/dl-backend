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
import { NotificationService, notificationService as notificationServiceSingleton } from '../notificationService';
import { handlePostMatchCreation, createMatchFeedPost } from '../matchService';
import { DMRRatingService, SetScore as DMRSetScore } from '../rating/dmrRatingService';
import { SportType, GameType } from '@prisma/client';
// NOTE: updateMatchStandings removed - V2 standings handles everything now
import { notifyAdminsDispute } from '../notification/adminNotificationService';
import { notifyBatchRatingChanges } from '../notification/playerNotificationService';
import { ScoreValidationService } from './validation/scoreValidationService';
import { MatchResultCreationService } from './calculation/matchResultCreationService';
import { Best6EventHandler } from './best6/best6EventHandler';
import { StandingsV2Service } from '../rating/standingsV2Service';
import { evaluateMatchAchievementsSafe } from '../achievement/achievementEvaluationService';

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
    this.notificationService = notificationService || notificationServiceSingleton;
  }

  /**
   * Submit match result (Any Participant)
   * Either team's captain can submit the score, the OTHER team must approve/deny
   * If isUnfinished=true, match is marked UNFINISHED and score validation is skipped
   */
  // TODO(111-F-61/F-39): Call assertUserCanAct(submittedById) — suspended/inactive users
  // can currently submit league match results. See docs/issues/backlog/match-penalty-enforcement.md
  async submitResult(input: SubmitResultInput) {
    const { matchId, submittedById, setScores, gameScores, comment, evidence, isUnfinished } = input;

    // Pre-fetch match for validation (outside transaction for read performance)
    const matchPreCheck = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        scores: true,
        pickleballScores: true
      }
    });

    if (!matchPreCheck) {
      throw new Error('Match not found');
    }

    // MT-5: Friendly matches must use the friendly result endpoint which skips
    // ratings/standings processing. The league endpoint runs processMatchCompletion
    // on confirmation, which would corrupt competitive data.
    if (matchPreCheck.isFriendly) {
      throw new Error('Friendly match results must be submitted through the friendly endpoint');
    }

    // Verify submitter is a participant with ACCEPTED status
    const submitterParticipant = matchPreCheck.participants.find(
      p => p.userId === submittedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!submitterParticipant) {
      throw new Error('Submitter must be a participant in the match');
    }

    // #037 BUG 5: For doubles, all 4 players must have ACCEPTED before submitting
    if (matchPreCheck.matchType === MatchType.DOUBLES) {
      const acceptedCount = matchPreCheck.participants.filter(
        p => p.invitationStatus === InvitationStatus.ACCEPTED
      ).length;
      if (acceptedCount < 4) {
        throw new Error(
          'All 4 players must accept the match before submitting results. ' +
          `Currently ${acceptedCount} of 4 have accepted.`
        );
      }
    }

    // Validate and calculate scores based on sport (can do outside transaction)
    let team1Score: number, team2Score: number, winner: string;

    if (matchPreCheck.sport === 'PICKLEBALL') {
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
        this.validateSetScores(setScores, matchPreCheck.sport, matchPreCheck.set3Format || undefined);
      }
      const tennisResult = this.calculateFinalScore(setScores);
      team1Score = tennisResult.team1Score;
      team2Score = tennisResult.team2Score;
      winner = isUnfinished ? 'unfinished' : tennisResult.winner;
    }

    // Use transaction with status check INSIDE to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Re-fetch match with lock to prevent race conditions
      const currentMatch = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          participants: true,
          scores: true,
          pickleballScores: true
        }
      });

      if (!currentMatch) {
        throw new Error('Match not found');
      }

      // Check match status INSIDE transaction to prevent race conditions
      if (currentMatch.status === MatchStatus.COMPLETED || currentMatch.status === 'WALKOVER_PENDING') {
        throw new Error('This match has already been completed — results cannot be resubmitted');
      }

      if (currentMatch.status === MatchStatus.ONGOING) {
        throw new Error('A result has already been submitted and is awaiting confirmation from your opponent');
      }

      if (currentMatch.status === MatchStatus.CANCELLED || currentMatch.status === MatchStatus.VOID) {
        throw new Error('Results cannot be submitted for a cancelled or void match');
      }

      // SS-5: Prevent duplicate submission — defense-in-depth for READ COMMITTED race window
      // Exception: UNFINISHED matches allow re-submission (user is completing the match)
      if (currentMatch.resultSubmittedById && currentMatch.status !== MatchStatus.UNFINISHED) {
        throw new Error('A result has already been submitted for this match. Please wait for your opponent to confirm.');
      }

      if (currentMatch.sport === 'PICKLEBALL') {
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
  // TODO(111-F-61/F-39): Call assertUserCanAct(userId) — suspended/inactive users
  // can currently confirm league match results. See docs/issues/backlog/match-penalty-enforcement.md
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

    // MT-5/Gap 4: Friendly matches must use the friendly confirm endpoint.
    // The league dispute path creates requiresAdminReview which doesn't exist
    // for friendlies. The friendly dispute path resets to SCHEDULED for re-submission.
    if (match.isFriendly) {
      throw new Error('Friendly match results must be confirmed through the friendly endpoint');
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

    // #037 BUG 7: For doubles, check if a teammate already confirmed/disputed
    if (match.matchType === MatchType.DOUBLES) {
      // Check if teammate already confirmed
      if (match.resultConfirmedById) {
        const previousConfirmer = match.participants.find(
          p => p.userId === match.resultConfirmedById
        );
        if (previousConfirmer && previousConfirmer.team === userParticipant.team) {
          throw new Error(
            'Your team has already responded to this result. Only one response per team is allowed.'
          );
        }
      }

      // Check if teammate already disputed — block confirmation if active dispute exists
      const activeDispute = match.disputes?.find(
        d => d.status !== DisputeStatus.RESOLVED
      );
      if (activeDispute) {
        const disputer = match.participants.find(
          p => p.userId === activeDispute.raisedByUserId
        );
        if (disputer && disputer.team === userParticipant.team) {
          throw new Error(
            'Your teammate has already disputed this result. The dispute must be resolved first.'
          );
        }
      }
    }

    // Check match is in correct status
    if (match.status !== MatchStatus.ONGOING) {
      const statusLabels: Record<string, string> = {
        SCHEDULED: 'scheduled (no result has been submitted yet)',
        DRAFT: 'still in draft',
        COMPLETED: 'already completed',
        FINISHED: 'already finished',
        CANCELLED: 'cancelled',
        VOID: 'voided',
        UNFINISHED: 'marked as unfinished',
        WALKOVER_PENDING: 'pending a walkover decision',
      };
      const label = statusLabels[match.status] ?? `in status ${match.status}`;
      throw new Error(`There is no result to confirm — this match is ${label}`);
    }

    let feedPostId: string | null = null;

    if (confirmed) {
      // SS-3: Wrap confirm path in transaction with inner status re-check
      // Prevents double processMatchCompletion when two opponents confirm simultaneously
      await prisma.$transaction(async (tx) => {
        const freshMatch = await tx.match.findUnique({ where: { id: matchId } });
        if (!freshMatch || freshMatch.status !== MatchStatus.ONGOING) {
          throw new Error('Match is not pending confirmation');
        }

        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            resultConfirmedById: userId,
            resultConfirmedAt: new Date(),
            isAutoApproved: false
          }
        });
      });

      // Process match completion AFTER transaction commits (side effects)
      await this.processMatchCompletion(matchId);

      // NOTE: Feed post creation is now handled by user via share prompt
      // Don't auto-create feed posts to avoid "already exists" issue

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

    const matchResult = await this.getMatchWithResults(matchId);
    return { ...matchResult, feedPostId };
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

      // Step 8: Evaluate achievements for all participants (fire-and-forget)
      const participantUserIds = match.participants.map(p => p.userId).filter((id): id is string => id !== null);
      for (const playerId of participantUserIds) {
        void evaluateMatchAchievementsSafe(playerId, {
          userId: playerId,
          matchId,
          seasonId: match.seasonId ?? undefined,
          divisionId: match.divisionId ?? undefined,
          sportType: match.sport as SportType,
          gameType: match.matchType as GameType,
        });
      }

      // TODO (2026-04-22, docs/issues/backlog/notification-cron-timing-audit-round-3-2026-04-22.md M3):
      // 7 spec notifications are currently dead code — templates and service
      // functions exist but are never invoked after match completion:
      //   NOTIF-035 (Winning Streak)   ← spec marks ✅
      //   NOTIF-110 (Moved Up Standings)
      //   NOTIF-111 (Top 5)
      //   NOTIF-112 (Top 3)
      //   NOTIF-113 (League Leader #1)
      //   NOTIF-115 (DMR Increased)    ← spec marks ✅
      //   NOTIF-117 (Personal Best)    ← spec marks ✅
      // Wire them here (for league matches with a divisionId):
      //   await checkAndSendStandingsNotifications(match.divisionId, match.seasonId); // 110/111/112/113
      //   await checkAndSendWinningStreakNotification(userId); // 035 (per participant)
      //   await sendDMRIncreasedNotification(userId, sport, newRating, oldRating); // 115 + triggers 117 internally
      // See also F2 (NOTIF-111 has broken copy/type/position range before it's even called).
      // Requires: rating deltas must be captured BEFORE ratings are applied (step 6 above);
      // standings must be recalculated AFTER rating updates. Confirm ordering before implementation.
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

  // updatePartnershipStandings REMOVED — was causing triple counting.
  // V2 service handles all standings from MatchResult records correctly.
  // See docs/issues/dissections/111-singles-match-deep-stress.md §5 D-3.

  /**
   * Process match ratings using DMR (Glicko-2 based) algorithm
   * Handles both singles and doubles matches
   */
  // TODO(#104 defense-in-depth): Add a `ratingsProcessedAt DateTime?` field to the Match
  // model and check it here to prevent double rating application. Currently the upstream
  // callers (confirmResult, autoApproveResults, autoCompleteWalkovers) all have transaction
  // guards that prevent double calls. But if a new caller is added in the future without
  // a guard, DMR ratings would be applied twice (deltas are not idempotent). The fix:
  //   1. Add `ratingsProcessedAt DateTime?` to Match in schema.prisma
  //   2. At the top of this function: if match.ratingsProcessedAt is set, log and return
  //   3. At the bottom: set ratingsProcessedAt = new Date()
  // This requires a Prisma migration. See docs/issues/dissections/104-dissolution-standings-and-notification.md
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

        const result = await dmrService.processSinglesMatch({
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
      // Pickleball: best-of-3 games, walkover needs 2 wins (matching Tennis pattern)
      return {
        walkoverScore: {
          games: [
            { gameNumber: 1, winner: 15, loser: 0 },
            { gameNumber: 2, winner: 15, loser: 0 }
          ]
        },
        setsWon: 2
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

    // #037 BUG 6: Validate defaulting player is on the OPPOSING team
    const reporterParticipantCheck = match.participants.find(p => p.userId === reportedById);
    if (reporterParticipantCheck && defaultingParticipant.team === reporterParticipantCheck.team) {
      throw new Error('Cannot report a walkover for your own team member');
    }

    // MT-2: Friendly matches don't support walkovers — walkovers affect ratings/standings
    // which should never happen for friendly matches. If the opposing team doesn't show,
    // the friendly match should be cancelled, not resolved as a walkover.
    if (match.isFriendly) {
      throw new Error('Walkovers are not supported for friendly matches. Please cancel the match instead.');
    }

    // SS-4: Status check — prevent walkover on completed/cancelled/void matches
    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.ONGOING) {
      const statusLabels: Record<string, string> = {
        COMPLETED: 'already completed',
        FINISHED: 'already finished',
        CANCELLED: 'cancelled',
        VOID: 'voided',
        DRAFT: 'still in draft',
        UNFINISHED: 'marked as unfinished',
        WALKOVER_PENDING: 'pending a walkover decision',
      };
      const label = statusLabels[match.status] ?? `in status ${match.status}`;
      throw new Error(`Walkover cannot be recorded — this match is ${label}`);
    }

    // SS-4: Prevent walkover when result already submitted (conflicting state)
    if (match.resultSubmittedAt) {
      throw new Error('Cannot record walkover — a result has already been submitted for this match');
    }

    // #037 BUG 6: Determine winner from defaulting player's team (opposing team wins)
    const reporterParticipant = match.participants.find(p => p.userId === reportedById);
    const defaultingTeam = defaultingParticipant.team;
    const winningTeam = defaultingTeam === 'team1' ? 'team2' : 'team1';
    const winningUserId = reportedById; // Reporter wins the walkover

    // Get sport-specific walkover scores
    const walkoverScores = this.getWalkoverScores(match.sport);

    await prisma.$transaction(async (tx) => {
      // MT-15: Re-check match status inside transaction to prevent race with
      // concurrent score submission. Without this, a score submitted between
      // the outer read and this transaction could be overwritten by the walkover.
      const freshMatch = await tx.match.findUnique({
        where: { id: matchId },
        select: { status: true, resultSubmittedAt: true },
      });
      if (!freshMatch || freshMatch.status !== MatchStatus.SCHEDULED) {
        throw new Error('Match is no longer available for walkover');
      }
      if (freshMatch.resultSubmittedAt) {
        throw new Error('A result has already been submitted for this match');
      }

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

      // Set dispute expiry to 24h from now
      walkoverData.disputeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await tx.matchWalkover.create({
        data: walkoverData
      });

      // Update match to WALKOVER_PENDING — NOT COMPLETED
      // Match stays pending for 24h to allow opponent to dispute
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'WALKOVER_PENDING' as MatchStatus,
          isWalkover: true,
          walkoverReason: reason,
          walkoverRecordedById: reportedById,
          outcome: winningTeam, // #038: Use team format so match history counts win correctly. Reason stored in walkoverReason.
          walkoverScore: walkoverScores.walkoverScore,
          team1Score: winningTeam === 'team1' ? walkoverScores.setsWon : 0,
          team2Score: winningTeam === 'team2' ? walkoverScores.setsWon : 0
        }
      });
    });

    // Notify participants
    await this.sendWalkoverNotification(matchId, reportedById, defaultingUserId);

    // DO NOT process match completion here — deferred until 24h expiry or admin resolution

    // NOTE: Feed post creation is now handled by user via share prompt
    // Don't auto-create feed posts to avoid "already exists" issue

    logger.info(`Walkover reported and processed for match ${matchId} by user ${reportedById}`);

    const matchResult = await this.getMatchWithResults(matchId);
    return matchResult;
  }

  /**
   * Dispute a pending walkover.
   * Only the defaulting player can dispute within 24 hours.
   */
  async disputeWalkover(input: { matchId: string; disputedById: string; reason: string }) {
    const { matchId, disputedById, reason } = input;

    // Use transaction to prevent race with autoCompleteWalkovers
    return await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { walkover: true, participants: true },
      });

      if (!match) throw new Error('Match not found');
      if (match.status !== ('WALKOVER_PENDING' as MatchStatus)) {
        throw new Error('This match is not in a walkover pending state');
      }
      if (!match.walkover) throw new Error('No walkover record found');

      // Verify disputer is the defaulting player
      if (match.walkover.defaultingPlayerId !== disputedById) {
        throw new Error('Only the reported player can dispute a walkover');
      }

      // Check if already disputed
      if (match.walkover.isDisputed) {
        throw new Error('This walkover has already been disputed');
      }

      // Check 24h window
      if (match.walkover.disputeExpiresAt && new Date() > match.walkover.disputeExpiresAt) {
        throw new Error('Dispute window has expired (24 hours)');
      }

      // Mark walkover as disputed
      await tx.matchWalkover.update({
        where: { id: match.walkover.id },
        data: {
          isDisputed: true,
          disputedAt: new Date(),
          disputeReason: reason,
        },
      });

      // Create a MatchDispute record so admin can resolve through the existing dispute workflow
      // This connects walkover disputes to the same admin resolution modal as score disputes
      const existingDispute = await tx.matchDispute.findUnique({ where: { matchId } });
      if (!existingDispute) {
        // Get reporter name for context
        const reporter = await tx.user.findUnique({
          where: { id: match.walkover.reportedBy },
          select: { name: true },
        });
        const disputer = await tx.user.findUnique({
          where: { id: disputedById },
          select: { name: true },
        });

        const walkoverReason = match.walkover.walkoverReason || 'Unknown';
        const disputeComment = [
          `[WALKOVER DISPUTE]`,
          `Reported by: ${reporter?.name || 'Unknown'} — Reason: ${walkoverReason}`,
          `Disputed by: ${disputer?.name || 'Unknown'}`,
          `Dispute reason: ${reason}`,
        ].join('\n');

        await tx.matchDispute.create({
          data: {
            matchId,
            raisedByUserId: disputedById,
            disputeCategory: 'OTHER',
            disputeComment,
            status: 'OPEN',
            priority: 'HIGH',
          },
        });
      }

      // Set match to require admin review and mark as disputed
      await tx.match.update({
        where: { id: matchId },
        data: {
          requiresAdminReview: true,
          isDisputed: true,
        },
      });

      logger.info(`Walkover disputed for match ${matchId} by user ${disputedById}`);

      return { success: true, message: 'Walkover disputed successfully. An admin will review this match.' };
    });
  }

  /**
   * Auto-complete undisputed walkovers after 24h.
   * Called by the existing autoApproveResults cron job.
   */
  async autoCompleteWalkovers() {
    try {
      const now = new Date();

      const pendingWalkovers = await prisma.match.findMany({
        where: {
          status: 'WALKOVER_PENDING' as MatchStatus,
          walkover: {
            isDisputed: false,
            disputeExpiresAt: { lte: now },
          },
        },
        include: { walkover: true },
      });

      let completedCount = 0;

      for (const match of pendingWalkovers) {
        try {
          // Use transaction to re-check isDisputed before completing (race guard)
          const completed = await prisma.$transaction(async (tx) => {
            // Re-check both match status and walkover dispute state
            const freshMatch = await tx.match.findUnique({
              where: { id: match.id },
              select: { status: true },
            });
            if (freshMatch?.status !== ('WALKOVER_PENDING' as MatchStatus)) return false;

            const freshWalkover = await tx.matchWalkover.findUnique({
              where: { matchId: match.id },
            });
            if (!freshWalkover || freshWalkover.isDisputed) return false;

            await tx.match.update({
              where: { id: match.id },
              data: { status: MatchStatus.COMPLETED },
            });
            return true;
          });

          if (completed) {
            await this.processMatchCompletion(match.id);
            completedCount++;
            logger.info(`Auto-completed walkover for match ${match.id} (24h dispute window expired)`);
          } else {
            logger.info(`Skipped auto-complete for match ${match.id} (disputed during processing)`);
          }
        } catch (error) {
          logger.error(`Failed to auto-complete walkover for match ${match.id}:`, {}, error as Error);
        }
      }

      return { walkoversChecked: pendingWalkovers.length, walkoversCompleted: completedCount };
    } catch (error) {
      logger.error('Error in autoCompleteWalkovers:', {}, error as Error);
      return { walkoversChecked: 0, walkoversCompleted: 0 };
    }
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

      const submitter = await prisma.user.findUnique({
        where: { id: submitterId },
        select: { name: true }
      });

      const otherParticipants = match.participants
        .filter(p => p.userId !== submitterId)
        .map(p => p.userId)
        .filter((id): id is string => id !== null);

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

      const participantIds = match.participants
        .map(p => p.userId)
        .filter((id): id is string => id !== null);

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
        .map(p => p.userId)
        .filter((id): id is string => id !== null);

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

      const participantIds = match.participants
        .map(p => p.userId)
        .filter((id): id is string => id !== null);

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

      const participantIds = match.participants
        .map(p => p.userId)
        .filter((id): id is string => id !== null);

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
      // Note: When a result is submitted, match status is set to ONGOING (awaiting confirmation)
      // Only after confirmation does it become COMPLETED
      const matches = await prisma.match.findMany({
        where: {
          status: MatchStatus.ONGOING,
          isFriendly: false,  // MT-32: friendly matches must NOT be auto-approved with ratings/standings
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
          // Race guard: use transaction to re-check status before completing.
          // Without this, a user confirming via confirmResult() at the same moment
          // the cron processes the match would cause both paths to apply DMR rating
          // deltas — doubling the rating change. This matches the pattern used by
          // autoCompleteWalkovers() above. See docs/issues/dissections/101-score-submission-races.md
          const approved = await prisma.$transaction(async (tx) => {
            const freshMatch = await tx.match.findUnique({
              where: { id: match.id },
              select: { status: true, isDisputed: true },
            });
            // F-2: Also re-check isDisputed inside tx — a dispute created between the outer
            // findMany (which filters isDisputed:false) and this tx would otherwise be ignored,
            // allowing the cron to auto-approve a match the user just disputed.
            if (freshMatch?.status !== MatchStatus.ONGOING || freshMatch.isDisputed) return false;

            await tx.match.update({
              where: { id: match.id },
              data: {
                status: MatchStatus.COMPLETED,
                isAutoApproved: true,
                resultConfirmedAt: new Date()
              }
            });
            return true;
          });

          if (!approved) {
            logger.info(`Skipped auto-approve for match ${match.id} (already confirmed or disputed)`);
            continue;
          }

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

          // NOTE: V2 standings already recalculated above (line 1248) - removed duplicate call

          // Evaluate achievements for all participants (fire-and-forget)
          const participantUserIds = match.participants.map(p => p.userId).filter((id): id is string => id !== null);
          for (const playerId of participantUserIds) {
            void evaluateMatchAchievementsSafe(playerId, {
              userId: playerId,
              matchId: match.id,
              seasonId: match.seasonId ?? undefined,
              divisionId: match.divisionId ?? undefined,
              sportType: match.sport as SportType,
              gameType: match.matchType as GameType,
            });
          }

          // TODO (2026-04-21, docs/issues/backlog/notification-cron-timing-audit-round-2-2026-04-21.md M2):
          // NOTIF-100 spec wording is:
          //   title:   "Result Confirmed Automatically"
          //   message: "Looks like [Opponent Name] missed the confirmation window. The submitted result has been auto-confirmed."
          // A ready-to-use template exists at matchManagementNotifications.scoreAutoConfirmed()
          // but is never called. Current send uses custom type/text and
          // broadcasts to ALL participants; per spec it should go to the
          // non-confirmer (opponent of the submitter) with the opponent's name
          // interpolated. Fix: identify submitter/non-confirmer, call
          // matchManagementNotifications.scoreAutoConfirmed(submitterName),
          // send to non-confirmer only.
          // Notify all participants
          const participantIds = match.participants.map(p => p.userId).filter((id): id is string => id !== null);
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
   * Auto-approve friendly match results after 24h.
   * Unlike league matches, friendly matches do NOT affect ratings, standings, or Best 6.
   * This simply marks the match as COMPLETED and notifies participants.
   * Separated from autoApproveResults to prevent friendly results leaking into
   * the competitive system (MT-32 fix).
   */
  async autoApproveFriendlyResults() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const matches = await prisma.match.findMany({
        where: {
          status: MatchStatus.ONGOING,
          isFriendly: true,
          resultSubmittedAt: { lte: twentyFourHoursAgo },
          resultConfirmedAt: null,
          isAutoApproved: false,
        },
        select: { id: true, participants: { select: { userId: true } } },
      });

      let count = 0;
      for (const match of matches) {
        try {
          const approved = await prisma.$transaction(async (tx) => {
            const fresh = await tx.match.findUnique({
              where: { id: match.id },
              select: { status: true },
            });
            if (fresh?.status !== MatchStatus.ONGOING) return false;

            await tx.match.update({
              where: { id: match.id },
              data: {
                status: MatchStatus.COMPLETED,
                isAutoApproved: true,
                resultConfirmedAt: new Date(),
              },
            });
            return true;
          });

          if (approved) {
            const participantIds = match.participants
              .map(p => p.userId)
              .filter((id): id is string => id !== null);

            await this.notificationService.createNotification({
              type: 'MATCH_RESULT_AUTO_APPROVED',
              title: 'Match Result Auto-Approved',
              message: 'The friendly match result has been automatically approved after 24 hours.',
              category: 'MATCH',
              matchId: match.id,
              userIds: participantIds,
            });
            count++;
          }
        } catch (error) {
          logger.error(`Failed to auto-approve friendly match ${match.id}:`, {}, error as Error);
        }
      }

      return { matchesChecked: matches.length, autoApprovedCount: count };
    } catch (error) {
      logger.error('Error in autoApproveFriendlyResults:', {}, error as Error);
      return { matchesChecked: 0, autoApprovedCount: 0 };
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
