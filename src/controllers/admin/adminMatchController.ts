/**
 * Admin Match Controller
 * Handles HTTP requests for admin match management
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { getAdminMatchService } from '../../services/admin/adminMatchService';
import {
  MatchStatus,
  DisputeStatus,
  DisputePriority,
  DisputeResolutionAction,
  PenaltyType,
  PenaltySeverity
} from '@prisma/client';

const adminMatchService = getAdminMatchService();

/**
 * Get admin matches dashboard (AS6)
 * GET /api/admin/matches
 */
export const getAdminMatches = async (req: Request, res: Response) => {
  try {
    const {
      leagueId,
      seasonId,
      divisionId,
      status,
      startDate,
      endDate,
      search,
      isDisputed,
      hasLateCancellation,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    if (leagueId) filters.leagueId = leagueId as string;
    if (seasonId) filters.seasonId = seasonId as string;
    if (divisionId) filters.divisionId = divisionId as string;
    if (status) filters.status = (status as string).split(',') as MatchStatus[];
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (search) filters.search = search as string;
    if (isDisputed !== undefined) filters.isDisputed = isDisputed === 'true';
    if (hasLateCancellation !== undefined) filters.hasLateCancellation = hasLateCancellation === 'true';

    const result = await adminMatchService.getAdminMatches(filters);

    res.json(result);
  } catch (error) {
    console.error('Get Admin Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve matches' });
  }
};

/**
 * Get match statistics (AS6)
 * GET /api/admin/matches/stats
 */
export const getMatchStats = async (req: Request, res: Response) => {
  try {
    const { leagueId, seasonId, divisionId } = req.query;

    const stats = await adminMatchService.getMatchStats({
      leagueId: leagueId as string,
      seasonId: seasonId as string,
      divisionId: divisionId as string
    });

    res.json(stats);
  } catch (error) {
    console.error('Get Match Stats Error:', error);
    res.status(500).json({ error: 'Failed to retrieve match statistics' });
  }
};

/**
 * Get all disputes (AS5)
 * GET /api/admin/disputes
 */
export const getDisputes = async (req: Request, res: Response) => {
  try {
    const { status, priority, page = '1', limit = '20' } = req.query;

    const disputeFilters: any = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    if (status) disputeFilters.status = (status as string).split(',') as DisputeStatus[];
    if (priority) disputeFilters.priority = priority as DisputePriority;

    const result = await adminMatchService.getDisputes(disputeFilters);

    res.json(result);
  } catch (error) {
    console.error('Get Disputes Error:', error);
    res.status(500).json({ error: 'Failed to retrieve disputes' });
  }
};

/**
 * Get dispute by ID (AS5)
 * GET /api/admin/disputes/:id
 */
export const getDisputeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Dispute ID is required' });
    }

    const dispute = await adminMatchService.getDisputeById(id);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    res.json(dispute);
  } catch (error) {
    console.error('Get Dispute By ID Error:', error);
    res.status(500).json({ error: 'Failed to retrieve dispute' });
  }
};

/**
 * Resolve a dispute (AS5)
 * POST /api/admin/disputes/:id/resolve
 */
export const resolveDispute = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Dispute ID is required' });
    }

    const { action, finalScore, reason, notifyPlayers } = req.body;

    if (!action || !reason) {
      return res.status(400).json({ error: 'action and reason are required' });
    }

    const validActions = [
      'UPHOLD_ORIGINAL', 'UPHOLD_DISPUTER', 'CUSTOM_SCORE',
      'VOID_MATCH', 'AWARD_WALKOVER', 'REQUEST_MORE_INFO'
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid resolution action' });
    }

    const dispute = await adminMatchService.resolveDispute({
      disputeId: id,
      adminId,
      action: action as DisputeResolutionAction,
      finalScore,
      reason,
      notifyPlayers
    });

    res.json(dispute);
  } catch (error) {
    console.error('Resolve Dispute Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve dispute';
    res.status(400).json({ error: message });
  }
};

