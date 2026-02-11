/**
 * Admin Rating Controller
 * Handles HTTP requests for admin rating operations
 */

import { Request, Response } from 'express';
import { GameType } from '@prisma/client';
import {
  adjustPlayerRating,
  getDivisionPlayerRatings,
  getDivisionRatingSummary,
  previewRecalculation,
  recalculateMatchRatings,
  recalculatePlayerRatings,
  recalculateDivisionRatings,
  recalculateSeasonRatings,
  updateRatingParameters,
  getRatingParameters,
  lockSeasonRatings,
  unlockSeasonRatings,
  getSeasonLockStatus,
  generateSeasonExport
} from '../services/rating/adminRatingService';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get all player ratings in a division
 * GET /api/admin/ratings/division/:divisionId
 */
export async function getAdminDivisionRatings(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;
    if (!divisionId) {
      return sendError(res, 'Division ID is required', 400);
    }

    const ratings = await getDivisionPlayerRatings(divisionId);

    return sendSuccess(res, ratings);
  } catch (error: any) {
    logger.error('Get admin division ratings error:', error);
    return sendError(res, error.message || 'Failed to get division ratings');
  }
}

/**
 * Get division rating summary/averages
 * GET /api/admin/ratings/division/:divisionId/summary
 */
export async function getAdminDivisionSummary(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;
    if (!divisionId) {
      return sendError(res, 'Division ID is required', 400);
    }

    const summary = await getDivisionRatingSummary(divisionId);

    return sendSuccess(res, summary);
  } catch (error: any) {
    logger.error('Get admin division summary error:', error);
    return sendError(res, error.message || 'Failed to get division summary');
  }
}

/**
 * Manually adjust a player's rating
 * POST /api/admin/ratings/adjust
 */
export async function adjustRating(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { userId, seasonId, gameType, newRating, reason } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!userId || !seasonId || !newRating) {
      return sendError(res, 'Missing required fields: userId, seasonId, newRating', 400);
    }

    await adjustPlayerRating({
      userId,
      seasonId,
      gameType: (gameType as GameType) || GameType.SINGLES,
      newRating: parseInt(newRating),
      reason: reason || 'Admin adjustment',
      adminId
    });

    // Send notification to player
    try {
      await notificationService.createNotification({
        userIds: userId,
        title: 'Rating Adjusted',
        message: `Your rating has been adjusted to ${newRating}. Reason: ${reason || 'Admin adjustment'}`,
        type: 'RATING_UPDATE',
        category: 'GENERAL'
      });
    } catch (notifError: any) {
      logger.warn('Failed to send rating adjustment notification:', notifError);
    }

    return sendSuccess(res, null, 'Rating adjusted successfully');
  } catch (error: any) {
    logger.error('Adjust rating error:', error);
    return sendError(res, error.message || 'Failed to adjust rating');
  }
}

/**
 * Recalculate all ratings for a season
 * POST /api/admin/ratings/recalculate/:seasonId
 */
export async function recalculateRatings(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { seasonId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const result = await recalculateSeasonRatings(seasonId, adminId);

    return sendSuccess(res, result, 'Ratings recalculated successfully');
  } catch (error: any) {
    logger.error('Recalculate ratings error:', error);
    return sendError(res, error.message || 'Failed to recalculate ratings');
  }
}

/**
 * Get rating parameters for a season
 * GET /api/admin/ratings/parameters/:seasonId
 */
export async function getParameters(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const params = await getRatingParameters(seasonId);

    return sendSuccess(res, params);
  } catch (error: any) {
    logger.error('Get rating parameters error:', error);
    return sendError(res, error.message || 'Failed to get rating parameters');
  }
}

/**
 * Update rating parameters for a season
 * PUT /api/admin/ratings/parameters/:seasonId
 */
export async function updateParameters(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    const params = req.body;

    const result = await updateRatingParameters({
      seasonId,
      ...params
    });

    return sendSuccess(res, { warning: result.warning }, 'Rating parameters updated successfully');
  } catch (error: any) {
    logger.error('Update rating parameters error:', error);
    return sendError(res, error.message || 'Failed to update rating parameters');
  }
}

