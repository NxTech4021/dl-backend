import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { Prisma, GameType, DivisionLevel, GenderType } from "@prisma/client";

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

// 🆕 Notification imports
import { notificationService } from '../services/notificationService';
import { notificationTemplates } from '../helpers/notification';
import { logger } from '../utils/logger';

const updateDivisionCounts = async (divisionId: string, increment: boolean) => {
  try {
    const count = await prisma.divisionAssignment.count({
      where: { divisionId }
    });
    
    await prisma.division.update({
      where: { id: divisionId },
      data: { currentSinglesCount: count }
    });

    logger.databaseOperation('update', 'division', 0, { divisionId, newCount: count });
  } catch (error) {
    logger.databaseError('update', 'division', error as Error, { divisionId });
  }
};

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
    logger.warn('Division creation attempted without admin ID', { seasonId, name });
    return res.status(400).json({
      success: false,
      error: "Admin Id is required to create the division thread.",
    });
  }

  if (!seasonId || !name || !divisionLevel || !gameType) {
    logger.warn('Division creation with missing required fields', { seasonId, name, divisionLevel, gameType });
    return res.status(400).json({
      success: false,
      error: "seasonId, name, divisionLevel, and gameType are required fields.",
    });
  }

  try {
    logger.info('Creating division', { seasonId, name, divisionLevel, gameType, adminId });

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

    logger.divisionCreated(result.division.id, result.division.name, seasonId, { adminId });

    // Socket notification for thread creation
    if ((req as any).io) {
      (req as any).io.to(adminId).emit('new_thread', {
        thread: result.thread,
        message: `Division chat created for ${result.division.name}`,
        timestamp: new Date().toISOString()
      });

      (req as any).io.to(adminId).emit('division_created', {
        division: result.division,
        thread: result.thread,
        message: `Division ${result.division.name} created successfully`,
        timestamp: new Date().toISOString()
      });

      logger.info('Sent division creation notifications', { adminId, divisionId: result.division.id });
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
    logger.error('Create division error', { seasonId, name, adminId }, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "A division with this name already exists in the season."
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid season, league, or admin ID provided."
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while creating the division and chat group."
    });
  }
};

