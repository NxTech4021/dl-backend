/**
 * Match Result Controller
 * Handles HTTP requests for match result submission and confirmation
 */

import { Request, Response } from 'express';
import { getMatchResultService } from '../../services/match/matchResultService';
import { DisputeCategory, WalkoverReason } from '@prisma/client';
import { notificationService } from '../../services/notificationService';
import { matchManagementNotifications } from '../../helpers/notifications/matchManagementNotifications';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { logMatchActivity } from '../../services/userActivityLogService';
import { UserActionType } from '@prisma/client';

const matchResultService = getMatchResultService();

/**
 * Helper function to get opponent name from match
 */
const getOpponentName = async (matchId: string, currentUserId: string): Promise<string> => {
  const participants = await prisma.matchParticipant.findMany({
    where: { 
      matchId,
      userId: { not: currentUserId }
    },
    include: {
      user: {
        select: { name: true }
      }
    },
  });
  return participants[0]?.user.name || 'Opponent';
};

/**
 * Helper function to get other participant user IDs
 */
const getOtherParticipants = async (matchId: string, excludeUserId: string): Promise<string[]> => {
  const participants = await prisma.matchParticipant.findMany({
    where: { 
      matchId,
      userId: { not: excludeUserId }
    },
    select: { userId: true },
  });
  return participants.map(p => p.userId);
};

/**
 * Submit match result
 * POST /api/matches/:id/result
 */
