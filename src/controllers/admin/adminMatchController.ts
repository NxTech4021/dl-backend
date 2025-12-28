/**
 * Admin Match Controller
 * Handles HTTP requests for admin match management
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { getAdminMatchService } from '../../services/admin/adminMatchService';
import { AdminMatchParticipantService } from '../../services/admin/adminMatchParticipantService';
import { validateParticipantEdit } from '../../services/admin/matchParticipantValidationService';
import { logMatchAction, createAdminLog } from '../../services/admin/adminLogService';
import {
  MatchStatus,
  DisputeStatus,
  DisputePriority,
  DisputeResolutionAction,
  PenaltyType,
  PenaltySeverity,
  ParticipantRole,
  MatchReportCategory,
  AdminActionType,
  AdminTargetType
} from '@prisma/client';

const adminMatchService = getAdminMatchService();
const participantService = new AdminMatchParticipantService();

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
      isWalkover,
      requiresAdminReview,
      matchContext, // 'league' | 'friendly' | 'all'
      showHidden,
      showReported,
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
    if (isWalkover !== undefined) filters.isWalkover = isWalkover === 'true';
    if (requiresAdminReview !== undefined) filters.requiresAdminReview = requiresAdminReview === 'true';
    if (matchContext) filters.matchContext = matchContext as 'league' | 'friendly' | 'all';
    if (showHidden !== undefined) filters.showHidden = showHidden === 'true';
    if (showReported !== undefined) filters.showReported = showReported === 'true';

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
 * Start reviewing a dispute - sets status to UNDER_REVIEW (AS5)
 * POST /api/admin/disputes/:id/start-review
 */
export const startDisputeReview = async (req: Request, res: Response) => {
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

    const dispute = await adminMatchService.startDisputeReview(id, adminId);
    res.json(dispute);
  } catch (error) {
    console.error('Start Dispute Review Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start dispute review';
    res.status(400).json({ error: message });
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
      'VOID_MATCH', 'AWARD_WALKOVER', 'REQUEST_MORE_INFO', 'REJECT'
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

    // Log admin action
    await createAdminLog({
      adminId: authReq.user?.id || adminId,
      actionType: AdminActionType.DISPUTE_RESOLVE,
      targetType: AdminTargetType.DISPUTE,
      targetId: id,
      description: `Resolved dispute with action: ${action}`,
      newValue: { action, finalScore, reason }
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

    // Log admin action
    await logMatchAction(
      authReq.user?.id || adminId,
      AdminActionType.MATCH_EDIT_RESULT,
      id,
      `Edited match result: ${reason}`,
      undefined,
      { team1Score, team2Score, setScores, outcome, isWalkover }
    );

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

    // Log admin action
    await logMatchAction(
      authReq.user?.id || adminId,
      AdminActionType.MATCH_VOID,
      id,
      `Voided match: ${reason}`,
      undefined,
      { status: 'VOIDED', reason }
    );

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
 * POST /api/admin/matches/:id/message-participants
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

    const { subject, message, sendEmail = false, sendPush = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Validate at least one delivery method when explicitly set
    if (sendEmail === false && sendPush === false) {
      // Default to in-app notification only - this is fine
    }

    const result = await adminMatchService.messageParticipants(id, adminId, {
      subject: subject || 'Message from Admin',
      message,
      sendEmail,
      sendPush,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Message Participants Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    res.status(400).json({ error: errorMessage });
  }
};

/**
 * Edit match participants (AS7)
 * PUT /api/admin/matches/:id/participants
 */
export const editMatchParticipants = async (req: Request, res: Response) => {
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

    const { participants, reason } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'participants array is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required for audit trail' });
    }

    // Validate participant structure
    for (const p of participants) {
      if (!p.userId) {
        return res.status(400).json({ error: 'Each participant must have a userId' });
      }
      if (!p.role || !Object.values(ParticipantRole).includes(p.role)) {
        return res.status(400).json({ error: `Invalid role for participant ${p.userId}` });
      }
      if (p.team && !['team1', 'team2'].includes(p.team)) {
        return res.status(400).json({ error: `Invalid team for participant ${p.userId}` });
      }
    }

    const result = await participantService.editParticipants({
      matchId: id,
      adminId,
      participants,
      reason
    });

    res.json(result);
  } catch (error) {
    console.error('Edit Match Participants Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit participants';
    res.status(400).json({ error: message });
  }
};

/**
 * Validate participant edit before submission (AS7)
 * POST /api/admin/matches/:id/participants/validate
 */
export const validateMatchParticipants = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'participants array is required' });
    }

    const validation = await validateParticipantEdit(id, participants);

    res.json(validation);
  } catch (error) {
    console.error('Validate Participants Error:', error);
    const message = error instanceof Error ? error.message : 'Validation failed';
    res.status(400).json({ error: message });
  }
};