export const assignPlayerToDivision = async (req: Request, res: Response) => {
  try {
    const { userId, divisionId, seasonId, assignedBy, notes, autoAssignment } = req.body;

    logger.info('Assigning player to division', { userId, divisionId, seasonId });

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

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true }
    });

    if (!user) {
      logger.warn('User not found for division assignment', { userId, divisionId });
      return res.status(404).json({
        success: false,
        error: "User not found"
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

    // Validate player rating if threshold exists
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

    // Find the division's group chat thread
    const divisionThread = await prisma.thread.findFirst({
      where: { 
        divisionId: divisionId,
        isGroup: true 
      },
      select: { id: true, name: true }
    });

    if (!divisionThread) {
      logger.warn('No group chat found for division', { divisionId });
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
          division: { 
            select: { 
              id: true, 
              name: true, 
              level: true, 
              gameType: true,
              season: { select: { id: true, name: true } }
            } 
          },
        }
      });

      // Add user to group chat if not already a member
      if (!existingThreadMember) {
        await tx.userThread.create({
          data: {
            threadId: divisionThread.id,
            userId: userId,
            role: null
          }
        });
        logger.info('Added user to division group chat', { userId, threadId: divisionThread.id });
      }

      return { assignment, divisionThread };
    });

    // Update division counts
    await updateDivisionCounts(divisionId, true);

    // Get season info for notifications
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true }
    });

    // 🆕 Send division assignment notification
    try {
      const divisionNotif = notificationTemplates.division.assigned(
        division.name,
        season?.name || 'Current Season'
      );

      await notificationService.createNotification({
        userIds: userId,
        ...divisionNotif,
        divisionId: divisionId,
        seasonId: seasonId,
      });

      logger.notificationSent('DIVISION_ASSIGNED', [userId], { divisionId, seasonId });

      // 🆕 Send group chat notification
      const chatNotif = notificationTemplates.chat.groupAdded(
        divisionThread.name || `${division.name} Chat`,
        division.name
      );

      await notificationService.createNotification({
        userIds: userId,
        ...chatNotif,
        threadId: divisionThread.id,
        divisionId: divisionId,
      });

      logger.notificationSent('GROUP_CHAT_ADDED', [userId], { threadId: divisionThread.id });
    } catch (notifError) {
      logger.error('Failed to send assignment notifications', { userId, divisionId }, notifError as Error);
      // Continue execution - notification failure shouldn't block assignment
    }

    logger.playerAssigned(userId, divisionId, seasonId, { adminId: adminId || undefined });

    // Socket notifications
    if ((req as any).io) {
      // Notify the assigned user
      (req as any).io.to(userId).emit('division_assigned', {
        assignment: result.assignment,
        groupChat: {
          threadId: result.divisionThread.id,
          threadName: result.divisionThread.name
        },
        message: `You have been assigned to ${division.name}`,
        timestamp: new Date().toISOString()
      });

      // Notify the division group chat about new member
      (req as any).io.to(result.divisionThread.id).emit('member_joined_division', {
        userId,
        userName: user.name,
        divisionId,
        divisionName: division.name,
        timestamp: new Date().toISOString()
      });

      // Notify the assigned user about joining the group chat
      (req as any).io.to(userId).emit('new_thread', {
        thread: {
          id: result.divisionThread.id,
          name: result.divisionThread.name,
          isGroup: true,
          divisionId: divisionId
        },
        message: `Welcome to ${division.name} group chat!`,
        timestamp: new Date().toISOString()
      });

      logger.socketEvent('division_assignment', userId, { divisionId, threadId: result.divisionThread.id });
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
    logger.error('Error assigning user to division', { userId: req.body.userId, divisionId: req.body.divisionId }, error);

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
    const { reason } = req.body;

    logger.info('Removing player from division', { userId, divisionId, reason });

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
        user: { select: { id: true, name: true } },
        division: { 
          select: { 
            id: true,
            name: true, 
            seasonId: true, 
            gameType: true,
            season: { select: { id: true, name: true } }
          } 
        }
      }
    });

    if (!assignment) {
      logger.warn('Assignment not found for removal', { userId, divisionId });
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

      // Remove user from division group chat
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
          logger.info('Removed user from division group chat', { userId, threadId: divisionThread.id });
        }
      }
    });

    // Update division counts
    await updateDivisionCounts(divisionId, false);

    // 🆕 Send removal notification
    try {
      const notif = notificationTemplates.division.removed(
        assignment.division.name,
        assignment.division.season?.name || 'Current Season',
        reason
      );

      await notificationService.createNotification({
        userIds: userId,
        ...notif,
        divisionId: divisionId,
        seasonId: assignment.division.seasonId,
      });

      logger.notificationSent('DIVISION_REMOVED', [userId], { divisionId, reason });
    } catch (notifError) {
      logger.error('Failed to send removal notification', { userId, divisionId }, notifError as Error);
    }

    logger.playerRemoved(userId, divisionId, reason, { seasonId: assignment.division.seasonId });

    // Socket notifications for removal
    if ((req as any).io) {
      // Notify the removed user
      (req as any).io.to(userId).emit('division_removed', {
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
        (req as any).io.to(divisionThread.id).emit('member_left_division', {
          userId,
          userName: assignment.user.name,
          divisionId,
          divisionName: assignment.division.name,
          timestamp: new Date().toISOString()
        });

        // Force the user to leave the socket room
        const userSockets = (req as any).io.sockets.sockets;
        for (const [socketId, socket] of userSockets) {
          if ((socket as any).userId === userId) {
            socket.leave(divisionThread.id);
          }
        }
      }

      logger.socketEvent('division_removal', userId, { divisionId });
    }

    return res.json({
      success: true,
      message: "User removed from division and group chat successfully"
    });

  } catch (error: any) {
    logger.error('Error removing user from division', { userId: req.params.userId, divisionId: req.params.divisionId }, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to remove user from division"
    });
  }
};

/**
 * Transfer player between divisions
 */
