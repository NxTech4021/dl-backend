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
import { sendSuccess, sendError } from '../../utils/response';

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

    sendSuccess(res, result);
  } catch (error) {
    console.error('Get Admin Matches Error:', error);
    sendError(res, 'Failed to retrieve matches');
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

    sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Match Stats Error:', error);
    sendError(res, 'Failed to retrieve match statistics');
  }
};

/**
 * Get a single match by ID
 * GET /api/admin/matches/:id
 */
export const getMatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await adminMatchService.getMatchById(id);
    if (!match) {
      return sendError(res, 'Match not found', 404);
    }

    sendSuccess(res, match);
  } catch (error) {
    console.error('Get Match By ID Error:', error);
    sendError(res, 'Failed to retrieve match');
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

    sendSuccess(res, result);
  } catch (error) {
    console.error('Get Disputes Error:', error);
    sendError(res, 'Failed to retrieve disputes');
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
      return sendError(res, 'Dispute ID is required', 400);
    }

    const dispute = await adminMatchService.getDisputeById(id);
    if (!dispute) {
      return sendError(res, 'Dispute not found', 404);
    }

    sendSuccess(res, dispute);
  } catch (error) {
    console.error('Get Dispute By ID Error:', error);
    sendError(res, 'Failed to retrieve dispute');
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Dispute ID is required', 400);
    }

    const dispute = await adminMatchService.startDisputeReview(id, adminId);
    sendSuccess(res, dispute);
  } catch (error) {
    console.error('Start Dispute Review Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start dispute review';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Dispute ID is required', 400);
    }

    const { action, finalScore, reason, notifyPlayers } = req.body;

    if (!action || !reason) {
      return sendError(res, 'action and reason are required', 400);
    }

    const validActions = [
      'UPHOLD_ORIGINAL', 'UPHOLD_DISPUTER', 'CUSTOM_SCORE',
      'VOID_MATCH', 'AWARD_WALKOVER', 'REQUEST_MORE_INFO', 'REJECT'
    ];

    if (!validActions.includes(action)) {
      return sendError(res, 'Invalid resolution action', 400);
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

    sendSuccess(res, dispute);
  } catch (error) {
    console.error('Resolve Dispute Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve dispute';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Dispute ID is required', 400);
    }

    const { note, isInternalOnly = true } = req.body;

    if (!note) {
      return sendError(res, 'note is required', 400);
    }

    const result = await adminMatchService.addDisputeNote(id, adminId, note, isInternalOnly);
    sendSuccess(res, result, undefined, 201);
  } catch (error) {
    console.error('Add Dispute Note Error:', error);
    sendError(res, 'Failed to add note');
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { team1Score, team2Score, setScores, outcome, isWalkover, walkoverReason, reason } = req.body;

    if (!reason) {
      return sendError(res, 'reason is required for audit trail', 400);
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

    sendSuccess(res, match);
  } catch (error) {
    console.error('Edit Match Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit result';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'reason is required', 400);
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

    sendSuccess(res, match);
  } catch (error) {
    console.error('Void Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to void match';
    sendError(res, message, 400);
  }
};

/**
 * Get pending late cancellations (AS3)
 * GET /api/admin/cancellations/pending
 */
export const getPendingCancellations = async (req: Request, res: Response) => {
  try {
    const cancellations = await adminMatchService.getPendingCancellations();
    sendSuccess(res, cancellations);
  } catch (error) {
    console.error('Get Pending Cancellations Error:', error);
    sendError(res, 'Failed to retrieve pending cancellations');
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { approved, applyPenalty, penaltySeverity, reason } = req.body;

    if (typeof approved !== 'boolean') {
      return sendError(res, 'approved (boolean) is required', 400);
    }

    const result = await adminMatchService.reviewCancellation({
      matchId: id,
      adminId,
      approved,
      applyPenalty,
      penaltySeverity: penaltySeverity as PenaltySeverity,
      reason
    });

    sendSuccess(res, result);
  } catch (error) {
    console.error('Review Cancellation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to review cancellation';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
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
      return sendError(res, 'userId, penaltyType, severity, and reason are required', 400);
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

    sendSuccess(res, penalty, undefined, 201);
  } catch (error) {
    console.error('Apply Penalty Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to apply penalty';
    sendError(res, message, 400);
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
      return sendError(res, 'User ID is required', 400);
    }

    const penalties = await adminMatchService.getPlayerPenalties(userId);
    sendSuccess(res, penalties);
  } catch (error) {
    console.error('Get Player Penalties Error:', error);
    sendError(res, 'Failed to retrieve penalties');
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { subject, message, sendEmail = false, sendPush = false } = req.body;

    if (!message) {
      return sendError(res, 'message is required', 400);
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

    sendSuccess(res, result);
  } catch (error) {
    console.error('Message Participants Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    sendError(res, errorMessage, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { participants, reason } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return sendError(res, 'participants array is required', 400);
    }

    if (!reason) {
      return sendError(res, 'reason is required for audit trail', 400);
    }

    // Validate participant structure
    for (const p of participants) {
      if (!p.userId) {
        return sendError(res, 'Each participant must have a userId', 400);
      }
      if (!p.role || !Object.values(ParticipantRole).includes(p.role)) {
        return sendError(res, `Invalid role for participant ${p.userId}`, 400);
      }
      if (p.team && !['team1', 'team2'].includes(p.team)) {
        return sendError(res, `Invalid team for participant ${p.userId}`, 400);
      }
    }

    const result = await participantService.editParticipants({
      matchId: id,
      adminId,
      participants,
      reason
    });

    sendSuccess(res, result);
  } catch (error) {
    console.error('Edit Match Participants Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit participants';
    sendError(res, message, 400);
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
      return sendError(res, 'Match ID is required', 400);
    }

    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return sendError(res, 'participants array is required', 400);
    }

    const validation = await validateParticipantEdit(id, participants);

    sendSuccess(res, validation);
  } catch (error) {
    console.error('Validate Participants Error:', error);
    const message = error instanceof Error ? error.message : 'Validation failed';
    sendError(res, message, 400);
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
      return sendError(res, 'Division ID is required', 400);
    }

    const { excludeMatchId, search } = req.query;

    const players = await participantService.getAvailablePlayersForMatch(
      divisionId,
      excludeMatchId as string | undefined,
      search as string | undefined
    );

    sendSuccess(res, players);
  } catch (error) {
    console.error('Get Available Players Error:', error);
    sendError(res, 'Failed to retrieve available players');
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'reason is required', 400);
    }

    const match = await adminMatchService.hideMatch(id, adminId, reason);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Hide Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to hide match';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await adminMatchService.unhideMatch(id, adminId);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Unhide Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to unhide match';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { reason, category } = req.body;

    if (!reason) {
      return sendError(res, 'reason is required', 400);
    }

    if (!category) {
      return sendError(res, 'category is required', 400);
    }

    const validCategories = [
      'FAKE_MATCH', 'RATING_MANIPULATION', 'INAPPROPRIATE_CONTENT',
      'HARASSMENT', 'SPAM', 'OTHER'
    ];

    if (!validCategories.includes(category)) {
      return sendError(res, 'Invalid report category', 400);
    }

    const match = await adminMatchService.reportMatchAbuse(id, adminId, reason, category as MatchReportCategory);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Report Match Abuse Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to report match';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await adminMatchService.clearMatchReport(id, adminId);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Clear Match Report Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to clear report';
    sendError(res, message, 400);
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
      return sendError(res, 'Admin authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { winnerId, reason, walkoverReason } = req.body;

    if (!winnerId) {
      return sendError(res, 'winnerId is required', 400);
    }

    if (!reason) {
      return sendError(res, 'reason is required for audit trail', 400);
    }

    const userId = authReq.user?.id || adminId;

    const match = await adminMatchService.convertToWalkover({
      matchId: id,
      adminId,
      userId,
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

    sendSuccess(res, match);
  } catch (error) {
    console.error('Convert To Walkover Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to convert to walkover';
    sendError(res, message, 400);
  }
};
