/**
 * Match Schedule Controller
 * Handles HTTP requests for match cancellation and rescheduling
 */

import { Request, Response } from 'express';
import { getMatchScheduleService } from '../../services/match/matchScheduleService';
import { CancellationReason } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response';

const matchScheduleService = getMatchScheduleService();

/**
 * Cancel a match
 * POST /api/matches/:id/cancel
 */
export const cancelMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { reason, comment } = req.body;

    if (!reason) {
      return sendError(res, 'Cancellation reason is required', 400);
    }

    const validReasons = [
      'PERSONAL_EMERGENCY', 'INJURY', 'WEATHER', 'SCHEDULING_CONFLICT',
      'ILLNESS', 'WORK_COMMITMENT', 'FAMILY_EMERGENCY', 'OTHER'
    ];

    if (!validReasons.includes(reason)) {
      return sendError(res, 'Invalid cancellation reason', 400);
    }

    const match = await matchScheduleService.cancelMatch({
      matchId: id,
      cancelledById: userId,
      reason: reason as CancellationReason,
      comment
    });

    sendSuccess(res, match);
  } catch (error) {
    console.error('Cancel Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel match';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { proposedTimes, reason } = req.body;

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return sendError(res, 'At least one proposed time is required', 400);
    }

    if (!reason) {
      return sendError(res, 'Reason for rescheduling is required', 400);
    }

    const match = await matchScheduleService.requestReschedule({
      matchId: id,
      requestedById: userId,
      proposedTimes: proposedTimes.map((t: string) => new Date(t)),
      reason
    });

    sendSuccess(res, match);
  } catch (error) {
    console.error('Request Reschedule Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to request reschedule';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const impact = await matchScheduleService.getCancellationRuleImpact(id);
    sendSuccess(res, impact);
  } catch (error) {
    console.error('Get Cancellation Impact Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get cancellation impact';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { defaultingPlayerId, reason } = req.body;

    if (!defaultingPlayerId) {
      return sendError(res, 'Defaulting player ID is required', 400);
    }

    if (!reason) {
      return sendError(res, 'Reason is required', 400);
    }

    const match = await matchScheduleService.recordWalkover(
      id,
      userId,
      defaultingPlayerId,
      reason
    );

    sendSuccess(res, match);
  } catch (error) {
    console.error('Record Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to record walkover';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { proposedTimes, notes } = req.body;

    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return sendError(res, 'At least one proposed time is required', 400);
    }

    const match = await matchScheduleService.continueUnfinishedMatch(
      id,
      userId,
      proposedTimes.map((t: string) => new Date(t)),
      notes
    );

    sendSuccess(res, match);
  } catch (error) {
    console.error('Continue Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to continue match';
    sendError(res, message, 400);
  }
};
