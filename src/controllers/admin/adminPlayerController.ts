/**
 * Admin Player Controller
 * Handles HTTP requests for player management operations
 */

import { Request, Response } from 'express';
import { UserStatus, StatusChangeReason, AdminActionType } from '@prisma/client';
import * as adminPlayerService from '../../services/admin/adminPlayerService';
import { logPlayerAction } from '../../services/admin/adminLogService';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';

/**
 * Ban a player
 * POST /api/admin/players/:id/ban
 */
export const banPlayer = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id: playerId } = req.params;
    const { reason, notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return sendError(res, 'Ban reason is required', 400);
    }

    const result = await adminPlayerService.banPlayer({
      playerId,
      adminId,
      reason: reason.trim(),
      notes: notes?.trim()
    });

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_BAN,
      playerId,
      `Banned player: ${reason.trim()}`,
      { status: result.previousStatus },
      { status: result.player.status },
      { notes: notes?.trim() }
    );

    return sendSuccess(res, {
      player: {
        id: result.player.id,
        status: result.player.status
      },
      previousStatus: result.previousStatus,
      statusChangeId: result.statusChange.id
    }, 'Player banned successfully');
  } catch (error: any) {
    logger.error('Ban player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already banned') || error.message.includes('deleted player') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to ban player', statusCode);
  }
};

/**
 * Unban a player
 * POST /api/admin/players/:id/unban
 */
export const unbanPlayer = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id: playerId } = req.params;
    const { notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    const result = await adminPlayerService.unbanPlayer({
      playerId,
      adminId,
      notes: notes?.trim()
    });

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_UNBAN,
      playerId,
      'Unbanned player',
      { status: result.previousStatus },
      { status: result.player.status },
      { notes: notes?.trim() }
    );

    return sendSuccess(res, {
      player: {
        id: result.player.id,
        status: result.player.status
      },
      previousStatus: result.previousStatus,
      statusChangeId: result.statusChange.id
    }, 'Player unbanned successfully');
  } catch (error: any) {
    logger.error('Unban player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('not banned') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to unban player', statusCode);
  }
};

/**
 * Delete a player (soft delete by default)
 * DELETE /api/admin/players/:id
 */
export const deletePlayer = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id: playerId } = req.params;
    const { reason, hardDelete } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return sendError(res, 'Deletion reason is required', 400);
    }

    const result = await adminPlayerService.deletePlayer({
      playerId,
      adminId,
      reason: reason.trim(),
      hardDelete: hardDelete === true
    });

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_DELETE,
      playerId,
      `Deleted player: ${reason.trim()}`,
      { status: result.previousStatus },
      { status: result.player?.status ?? 'DELETED', hardDelete: result.hardDelete },
      { hardDelete: result.hardDelete }
    );

    return sendSuccess(res, {
      deleted: result.deleted,
      hardDelete: result.hardDelete,
      previousStatus: result.previousStatus,
      player: result.player ? {
        id: result.player.id,
        status: result.player.status
      } : null
    }, result.hardDelete
      ? 'Player permanently deleted'
      : 'Player marked as deleted');
  } catch (error: any) {
    logger.error('Delete player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already deleted') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to delete player', statusCode);
  }
};

/**
 * Update player status
 * PATCH /api/admin/players/:id/status
 */
export const updatePlayerStatus = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id: playerId } = req.params;
    const { status, reason, notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    if (!status || !Object.values(UserStatus).includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${Object.values(UserStatus).join(', ')}`, 400);
    }

    // Map status to appropriate reason
    let statusReason: StatusChangeReason;
    switch (status) {
      case UserStatus.BANNED:
        statusReason = StatusChangeReason.ADMIN_BAN;
        break;
      case UserStatus.DELETED:
        statusReason = StatusChangeReason.ADMIN_DELETE;
        break;
      default:
        statusReason = StatusChangeReason.ADMIN_MANUAL;
    }

    const result = await adminPlayerService.updatePlayerStatus({
      playerId,
      adminId,
      newStatus: status,
      reason: statusReason,
      notes: notes?.trim() || reason?.trim()
    });

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_STATUS_CHANGE,
      playerId,
      `Changed player status from ${result.previousStatus} to ${status}`,
      { status: result.previousStatus },
      { status: result.player.status },
      { reason: notes?.trim() || reason?.trim() }
    );

    return sendSuccess(res, {
      player: {
        id: result.player.id,
        status: result.player.status
      },
      previousStatus: result.previousStatus,
      statusChangeId: result.statusChange.id
    }, `Player status updated to ${status}`);
  } catch (error: any) {
    logger.error('Update player status error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to update player status', statusCode);
  }
};

/**
 * Get player status history
 * GET /api/admin/players/:id/status-history
 */
export const getPlayerStatusHistory = async (req: Request, res: Response) => {
  try {
    const { id: playerId } = req.params;

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    const history = await adminPlayerService.getPlayerStatusHistory(playerId);

    return sendSuccess(res, history, 'Status history retrieved successfully');
  } catch (error: any) {
    logger.error('Get player status history error:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;

    return sendError(res, error.message || 'Failed to get status history', statusCode);
  }
};

/**
 * Get players by status
 * GET /api/admin/players
 * Query params: status, page, limit, search
 */
export const getPlayers = async (req: Request, res: Response) => {
  try {
    const { status, page, limit, search } = req.query;

    const validStatus = status && Object.values(UserStatus).includes(status as UserStatus)
      ? status as UserStatus
      : undefined;

    const searchStr = search ? String(search) : undefined;

    const result = await adminPlayerService.getPlayersByStatus(validStatus, {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      search: searchStr
    });

    return sendPaginated(res, result.players, result.pagination, 'Players retrieved successfully');
  } catch (error: any) {
    logger.error('Get players error:', error);

    return sendError(res, error.message || 'Failed to get players');
  }
};

/**
 * Update player profile (admin)
 * PUT /api/admin/players/:id
 */
export const updatePlayer = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id: playerId } = req.params;
    const { name, email, phoneNumber, area, bio, gender, dateOfBirth } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    const updatedPlayer = await adminPlayerService.adminUpdatePlayer({
      playerId,
      adminId,
      name,
      email,
      phoneNumber,
      area,
      bio,
      gender,
      dateOfBirth
    });

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_UPDATE,
      playerId,
      'Updated player profile',
      undefined,
      { name, email, phoneNumber, area, bio, gender, dateOfBirth }
    );

    return sendSuccess(res, updatedPlayer, 'Player updated successfully');
  } catch (error: any) {
    logger.error('Update player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already in use') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to update player', statusCode);
  }
};

/**
 * Get player details for admin view
 * GET /api/admin/players/:id
 */
export const getPlayerDetails = async (req: Request, res: Response) => {
  try {
    const { id: playerId } = req.params;

    if (!playerId) {
      return sendError(res, 'Player ID is required', 400);
    }

    const player = await adminPlayerService.getPlayerDetailsForAdmin(playerId);

    return sendSuccess(res, player, 'Player details retrieved successfully');
  } catch (error: any) {
    logger.error('Get player details error:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;

    return sendError(res, error.message || 'Failed to get player details', statusCode);
  }
};