/**
 * Lock season ratings (finalization)
 * POST /api/admin/ratings/lock/:seasonId
 */
export async function lockSeason(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { seasonId } = req.params;
    const { notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    await lockSeasonRatings({
      seasonId,
      adminId,
      notes
    });

    return sendSuccess(res, null, 'Season ratings locked successfully');
  } catch (error: any) {
    logger.error('Lock season ratings error:', error);
    return sendError(res, error.message || 'Failed to lock season ratings');
  }
}

/**
 * Unlock season ratings
 * POST /api/admin/ratings/unlock/:seasonId
 */
export async function unlockSeason(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { seasonId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    await unlockSeasonRatings(seasonId, adminId);

    return sendSuccess(res, null, 'Season ratings unlocked successfully');
  } catch (error: any) {
    logger.error('Unlock season ratings error:', error);
    return sendError(res, error.message || 'Failed to unlock season ratings');
  }
}

/**
 * Get season lock status
 * GET /api/admin/ratings/lock-status/:seasonId
 */
export async function getLockStatus(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const status = await getSeasonLockStatus(seasonId);

    return sendSuccess(res, status);
  } catch (error: any) {
    logger.error('Get lock status error:', error);
    return sendError(res, error.message || 'Failed to get lock status');
  }
}

/**
 * Preview recalculation changes
 * POST /api/admin/ratings/recalculate/preview
 */
export async function previewRecalc(req: Request, res: Response) {
  try {
    const { scope, targetId } = req.body;

    if (!scope || !targetId) {
      return sendError(res, 'Missing required fields: scope, targetId', 400);
    }

    const preview = await previewRecalculation(scope, targetId);

    return sendSuccess(res, preview);
  } catch (error: any) {
    logger.error('Preview recalculation error:', error);
    return sendError(res, error.message || 'Failed to preview recalculation');
  }
}

/**
 * Recalculate ratings for a match
 * POST /api/admin/ratings/recalculate/match/:matchId
 */
export async function recalculateMatch(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { matchId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!matchId) {
      return sendError(res, 'Match ID is required', 400);
    }

    const result = await recalculateMatchRatings(matchId, adminId);

    return sendSuccess(res, result);
  } catch (error: any) {
    logger.error('Recalculate match error:', error);
    return sendError(res, error.message || 'Failed to recalculate match');
  }
}

/**
 * Recalculate ratings for a player
 * POST /api/admin/ratings/recalculate/player/:userId
 */
export async function recalculatePlayer(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { userId } = req.params;
    const { seasonId } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!seasonId) {
      return sendError(res, 'Missing required field: seasonId', 400);
    }

    if (!userId) {
      return sendError(res, 'User ID is required', 400);
    }

    const result = await recalculatePlayerRatings(userId, seasonId, adminId);

    return sendSuccess(res, result, 'Player ratings recalculated successfully');
  } catch (error: any) {
    logger.error('Recalculate player error:', error);
    return sendError(res, error.message || 'Failed to recalculate player ratings');
  }
}

/**
 * Recalculate ratings for a division
 * POST /api/admin/ratings/recalculate/division/:divisionId
 */
export async function recalculateDivision(req: Request, res: Response) {
  try {
    const adminId = (req as any).user?.id;
    const { divisionId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!divisionId) {
      return sendError(res, 'Division ID is required', 400);
    }

    const result = await recalculateDivisionRatings(divisionId, adminId);

    return sendSuccess(res, result, 'Division ratings recalculated successfully');
  } catch (error: any) {
    logger.error('Recalculate division error:', error);
    return sendError(res, error.message || 'Failed to recalculate division ratings');
  }
}

/**
 * Generate season export
 * GET /api/admin/ratings/export/:seasonId
 */
export async function getSeasonExport(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const format = (req.query.format as 'csv' | 'json') || 'json';

    const result = await generateSeasonExport(seasonId, format);

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');

    return res.status(200).send(result.data);
  } catch (error: any) {
    logger.error('Generate export error:', error);
    return sendError(res, error.message || 'Failed to generate export');
  }
}
