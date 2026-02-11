/**
 * Bracket Controller
 * Handles HTTP requests for bracket management (AS2)
 */

import { Request, Response } from 'express';
import { getBracketService } from '../../services/admin/bracketService';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError } from '../../utils/response';

const bracketService = getBracketService();

/**
 * Create a new bracket
 * POST /api/admin/brackets
 */
export async function createBracket(req: Request, res: Response) {
  try {
    const {
      seasonId,
      divisionId,
      bracketName,
      bracketType,
      seedingSource,
      numPlayers,
      startDate,
      endDate
    } = req.body;

    if (!seasonId || !divisionId || !bracketName) {
      return sendError(res, 'Season ID, division ID, and bracket name are required', 400);
    }

    const createInput: any = {
      seasonId,
      divisionId,
      bracketName,
      bracketType,
      seedingSource,
      numPlayers
    };
    if (startDate) createInput.startDate = new Date(startDate);
    if (endDate) createInput.endDate = new Date(endDate);

    const bracket = await bracketService.createBracket(createInput);

    return sendSuccess(res, bracket, 'Bracket created successfully', 201);
  } catch (error: any) {
    logger.error('Create bracket error:', error);
    return sendError(res, error.message || 'Failed to create bracket', 400);
  }
}

/**
 * Seed a bracket
 * POST /api/admin/brackets/:id/seed
 */
export async function seedBracket(req: Request, res: Response) {
  try {
    const { id: bracketId } = req.params;
    if (!bracketId) {
      return sendError(res, 'Bracket ID is required', 400);
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { seedingSource, manualSeeds } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin ID required', 401);
    }

    const result = await bracketService.seedBracket({
      bracketId,
      adminId,
      seedingSource,
      manualSeeds
    });

    return sendSuccess(res, result, 'Bracket seeded successfully');
  } catch (error: any) {
    logger.error('Seed bracket error:', error);
    return sendError(res, error.message || 'Failed to seed bracket', 400);
  }
}

/**
 * Publish a bracket
 * POST /api/admin/brackets/:id/publish
 */
export async function publishBracket(req: Request, res: Response) {
  try {
    const { id: bracketId } = req.params;
    if (!bracketId) {
      return sendError(res, 'Bracket ID is required', 400);
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { notifyPlayers } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin ID required', 401);
    }

    const bracket = await bracketService.publishBracket({
      bracketId,
      adminId,
      notifyPlayers
    });

    return sendSuccess(res, bracket, 'Bracket published successfully');
  } catch (error: any) {
    logger.error('Publish bracket error:', error);
    return sendError(res, error.message || 'Failed to publish bracket', 400);
  }
}

/**
 * Update bracket match
 * PUT /api/admin/brackets/match/:id
 */
export async function updateBracketMatch(req: Request, res: Response) {
  try {
    const { id: bracketMatchId } = req.params;
    if (!bracketMatchId) {
      return sendError(res, 'Bracket match ID is required', 400);
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { scheduledTime, courtLocation, player1Id, player2Id } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin ID required', 401);
    }

    const updateInput: any = { bracketMatchId, adminId };
    if (scheduledTime) updateInput.scheduledTime = new Date(scheduledTime);
    if (courtLocation) updateInput.courtLocation = courtLocation;
    if (player1Id) updateInput.player1Id = player1Id;
    if (player2Id) updateInput.player2Id = player2Id;

    const match = await bracketService.updateBracketMatch(updateInput);

    return sendSuccess(res, match, 'Bracket match updated successfully');
  } catch (error: any) {
    logger.error('Update bracket match error:', error);
    return sendError(res, error.message || 'Failed to update bracket match', 400);
  }
}

/**
 * Record bracket match result
 * POST /api/admin/brackets/match/:id/result
 */
export async function recordBracketMatchResult(req: Request, res: Response) {
  try {
    const { id: bracketMatchId } = req.params;
    if (!bracketMatchId) {
      return sendError(res, 'Bracket match ID is required', 400);
    }

    const { winnerId, matchId } = req.body;

    if (!winnerId) {
      return sendError(res, 'Winner ID is required', 400);
    }

    const bracket = await bracketService.recordMatchResult(bracketMatchId, winnerId, matchId);

    return sendSuccess(res, bracket, 'Match result recorded successfully');
  } catch (error: any) {
    logger.error('Record bracket match result error:', error);
    return sendError(res, error.message || 'Failed to record match result', 400);
  }
}

/**
 * Get bracket by ID
 * GET /api/admin/brackets/:id
 */
export async function getBracketById(req: Request, res: Response) {
  try {
    const { id: bracketId } = req.params;
    if (!bracketId) {
      return sendError(res, 'Bracket ID is required', 400);
    }

    const bracket = await bracketService.getBracketById(bracketId);

    if (!bracket) {
      return sendError(res, 'Bracket not found', 404);
    }

    return sendSuccess(res, bracket);
  } catch (error: any) {
    logger.error('Get bracket error:', error);
    return sendError(res, error.message || 'Failed to get bracket');
  }
}

/**
 * Get brackets by season
 * GET /api/admin/brackets/season/:seasonId
 */
export async function getBracketsBySeason(req: Request, res: Response) {
  try {
    const { seasonId } = req.params;
    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const brackets = await bracketService.getBracketsBySeason(seasonId);

    return sendSuccess(res, brackets);
  } catch (error: any) {
    logger.error('Get brackets by season error:', error);
    return sendError(res, error.message || 'Failed to get brackets');
  }
}
