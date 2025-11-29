/**
 * Match Schedule Controller
 * Handles HTTP requests for match cancellation and rescheduling
 */

import { Request, Response } from 'express';
import { getMatchScheduleService } from '../../services/match/matchScheduleService';
import { CancellationReason } from '@prisma/client';

const matchScheduleService = getMatchScheduleService();

/**
 * Cancel a match
 * POST /api/matches/:id/cancel
 */
export const cancelMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { reason, comment } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const validReasons = [
      'PERSONAL_EMERGENCY', 'INJURY', 'WEATHER', 'SCHEDULING_CONFLICT',
      'ILLNESS', 'WORK_COMMITMENT', 'FAMILY_EMERGENCY', 'OTHER'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid cancellation reason' });
    }

    const match = await matchScheduleService.cancelMatch({
      matchId: id,
      cancelledById: userId,
      reason: reason as CancellationReason,
      comment
    });

    res.json(match);
  } catch (error) {
    console.error('Cancel Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel match';
    res.status(400).json({ error: message });
  }
};

/**
 * Request to reschedule a match
 * POST /api/matches/:id/reschedule
 */
export const requestReschedule = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { proposedTimes, reason } = req.body;

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return res.status(400).json({ error: 'At least one proposed time is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason for rescheduling is required' });
    }

    const match = await matchScheduleService.requestReschedule({
      matchId: id,
      requestedById: userId,
      proposedTimes: proposedTimes.map((t: string) => new Date(t)),
      reason
    });

    res.json(match);
  } catch (error) {
    console.error('Request Reschedule Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to request reschedule';
    res.status(400).json({ error: message });
  }
};

/**
 * Get cancellation rule impact
 * GET /api/matches/:id/cancel-impact
 */
export const getCancellationRuleImpact = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const impact = await matchScheduleService.getCancellationRuleImpact(id);
    res.json(impact);
  } catch (error) {
    console.error('Get Cancellation Impact Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get cancellation impact';
    res.status(400).json({ error: message });
  }
};

/**
 * Record a walkover (opponent 20+ minutes late)
 * POST /api/matches/:id/walkover
 */
export const recordWalkover = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { defaultingPlayerId, reason } = req.body;

    if (!defaultingPlayerId) {
      return res.status(400).json({ error: 'Defaulting player ID is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const match = await matchScheduleService.recordWalkover(
      id,
      userId,
      defaultingPlayerId,
      reason
    );

    res.json(match);
  } catch (error) {
    console.error('Record Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to record walkover';
    res.status(400).json({ error: message });
  }
};

/**
 * Continue an unfinished match
 * POST /api/matches/:id/continue
 */
export const continueMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { proposedTimes, notes } = req.body;

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return res.status(400).json({ error: 'At least one proposed time is required' });
    }

    const match = await matchScheduleService.continueUnfinishedMatch(
      id,
      userId,
      proposedTimes.map((t: string) => new Date(t)),
      notes
    );

    res.json(match);
  } catch (error) {
    console.error('Continue Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to continue match';
    res.status(400).json({ error: message });
  }
};
