/**
 * Admin Achievement Controller
 * Handles CRUD operations for achievement definitions and manual grants.
 */

import { Request, Response } from 'express';
import { AchievementCategory, AchievementScope, TierType } from '@prisma/client';
import {
  getAchievementsAdmin,
  getAchievementById,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  grantAchievement,
} from '../../services/achievement/achievementCrudService';
import { getEvaluatorKeys } from '../../services/achievement/achievementDefinitions';
import { finalizeSeasonAchievements } from '../../services/achievement/achievementEvaluationService';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * GET /api/admin/achievements
 * List all achievements with unlock stats.
 */
export async function getAchievements(req: Request, res: Response) {
  try {
    const { category, tier, isActive, search } = req.query;

    const achievements = await getAchievementsAdmin({
      category: category as AchievementCategory | undefined,
      tier: tier as TierType | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string | undefined,
    });

    return sendSuccess(res, achievements);
  } catch (error: unknown) {
    logger.error('Failed to get achievements:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to fetch achievements');
  }
}

/**
 * GET /api/admin/achievements/evaluators
 * Get available evaluator keys for the create/edit form.
 */
export async function getEvaluators(_req: Request, res: Response) {
  try {
    const keys = getEvaluatorKeys();
    return sendSuccess(res, keys);
  } catch (error: unknown) {
    logger.error('Failed to get evaluator keys:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to fetch evaluator keys');
  }
}

/**
 * GET /api/admin/achievements/:id
 * Get a single achievement with stats.
 */
export async function getAchievementDetail(req: Request, res: Response) {
  try {
    const id = req.params.id!;
    const achievement = await getAchievementById(id);

    if (!achievement) {
      return sendError(res, 'Achievement not found', 404);
    }

    return sendSuccess(res, achievement);
  } catch (error: unknown) {
    logger.error('Failed to get achievement:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to fetch achievement');
  }
}

/**
 * POST /api/admin/achievements
 * Create a new achievement definition.
 */
export async function createAchievementHandler(req: Request, res: Response) {
  try {
    const { title, description, icon, category, tier, scope, evaluatorKey, threshold, sportFilter, gameTypeFilter, sortOrder, isHidden, points } = req.body;

    if (!title || !description || !icon || !category || !evaluatorKey) {
      return sendError(res, 'Missing required fields: title, description, icon, category, evaluatorKey', 400);
    }

    // Validate evaluator key exists
    const validKeys = getEvaluatorKeys();
    if (!validKeys.includes(evaluatorKey)) {
      return sendError(res, `Invalid evaluatorKey. Valid keys: ${validKeys.join(', ')}`, 400);
    }

    const achievement = await createAchievement({
      title,
      description,
      icon,
      category: category as AchievementCategory,
      tier: tier as TierType | undefined,
      scope: scope as AchievementScope | undefined,
      evaluatorKey,
      threshold,
      sportFilter: sportFilter || null,
      gameTypeFilter: gameTypeFilter || null,
      sortOrder,
      isHidden,
      points,
    });

    return sendSuccess(res, achievement, 'Achievement created successfully', 201);
  } catch (error: unknown) {
    logger.error('Failed to create achievement:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to create achievement');
  }
}

/**
 * PUT /api/admin/achievements/:id
 * Update an achievement definition.
 */
export async function updateAchievementHandler(req: Request, res: Response) {
  try {
    const id = req.params.id!;

    // Validate evaluator key if provided
    if (req.body.evaluatorKey) {
      const validKeys = getEvaluatorKeys();
      if (!validKeys.includes(req.body.evaluatorKey)) {
        return sendError(res, `Invalid evaluatorKey. Valid keys: ${validKeys.join(', ')}`, 400);
      }
    }

    const achievement = await updateAchievement(id, req.body);
    return sendSuccess(res, achievement, 'Achievement updated successfully');
  } catch (error: unknown) {
    logger.error('Failed to update achievement:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to update achievement');
  }
}

/**
 * DELETE /api/admin/achievements/:id
 * Soft-delete (deactivate) an achievement.
 */
export async function deleteAchievementHandler(req: Request, res: Response) {
  try {
    const id = req.params.id!;
    await deleteAchievement(id);
    return sendSuccess(res, null, 'Achievement deactivated successfully');
  } catch (error: unknown) {
    logger.error('Failed to delete achievement:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to delete achievement');
  }
}

/**
 * POST /api/admin/achievements/:id/grant
 * Manually grant an achievement to a user.
 */
export async function grantAchievementHandler(req: Request, res: Response) {
  try {
    const id = req.params.id!;
    const { userId } = req.body;

    if (!userId) {
      return sendError(res, 'Missing required field: userId', 400);
    }

    const userAchievement = await grantAchievement(id, userId);
    return sendSuccess(res, userAchievement, 'Achievement granted successfully');
  } catch (error: unknown) {
    logger.error('Failed to grant achievement:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to grant achievement');
  }
}

/**
 * POST /api/admin/achievements/finalize-season/:seasonId
 * Trigger season achievement evaluation for all players in a season.
 */
export async function finalizeSeasonAchievementsHandler(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;

    if (!seasonId) {
      return sendError(res, 'Missing required param: seasonId', 400);
    }

    // Fire-and-forget — returns immediately
    void finalizeSeasonAchievements(seasonId);

    return sendSuccess(res, { seasonId }, 'Season achievement evaluation started');
  } catch (error: unknown) {
    logger.error('Failed to finalize season achievements:', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Failed to finalize season achievements');
  }
}
