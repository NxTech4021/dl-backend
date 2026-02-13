/**
 * Admin Status Controller
 * Handles HTTP requests for admin status management (suspend, activate, history)
 */

import { Request, Response } from 'express';
import * as adminStatusService from '../../services/admin/adminStatusService';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError } from '../../utils/response';

/**
 * Suspend an admin
 * POST /api/admin/admins/:id/suspend
 * Body: { reason: string, notes?: string }
 */
export const suspendAdmin = async (req: Request, res: Response) => {
  try {
    const actingAdminUserId = (req as any).user?.id;
    const { id: targetAdminId } = req.params;
    const { reason, notes } = req.body;

    if (!actingAdminUserId) {
      return sendError(res, 'Not authenticated', 401);
    }

    if (!targetAdminId) {
      return sendError(res, 'Admin ID is required', 400);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return sendError(res, 'Suspension reason is required', 400);
    }

    const result = await adminStatusService.suspendAdmin({
      targetAdminId,
      actingAdminUserId,
      reason: reason.trim(),
      notes: notes?.trim()
    });

    return sendSuccess(res, {
      admin: {
        id: result.admin.id,
        status: result.admin.status
      },
      previousStatus: result.previousStatus,
      statusChangeId: result.statusChange.id
    }, 'Admin suspended successfully');
  } catch (error: any) {
    logger.error('Suspend admin error:', error);

    const statusCode =
      error.message === 'Admin not found' || error.message === 'Acting admin not found' ? 404 :
      error.message === 'Cannot suspend yourself' ? 403 :
      error.message.includes('already suspended') || error.message.includes('pending') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to suspend admin', statusCode);
  }
};

/**
 * Activate a suspended admin
 * POST /api/admin/admins/:id/activate
 * Body: { notes?: string }
 */
export const activateAdmin = async (req: Request, res: Response) => {
  try {
    const actingAdminUserId = (req as any).user?.id;
    const { id: targetAdminId } = req.params;
    const { notes } = req.body;

    if (!actingAdminUserId) {
      return sendError(res, 'Not authenticated', 401);
    }

    if (!targetAdminId) {
      return sendError(res, 'Admin ID is required', 400);
    }

    const result = await adminStatusService.activateAdmin({
      targetAdminId,
      actingAdminUserId,
      notes: notes?.trim()
    });

    return sendSuccess(res, {
      admin: {
        id: result.admin.id,
        status: result.admin.status
      },
      previousStatus: result.previousStatus,
      statusChangeId: result.statusChange.id
    }, 'Admin activated successfully');
  } catch (error: any) {
    logger.error('Activate admin error:', error);

    const statusCode =
      error.message === 'Admin not found' || error.message === 'Acting admin not found' ? 404 :
      error.message.includes('not suspended') ? 400 :
      500;

    return sendError(res, error.message || 'Failed to activate admin', statusCode);
  }
};

/**
 * Get admin status history
 * GET /api/admin/admins/:id/status-history
 */
export const getAdminStatusHistory = async (req: Request, res: Response) => {
  try {
    const { id: adminId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin ID is required', 400);
    }

    const history = await adminStatusService.getAdminStatusHistory(adminId);

    return sendSuccess(res, history, 'Status history retrieved successfully');
  } catch (error: any) {
    logger.error('Get admin status history error:', error);

    const statusCode = error.message === 'Admin not found' ? 404 : 500;

    return sendError(res, error.message || 'Failed to get status history', statusCode);
  }
};

/**
 * Get admin detail for profile view
 * GET /api/admin/admins/:id
 */
export const getAdminDetail = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.params;

    if (!userId) {
      return sendError(res, 'Admin user ID is required', 400);
    }

    const admin = await adminStatusService.getAdminDetailForProfile(userId);

    return sendSuccess(res, admin, 'Admin details retrieved successfully');
  } catch (error: any) {
    logger.error('Get admin detail error:', error);

    const statusCode = error.message === 'Admin not found' ? 404 : 500;

    return sendError(res, error.message || 'Failed to get admin details', statusCode);
  }
};
