/**
 * Admin Log Controller
 * Handles HTTP requests for admin log operations
 */

import { Request, Response } from 'express';
import {
  getAdminLogs,
  getTargetLogs,
  getAdminActivitySummary
} from '../../services/admin/adminLogService';
import { AdminActionType, AdminTargetType } from '@prisma/client';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Get admin logs with filtering and pagination
 * GET /api/admin/logs
 */
export const getLogs = async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      adminId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      search
    } = req.query;

    // Validate actionType if provided
    if (actionType && !Object.values(AdminActionType).includes(actionType as AdminActionType)) {
      return sendError(res, 'Invalid action type', 400);
    }

    // Validate targetType if provided
    if (targetType && !Object.values(AdminTargetType).includes(targetType as AdminTargetType)) {
      return sendError(res, 'Invalid target type', 400);
    }

    // Validate dates if provided
    if (startDate && isNaN(Date.parse(startDate as string))) {
      return sendError(res, 'Invalid start date', 400);
    }
    if (endDate && isNaN(Date.parse(endDate as string))) {
      return sendError(res, 'Invalid end date', 400);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);

    const result = await getAdminLogs({
      page: page ? parseInt(page as string) : undefined,
      limit: safeLimit,
      adminId: adminId as string | undefined,
      actionType: actionType as AdminActionType | undefined,
      targetType: targetType as AdminTargetType | undefined,
      targetId: targetId as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      search: search as string | undefined
    });

    return sendPaginated(res, result.logs, result.pagination);
  } catch (error: unknown) {
    logger.error('Failed to fetch admin logs:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch admin logs');
  }
};

/**
 * Get logs for a specific target
 * GET /api/admin/logs/target/:targetType/:targetId
 */
export const getLogsForTarget = async (req: Request, res: Response) => {
  try {
    const { targetType, targetId } = req.params;
    const { page, limit } = req.query;

    // Validate target type
    if (!Object.values(AdminTargetType).includes(targetType as AdminTargetType)) {
      return sendError(res, 'Invalid target type', 400);
    }

    // Validate targetId
    if (!targetId) {
      return sendError(res, 'Target ID is required', 400);
    }

    const result = await getTargetLogs(
      targetType as AdminTargetType,
      targetId,
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      }
    );

    return sendPaginated(res, result.logs, result.pagination);
  } catch (error: unknown) {
    logger.error('Failed to fetch target logs:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch target logs');
  }
};

/**
 * Get admin activity summary
 * GET /api/admin/logs/summary
 */
export const getActivitySummary = async (req: Request, res: Response) => {
  try {
    const { days, adminId } = req.query;

    const summary = await getAdminActivitySummary({
      days: days ? parseInt(days as string) : undefined,
      adminId: adminId as string | undefined
    });

    return sendSuccess(res, summary);
  } catch (error: unknown) {
    logger.error('Failed to fetch activity summary:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch activity summary');
  }
};

/**
 * Get available action types (for filtering UI)
 * GET /api/admin/logs/action-types
 */
export const getActionTypes = async (_req: Request, res: Response) => {
  try {
    const actionTypes = Object.values(AdminActionType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
    }));

    return sendSuccess(res, actionTypes);
  } catch (error: unknown) {
    logger.error('Failed to fetch action types:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch action types');
  }
};

/**
 * Get available target types (for filtering UI)
 * GET /api/admin/logs/target-types
 */
export const getTargetTypes = async (_req: Request, res: Response) => {
  try {
    const targetTypes = Object.values(AdminTargetType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
    }));

    return sendSuccess(res, targetTypes);
  } catch (error: unknown) {
    logger.error('Failed to fetch target types:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch target types');
  }
};
