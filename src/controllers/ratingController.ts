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
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get current user's rating
 * GET /api/ratings/me
 */
export async function getMyRating(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { seasonId, gameType } = req.query;

    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const rating = await getPlayerRating(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES
    );

    if (!rating) {
      return sendError(res, 'No rating found', 404);
    }

    return sendSuccess(res, rating);
  } catch (error: any) {
    logger.error('Get my rating error:', error);
    return sendError(res, error.message || 'Failed to get rating');
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
      return sendError(res, 'User not authenticated', 401);
    }

    const summary = await getPlayerRatingSummary(userId);

    return sendSuccess(res, summary);
  } catch (error: any) {
    logger.error('Get my rating summary error:', error);
    return sendError(res, error.message || 'Failed to get rating summary');
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
      return sendError(res, 'User not authenticated', 401);
    }

    const history = await getPlayerRatingHistory(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES,
      parseInt(limit as string) || 50,
      sport ? (sport as SportType) : undefined
    );

    return sendSuccess(res, history);
  } catch (error: any) {
    logger.error('Get my rating history error:', error);
    return sendError(res, error.message || 'Failed to get rating history');
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
      return sendError(res, 'User not authenticated', 401);
    }

    const stats = await getPlayerRatingStats(userId);

    return sendSuccess(res, stats);
  } catch (error: any) {
    logger.error('Get my rating stats error:', error);
    return sendError(res, error.message || 'Failed to get rating stats');
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
      return sendError(res, 'User ID is required', 400);
    }

    const { seasonId, gameType } = req.query;

    const rating = await getPlayerRating(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES
    );

    if (!rating) {
      return sendError(res, 'No rating found for this player', 404);
    }

    return sendSuccess(res, rating);
  } catch (error: any) {
    logger.error('Get player rating error:', error);
    return sendError(res, error.message || 'Failed to get player rating');
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
      return sendError(res, 'User ID is required', 400);
    }

    const ratings = await getPlayerRatings(userId);

    return sendSuccess(res, ratings);
  } catch (error: any) {
    logger.error('Get all player ratings error:', error);
    return sendError(res, error.message || 'Failed to get player ratings');
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
      return sendError(res, 'User ID is required', 400);
    }

    const { seasonId, gameType, limit } = req.query;

    const history = await getPlayerRatingHistory(
      userId,
      seasonId as string | undefined,
      (gameType as GameType) || GameType.SINGLES,
      parseInt(limit as string) || 50
    );

    return sendSuccess(res, history);
  } catch (error: any) {
    logger.error('Get player rating history error:', error);
    return sendError(res, error.message || 'Failed to get player rating history');
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
      return sendError(res, 'Division ID is required', 400);
    }

    const standings = await getDivisionStandings(divisionId);

    return sendSuccess(res, standings);
  } catch (error: any) {
    logger.error('Get division standings error:', error);
    return sendError(res, error.message || 'Failed to get division standings');
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
      return sendError(res, 'User not authenticated', 401);
    }

    if (!divisionId) {
      return sendError(res, 'Division ID is required', 400);
    }

    const standing = await getPlayerStanding(userId, divisionId as string);

    if (!standing) {
      return sendError(res, 'No standing found in this division', 404);
    }

    return sendSuccess(res, standing);
  } catch (error: any) {
    logger.error('Get my standing error:', error);
    return sendError(res, error.message || 'Failed to get standing');
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
      return sendError(res, 'User ID and Division ID are required', 400);
    }

    const standing = await getPlayerStanding(userId, divisionId);

    if (!standing) {
      return sendError(res, 'No standing found for this player in this division', 404);
    }

    return sendSuccess(res, standing);
  } catch (error: any) {
    logger.error('Get player standing error:', error);
    return sendError(res, error.message || 'Failed to get player standing');
  }
}
