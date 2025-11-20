/**
 * Match Result Controller
 * Handles HTTP requests for match result submission and confirmation
 */

import { Request, Response } from 'express';
import { getMatchResultService } from '../../services/match/matchResultService';
import { DisputeCategory, WalkoverReason } from '@prisma/client';

const matchResultService = getMatchResultService();

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

    const { setScores, comment, evidence } = req.body;

    if (!setScores || !Array.isArray(setScores) || setScores.length === 0) {
      return res.status(400).json({ error: 'setScores array is required' });
    }

    const match = await matchResultService.submitResult({
      matchId: id,
      submittedById: userId,
      setScores,
      comment,
      evidence
    });

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