/**
 * Add note to dispute (AS5)
 * POST /api/admin/disputes/:id/notes
 */
export const addDisputeNote = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Dispute ID is required' });
    }

    const { note, isInternalOnly = true } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'note is required' });
    }

    const result = await adminMatchService.addDisputeNote(id, adminId, note, isInternalOnly);
    res.status(201).json(result);
  } catch (error) {
    console.error('Add Dispute Note Error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
};

/**
 * Edit match result (AS4)
 * PUT /api/admin/matches/:id/result
 */
export const editMatchResult = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { team1Score, team2Score, setScores, outcome, isWalkover, walkoverReason, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required for audit trail' });
    }

    const match = await adminMatchService.editMatchResult({
      matchId: id,
      adminId,
      team1Score,
      team2Score,
      setScores,
      outcome,
      isWalkover,
      walkoverReason,
      reason
    });

    res.json(match);
  } catch (error) {
    console.error('Edit Match Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit result';
    res.status(400).json({ error: message });
  }
};

/**
 * Void a match (AS4)
 * POST /api/admin/matches/:id/void
 */
export const voidMatch = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const match = await adminMatchService.voidMatch(id, adminId, reason);
    res.json(match);
  } catch (error) {
    console.error('Void Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to void match';
    res.status(400).json({ error: message });
  }
};

/**
 * Get pending late cancellations (AS3)
 * GET /api/admin/cancellations/pending
 */
export const getPendingCancellations = async (req: Request, res: Response) => {
  try {
    const cancellations = await adminMatchService.getPendingCancellations();
    res.json(cancellations);
  } catch (error) {
    console.error('Get Pending Cancellations Error:', error);
    res.status(500).json({ error: 'Failed to retrieve pending cancellations' });
  }
};

/**
 * Review a late cancellation (AS3)
 * POST /api/admin/cancellations/:id/review
 */
export const reviewCancellation = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { approved, applyPenalty, penaltySeverity, reason } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required' });
    }

    const result = await adminMatchService.reviewCancellation({
      matchId: id,
      adminId,
      approved,
      applyPenalty,
      penaltySeverity: penaltySeverity as PenaltySeverity,
      reason
    });

    res.json(result);
  } catch (error) {
    console.error('Review Cancellation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to review cancellation';
    res.status(400).json({ error: message });
  }
};

/**
 * Apply penalty to player (AS3)
 * POST /api/admin/penalties/apply
 */
export const applyPenalty = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const {
      userId,
      penaltyType,
      severity,
      relatedMatchId,
      relatedDisputeId,
      pointsDeducted,
      suspensionDays,
      reason,
      evidenceUrl
    } = req.body;

    if (!userId || !penaltyType || !severity || !reason) {
      return res.status(400).json({
        error: 'userId, penaltyType, severity, and reason are required'
      });
    }

    const penalty = await adminMatchService.applyPenalty({
      userId,
      adminId,
      penaltyType: penaltyType as PenaltyType,
      severity: severity as PenaltySeverity,
      relatedMatchId,
      relatedDisputeId,
      pointsDeducted,
      suspensionDays,
      reason,
      evidenceUrl
    });

    res.status(201).json(penalty);
  } catch (error) {
    console.error('Apply Penalty Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to apply penalty';
    res.status(400).json({ error: message });
  }
};

/**
 * Get player's penalty history (AS3)
 * GET /api/admin/penalties/player/:userId
 */
export const getPlayerPenalties = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const penalties = await adminMatchService.getPlayerPenalties(userId);
    res.json(penalties);
  } catch (error) {
    console.error('Get Player Penalties Error:', error);
    res.status(500).json({ error: 'Failed to retrieve penalties' });
  }
};

/**
 * Message match participants (AS6)
 * POST /api/admin/matches/:id/message
 */
export const messageParticipants = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.adminId;
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await adminMatchService.messageParticipants(id, adminId, message);
    res.json(result);
  } catch (error) {
    console.error('Message Participants Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send message';
    res.status(400).json({ error: message });
  }
};
