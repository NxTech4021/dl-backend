/**
 * Admin Best 6 Controller
 * Handles HTTP requests for admin Best 6 and standings operations
 */

import { Request, Response } from 'express';
import { Best6EventHandler } from '../../services/match/best6/best6EventHandler';
import { Best6AlgorithmService } from '../../services/match/best6/best6AlgorithmService';
import { StandingsV2Service } from '../../services/rating/standingsV2Service';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Recalculate Best 6 for a specific player
 * POST /api/admin/best6/player/:userId/recalculate
 */
export async function recalculatePlayerBest6(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { divisionId, seasonId } = req.body;

    if (!userId || !divisionId || !seasonId) {
      return sendError(res, 'Missing required fields: userId, divisionId, seasonId', 400);
    }

    // Recalculate for single player only
    const best6Service = new Best6AlgorithmService();
    await best6Service.applyBest6ToDatabase(userId, divisionId, seasonId);

    logger.info(`Admin recalculated Best 6 for player ${userId}`, {
      adminId: (req as any).user?.id,
      divisionId,
      seasonId
    });

    return sendSuccess(res, null, 'Best 6 recalculated successfully for player');
  } catch (error: any) {
    logger.error('Recalculate player Best 6 error:', error);
    return sendError(res, error.message || 'Failed to recalculate Best 6');
  }
}

/**
 * Recalculate Best 6 for entire division
 * POST /api/admin/best6/division/:divisionId/recalculate
 */
export async function recalculateDivisionBest6(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;
    const { seasonId } = req.body;

    if (!divisionId || !seasonId) {
      return sendError(res, 'Missing required fields: divisionId, seasonId', 400);
    }

    const best6Handler = new Best6EventHandler();
    await best6Handler.recalculateDivision(divisionId, seasonId);

    logger.info(`Admin recalculated Best 6 for division ${divisionId}`, {
      adminId: (req as any).user?.id,
      seasonId
    });

    return sendSuccess(res, null, 'Best 6 recalculated successfully for division');
  } catch (error: any) {
    logger.error('Recalculate division Best 6 error:', error);
    return sendError(res, error.message || 'Failed to recalculate Best 6');
  }
}

/**
 * Recalculate standings for a division
 * POST /api/admin/standings/division/:divisionId/recalculate
 */
export async function recalculateDivisionStandings(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;
    const { seasonId } = req.body;

    if (!divisionId || !seasonId) {
      return sendError(res, 'Missing required fields: divisionId, seasonId', 400);
    }

    const standingsService = new StandingsV2Service();
    await standingsService.recalculateDivisionStandings(divisionId, seasonId);

    logger.info(`Admin recalculated standings for division ${divisionId}`, {
      adminId: (req as any).user?.id,
      seasonId
    });

    return sendSuccess(res, null, 'Standings recalculated successfully');
  } catch (error: any) {
    logger.error('Recalculate division standings error:', error);
    return sendError(res, error.message || 'Failed to recalculate standings');
  }
}

/**
 * Get player's Best 6 composition
 * GET /api/admin/best6/player/:userId
 */
export async function getPlayerBest6(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { divisionId, seasonId } = req.query;

    if (!userId || !divisionId || !seasonId) {
      return sendError(res, 'Missing required query params: divisionId, seasonId', 400);
    }

    // Get all match results with Best 6 info
    const allResults = await prisma.matchResult.findMany({
      where: {
        playerId: userId,
        match: {
          divisionId: divisionId as string,
          seasonId: seasonId as string,
          status: 'COMPLETED'
        }
      },
      include: {
        match: {
          select: {
            id: true,
            matchDate: true,
            sport: true,
            matchType: true
          }
        },
        opponent: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        datePlayed: 'asc'
      }
    });

    const best6 = allResults.filter(r => r.countsForStandings);
    const notCounted = allResults.filter(r => !r.countsForStandings);

    return sendSuccess(res, {
      totalMatches: allResults.length,
      best6Count: best6.length,
      best6Results: best6.map(r => ({
        matchId: r.matchId,
        sequence: r.resultSequence,
        datePlayed: r.datePlayed,
        opponent: r.opponent.name,
        isWin: r.isWin,
        matchPoints: r.matchPoints,
        margin: r.margin,
        score: `${r.setsWon}-${r.setsLost}`,
        gamesScore: `${r.gamesWon}-${r.gamesLost}`
      })),
      notCountedResults: notCounted.map(r => ({
        matchId: r.matchId,
        datePlayed: r.datePlayed,
        opponent: r.opponent.name,
        isWin: r.isWin,
        matchPoints: r.matchPoints,
        margin: r.margin,
        score: `${r.setsWon}-${r.setsLost}`
      }))
    });
  } catch (error: any) {
    logger.error('Get player Best 6 error:', error);
    return sendError(res, error.message || 'Failed to get Best 6 composition');
  }
}

/**
 * Get division standings with Best 6 info
 * GET /api/admin/standings/division/:divisionId
 */
export async function getDivisionStandings(req: Request, res: Response) {
  try {
    const { divisionId } = req.params;

    if (!divisionId) {
      return sendError(res, 'Division ID is required', 400);
    }

    const standingsService = new StandingsV2Service();
    const standings = await standingsService.getDivisionStandings(divisionId);

    return sendSuccess(res, standings);
  } catch (error: any) {
    logger.error('Get division standings error:', error);
    return sendError(res, error.message || 'Failed to get division standings');
  }
}
