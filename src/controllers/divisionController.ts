/**
 * Division Controller
 * HTTP handlers for division-related endpoints
 * Thin wrapper around division services
 */

import { Request, Response } from "express";
import { Prisma, GameType } from "@prisma/client";

// Service imports
import {
  createDivisionWithThread,
  getAllDivisions,
  getDivisionById as getDivisionByIdService,
  updateDivision as updateDivisionService,
  deleteDivision as deleteDivisionService
} from '../services/division/divisionCrudService';

import {
  getDivisionsBySeasonId as getDivisionsBySeasonIdService,
  getDivisionSummaryBySeasonId as getDivisionSummaryBySeasonIdService
} from '../services/division/divisionQueryService';

import {
  assignPlayerToDivision as assignPlayerToDivisionService,
  removePlayerFromDivision as removePlayerFromDivisionService,
  getDivisionAssignments as getDivisionAssignmentsService,
  getUserDivisionAssignments as getUserDivisionAssignmentsService,
  autoAssignPlayersToDivisions as autoAssignPlayersToDivisionsService,
  transferPlayerBetweenDivisions as transferPlayerBetweenDivisionsService
} from '../services/division/divisionAssignmentService';

import {
  checkDivisionCapacity,
  getDivisionCapacityInfo
} from '../services/division/divisionCapacityService';

import {
  validateUserExists,
  validateDivisionExists,
  validatePlayerRatingForDivision,
  getAdminIdFromUserId
} from '../services/division/divisionValidationService';

/**
 * Create a new division with chat thread
 */
