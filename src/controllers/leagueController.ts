import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { leagueService } from "../services/leagueService";
import { sportLocationService } from "../services/sportLocationService";
import {
  validateCreateLeague,
  validateUpdateLeague,
  validateListLeagues,
  validateLeagueSettings,
  validatePreviewLeagueSettings,
  validateCreateLeagueJoinRequest,
  validateUpdateLeagueJoinRequestStatus,
  validateCreateLeagueTemplate,
  validateBulkCreateLeagues,
  validateCopyLeagueSettings,
  ValidationResult,
} from "../validators/leagueValidation";

// Helper function to get admin ID from request
function getAdminId(req: Request): string | undefined {
  return (req as any).adminId || (req as any).user?.id;
}

// CRUD Operations for Leagues
export const createLeague = async (req: Request, res: Response) => {
  try {
    const validation = validateCreateLeague(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const { sport, location } = req.body;

    // Validate sport and location
    const sportLocationValidation = await sportLocationService.validateLeagueInputs(sport, location);
    if (!sportLocationValidation.isValid) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, sportLocationValidation.errors.join('; '))
      );
    }

    const adminId = getAdminId(req);
    const league = await leagueService.createLeague(req.body, adminId);

    return res.status(201).json(
      new ApiResponse(true, 201, { league }, "League created successfully.")
    );
  } catch (error) {
    console.error("createLeague error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to create league.")
    );
  }
};

export const listLeagues = async (req: Request, res: Response) => {
  try {
    const validation = validateListLeagues(req.query);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const result = await leagueService.getLeagues(req.query);

    return res.json(new ApiResponse(true, 200, result));
  } catch (error) {
    console.error("listLeagues error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch leagues.")
    );
  }
};

export const getLeagueById = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const league = await leagueService.getLeagueById(leagueId);

    if (!league) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, "League not found.")
      );
    }

    return res.json(new ApiResponse(true, 200, { league }));
  } catch (error) {
    console.error("getLeagueById error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch league.")
    );
  }
};

export const updateLeague = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const validation = validateUpdateLeague(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    // Validate sport and location if they are being updated
    const { sport, location } = req.body;
    if (sport || location) {
      const currentLeague = await leagueService.getLeagueById(leagueId);
      if (!currentLeague) {
        return res.status(404).json(
          new ApiResponse(false, 404, null, "League not found.")
        );
      }

      const finalSport = sport || currentLeague.sport;
      const finalLocation = location || currentLeague.location;

      const sportLocationValidation = await sportLocationService.validateLeagueInputs(finalSport, finalLocation);
      if (!sportLocationValidation.isValid) {
        return res.status(400).json(
          new ApiResponse(false, 400, null, sportLocationValidation.errors.join('; '))
        );
      }
    }

    const updatedLeague = await leagueService.updateLeague(leagueId, req.body);

    return res.json(
      new ApiResponse(true, 200, { league: updatedLeague }, "League updated successfully.")
    );
  } catch (error) {
    console.error("updateLeague error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to update league.")
    );
  }
};

export const deleteLeague = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    await leagueService.deleteLeague(leagueId);

    return res.json(new ApiResponse(true, 200, null, "League deleted successfully."));
  } catch (error) {
    console.error("deleteLeague error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to delete league.")
    );
  }
};

// League Settings Operations
export const getLeagueSettings = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const result = await leagueService.getLeagueSettings(leagueId);

    return res.json(
      new ApiResponse(true, 200, result, "League settings retrieved.")
    );
  } catch (error) {
    console.error("getLeagueSettings error:", error);

    if (error instanceof Error) {
      return res.status(404).json(new ApiResponse(false, 404, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch league settings.")
    );
  }
};

export const updateLeagueSettings = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const validation = validateLeagueSettings(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const adminId = getAdminId(req);
    const settings = await leagueService.updateLeagueSettings(leagueId, req.body, adminId);

    return res.json(
      new ApiResponse(true, 200, { settings }, "League settings updated successfully.")
    );
  } catch (error) {
    console.error("updateLeagueSettings error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to update league settings.")
    );
  }
};

export const previewLeagueSettings = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const validation = validatePreviewLeagueSettings(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const settings = await leagueService.previewLeagueSettings(
      leagueId,
      req.body.previewPayload,
      req.body.expiresInMinutes || 30
    );

    return res.json(
      new ApiResponse(true, 200, { settings }, "Preview saved successfully.")
    );
  } catch (error) {
    console.error("previewLeagueSettings error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to preview league settings.")
    );
  }
};

