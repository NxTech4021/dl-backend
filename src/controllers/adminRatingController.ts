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
import { sendNotification } from '../services/notificationService';
import { logger } from '../utils/logger';

/**
 * Get all player ratings in a division
 * GET /api/admin/ratings/division/:divisionId
 */
export async function getAdminDivisionRatings(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;

    const ratings = await getDivisionPlayerRatings(divisionId);

    return res.status(200).json({
      success: true,
      data: ratings
    });
  } catch (error: any) {
    logger.error('Get admin division ratings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get division ratings'
    });
  }
}

/**
 * Get division rating summary/averages
 * GET /api/admin/ratings/division/:divisionId/summary
 */
export async function getAdminDivisionSummary(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;

    const summary = await getDivisionRatingSummary(divisionId);

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Get admin division summary error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get division summary'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!userId || !seasonId || !newRating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, seasonId, newRating'
      });
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
      await sendNotification({
        userId,
        title: 'Rating Adjusted',
        message: `Your rating has been adjusted to ${newRating}. Reason: ${reason || 'Admin adjustment'}`,
        type: 'RATING_UPDATE'
      });
    } catch (notifError) {
      logger.warn('Failed to send rating adjustment notification:', notifError);
    }

    return res.status(200).json({
      success: true,
      message: 'Rating adjusted successfully'
    });
  } catch (error: any) {
    logger.error('Adjust rating error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to adjust rating'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const result = await recalculateSeasonRatings(seasonId, adminId);

    return res.status(200).json({
      success: true,
      message: 'Ratings recalculated successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Recalculate ratings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to recalculate ratings'
    });
  }
}

/**
 * Get rating parameters for a season
 * GET /api/admin/ratings/parameters/:seasonId
 */
export async function getParameters(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;

    const params = await getRatingParameters(seasonId);

    return res.status(200).json({
      success: true,
      data: params
    });
  } catch (error: any) {
    logger.error('Get rating parameters error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get rating parameters'
    });
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

    return res.status(200).json({
      success: true,
      message: 'Rating parameters updated successfully',
      warning: result.warning
    });
  } catch (error: any) {
    logger.error('Update rating parameters error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update rating parameters'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    await lockSeasonRatings({
      seasonId,
      adminId,
      notes
    });

    return res.status(200).json({
      success: true,
      message: 'Season ratings locked successfully'
    });
  } catch (error: any) {
    logger.error('Lock season ratings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to lock season ratings'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    await unlockSeasonRatings(seasonId, adminId);

    return res.status(200).json({
      success: true,
      message: 'Season ratings unlocked successfully'
    });
  } catch (error: any) {
    logger.error('Unlock season ratings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to unlock season ratings'
    });
  }
}

/**
 * Get season lock status
 * GET /api/admin/ratings/lock-status/:seasonId
 */
export async function getLockStatus(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;

    const status = await getSeasonLockStatus(seasonId);

    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Get lock status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get lock status'
    });
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
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: scope, targetId'
      });
    }

    const preview = await previewRecalculation(scope, targetId);

    return res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error: any) {
    logger.error('Preview recalculation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to preview recalculation'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const result = await recalculateMatchRatings(matchId, adminId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Recalculate match error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to recalculate match'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: seasonId'
      });
    }

    const result = await recalculatePlayerRatings(userId, seasonId, adminId);

    return res.status(200).json({
      success: true,
      message: 'Player ratings recalculated successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Recalculate player error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to recalculate player ratings'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const result = await recalculateDivisionRatings(divisionId, adminId);

    return res.status(200).json({
      success: true,
      message: 'Division ratings recalculated successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Recalculate division error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to recalculate division ratings'
    });
  }
}

/**
 * Generate season export
 * GET /api/admin/ratings/export/:seasonId
 */
export async function getSeasonExport(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    const format = (req.query.format as 'csv' | 'json') || 'json';

    const result = await generateSeasonExport(seasonId, format);

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');

    return res.status(200).send(result.data);
  } catch (error: any) {
    logger.error('Generate export error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate export'
    });
  }
}