export const transferPlayerBetweenDivisions = async (req: Request, res: Response) => {
  try {
    const { userId, fromDivisionId, toDivisionId, transferredBy, reason } = req.body;

    logger.info('Transferring player between divisions', { userId, fromDivisionId, toDivisionId });

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

    // 🆕 Send transfer notification
    if (result.fromDivision && result.toDivision && result.season) {
      try {
        const notif = notificationTemplates.division.transferred(
          result.fromDivision.name,
          result.toDivision.name,
          result.season.name
        );

        await notificationService.createNotification({
          userIds: userId,
          ...notif,
          seasonId: result.toDivision.seasonId,
        });

        logger.notificationSent('DIVISION_TRANSFERRED', [userId], { 
          fromDivisionId, 
          toDivisionId,
          seasonId: result.toDivision.seasonId 
        });
      } catch (notifError) {
        logger.error('Failed to send transfer notification', { userId, fromDivisionId, toDivisionId }, notifError as Error);
      }
    }

    logger.playerTransferred(userId, fromDivisionId, toDivisionId, { 
      reason, 
      seasonId: result.toDivision?.seasonId 
    });

    // Socket notifications
    if ((req as any).io && result.fromDivision && result.toDivision) {
      (req as any).io.to(userId).emit('division_transferred', {
        fromDivision: result.fromDivision,
        toDivision: result.toDivision,
        message: `Transferred from ${result.fromDivision.name} to ${result.toDivision.name}`,
        timestamp: new Date().toISOString()
      });

      logger.socketEvent('division_transfer', userId, { fromDivisionId, toDivisionId });
    }

    return res.json({
      success: true,
      message: "User transferred successfully",
      data: result
    });

  } catch (error: any) {
    logger.error('Error transferring user', { 
      userId: req.body.userId, 
      fromDivisionId: req.body.fromDivisionId, 
      toDivisionId: req.body.toDivisionId 
    }, error);
    
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to transfer user between divisions"
    });
  }
};

/**
 * Get all divisions
 */
export const getDivisions = async (_req: Request, res: Response) => {
  try {
    const divisions = await getAllDivisions();
    return res.json({ success: true, data: divisions });
  } catch (error) {
    logger.error('Error getting divisions', {}, error as Error);
    return res.status(500).json({ success: false, error: "Failed to retrieve divisions." });
  }
};

/**
 * Get division by ID
 */
export const getDivisionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "Division ID is required." });
  }

  try {
    const division = await getDivisionByIdService(id);

    if (!division) {
      return res.status(404).json({ success: false, error: "Division not found." });
    }

    return res.json({ success: true, data: division });
  } catch (error) {
    logger.error('Error getting division by ID', { divisionId: id }, error as Error);
    return res.status(500).json({ success: false, error: "Failed to retrieve division." });
  }
};

/**
 * Update division
 */
export const updateDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "Division ID is required." });
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
      success: true,
      data: division,
      message: "Division updated successfully",
    });
  } catch (error: any) {
    logger.error('Error updating division', { divisionId: id }, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to update division." 
    });
  }
};

/**
 * Delete division
 */
export const deleteDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "Division ID is required." });
  }

  try {
    await deleteDivisionService(id);
    logger.info('Division deleted', { divisionId: id });
    return res.json({ success: true, message: "Division deleted successfully" });
  } catch (error) {
    logger.error('Error deleting division', { divisionId: id }, error as Error);
    return res.status(500).json({ success: false, error: "Failed to delete division." });
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
    logger.error('Error fetching division assignments', { divisionId: req.params.divisionId }, error as Error);
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
    logger.error('Error fetching user assignments', { userId: req.params.userId }, error as Error);
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

    logger.info('Starting auto-assignment', { seasonId, assignedBy });

    const result = await autoAssignPlayersToDivisionsService(seasonId, assignedBy);

    logger.info('Auto-assignment completed', { 
      seasonId, 
      assignedCount: result.assigned?.length || 0,
      failedCount: result.failed?.length || 0 
    });

    return res.json({
      success: true,
      message: "Auto-assignment completed",
      data: result
    });

  } catch (error: any) {
    logger.error('Error in auto-assignment', { seasonId: req.body.seasonId }, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to auto-assign users"
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
    logger.error('Error fetching divisions by season', { seasonId: req.params.seasonId }, error as Error);

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
    logger.error('Error fetching division summary', { seasonId: req.params.seasonId }, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch division summary"
    });
  }
};
