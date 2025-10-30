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
      const adminRecord = await prisma.admin.findUnique({
        where: { userId: assignedBy },
        select: { id: true },
      });
      if (adminRecord) {
        adminId = adminRecord.id;
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
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
    },

      if (!ratingValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: ratingValidation.error
        },
          
      const seasonWithLeague = await prisma.season.findUnique({
        where: { id: seasonId },
        include: {
          leagues: {
            select: { sportType: true }
          }
        }
      });

      if (seasonWithLeague?.leagues?.[0]?.sportType) {
        const sportType = seasonWithLeague.leagues[0].sportType.toLowerCase();
        
        const questionnaireResponse = await prisma.questionnaireResponse.findFirst({
          where: {
            userId: userId,
            sport: sportType,
            completedAt: { not: null }
          },
          include: {
            result: true
          }
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

    // Check if user is already assigned to this division
    const existingAssignment = await prisma.divisionAssignment.findUnique({
      where: { divisionId_userId: { divisionId, userId } }
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        error: "User is already assigned to this division"
      });
    }

    // 🆕 NEW: Find the division's group chat thread
    const divisionThread = await prisma.thread.findFirst({
      where: { 
        divisionId: divisionId,
        isGroup: true 
      },
      select: { id: true, name: true }
    });

    if (!divisionThread) {
      console.log(`⚠️ No group chat found for division ${divisionId}`);
      return res.status(400).json({
        success: false,
        error: "Division group chat not found. Please contact administrator."
      });
    }

    // Check if user is already a member of the division thread
    const existingThreadMember = await prisma.userThread.findUnique({
      where: { 
        threadId_userId: { 
          threadId: divisionThread.id, 
          userId 
        } 
      }
    });

    // Create assignment and add to group chat in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Handle season membership
      let seasonMembership = await tx.seasonMembership.findFirst({
        where: { userId, seasonId }
      });

      if (!seasonMembership) {
        seasonMembership = await tx.seasonMembership.create({
          data: {
            userId,
            seasonId,
            divisionId,
            status: "ACTIVE"
          }
        });
      } else if (seasonMembership.divisionId !== divisionId) {
        await tx.seasonMembership.update({
          where: { id: seasonMembership.id },
          data: { divisionId }
        });
      }

      // Create division assignment
      const assignment = await tx.divisionAssignment.create({
        data: {
          divisionId,
          userId,
          assignedBy: adminId,
          notes: notes || (autoAssignment ? "Auto-assigned based on rating" : null)
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
          division: { select: { id: true, name: true, level: true, gameType: true } },
        }
      });

      if (!existingThreadMember) {
        await tx.userThread.create({
          data: {
            threadId: divisionThread.id,
            userId: userId,
            role: null
          }
        });
        console.log(`✅ Added user ${userId} to division group chat ${divisionThread.id}`);
      } else {
        console.log(`ℹ️ User ${userId} already in division group chat ${divisionThread.id}`);
      }

      return { assignment, divisionThread };
    });

    // Update division counts
    await updateDivisionCounts(divisionId, true);

    console.log(`✅ User ${userId} assigned to division ${divisionId} and added to group chat`);

    
    if (req.io) {
      // Notify the assigned user
      req.io.to(userId).emit('division_assigned', {
        assignment: result.assignment,
        groupChat: {
          threadId: result.divisionThread.id,
          threadName: result.divisionThread.name
        },
        message: `You have been assigned to ${division.name} and added to the group chat`,
        timestamp: new Date().toISOString()
      });

      // Notify the division group chat about new member
      req.io.to(result.divisionThread.id).emit('member_joined_division', {
        userId,
        userName: user.name,
        divisionId,
        divisionName: division.name,
        message: `${user.name} has been assigned to ${division.name}`,
        timestamp: new Date().toISOString()
      });

      // Notify the assigned user that they joined the group chat
      req.io.to(userId).emit('new_thread', {
        thread: {
          id: result.divisionThread.id,
          name: result.divisionThread.name,
          isGroup: true,
          divisionId: divisionId
        },
        message: `Welcome to ${division.name} group chat!`,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Sent division assignment and group chat notifications`);
    }

    return res.status(201).json({
      success: true,
      message: "User assigned to division and added to group chat successfully",
      data: {
        assignment: result.assignment,
        groupChat: {
          threadId: result.divisionThread.id,
          threadName: result.divisionThread.name
        }
      }
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

    // Check if assignment exists
    const assignment = await prisma.divisionAssignment.findUnique({
      where: { divisionId_userId: { divisionId, userId } },
      include: {
        user: { select: { name: true } },
        division: { select: { name: true, seasonId: true, gameType: true } }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "User is not assigned to this division"
      });
    }

    const divisionThread = await prisma.thread.findFirst({
      where: { 
        divisionId: divisionId,
        isGroup: true 
      },
      select: { id: true, name: true }
    });

    // Remove assignment and group chat membership in transaction
    await prisma.$transaction(async (tx) => {
      // Remove the assignment
      await tx.divisionAssignment.delete({
        where: { divisionId_userId: { divisionId, userId } }
      });

      // Update season membership to remove division
      await tx.seasonMembership.updateMany({
        where: { 
          userId, 
          seasonId: assignment.division.seasonId,
          divisionId 
        },
        data: { divisionId: null }
      });

      // 🆕 NEW: Remove user from division group chat
      if (divisionThread) {
        const threadMember = await tx.userThread.findUnique({
          where: { 
            threadId_userId: { 
              threadId: divisionThread.id, 
              userId 
            } 
          }
        });

        if (threadMember) {
          await tx.userThread.delete({
            where: { 
              threadId_userId: { 
                threadId: divisionThread.id, 
                userId 
              } 
            }
          });
          console.log(`✅ Removed user ${userId} from division group chat ${divisionThread.id}`);
        }
      }
    });

    // Update division counts
    await updateDivisionCounts(divisionId, false);

    console.log(`✅ User ${userId} removed from division ${divisionId} and group chat`);

    // 🆕 ENHANCED: Socket notifications for removal
    if (req.io) {
      // Notify the removed user
      req.io.to(userId).emit('division_removed', {
        divisionId,
        divisionName: assignment.division.name,
        groupChatRemoved: divisionThread ? {
          threadId: divisionThread.id,
          threadName: divisionThread.name
        } : null,
        reason: reason || "Removed by admin",
        timestamp: new Date().toISOString()
      });

      // Notify the division group chat about member leaving
      if (divisionThread) {
        req.io.to(divisionThread.id).emit('member_left_division', {
          userId,
          userName: assignment.user.name,
          divisionId,
          divisionName: assignment.division.name,
          message: `${assignment.user.name} has been removed from ${assignment.division.name}`,
          timestamp: new Date().toISOString()
        });

        // Force the user to leave the socket room
        req.io.sockets.sockets.get(userId)?.leave(divisionThread.id);
      }

      console.log(`📤 Sent division removal and group chat notifications`);
    }

    return res.json({
      success: true,
      message: "User removed from division and group chat successfully"
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
    // Get all users without division assignments in this season
    const unassignedUsers = await prisma.seasonMembership.findMany({
      where: {
        seasonId,
        divisionId: null,
        status: "ACTIVE"
      },
      include: {
        user: {
          include: {
            initialRatingResult: true
          }
        }
      }
    });

    // Get available divisions for this season
    const divisions = await prisma.division.findMany({
      where: {
        seasonId,
        isActiveDivision: true,
        autoAssignmentEnabled: true
      },
      orderBy: [
        { level: 'asc' },
        { pointsThreshold: 'asc' }
      ]
    });

    if (divisions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No divisions available for auto-assignment"
      });
    }

    const assignments = [];
    const errors = [];

    for (const membership of unassignedUsers) {
      try {
        const userRating = membership.user.initialRatingResult?.singles || membership.user.initialRatingResult?.doubles || 0;
        
        // Find appropriate division based on rating and capacity
        let targetDivision = null;
        
        for (const division of divisions) {
          const capacityCheck = await checkDivisionCapacity(division.id, division.gameType);
          
          if (capacityCheck.hasCapacity && 
              (!division.pointsThreshold || userRating >= division.pointsThreshold)) {
            targetDivision = division;
          }
        }

        if (targetDivision) {
          const assignment = await prisma.divisionAssignment.create({
            data: {
              divisionId: targetDivision.id,
              userId: membership.userId,
              assignedBy: assignedBy || null,
              notes: `Auto-assigned based on rating: ${userRating}`
            },
            include: {
              user: { select: { name: true } },
              division: { select: { name: true } }
            }
          });

          // Update season membership
          await prisma.seasonMembership.update({
            where: { id: membership.id },
            data: { divisionId: targetDivision.id }
          });

          // Update division counts
          await updateDivisionCounts(targetDivision.id, true);

          assignments.push(assignment);

          // Socket notifications FUTURE TO-DO 
          // if (req.io) {
          //   req.io.to(membership.userId).emit('division_assigned', {
          //     assignment,
          //     message: `You have been auto-assigned to ${targetDivision.name}`,
          //     timestamp: new Date().toISOString()
          //   });
          // }

        } else {
          errors.push({
            userId: membership.userId,
            userName: membership.user.name,
            reason: "No suitable division found or all divisions at capacity"
          });
        }

      } catch (error) {
        errors.push({
          userId: membership.userId,
          userName: membership.user.name,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`✅ Auto-assignment completed: ${assignments.length} successful, ${errors.length} failed`);

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

    if (!season) {
      return res.status(404).json({
        success: false,
        error: "Season not found"
      });
    }

  
    const whereConditions: any = {
      seasonId
    };

    if (gameType) {
      const gameTypeEnum = toEnum(gameType as string, GameType);
      if (gameTypeEnum) {
        whereConditions.gameType = gameTypeEnum;
      }
    }

    if (level) {
      const levelEnum = toEnum(level as string, DivisionLevel);
      if (levelEnum) {
        whereConditions.level = levelEnum;
      }
    }

    if (genderCategory) {
      const genderEnum = toEnum(genderCategory as string, GenderType);
      if (genderEnum) {
        whereConditions.genderCategory = genderEnum;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Build include object based on query parameters
    const includeOptions: any = {
      season: {
        select: {
          id: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true
        }
      },
      divisionSponsor: {
        select: {
          id: true,
          sponsoredName: true,
          packageTier: true
        }
      },
      _count: {
        select: {
          assignments: true,
          seasonMemberships: true,
          matches: true
        }
      }
    };

    // Include assignments if requested
    if (includeAssignments === 'true') {
      includeOptions.assignments = {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true
            }
          }
        },
        orderBy: {
          assignedAt: 'desc'
        }
      };
    }

    const [divisions, totalCount] = await Promise.all([
      prisma.division.findMany({
        where: whereConditions,
        include: includeOptions,
        orderBy: [
          { level: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: Number(limit)
      }),
      prisma.division.count({ where: whereConditions })
    ]);

    console.log(`✅ Found ${divisions.length} divisions for season ${seasonId}`);

    // Format the response data
    const formattedDivisions = divisions.map(division => ({
      ...formatDivision(division),
      assignmentCount: (division._count as any)?.assignments || 0,
      membershipCount: (division._count as any)?.seasonMemberships || 0,
      matchCount: (division._count as any)?.matches || 0,
      sponsor: division.divisionSponsor ? {
        id: division.divisionSponsor.id,
        name: division.divisionSponsor.sponsoredName,
        tier: division.divisionSponsor.packageTier
      } : null,
      assignments: includeAssignments === 'true' ? division.assignments : undefined
    }));

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
