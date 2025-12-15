/**
 * Match History Controller
 * Handles HTTP requests for match history and statistics
 */

import { Request, Response } from 'express';
import { getMatchHistoryService } from '../../services/match/matchHistoryService';
import { MatchStatus, MatchType } from '@prisma/client';

const matchHistoryService = getMatchHistoryService();

/**
 * Get user's match history
 * GET /api/matches/history
 */
export const getMatchHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      divisionId,
      seasonId,
      status,
      matchType,
      fromDate,
      toDate,
      outcome,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      userId,
      outcome: outcome as 'win' | 'loss' | 'all',
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    if (divisionId) filters.divisionId = divisionId as string;
    if (seasonId) filters.seasonId = seasonId as string;
    if (status) filters.status = status as MatchStatus;
    if (matchType) filters.matchType = matchType as MatchType;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);

    const result = await matchHistoryService.getMatchHistory(filters);

    res.json(result);
  } catch (error) {
    console.error('Get Match History Error:', error);
    res.status(500).json({ error: 'Failed to retrieve match history' });
  }
};

/**
 * Get user's match statistics summary
 * GET /api/matches/stats
 */
export const getMatchStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { seasonId, divisionId } = req.query;

    const stats = await matchHistoryService.getMatchStatsSummary(
      userId,
      seasonId as string,
      divisionId as string
    );

    res.json(stats);
  } catch (error) {
    console.error('Get Match Stats Error:', error);
    res.status(500).json({ error: 'Failed to retrieve match statistics' });
  }
};

/**
 * Get head-to-head record against another player
 * GET /api/matches/head-to-head/:opponentId
 */
export const getHeadToHead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { opponentId } = req.params;
    if (!opponentId) {
      return res.status(400).json({ error: 'opponentId is required' });
    }

    const result = await matchHistoryService.getHeadToHead(userId, opponentId);
    res.json(result);
  } catch (error) {
    console.error('Get Head to Head Error:', error);
    res.status(500).json({ error: 'Failed to retrieve head-to-head record' });
  }
};

/**
 * Get upcoming matches
 * GET /api/matches/upcoming
 */
export const getUpcomingMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = '5' } = req.query;

    const matches = await matchHistoryService.getUpcomingMatches(
      userId,
      parseInt(limit as string)
    );

    res.json(matches);
  } catch (error) {
    console.error('Get Upcoming Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve upcoming matches' });
  }
};

/**
 * Get recent results
 * GET /api/matches/recent
 */
export const getRecentResults = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = '5' } = req.query;

    const matches = await matchHistoryService.getRecentResults(
      userId,
      parseInt(limit as string)
    );

    res.json(matches);
  } catch (error) {
    console.error('Get Recent Results Error:', error);
    res.status(500).json({ error: 'Failed to retrieve recent results' });
  }
};

/**
 * Get matches pending confirmation
 * GET /api/matches/pending-confirmation
 */
export const getPendingConfirmationMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = '20' } = req.query;

    const matches = await matchHistoryService.getPendingConfirmationMatches(
      userId,
      parseInt(limit as string)
    );

    res.json(matches);
  } catch (error) {
    console.error('Get Pending Confirmation Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve pending confirmation matches' });
  }
};

/**
 * Get disputed matches
 * GET /api/matches/disputed
 */
export const getDisputedMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = '20' } = req.query;

    const matches = await matchHistoryService.getDisputedMatches(
      userId,
      parseInt(limit as string)
    );

    res.json(matches);
  } catch (error) {
    console.error('Get Disputed Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve disputed matches' });
  }
};

/**
 * Get completed matches for a division (all matches, not user-specific)
 * GET /api/match/division/:divisionId/results
 */
export const getDivisionResults = async (req: Request, res: Response) => {
  try {
    const { divisionId } = req.params;
    const { limit = '3', seasonId } = req.query;

    if (!divisionId) {
      return res.status(400).json({ error: 'divisionId is required' });
    }

    const matches = await matchHistoryService.getDivisionResults(
      divisionId,
      seasonId as string | undefined,
      parseInt(limit as string)
    );

    res.json({ matches });
  } catch (error) {
    console.error('Get Division Results Error:', error);
    res.status(500).json({ error: 'Failed to retrieve division results' });
  }
};