export const submitResult = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { setScores, gameScores, comment, evidence, isUnfinished } = req.body;

    // Validate that at least one score type is provided
    if ((!setScores || !Array.isArray(setScores) || setScores.length === 0) &&
        (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0)) {
      return sendError(res, 'Either setScores (Tennis/Padel) or gameScores (Pickleball) array is required', 400);
    }

    const match = await matchResultService.submitResult({
      matchId: id,
      submittedById: userId,
      setScores,
      gameScores,
      comment,
      evidence,
      isUnfinished: isUnfinished === true
    });

    if (!match) {
      return sendError(res, 'Failed to submit result');
    }

    // Notify other participants about score submission
    try {
      const submitterName = req.user?.name || 'Opponent';
      const otherParticipants = await getOtherParticipants(id, userId);

      if (otherParticipants.length > 0) {
        const notification = matchManagementNotifications.opponentSubmittedScore(
          submitterName
        );

        await notificationService.createNotification({
          ...notification,
          userIds: otherParticipants,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send result submission notification:', notifError);
      // Don't fail the request if notification fails
    }

    void logMatchActivity(userId, UserActionType.SCORE_SUBMIT, id, {}, req.ip);

    sendSuccess(res, match);
  } catch (error) {
    console.error('Submit Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit result';
    sendError(res, message, 400);
  }
};

/**
 * Confirm or dispute match result
 * POST /api/matches/:id/confirm
 */
export const confirmResult = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { confirmed, disputeReason, disputeCategory, disputerScore, evidenceUrl } = req.body;

    if (typeof confirmed !== 'boolean') {
      return sendError(res, 'confirmed (boolean) is required', 400);
    }

    if (!confirmed && !disputeReason) {
      return sendError(res, 'disputeReason is required when not confirming', 400);
    }

    const match = await matchResultService.confirmResult({
      matchId: id,
      userId,
      confirmed,
      disputeReason,
      disputeCategory: disputeCategory as DisputeCategory,
      disputerScore,
      evidenceUrl
    });

    if (!match) {
      return sendError(res, 'Failed to confirm result');
    }

    // Send notification based on confirmation status
    try {
      const confirmerName = req.user?.name || 'Opponent';
      const otherParticipants = await getOtherParticipants(id, userId);

      if (otherParticipants.length > 0) {
        if (confirmed) {
          // Score confirmed
          let scoreDisplay = 'Final';
          if (match.team1Score !== null && match.team2Score !== null) {
            scoreDisplay = `${match.team1Score}-${match.team2Score}`;
          }

          const notification = matchManagementNotifications.scoreAutoConfirmed(
            confirmerName,
            scoreDisplay
          );
          
          await notificationService.createNotification({
            ...notification,
            userIds: otherParticipants,
            matchId: match.id,
          });
        } else {
          // Score disputed
          const notification = matchManagementNotifications.scoreDisputeAlert(
            confirmerName
          );
          
          await notificationService.createNotification({
            ...notification,
            userIds: otherParticipants,
            matchId: match.id,
          });
        }
      }
    } catch (notifError) {
      console.error('Failed to send confirmation notification:', notifError);
      // Don't fail the request if notification fails
    }

    void logMatchActivity(userId, confirmed ? UserActionType.SCORE_CONFIRM : UserActionType.SCORE_DISPUTE, id, {}, req.ip);

    sendSuccess(res, match);
  } catch (error) {
    console.error('Confirm Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm result';
    sendError(res, message, 400);
  }
};

/**
 * Submit walkover
 * POST /api/matches/:id/walkover
 */
export const submitWalkover = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { defaultingUserId, reason, reasonDetail } = req.body;

    if (!defaultingUserId) {
      return sendError(res, 'defaultingUserId is required', 400);
    }

    if (!reason || !['NO_SHOW', 'LATE_CANCELLATION', 'INJURY', 'PERSONAL_EMERGENCY', 'OTHER'].includes(reason)) {
      return sendError(res, 'Valid reason is required', 400);
    }

    const match = await matchResultService.submitWalkover({
      matchId: id,
      reportedById: userId,
      defaultingUserId,
      reason: reason as WalkoverReason,
      reasonDetail
    });

    if (!match) {
      return sendError(res, 'Failed to submit walkover');
    }

    // Send walkover notifications to participants
    try {
      const reporter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      const defaulter = await prisma.user.findUnique({
        where: { id: defaultingUserId },
        select: { name: true }
      });

      // Notify the defaulting player about the walkover loss
      const walkoverLostNotif = matchManagementNotifications.matchWalkoverLost(
        reporter?.name || 'Opponent'
      );
      
      await notificationService.createNotification({
        ...walkoverLostNotif,
        userIds: defaultingUserId,
        matchId: match.id,
      });

      // Notify the reporting player about the walkover win (if they're not the same person)
      if (userId !== defaultingUserId) {
        const walkoverWonNotif = matchManagementNotifications.matchWalkoverWon(
          defaulter?.name || 'Opponent'
        );
        
        await notificationService.createNotification({
          ...walkoverWonNotif,
          userIds: userId,
          matchId: match.id,
        });
      }

      // If no-show, send additional warning notification
      if (reason === 'NO_SHOW') {
        const noShowWarningNotif = matchManagementNotifications.noShowStrikeWarning(
          reporter?.name || 'Opponent'
        );
        
        await notificationService.createNotification({
          ...noShowWarningNotif,
          userIds: defaultingUserId,
          matchId: match.id,
        });

        // Notify reporter that opponent was claimed as no-show
        const opponentClaimsNotif = matchManagementNotifications.opponentClaimsNoShow(
          defaulter?.name || 'Player',
          new Date().toLocaleDateString()
        );
        
        await notificationService.createNotification({
          ...opponentClaimsNotif,
          userIds: defaultingUserId,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send walkover notification:', notifError);
      // Don't fail the request if notification fails
    }

    void logMatchActivity(userId, UserActionType.WALKOVER_REPORT, id, { defaultingUserId, reason }, req.ip);

    sendSuccess(res, match);
  } catch (error) {
    console.error('Submit Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit walkover';
    sendError(res, message, 400);
  }
};

/**
 * Get match with results
 * GET /api/matches/:id/result
 */
export const getMatchResult = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await matchResultService.getMatchWithResults(id);
    if (!match) {
      return sendError(res, 'Match not found', 404);
    }

    sendSuccess(res, match);
  } catch (error) {
    console.error('Get Match Result Error:', error);
    sendError(res, 'Failed to retrieve match result');
  }
};

/**
 * Get dispute details by ID
 * GET /api/matches/disputes/:id
 */
export const getDisputeById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Dispute ID is required', 400);
    }

    const dispute = await matchResultService.getDisputeById(id);
    sendSuccess(res, dispute);
  } catch (error) {
    console.error('Get Dispute Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get dispute';
    sendError(res, message, 404);
  }
};
