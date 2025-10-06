import { Request, Response } from 'express';
import * as leagueService from '../services/leagueService';
import { Statuses, PrismaClient, Prisma } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';

const prisma = new PrismaClient();
/**
 * Get all leagues with optional filters
 * Public endpoint
 */
export const getLeagues = async (req: Request, res: Response) => {
  try {
    const { name, sportId, location, status } = req.query;

    const filters = {
      name: name as string | undefined,
      sportId: sportId ? Number(sportId) : undefined,
      location: location as string | undefined,
      status: status as string | undefined,
    };

    const leagues = await leagueService.getAllLeagues(filters);
    
    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { leagues },
        `Found ${leagues.length} league(s)`
      )
    );
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching leagues")
    );
  }
};


export const getLeaguePlayerCount = async (leagueId: string) => {
  return prisma.leagueMembership.count({
    where: { leagueId }
  });
};

// export const getLeagueById = async (req: Request, res: Response) => {
//   try {
//     const id = parseInt(req.params.id, 10);
    
//     if (isNaN(id)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid league ID")
//       );
//     }

//     const league = await leagueService.getLeagueById(id);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, { league }, "League fetched successfully")
//     );
//   } catch (error: any) {
//     console.error("Error fetching league:", error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     }
    
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching league")
//     );
//   }
// };


export const createLeague = async (req: Request, res: Response) => {
  try {
   const { name, location, description, status, sportType, registrationType, gameType, sponsorships, existingSponsorshipIds } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name is required")
      );
    }

    if (name.length > 200) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name must be 200 characters or less")
      );
    }

    if (!location || !location.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Location is required")
      );
    }

    if (status && !Object.values(Statuses).includes(status)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Invalid status. Must be one of: ${Object.values(Statuses).join(', ')}`
        )
      );
    }

     const newLeague = await leagueService.createLeague({
      name,
      location,
      description,
      status,
      sportType,
      registrationType,
      gameType,
      sponsorships: sponsorships?.map((s: any) => ({ ...s, createdById: req.user?.id })),
      existingSponsorshipIds
    });


    return res.status(201).json(
      new ApiResponse(
        true,
        201,
        { league: newLeague },
        "League created successfully"
      )
    );
  } catch (error: any) {
    console.error("Error creating league:", error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json(
        new ApiResponse(false, 409, null, error.message)
      );
    }
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json(
          new ApiResponse(false, 409, null, "A league with this name already exists")
        );
      }
    }
    
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating league")
    );
  }
};

/**
 * Update league
 * Admin only
 */
export const updateLeague = async (req: Request, res: Response) => {
  try {
    const id = req.params.id; // STRING now
    const { name, location, description, status, sponsorships } = req.body;
    
    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid league ID")
      );
    }

  

 // Validation
    if (name !== undefined && (!name.trim() || name.length > 255)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name must be between 1 and 255 characters")
      );
    }
    if (location !== undefined && !location.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Location cannot be empty")
      );
    }
    if (status && !Object.values(Statuses).includes(status)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Invalid status. Must be one of: ${Object.values(Statuses).join(', ')}`
        )
      );
    }

   const updatedLeague = await leagueService.updateLeague(id, {
      name,
      location,
      description,
      status: status as Statuses,
      
      sponsorships: sponsorships?.map((s: any) => ({
        id: s.id, 
        companyId: s.companyId,
        packageTier: s.packageTier,
        contractAmount: s.contractAmount,
        sponsoredName: s.sponsoredName,
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive ?? true,
        createdById: req.user?.id
      })),
    });

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { league: updatedLeague },
        "League updated successfully"
      )
    );
  } catch (error: any) {
    console.error("Error updating league:", error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json(
        new ApiResponse(false, 409, null, error.message)
      );
    }
    
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating league")
    );
  }
};

export const deleteLeague = async (req: Request, res: Response) => {
  try {
    const id = req.params.id; 

    if (!id || typeof id !== 'string') {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid league ID")
      );
    }

    await leagueService.deleteLeague(id);

    return res.status(200).json(
      new ApiResponse(true, 200, null, "League deleted successfully")
    );
  } catch (error: any) {
    console.error("Error deleting league:", error);

    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }

    if (error.message.includes('Cannot delete')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error deleting league")
    );
  }
};
/**
 * Get leagues offering a specific sport
 * Public endpoint - for user browsing by sport
 */
// export const getLeaguesBySport = async (req: Request, res: Response) => {
//   try {
//     const sportId = parseInt(req.params.sportId, 10);
//     const { location } = req.query;
    
//     if (isNaN(sportId)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid sport ID")
//       );
//     }