export const createDivision = async (req: Request, res: Response) => {
  const {
    seasonId,
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled = false,
    isActive = true,
    prizePoolTotal,
    sponsorName,
    adminId
  } = req.body;

  if (!adminId) {
    return res.status(400).json({
      error: "Admin Id is required to create the division thread.",
    });
  }

  if (!seasonId || !name || !divisionLevel || !gameType) {
    return res.status(400).json({
      error: "seasonId, name, divisionLevel, and gameType are required fields.",
    });
  }

  try {
    const result = await createDivisionWithThread(
      {
        seasonId,
        name,
        description,
        threshold,
        divisionLevel,
        gameType,
        genderCategory,
        maxSinglesPlayers,
        maxDoublesTeams,
        autoAssignmentEnabled,
        isActive,
        prizePoolTotal,
        sponsorName
      },
      adminId
    );

    // Socket notification for thread creation
    if (req.io) {
      req.io.to(adminId).emit('new_thread', {
        thread: result.thread,
        message: `Division chat created for ${result.division.name}`,
        timestamp: new Date().toISOString()
      });

      req.io.to(adminId).emit('division_created', {
        division: result.division,
        thread: result.thread,
        message: `Division ${result.division.name} created successfully`,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Sent division and thread creation notifications to admin ${adminId}`);
    }

    return res.status(201).json({
      success: true,
      data: {
        division: result.division,
        thread: {
          id: result.thread.id,
          name: result.thread.name,
          isGroup: result.thread.isGroup,
          divisionId: result.thread.divisionId,
          members: result.thread.members
        }
      },
      message: "Division and chat group created successfully",
    });

  } catch (error: any) {
    console.error("❌ Create Division Error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "A division with this name already exists in the season."
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          error: "Invalid season, league, or admin ID provided."
        });
      }
    }

    return res.status(500).json({
      error: error.message || "An error occurred while creating the division and chat group."
    });
  }
};

/**
 * Get all divisions
 */
export const getDivisions = async (_req: Request, res: Response) => {
  try {
    const divisions = await getAllDivisions();
    return res.json(divisions);
  } catch (error) {
    console.error("Get Divisions Error:", error);
    return res.status(500).json({ error: "Failed to retrieve divisions." });
  }
};

/**
 * Get division by ID
 */
export const getDivisionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    const division = await getDivisionByIdService(id);

    if (!division) {
      return res.status(404).json({ error: "Division not found." });
    }

    return res.json(division);
  } catch (error) {
    console.error("Get Division By ID Error:", error);
    return res.status(500).json({ error: "Failed to retrieve division." });
  }
};

/**
 * Update division
 */
export const updateDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  const {
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled,
    isActive,
    prizePoolTotal,
    sponsorName,
    seasonId,
  } = req.body;

  try {
    const division = await updateDivisionService(id, {
      name,
      description,
      threshold,
      divisionLevel,
      gameType,
      genderCategory,
      maxSinglesPlayers,
      maxDoublesTeams,
      autoAssignmentEnabled,
      isActive,
      prizePoolTotal,
      sponsorName,
      seasonId
    });

    return res.json({
      data: division,
      message: "Division updated successfully",
    });
  } catch (error: any) {
    console.error("Update Division Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update division." });
  }
};

/**
 * Delete division
 */
export const deleteDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    await deleteDivisionService(id);
    return res.json({ message: "Division deleted successfully" });
  } catch (error) {
    console.error("Delete Division Error:", error);
    return res.status(500).json({ error: "Failed to delete division." });
  }
};

/**
 * Assign player to division
 */
export const assignPlayerToDivision = async (req: Request, res: Response) => {
  try {
    const { userId, divisionId, seasonId, assignedBy, notes, autoAssignment } = req.body;

    console.log(`🎯 Assigning user ${userId} to division ${divisionId}`);

    if (!userId || !divisionId || !seasonId) {
      return res.status(400).json({
        success: false,
        error: "userId, divisionId, and seasonId are required"
      });
    }

    // Get admin ID if provided
    let adminId = null;
    if (assignedBy) {
      const adminLookup = await getAdminIdFromUserId(assignedBy);
      adminId = adminLookup.adminId;
    }

    // Validate user exists
    const userValidation = await validateUserExists(userId);
    if (!userValidation.isValid) {
      return res.status(404).json({
        success: false,
        error: userValidation.error
      });
    }

    // Validate division exists and is active
    const divisionValidation = await validateDivisionExists(divisionId, seasonId);
    if (!divisionValidation.isValid) {
      return res.status(divisionValidation.error === "Division not found" ? 404 : 400).json({
        success: false,
        error: divisionValidation.error
      });
    }

    const division = divisionValidation.division;

    // Check player rating against division threshold
    if (division.pointsThreshold) {
      const ratingValidation = await validatePlayerRatingForDivision(
        userId,
        divisionId,
        division.pointsThreshold,
        division.gameType,
        seasonId
      );

      if (!ratingValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: ratingValidation.error
        });
      }
    }

    // Check division capacity
    const capacityCheck = await checkDivisionCapacity(divisionId, division.gameType);
    if (!capacityCheck.hasCapacity) {
      return res.status(400).json({
        success: false,
        error: `Division is at full capacity (${capacityCheck.currentCount}/${capacityCheck.maxCapacity})`
      });
    }

    // Perform assignment
    const assignment = await assignPlayerToDivisionService({
      userId,
      divisionId,
      seasonId,
      adminId,
      notes,
      autoAssignment
    });

    return res.status(201).json({
      success: true,
      message: "User assigned to division successfully",
      data: assignment
    });

  } catch (error: any) {
    console.error("❌ Error assigning user to division:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "User is already assigned to this division"
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid user, division, or admin ID"
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to assign user to division"
    });
  }
};

/**
 * Remove player from division
 */
export const removePlayerFromDivision = async (req: Request, res: Response) => {
  try {
    const { divisionId, userId } = req.params;

    console.log(`🗑️ Removing user ${userId} from division ${divisionId}`);

    if (!divisionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Division ID and User ID are required"
      });
    }

    const assignment = await removePlayerFromDivisionService(divisionId, userId);

    return res.json({
      success: true,
      message: "User removed from division successfully"
    });

  } catch (error: any) {
    console.error("❌ Error removing user from division:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to remove user from division"
    });
  }
};

/**
 * Get division assignments
 */
export const getDivisionAssignments = async (req: Request, res: Response) => {
  try {
    const { divisionId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!divisionId) {
      return res.status(400).json({
        success: false,
        error: "Division ID is required"
      });
    }

    const result = await getDivisionAssignmentsService(
      divisionId,
      Number(page),
      Number(limit)
    );

    return res.json({
      success: true,
      data: result.assignments,
      division: result.division,
      pagination: result.pagination
    });

  } catch (error) {
    console.error("❌ Error fetching division assignments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch division assignments"
    });
  }
};

/**
 * Get user's division assignments
 */
export const getUserDivisionAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    const assignments = await getUserDivisionAssignmentsService(userId);

    return res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });

  } catch (error) {
    console.error("❌ Error fetching user assignments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch user assignments"
    });
  }
};

/**
 * Auto-assign players to divisions
 */
export const autoAssignPlayersToDivisions = async (req: Request, res: Response) => {
  try {
    const { seasonId, assignedBy } = req.body;

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    const result = await autoAssignPlayersToDivisionsService(seasonId, assignedBy);

    return res.json({
      success: true,
      message: "Auto-assignment completed",
      data: result
    });

  } catch (error: any) {
    console.error("❌ Error in auto-assignment:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to auto-assign users"
    });
  }
};

/**
 * Transfer player between divisions
 */
export const transferPlayerBetweenDivisions = async (req: Request, res: Response) => {
  try {
    const { userId, fromDivisionId, toDivisionId, transferredBy, reason } = req.body;

    if (!userId || !fromDivisionId || !toDivisionId) {
      return res.status(400).json({
        success: false,
        error: "userId, fromDivisionId, and toDivisionId are required"
      });
    }

    const result = await transferPlayerBetweenDivisionsService(
      userId,
      fromDivisionId,
      toDivisionId,
      transferredBy,
      reason
    );

    return res.json({
      success: true,
      message: "User transferred successfully",
      data: result
    });

  } catch (error: any) {
    console.error("❌ Error transferring user:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to transfer user between divisions"
    });
  }
};

/**
 * Get divisions by season ID with filtering
 */
export const getDivisionsBySeasonId = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const {
      page = 1,
      limit = 20,
      isActive,
      gameType,
      level,
      genderCategory,
      includeAssignments = false
    } = req.query;

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    const result = await getDivisionsBySeasonIdService({
      seasonId,
      page: Number(page),
      limit: Number(limit),
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      gameType: gameType as string,
      level: level as string,
      genderCategory: genderCategory as string,
      includeAssignments: includeAssignments === 'true'
    });

    return res.json({
      success: true,
      data: result.divisions,
      season: result.season,
      pagination: result.pagination,
      filters: result.filters
    });

  } catch (error) {
    console.error("❌ Error fetching divisions by season:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch divisions for season"
    });
  }
};

/**
 * Get division summary statistics for a season
 */
export const getDivisionSummaryBySeasonId = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    const result = await getDivisionSummaryBySeasonIdService(seasonId);

    return res.json({
      success: true,
      season: result.season,
      summary: result.summary,
      divisions: result.divisions
    });

  } catch (error: any) {
    console.error("❌ Error fetching division summary:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch division summary"
    });
  }
};
