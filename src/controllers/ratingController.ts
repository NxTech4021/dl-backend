/**
 * Rating Controller
 * Handles HTTP requests for player ratings and standings
 */

import { Request, Response } from 'express';
import { GameType, SportType } from '@prisma/client';
import {
  getPlayerRating,
  getPlayerRatings,
  getPlayerRatingHistory,
  getPlayerRatingSummary,
  getPlayerRatingStats
} from '../services/rating/playerRatingService';
import {
  getDivisionStandings,
  getPlayerStanding
} from '../services/rating/standingsCalculationService';
import { logger } from '../utils/logger';

/**
 * Get current user's rating
 * GET /api/ratings/me
 */
export async function getMyRating(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { seasonId, gameType } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const rating = await getPlayerRating(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES
    );

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'No rating found'
      });
    }

    return res.status(200).json({
      success: true,
      data: rating
    });
  } catch (error: any) {
    logger.error('Get my rating error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get rating'
    });
  }
}

/**
 * Get current user's rating summary (singles + doubles)
 * GET /api/ratings/me/summary
 */
export async function getMyRatingSummary(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const summary = await getPlayerRatingSummary(userId);

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Get my rating summary error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get rating summary'
    });
  }
}

/**
 * Get current user's rating history
 * GET /api/ratings/me/history
 */
export async function getMyRatingHistory(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { seasonId, gameType, limit, sport } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const history = await getPlayerRatingHistory(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES,
      parseInt(limit as string) || 50,
      sport ? (sport as SportType) : undefined
    );

    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Get my rating history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get rating history'
    });
  }
}

/**
 * Get current user's rating stats
 * GET /api/ratings/me/stats
 */
export async function getMyRatingStats(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const stats = await getPlayerRatingStats(userId);

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Get my rating stats error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get rating stats'
    });
  }
}

/**
 * Get a player's rating (public)
 * GET /api/ratings/:userId
 */
export async function getPlayerRatingById(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { seasonId, gameType } = req.query;

    const rating = await getPlayerRating(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES
    );

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'No rating found for this player'
      });
    }

    return res.status(200).json({
      success: true,
      data: rating
    });
  } catch (error: any) {
    logger.error('Get player rating error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get player rating'
    });
  }
}

/**
 * Get all ratings for a player
 * GET /api/ratings/:userId/all
 */
export async function getAllPlayerRatings(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const ratings = await getPlayerRatings(userId);

    return res.status(200).json({
      success: true,
      data: ratings
    });
  } catch (error: any) {
    logger.error('Get all player ratings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get player ratings'
    });
  }
}

/**
 * Get a player's rating history
 * GET /api/ratings/:userId/history
 */
export async function getPlayerRatingHistoryById(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { seasonId, gameType, limit } = req.query;

    const history = await getPlayerRatingHistory(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES,
      parseInt(limit as string) || 50
    );

    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Get player rating history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get player rating history'
    });
  }
}

/**
 * Get division standings (leaderboard)
 * GET /api/standings/division/:divisionId
 */
export async function getDivisionStandingsHandler(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;
    if (!divisionId) {
      return res.status(400).json({ error: 'Division ID is required' });
    }

    const standings = await getDivisionStandings(divisionId);

    return res.status(200).json({
      success: true,
      data: standings
    });
  } catch (error: any) {
    logger.error('Get division standings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get division standings'
    });
  }
}

/**
 * Get current user's standing in active division
 * GET /api/standings/me
 */
export async function getMyStanding(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { divisionId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!divisionId) {
      return res.status(400).json({
        success: false,
        message: 'Division ID is required'
      });
    }

    const standing = await getPlayerStanding(userId, divisionId as string);

    if (!standing) {
      return res.status(404).json({
        success: false,
        message: 'No standing found in this division'
      });
    }

    return res.status(200).json({
      success: true,
      data: standing
    });
  } catch (error: any) {
    logger.error('Get my standing error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get standing'
    });
  }
}

/**
 * Get a player's standing in a division
 * GET /api/standings/:userId/division/:divisionId
 */
export async function getPlayerStandingHandler(req: Request, res: Response) {
  try {
    const { userId, divisionId } = req.params;
    if (!userId || !divisionId) {
      return res.status(400).json({ error: 'User ID and Division ID are required' });
    }

    const standing = await getPlayerStanding(userId, divisionId);

    if (!standing) {
      return res.status(404).json({
        success: false,
        message: 'No standing found for this player in this division'
      });
    }

    return res.status(200).json({
      success: true,
      data: standing
    });
  } catch (error: any) {
    logger.error('Get player standing error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get player standing'
    });
  }
}