// League Join Request Operations
export const listLeagueJoinRequests = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const requests = await leagueService.getLeagueJoinRequests(leagueId, req.query);

    return res.json(new ApiResponse(true, 200, { requests }));
  } catch (error) {
    console.error("listLeagueJoinRequests error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch join requests.")
    );
  }
};

export const createLeagueJoinRequest = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required.")
      );
    }

    const validation = validateCreateLeagueJoinRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const request = await leagueService.createLeagueJoinRequest(leagueId, req.body);

    return res.status(201).json(
      new ApiResponse(true, 201, { request }, "Join request created.")
    );
  } catch (error) {
    console.error("createLeagueJoinRequest error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to create join request.")
    );
  }
};

export const updateLeagueJoinRequestStatus = async (req: Request, res: Response) => {
  try {
    const { leagueId, requestId } = req.params;

    if (!leagueId || !requestId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID and Request ID are required.")
      );
    }

    const validation = validateUpdateLeagueJoinRequestStatus(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const adminId = getAdminId(req);
    const updatedRequest = await leagueService.updateLeagueJoinRequestStatus(
      leagueId,
      requestId,
      req.body,
      adminId
    );

    return res.json(
      new ApiResponse(true, 200, { request: updatedRequest }, "Join request updated successfully.")
    );
  } catch (error) {
    console.error("updateLeagueJoinRequestStatus error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to update join request.")
    );
  }
};

// League Template Operations
export const listLeagueTemplates = async (_req: Request, res: Response) => {
  try {
    const templates = await leagueService.getLeagueTemplates();

    return res.json(new ApiResponse(true, 200, { templates }));
  } catch (error) {
    console.error("listLeagueTemplates error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch league templates.")
    );
  }
};

export const createLeagueTemplate = async (req: Request, res: Response) => {
  try {
    const validation = validateCreateLeagueTemplate(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const adminId = getAdminId(req);
    const template = await leagueService.createLeagueTemplate(req.body, adminId);

    return res.status(201).json(
      new ApiResponse(true, 201, { template }, "League template created.")
    );
  } catch (error) {
    console.error("createLeagueTemplate error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to create league template.")
    );
  }
};

// Bulk Operations
export const bulkCreateLeagues = async (req: Request, res: Response) => {
  try {
    const validation = validateBulkCreateLeagues(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    const adminId = getAdminId(req);
    const leagues = await leagueService.bulkCreateLeagues(req.body, adminId);

    return res.status(201).json(
      new ApiResponse(
        true,
        201,
        { leagues, created: leagues.length, requested: req.body.leagues.length },
        `${leagues.length} of ${req.body.leagues.length} leagues created successfully.`
      )
    );
  } catch (error) {
    console.error("bulkCreateLeagues error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to create leagues in bulk.")
    );
  }
};

export const copyLeagueSettings = async (req: Request, res: Response) => {
  try {
    const validation = validateCopyLeagueSettings(req.body);
    if (!validation.isValid) {
      return res.status(400).json(new ApiResponse(false, 400, null, validation.errors.join('; ')));
    }

    await leagueService.copyLeagueSettings(req.body);

    return res.json(
      new ApiResponse(true, 200, null, "League settings copied successfully.")
    );
  } catch (error) {
    console.error("copyLeagueSettings error:", error);

    if (error instanceof Error) {
      return res.status(400).json(new ApiResponse(false, 400, null, error.message));
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to copy league settings.")
    );
  }
};

// Sport and Location Data Operations
export const getSportOptions = async (_req: Request, res: Response) => {
  try {
    const options = await sportLocationService.getSportOptions();

    return res.json(new ApiResponse(true, 200, { sports: options }));
  } catch (error) {
    console.error("getSportOptions error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch sport options.")
    );
  }
};

export const getLocationOptions = async (_req: Request, res: Response) => {
  try {
    const options = await sportLocationService.getLocationOptions();

    return res.json(new ApiResponse(true, 200, { locations: options }));
  } catch (error) {
    console.error("getLocationOptions error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to fetch location options.")
    );
  }
};

export const searchSports = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Search query is required.")
      );
    }

    const sports = await sportLocationService.searchSports(q);

    return res.json(new ApiResponse(true, 200, { sports }));
  } catch (error) {
    console.error("searchSports error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to search sports.")
    );
  }
};

export const searchLocations = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Search query is required.")
      );
    }

    const locations = await sportLocationService.searchLocations(q);

    return res.json(new ApiResponse(true, 200, { locations }));
  } catch (error) {
    console.error("searchLocations error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Failed to search locations.")
    );
  }
};