//     const leagues = await leagueService.getLeaguesBySport(
//       sportId,
//       location as string | undefined
//     );
    
//     return res.status(200).json(
//       new ApiResponse(
//         true,
//         200,
//         { leagues },
//         `Found ${leagues.length} league(s) offering this sport`
//       )
//     );
//   } catch (error) {
//     console.error("Error fetching leagues by sport:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching leagues")
//     );
//   }
// };

/**
 * Add sport to league
 * Admin only - POST /api/league/:leagueId/sport
 */
// export const addSportToLeague = async (req: Request, res: Response) => {
//   try {
//     const leagueId = parseInt(req.params.leagueId, 10);
//     const { sportId, isActive, sortOrder } = req.body;

//     if (isNaN(leagueId)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid league ID")
//       );
//     }

//     if (!sportId || isNaN(parseInt(sportId))) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Sport ID is required and must be a number")
//       );
//     }

//     const leagueSport = await leagueService.addSportToLeague({
//       leagueId,
//       sportId: parseInt(sportId),
//       isActive,
//       sortOrder
//     });

//     return res.status(201).json(
//       new ApiResponse(
//         true,
//         201,
//         { leagueSport },
//         "Sport added to league successfully"
//       )
//     );
//   } catch (error: any) {
//     console.error("Error adding sport to league:", error);

//     if (error.message.includes('not found')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     }

//     if (error.message.includes('already added')) {
//       return res.status(409).json(
//         new ApiResponse(false, 409, null, error.message)
//       );
//     }

//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error adding sport to league")
//     );
//   }
// };

/**
 * Get sports at a league
 * Public endpoint - GET /api/league/:leagueId/sport
 */
// export const getSportsAtLeague = async (req: Request, res: Response) => {
//   try {
//     const leagueId = parseInt(req.params.leagueId, 10);
//     const includeInactive = req.query.includeInactive === 'true';

//     if (isNaN(leagueId)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid league ID")
//       );
//     }

//     const sports = await leagueService.getSportsAtLeague(
//       leagueId,
//       includeInactive
//     );

//     return res.status(200).json(
//       new ApiResponse(
//         true,
//         200,
//         { sports },
//         `Found ${sports.length} sport(s) at this league`
//       )
//     );
//   } catch (error) {
//     console.error("Error fetching sports at league:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching sports")
//     );
//   }
// };

/**
 * Update LeagueSport (activate/deactivate, reorder)
 * Admin only - PUT /api/league/:leagueId/sport/:sportId
 */
// export const updateLeagueSport = async (req: Request, res: Response) => {
//   try {
//     const leagueId = parseInt(req.params.leagueId, 10);
//     const sportId = parseInt(req.params.sportId, 10);
//     const { isActive, sortOrder } = req.body;

//     if (isNaN(leagueId) || isNaN(sportId)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid league ID or sport ID")
//       );
//     }

//     if (isActive !== undefined && typeof isActive !== 'boolean') {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "isActive must be a boolean")
//       );
//     }

//     if (sortOrder !== undefined && isNaN(parseInt(sortOrder))) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "sortOrder must be a number")
//       );
//     }

//     const leagueSport = await leagueService.updateLeagueSport(
//       leagueId,
//       sportId,
//       { 
//         isActive, 
//         sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined 
//       }
//     );

//     return res.status(200).json(
//       new ApiResponse(
//         true,
//         200,
//         { leagueSport },
//         "LeagueSport updated successfully"
//       )
//     );
//   } catch (error: any) {
//     console.error("Error updating LeagueSport:", error);

//     if (error.message.includes('not offered')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     }

//     if (error.message.includes('Cannot deactivate')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }

//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error updating LeagueSport")
//     );
//   }
// };

/**
 * Remove sport from league
 * Admin only - DELETE /api/league/:leagueId/sport/:sportId
 */
// export const removeSportFromLeague = async (req: Request, res: Response) => {
//   try {
//     const leagueId = parseInt(req.params.leagueId, 10);
//     const sportId = parseInt(req.params.sportId, 10);

//     if (isNaN(leagueId) || isNaN(sportId)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, "Invalid league ID or sport ID")
//       );
//     }

//     await leagueService.removeSportFromLeague(leagueId, sportId);

//     return res.status(200).json(
//       new ApiResponse(true, 200, null, "Sport removed from league successfully")
//     );
//   } catch (error: any) {
//     console.error("Error removing sport from league:", error);

//     if (error.message.includes('not offered')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     }

//     if (error.message.includes('Cannot remove')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }

//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error removing sport from league")
//     );
//   }
// };
