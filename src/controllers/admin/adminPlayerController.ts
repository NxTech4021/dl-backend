/**
 * Admin Player Controller
 * Handles HTTP requests for player management operations
 */

import { Request, Response } from 'express';
import { UserStatus, StatusChangeReason } from '@prisma/client';
import * as adminPlayerService from '../../services/admin/adminPlayerService';
import { logger } from '../../utils/logger';

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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ban reason is required'
      });
    }

    const result = await adminPlayerService.banPlayer({
      playerId,
      adminId,
      reason: reason.trim(),
      notes: notes?.trim()
    });

    return res.status(200).json({
      success: true,
      data: {
        player: {
          id: result.player.id,
          status: result.player.status
        },
        previousStatus: result.previousStatus,
        statusChangeId: result.statusChange.id
      },
      message: 'Player banned successfully'
    });
  } catch (error: any) {
    logger.error('Ban player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already banned') || error.message.includes('deleted player') ? 400 :
      500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to ban player'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    const result = await adminPlayerService.unbanPlayer({
      playerId,
      adminId,
      notes: notes?.trim()
    });

    return res.status(200).json({
      success: true,
      data: {
        player: {
          id: result.player.id,
          status: result.player.status
        },
        previousStatus: result.previousStatus,
        statusChangeId: result.statusChange.id
      },
      message: 'Player unbanned successfully'
    });
  } catch (error: any) {
    logger.error('Unban player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('not banned') ? 400 :
      500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to unban player'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Deletion reason is required'
      });
    }

    const result = await adminPlayerService.deletePlayer({
      playerId,
      adminId,
      reason: reason.trim(),
      hardDelete: hardDelete === true
    });

    return res.status(200).json({
      success: true,
      data: {
        deleted: result.deleted,
        hardDelete: result.hardDelete,
        previousStatus: result.previousStatus,
        player: result.player ? {
          id: result.player.id,
          status: result.player.status
        } : null
      },
      message: result.hardDelete
        ? 'Player permanently deleted'
        : 'Player marked as deleted'
    });
  } catch (error: any) {
    logger.error('Delete player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already deleted') ? 400 :
      500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete player'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    if (!status || !Object.values(UserStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${Object.values(UserStatus).join(', ')}`
      });
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

    return res.status(200).json({
      success: true,
      data: {
        player: {
          id: result.player.id,
          status: result.player.status
        },
        previousStatus: result.previousStatus,
        statusChangeId: result.statusChange.id
      },
      message: `Player status updated to ${status}`
    });
  } catch (error: any) {
    logger.error('Update player status error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already') ? 400 :
      500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update player status'
    });
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
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    const history = await adminPlayerService.getPlayerStatusHistory(playerId);

    return res.status(200).json({
      success: true,
      data: history,
      message: 'Status history retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get player status history error:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get status history'
    });
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

    return res.status(200).json({
      success: true,
      data: result.players,
      pagination: result.pagination,
      message: 'Players retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get players error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get players'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
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

    return res.status(200).json({
      success: true,
      data: updatedPlayer,
      message: 'Player updated successfully'
    });
  } catch (error: any) {
    logger.error('Update player error:', error);

    const statusCode =
      error.message === 'Player not found' ? 404 :
      error.message === 'Admin not found' ? 401 :
      error.message.includes('already in use') ? 400 :
      500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update player'
    });
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
      return res.status(400).json({
        success: false,
        message: 'Player ID is required'
      });
    }

    const player = await adminPlayerService.getPlayerDetailsForAdmin(playerId);

    return res.status(200).json({
      success: true,
      data: player,
      message: 'Player details retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get player details error:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get player details'
    });
  }
};
