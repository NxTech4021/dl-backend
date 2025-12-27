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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { setScores, gameScores, comment, evidence, isUnfinished } = req.body;

    // Validate that at least one score type is provided
    if ((!setScores || !Array.isArray(setScores) || setScores.length === 0) &&
        (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0)) {
      return res.status(400).json({
        error: 'Either setScores (Tennis/Padel) or gameScores (Pickleball) array is required'
      });
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

    res.json(match);
  } catch (error) {
    console.error('Submit Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit result';
    res.status(400).json({ error: message });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { confirmed, disputeReason, disputeCategory, disputerScore, evidenceUrl } = req.body;

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'confirmed (boolean) is required' });
    }

    if (!confirmed && !disputeReason) {
      return res.status(400).json({ error: 'disputeReason is required when not confirming' });
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

    res.json(match);
  } catch (error) {
    console.error('Confirm Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm result';
    res.status(400).json({ error: message });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { defaultingUserId, reason, reasonDetail } = req.body;

    if (!defaultingUserId) {
      return res.status(400).json({ error: 'defaultingUserId is required' });
    }

    if (!reason || !['NO_SHOW', 'LATE_CANCELLATION', 'INJURY', 'PERSONAL_EMERGENCY', 'OTHER'].includes(reason)) {
      return res.status(400).json({ error: 'Valid reason is required' });
    }

    const match = await matchResultService.submitWalkover({
      matchId: id,
      reportedById: userId,
      defaultingUserId,
      reason: reason as WalkoverReason,
      reasonDetail
    });

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

    res.json(match);
  } catch (error) {
    console.error('Submit Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit walkover';
    res.status(400).json({ error: message });
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
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await matchResultService.getMatchWithResults(id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(match);
  } catch (error) {
    console.error('Get Match Result Error:', error);
    res.status(500).json({ error: 'Failed to retrieve match result' });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Dispute ID is required' });
    }

    const dispute = await matchResultService.getDisputeById(id);
    res.json(dispute);
  } catch (error) {
    console.error('Get Dispute Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get dispute';
    res.status(404).json({ error: message });
  }
};
