import { Request, Response } from 'express';
import { LeagueStatus } from '@prisma/client';
import * as seasonService from '../services/seasonService';
import { ApiResponse } from '../utils/ApiResponse';

/**
 * Get all seasons with optional filters
 * Public endpoint
 */
export const getSeasons = async (req: Request, res: Response) => {
  try {
    const {
      name, leagueId, sportId, leagueSportId, status, startDate, endDate
    } = req.query;

    const seasons = await seasonService.getSeasons({
      name: name as string | undefined,
      leagueId: leagueId ? Number(leagueId) : undefined,
      sportId: sportId ? Number(sportId) : undefined,
      leagueSportId: leagueSportId ? Number(leagueSportId) : undefined,
      status: status as LeagueStatus | undefined,
      startDateFrom: startDate ? new Date(startDate as string) : undefined,
      endDateTo: endDate ? new Date(endDate as string) : undefined,
    });

    return res.status(200).json(
      new ApiResponse(true, 200, { seasons }, `Found ${seasons.length} season(s)`)
    );
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Error fetching seasons')
    );
  }
};

/**
 * Get season by ID
 * Public endpoint
 */
export const getSeasonById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    const season = await seasonService.getSeasonById(id);
    return res.status(200).json(
      new ApiResponse(true, 200, { season }, 'Season fetched successfully')
    );
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    console.error('Error fetching season:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Error fetching season')
    );
  }
};

/**
 * Create new season
 * Admin only
 */
export const createSeason = async (req: Request, res: Response) => {
  try {
    const {
      name, entryFee, startDate, endDate, lastRegistration,
      status, leagueSportId, leagueTypeId, createdById
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Season name is required')
      );
    }

    if (!startDate) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Start date is required')
      );
    }

    if (!endDate) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'End date is required')
      );
    }

    if (!leagueSportId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'LeagueSport ID is required')
      );
    }

    if (!leagueTypeId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'League type ID is required')
      );
    }

    if (!createdById) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Creator ID is required')
      );
    }

    const season = await seasonService.createSeason({
      name: name.trim(),
      entryFee: entryFee ? Number(entryFee) : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      lastRegistration: lastRegistration ? new Date(lastRegistration) : undefined,
      status: status as LeagueStatus,
      leagueSportId: Number(leagueSportId),
      leagueTypeId: Number(leagueTypeId),
      createdById: String(createdById),
    });

    return res.status(201).json(
      new ApiResponse(true, 201, { season }, 'Season created successfully')
    );
  } catch (error: any) {
    console.error('Error creating season:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json(
        new ApiResponse(false, 409, null, error.message)
      );
    }

    if (error.message.includes('not found') || error.message.includes('must be before')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Error creating season')
    );
  }
};

/**
 * Update season
 * Admin only
 */
export const updateSeason = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    const {
      name, entryFee, startDate, endDate, lastRegistration,
      status, leagueSportId, leagueTypeId
    } = req.body;

    const updated = await seasonService.updateSeason(id, {
      name: name?.trim(),
      entryFee: entryFee !== undefined ? Number(entryFee) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      lastRegistration: lastRegistration ? new Date(lastRegistration) : undefined,
      status: status as LeagueStatus,
      leagueSportId: leagueSportId ? Number(leagueSportId) : undefined,
      leagueTypeId: leagueTypeId ? Number(leagueTypeId) : undefined,
    });

    return res.status(200).json(
      new ApiResponse(true, 200, { season: updated }, 'Season updated successfully')
    );
  } catch (error: any) {
    console.error('Error updating season:', error);

    if (error.message.includes('not found') || 
        error.message.includes('must be before') || 
        error.message.includes('already exists') ||
        error.message.includes('Cannot update')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Error updating season')
    );
  }
};

/**
 * Delete season
 * Admin only
 */
export const deleteSeason = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    await seasonService.deleteSeason(id);
    return res.status(200).json(
      new ApiResponse(true, 200, null, 'Season deleted successfully')
    );
  } catch (error: any) {
    console.error('Error deleting season:', error);

    if (error.message.includes('not found') || error.message.includes('Cannot delete')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Error deleting season')
    );
  }
};

/**
 * Close season registration
 * Admin only
 */
export const closeSeasonRegistration = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    const season = await seasonService.closeSeasonRegistration(id);
    return res.status(200).json(
      new ApiResponse(true, 200, { season }, 'Registration closed successfully')
    );
  } catch (error: any) {
    console.error('Error closing registration:', error);
    
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Error closing registration')
    );
  }
};

/**
 * Start season
 * Admin only
 */
export const startSeason = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    const season = await seasonService.startSeason(id);
    return res.status(200).json(
      new ApiResponse(true, 200, { season }, 'Season started successfully')
    );
  } catch (error: any) {
    console.error('Error starting season:', error);
    
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Error starting season')
    );
  }
};

/**
 * Complete season
 * Admin only
 */
export const completeSeason = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid season ID')
      );
    }

    const season = await seasonService.completeSeason(id);
    return res.status(200).json(
      new ApiResponse(true, 200, { season }, 'Season completed successfully')
    );
  } catch (error: any) {
    console.error('Error completing season:', error);
    
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Error completing season')
    );
  }
};
