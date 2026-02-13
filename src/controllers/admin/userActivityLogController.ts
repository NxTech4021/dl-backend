/**
 * User Activity Log Controller
 * Handles HTTP requests for user activity log operations (admin-facing).
 */

import { Request, Response } from 'express';
import { getUserActivityLogs } from '../../services/userActivityLogService';
import { UserActionType, UserTargetType } from '@prisma/client';
import { sendError, sendPaginated } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Get user activity logs with filtering and pagination
 * GET /api/admin/user-activity
 */
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { page, limit, userId, actionType, targetType, targetId, startDate, endDate } = req.query;

    // Validate actionType if provided
    if (actionType && !Object.values(UserActionType).includes(actionType as UserActionType)) {
      return sendError(res, 'Invalid action type', 400);
    }

    // Validate targetType if provided
    if (targetType && !Object.values(UserTargetType).includes(targetType as UserTargetType)) {
      return sendError(res, 'Invalid target type', 400);
    }

    // Validate dates if provided
    if (startDate && isNaN(Date.parse(startDate as string))) {
      return sendError(res, 'Invalid start date', 400);
    }
    if (endDate && isNaN(Date.parse(endDate as string))) {
      return sendError(res, 'Invalid end date', 400);
    }

    const result = await getUserActivityLogs({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      userId: userId as string | undefined,
      actionType: actionType as UserActionType | undefined,
      targetType: targetType as UserTargetType | undefined,
      targetId: targetId as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    return sendPaginated(res, result.data, result.pagination);
  } catch (error: unknown) {
    logger.error('Failed to fetch user activity logs:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch user activity logs');
  }
};

/**
 * Get user activity logs for a specific user
 * GET /api/admin/user-activity/user/:userId
 */
export const getActivityForUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;

    if (!userId) {
      return sendError(res, 'User ID is required', 400);
    }

    const result = await getUserActivityLogs({
      userId,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return sendPaginated(res, result.data, result.pagination);
  } catch (error: unknown) {
    logger.error('Failed to fetch user activity for user:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch user activity');
  }
};

/**
 * Get user activity logs for a specific target
 * GET /api/admin/user-activity/target/:targetType/:targetId
 */
export const getActivityForTarget = async (req: Request, res: Response) => {
  try {
    const { targetType, targetId } = req.params;
    const { page, limit } = req.query;

    // Validate target type
    if (!Object.values(UserTargetType).includes(targetType as UserTargetType)) {
      return sendError(res, 'Invalid target type', 400);
    }

    if (!targetId) {
      return sendError(res, 'Target ID is required', 400);
    }

    const result = await getUserActivityLogs({
      targetType: targetType as UserTargetType,
      targetId,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return sendPaginated(res, result.data, result.pagination);
  } catch (error: unknown) {
    logger.error('Failed to fetch user activity for target:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch user activity for target');
  }
};
