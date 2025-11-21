/**
 * Bracket Controller
 * Handles HTTP requests for bracket management (AS2)
 */

import { Request, Response } from 'express';
import { getBracketService } from '../../services/admin/bracketService';
import { logger } from '../../utils/logger';

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
      return res.status(400).json({
        success: false,
        message: 'Season ID, division ID, and bracket name are required'
      });
    }

    const bracket = await bracketService.createBracket({
      seasonId,
      divisionId,
      bracketName,
      bracketType,
      seedingSource,
      numPlayers,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    return res.status(201).json({
      success: true,
      message: 'Bracket created successfully',
      data: bracket
    });
  } catch (error: any) {
    logger.error('Create bracket error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create bracket'
    });
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
      return res.status(400).json({ error: 'Bracket ID is required' });
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { seedingSource, manualSeeds } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin ID required'
      });
    }

    const result = await bracketService.seedBracket({
      bracketId,
      adminId,
      seedingSource,
      manualSeeds
    });

    return res.status(200).json({
      success: true,
      message: 'Bracket seeded successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Seed bracket error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to seed bracket'
    });
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
      return res.status(400).json({ error: 'Bracket ID is required' });
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { notifyPlayers } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin ID required'
      });
    }

    const bracket = await bracketService.publishBracket({
      bracketId,
      adminId,
      notifyPlayers
    });

    return res.status(200).json({
      success: true,
      message: 'Bracket published successfully',
      data: bracket
    });
  } catch (error: any) {
    logger.error('Publish bracket error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to publish bracket'
    });
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
      return res.status(400).json({ error: 'Bracket match ID is required' });
    }

    const adminId = (req as any).user?.id || req.body.adminId;
    const { scheduledTime, courtLocation, player1Id, player2Id } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin ID required'
      });
    }

    const match = await bracketService.updateBracketMatch({
      bracketMatchId,
      adminId,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      courtLocation,
      player1Id,
      player2Id
    });

    return res.status(200).json({
      success: true,
      message: 'Bracket match updated successfully',
      data: match
    });
  } catch (error: any) {
    logger.error('Update bracket match error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update bracket match'
    });
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
      return res.status(400).json({ error: 'Bracket match ID is required' });
    }

    const { winnerId, matchId } = req.body;

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Winner ID is required'
      });
    }

    const bracket = await bracketService.recordMatchResult(bracketMatchId, winnerId, matchId);

    return res.status(200).json({
      success: true,
      message: 'Match result recorded successfully',
      data: bracket
    });
  } catch (error: any) {
    logger.error('Record bracket match result error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to record match result'
    });
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
      return res.status(400).json({ error: 'Bracket ID is required' });
    }

    const bracket = await bracketService.getBracketById(bracketId);

    if (!bracket) {
      return res.status(404).json({
        success: false,
        message: 'Bracket not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: bracket
    });
  } catch (error: any) {
    logger.error('Get bracket error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get bracket'
    });
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
      return res.status(400).json({ error: 'Season ID is required' });
    }

    const brackets = await bracketService.getBracketsBySeason(seasonId);

    return res.status(200).json({
      success: true,
      data: brackets
    });
  } catch (error: any) {
    logger.error('Get brackets by season error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get brackets'
    });
  }
}