/**
 * Get available players for a division (AS7)
 * GET /api/admin/divisions/:divisionId/available-players
 */
export const getAvailablePlayers = async (req: Request, res: Response) => {
  try {
    const { divisionId } = req.params;
    if (!divisionId) {
      return res.status(400).json({ error: 'Division ID is required' });
    }

    const { excludeMatchId, search } = req.query;

    const players = await participantService.getAvailablePlayersForMatch(
      divisionId,
      excludeMatchId as string | undefined,
      search as string | undefined
    );

    res.json(players);
  } catch (error) {
    console.error('Get Available Players Error:', error);
    res.status(500).json({ error: 'Failed to retrieve available players' });
  }
};

/**
 * Hide a match from public view (friendly match moderation)
 * POST /api/admin/matches/:id/hide
 */
export const hideMatch = async (req: Request, res: Response) => {
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

    const match = await adminMatchService.hideMatch(id, adminId, reason);
    res.json(match);
  } catch (error) {
    console.error('Hide Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to hide match';
    res.status(400).json({ error: message });
  }
};

/**
 * Unhide a match (restore visibility)
 * POST /api/admin/matches/:id/unhide
 */
export const unhideMatch = async (req: Request, res: Response) => {
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

    const match = await adminMatchService.unhideMatch(id, adminId);
    res.json(match);
  } catch (error) {
    console.error('Unhide Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to unhide match';
    res.status(400).json({ error: message });
  }
};

/**
 * Report a match for abuse
 * POST /api/admin/matches/:id/report
 */
export const reportMatchAbuse = async (req: Request, res: Response) => {
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

    const { reason, category } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    const validCategories = [
      'FAKE_MATCH', 'RATING_MANIPULATION', 'INAPPROPRIATE_CONTENT',
      'HARASSMENT', 'SPAM', 'OTHER'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid report category' });
    }

    const match = await adminMatchService.reportMatchAbuse(id, adminId, reason, category as MatchReportCategory);
    res.json(match);
  } catch (error) {
    console.error('Report Match Abuse Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to report match';
    res.status(400).json({ error: message });
  }
};

/**
 * Clear abuse report from a match
 * POST /api/admin/matches/:id/clear-report
 */
export const clearMatchReport = async (req: Request, res: Response) => {
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

    const match = await adminMatchService.clearMatchReport(id, adminId);
    res.json(match);
  } catch (error) {
    console.error('Clear Match Report Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to clear report';
    res.status(400).json({ error: message });
  }
};

/**
 * Convert a match to walkover
 * POST /api/admin/matches/:id/convert-walkover
 */
export const convertToWalkover = async (req: Request, res: Response) => {
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

    const { winnerId, reason, walkoverReason } = req.body;

    if (!winnerId) {
      return res.status(400).json({ error: 'winnerId is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required for audit trail' });
    }

    const match = await adminMatchService.convertToWalkover({
      matchId: id,
      adminId,
      winnerId,
      reason,
      walkoverReason
    });

    // Log admin action
    await logMatchAction(
      authReq.user?.id || adminId,
      AdminActionType.MATCH_WALKOVER,
      id,
      `Converted match to walkover: ${reason}`,
      undefined,
      { winnerId, walkoverReason }
    );

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    console.error('Convert To Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to convert to walkover';
    res.status(400).json({ error: message });
  }
};
