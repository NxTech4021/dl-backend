import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { Server as SocketIOServer } from "socket.io";

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
  getDivisionCapacityInfo,
  updateDivisionCounts
} from '../services/division/divisionCapacityService';

import {
  validateUserExists,
  validateDivisionExists,
  validatePlayerRatingForDivision,
  getAdminIdFromUserId
} from '../services/division/divisionValidationService';

// Standings service for rank recalculation
import { recalculateDivisionRanks } from '../services/rating/standingsCalculationService';

// 🆕 Notification imports
import { notificationService } from '../services/notificationService';
import { notificationTemplates } from '../helpers/notifications';
import { logger } from '../utils/logger';

interface CreateDivisionBody {
  seasonId?: string;
  name?: string;
  description?: string;
  threshold?: number;
  divisionLevel?: string;
  gameType?: string;
  genderCategory?: string;
  maxSinglesPlayers?: number;
  maxDoublesTeams?: number;
  autoAssignmentEnabled?: boolean;
  isActive?: boolean;
  prizePoolTotal?: number;
  sponsorName?: string;
  adminId?: string;
}


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
  } = req.body as CreateDivisionBody;

  if (!adminId) {
    const context: Record<string, string> = {};
    if (seasonId) context.seasonId = seasonId;
    if (name) context.name = name;
    logger.warn('Division creation attempted without admin ID', context);
    return res.status(400).json({
      success: false,
      error: "Admin Id is required to create the division thread.",
    });
  }

  if (!seasonId || !name || !divisionLevel || !gameType) {
    const context: Record<string, string | number | undefined> = {};
    if (seasonId) context.seasonId = seasonId;
    if (name) context.name = name;
    if (divisionLevel !== undefined) context.divisionLevel = divisionLevel;
    if (gameType) context.gameType = gameType;
    logger.warn('Division creation with missing required fields', context);
    return res.status(400).json({
      success: false,
      error: "seasonId, name, divisionLevel, and gameType are required fields.",
    });
  }

  try {
    logger.info("Creating division", { seasonId, name, divisionLevel, gameType, adminId });

    // Check if user has admin role first (from auth middleware or verify directly)
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        name: true,
        role: true,
        admin: {
          select: {
            id: true,
            userId: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
    });

    if (!user) {
      logger.warn('User not found', { adminId });
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    // Check if user has admin role (ADMIN or SUPERADMIN)
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      logger.warn('User does not have admin role', { adminId, role: user.role });
      return res.status(403).json({
        success: false,
        error: "Admin access required to create divisions.",
      });
    }

    // Get or create admin record if needed
    let adminRecord = user.admin;
    if (!adminRecord) {
      // Create admin record for users with admin role but no admin record
      logger.info('Creating admin record for user with admin role', { adminId });
      adminRecord = await prisma.admin.create({
        data: {
          userId: adminId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          userId: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    } else if (adminRecord.status !== 'ACTIVE') {
      logger.warn('Admin record exists but is not active', { adminId, status: adminRecord.status });
      return res.status(403).json({
        success: false,
        error: "Admin account is not active.",
      });
    }

    // 1️⃣ Create division and its chat thread
    const divisionData: Parameters<typeof createDivisionWithThread>[0] = {
      seasonId,
      name,
      divisionLevel,
      gameType,
      ...(description !== undefined && { description }),
      ...(threshold !== undefined && { threshold }),
      ...(genderCategory !== undefined && { genderCategory }),
      ...(maxSinglesPlayers !== undefined && { maxSinglesPlayers }),
      ...(maxDoublesTeams !== undefined && { maxDoublesTeams }),
      ...(autoAssignmentEnabled !== undefined && { autoAssignmentEnabled }),
      ...(isActive !== undefined && { isActive }),
      ...(prizePoolTotal !== undefined && { prizePoolTotal }),
      ...(sponsorName !== undefined && { sponsorName }),
    };
    const result = await createDivisionWithThread(divisionData, adminId);

   
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true },
    });

    logger.divisionCreated(result.division.id, result.division.name, seasonId, { 
      adminId: adminRecord.id,
      adminUserId: adminId,
      adminName: user.name
    });

   
    const seasonMembers = await prisma.seasonMembership.findMany({
      where: { 
        seasonId,
          userId: {
          not: adminId
        }
      },
      select: { userId: true },
    });

    console.log("✅ Season Members (excluding admin):", seasonMembers.length);
      console.log("🔍 Admin details:", {
      adminUserId: adminId,
      adminName: user.name,
      adminTableId: adminRecord.id,
      userRole: user.role
    });
    const recipientUserIds = seasonMembers.map((m) => m.userId);

    // 4️⃣ Notify season members about the new division (NOT the admin)
    if (recipientUserIds.length > 0) {
      try {
        // Use notification template with proper category
        const divisionNotif = notificationTemplates.division.created(
          result.division.name,
          season?.name || 'Current Season',
          adminRecord.user?.name 
        );

        console.log("📧 Creating notification for season members:", {
          userCount: recipientUserIds.length,
          divisionName: result.division.name,
          createdBy: adminRecord.user?.name,
        });

        const notifications = await notificationService.createNotification({
          userIds: recipientUserIds,
          ...divisionNotif,
          divisionId: result.division.id,
          seasonId: seasonId,
          threadId: result.thread.id,
        });

        console.log("✅ Notifications created:", notifications.length);

        logger.notificationSent("DIVISION_CREATED", recipientUserIds, {
          divisionId: result.division.id,
          action: "division_created",
          excludedAdmin: adminId,
          adminName: adminRecord.user?.name,
        });

        // 5️⃣ Emit socket events to season members (NOT the admin)
        if (req.io) {
          recipientUserIds.forEach((userId) => {
            req.io.to(userId).emit("new_notification", {
              type: divisionNotif.type,
              category: divisionNotif.category,
              title: divisionNotif.title,
              message: divisionNotif.message,
              divisionId: result.division.id,
              seasonId,
              timestamp: new Date().toISOString(),
              read: false,
            });
          });

          logger.info("Sent division creation socket notifications to season members", {
            seasonId,
            userCount: recipientUserIds.length,
            divisionId: result.division.id,
            excludedAdmin: adminId,
          });
        }
      } catch (notifError) {
        console.error("❌ Notification Error:", notifError);
        logger.error(
          "Failed to send division creation notification to season members",
          {
            seasonId,
            divisionId: result.division.id,
          },
          notifError as Error
        );
      }
    } else {
      logger.info("No season members found to notify for new division (excluding admin)", { 
        seasonId, 
        adminUserId: adminId 
      });
    }

  // 6️⃣ ONLY emit socket notifications for thread creation to the admin (not database notifications)
    if (req.io && adminId) {
      // Just inform about the thread creation - no persistent notification
      req.io.to(adminId).emit("new_thread", { // Use adminId (which is userId)
        thread: result.thread,
        message: `Division chat created for ${result.division.name}`,
        timestamp: new Date().toISOString(),
      });

      req.io.to(adminId).emit("division_created", { // Use adminId (which is userId)
        division: result.division,
        thread: result.thread,
        message: `Division ${result.division.name} created successfully`,
        timestamp: new Date().toISOString(),
      });

      logger.info("Sent division creation socket events to admin (no persistent notification)", {
        adminId,
        adminUserId: adminId,
        divisionId: result.division.id,
      });
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
          members: result.thread.members,
          sportType: result.division.league?.sportType,
        },
        notificationsSent: recipientUserIds.length,
      },
      message: "Division and chat group created successfully",
    });
  } catch (error: unknown) {
    console.error("❌ Division Creation Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Create division error", { seasonId, name, adminId }, error instanceof Error ? error : new Error(errorMessage));

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "A division with this name already exists in the season.",
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid season, league, or admin ID provided.",
        });
      }
    }

    const finalErrorMessage = error instanceof Error ? error.message : "An error occurred while creating the division and chat group.";
    return res.status(500).json({
      success: false,
      error: finalErrorMessage,
    });
  }
};

interface AssignPlayerToDivisionBody {
  userId?: string;
  divisionId?: string;
  seasonId?: string;
  assignedBy?: string;
  notes?: string;
  autoAssignment?: boolean;
  overrideThreshold?: boolean;
}

export const assignPlayerToDivision = async (req: Request, res: Response) => {
  try {
    const { userId, divisionId, seasonId, assignedBy, notes, autoAssignment, overrideThreshold } = req.body as AssignPlayerToDivisionBody;

    const context: Record<string, string | boolean | undefined> = {};
    if (userId) context.userId = userId;
    if (divisionId) context.divisionId = divisionId;
    if (seasonId) context.seasonId = seasonId;
    if (overrideThreshold !== undefined) context.overrideThreshold = overrideThreshold;
    logger.info('Assigning player to division', context);

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

    // Validate player rating if threshold exists (unless overrideThreshold is true)
    if (division.pointsThreshold && !overrideThreshold) {
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
    } else if (division.pointsThreshold && overrideThreshold) {
      // Log that admin is overriding threshold validation
      const overrideContext: Record<string, string | number> = {
        userId,
        divisionId,
        threshold: division.pointsThreshold,
      };
      if (assignedBy) overrideContext.adminId = assignedBy;
      logger.info('Admin overriding threshold validation', overrideContext);
    }

    // Check division capacity
    const capacityCheck = await checkDivisionCapacity(divisionId, division.gameType);
    if (!capacityCheck.hasCapacity) {
      return res.status(400).json({
        success: false,
        error: `Division is at full capacity (${capacityCheck.currentCount}/${capacityCheck.maxCapacity})`
      });
    }

    // Check if user is assigned to any division in this season (for reassignment detection)
    // Check both DivisionAssignment and SeasonMembership to ensure consistency
    const [existingSeasonAssignment, seasonMembership] = await Promise.all([
      prisma.divisionAssignment.findFirst({
        where: {
          userId,
          division: {
            seasonId: seasonId
          }
        },
        include: {
          division: {
            select: { id: true, name: true, seasonId: true }
          }
        }
      }),
      prisma.seasonMembership.findFirst({
        where: {
          userId,
          seasonId
        },
        select: {
          divisionId: true
        }
      })
    ]);

    // Log for debugging
    logger.info('Checking existing assignments', {
      userId,
      seasonId,
      targetDivisionId: divisionId,
      foundAssignment: !!existingSeasonAssignment,
      existingDivisionId: existingSeasonAssignment?.divisionId,
      existingDivisionName: existingSeasonAssignment?.division.name,
      seasonMembershipDivisionId: seasonMembership?.divisionId,
      assignmentMatchesMembership: existingSeasonAssignment?.divisionId === seasonMembership?.divisionId
    });

    const hasDataInconsistency = existingSeasonAssignment && 
      seasonMembership?.divisionId && 
      existingSeasonAssignment.divisionId !== seasonMembership.divisionId;

    if (hasDataInconsistency) {
      logger.warn('Data inconsistency detected between DivisionAssignment and SeasonMembership', {
        userId,
        assignmentDivisionId: existingSeasonAssignment.divisionId,
        assignmentDivisionName: existingSeasonAssignment.division.name,
        membershipDivisionId: seasonMembership.divisionId,
        targetDivisionId: divisionId
      });
    }

    // Determine if this is a reassignment
    // If user is already in target division according to DivisionAssignment, we'll update/refresh it
    // If user is in a different division, we'll transfer them
    const isReassignment = existingSeasonAssignment && existingSeasonAssignment.divisionId !== divisionId;
    const isSameDivision = existingSeasonAssignment && existingSeasonAssignment.divisionId === divisionId;
    const previousDivisionId = isReassignment ? existingSeasonAssignment.divisionId : null;
    const previousDivisionName = isReassignment ? existingSeasonAssignment.division.name : null;

    // If user is already assigned to THIS division and data is consistent, allow refresh/update
    if (isSameDivision && !hasDataInconsistency) {
      logger.info('User already assigned to this division - refreshing assignment', {
        userId,
        divisionId,
        divisionName: division.name
      });
      // Allow the assignment to proceed - it will update the SeasonMembership to ensure consistency
      // We'll treat this as a refresh rather than a new assignment
    } else if (isReassignment) {
      logger.info('Reassignment detected - proceeding with transfer', {
        userId,
        fromDivisionId: previousDivisionId,
        fromDivisionName: previousDivisionName,
        toDivisionId: divisionId,
        toDivisionName: division.name
      });
    } else if (!existingSeasonAssignment) {
      logger.info('New assignment - user not yet assigned to any division in this season', {
        userId,
        divisionId,
        divisionName: division.name
      });
    } else if (isSameDivision && hasDataInconsistency) {
      logger.info('User already assigned to this division but data inconsistency found - syncing', {
        userId,
        divisionId,
        divisionName: division.name,
        membershipDivisionId: seasonMembership?.divisionId
      });
      // Allow the assignment to proceed - it will sync the data
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

    // Find the old division's thread if reassigning
    let oldDivisionThread = null;
    if (isReassignment && previousDivisionId) {
      oldDivisionThread = await prisma.thread.findFirst({
        where: { 
          divisionId: previousDivisionId,
          isGroup: true 
        },
        select: { id: true, name: true }
      });
    }

    // Create assignment and add to group chat in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // If reassigning, remove from old division first
      if (isReassignment && previousDivisionId) {
        // Remove old division assignment
        await tx.divisionAssignment.delete({
          where: { divisionId_userId: { divisionId: previousDivisionId, userId } }
        }).catch(() => {
          // Ignore if already deleted - allows multiple reassignments
        });

        // Remove user from old division's group chat if they were a member
        if (oldDivisionThread) {
          await tx.userThread.deleteMany({
            where: {
              threadId: oldDivisionThread.id,
              userId: userId
            }
          });
        }

        logger.info('Removed user from previous division for reassignment', {
          userId,
          previousDivisionId,
          newDivisionId: divisionId
        });
      }

      // Handle season membership - always update to ensure consistency
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
        // Update to sync with DivisionAssignment
        await tx.seasonMembership.update({
          where: { id: seasonMembership.id },
          data: { divisionId }
        });
        logger.info('Synced SeasonMembership.divisionId with DivisionAssignment', {
          userId,
          oldDivisionId: seasonMembership.divisionId,
          newDivisionId: divisionId
        });
      }

      // Use upsert to handle all cases: create new, update existing, or reassign
      // This allows admins to reassign unlimited times without errors
      const assignment = await tx.divisionAssignment.upsert({
        where: {
          divisionId_userId: { divisionId, userId }
        },
        update: {
          assignedBy: adminId,
          notes: notes || (isReassignment ? `Reassigned from ${previousDivisionName || 'previous division'}` : (isSameDivision ? "Refreshed assignment" : (autoAssignment ? "Auto-assigned based on rating" : null))),
          reassignmentCount: isReassignment ? (existingSeasonAssignment?.reassignmentCount || 0) + 1 : (isSameDivision ? (existingSeasonAssignment?.reassignmentCount || 0) : 0),
          assignedAt: new Date() // Update timestamp
        },
        create: {
          divisionId,
          userId,
          assignedBy: adminId,
          notes: notes || (isReassignment ? `Reassigned from ${previousDivisionName || 'previous division'}` : (autoAssignment ? "Auto-assigned based on rating" : null)),
          reassignmentCount: isReassignment ? (existingSeasonAssignment?.reassignmentCount || 0) + 1 : 0
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

      // 🆕 Create or update division standing with initial zero stats
      // This ensures players appear in standings as soon as they join
      const existingStanding = await tx.divisionStanding.findFirst({
        where: { userId, divisionId }
      });

      if (!existingStanding) {
        await tx.divisionStanding.create({
          data: {
            divisionId,
            seasonId,
            userId,
            rank: 0, // Will be recalculated
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
            matchesScheduled: 9, // Default scheduled matches
            totalPoints: 0,
            countedWins: 0,
            countedLosses: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            best6SetsWon: 0,
            best6SetsTotal: 0,
            best6GamesWon: 0,
            best6GamesTotal: 0,
            winPoints: 0,
            setPoints: 0,
            completionBonus: 0,
            setDifferential: 0,
            headToHead: {},
          }
        });
        logger.info('Created initial standing for user in division', { userId, divisionId });
      }

      return { assignment, divisionThread };
    });

    // Update division counts
    await updateDivisionCounts(divisionId, true);
    // If reassigning, decrement old division count
    if (isReassignment && previousDivisionId) {
      await updateDivisionCounts(previousDivisionId, false);
    }

    // 🆕 Recalculate division ranks to include new player
    await recalculateDivisionRanks(divisionId);

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
        divisionThread.name || `${division.name} Chat`
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

    const assignedContext: Record<string, string> = {};
    if (adminId) assignedContext.adminId = adminId;
    logger.playerAssigned(userId, divisionId, seasonId, assignedContext);

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
      if (req.io && result.divisionThread) {
        req.io.to(result.divisionThread.id).emit('member_joined_division', {
          userId,
          userName: user.name,
          divisionId,
          divisionName: division.name,
          timestamp: new Date().toISOString()
        });

        // Notify the assigned user about joining the group chat
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

        logger.socketEvent('division_assignment', userId, { divisionId, threadId: result.divisionThread.id });
      }
    }

    return res.status(201).json({
      success: true,
      message: "User assigned to division and added to group chat successfully",
      data: {
        assignment: result.assignment,
        groupChat: {
          threadId: result.divisionThread.id,
          threadName: result.divisionThread.name,
          sportType: division.league?.sportType
        }
      }
    });

  } catch (error: unknown) {
    const body = req.body as AssignPlayerToDivisionBody;
    const errorContext: Record<string, string> = {};
    if (body.userId) errorContext.userId = body.userId;
    if (body.divisionId) errorContext.divisionId = body.divisionId;
    logger.error('Error assigning user to division', errorContext, error instanceof Error ? error : new Error('Unknown error'));

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 is unique constraint violation - but we're using upsert now, so this shouldn't happen
      // If it does, we'll retry the assignment
      if (error.code === "P2002") {
        const body = req.body as AssignPlayerToDivisionBody;
        const retryContext: Record<string, string> = {};
        if (body.userId) retryContext.userId = body.userId;
        if (body.divisionId) retryContext.divisionId = body.divisionId;
        logger.warn('Unique constraint violation during assignment - retrying with upsert', retryContext);
        // Try to complete the assignment using upsert
        try {
          if (!body.userId || !body.divisionId) {
            throw new Error('userId and divisionId are required for retry');
          }
          const retryAssignment = await prisma.divisionAssignment.upsert({
            where: {
              divisionId_userId: { divisionId: body.divisionId, userId: body.userId }
            },
            update: {
              assignedBy: body.assignedBy ? (await prisma.admin.findUnique({ where: { userId: body.assignedBy }, select: { id: true } }))?.id || null : null,
              assignedAt: new Date()
            },
            create: {
              divisionId: body.divisionId,
              userId: body.userId,
              assignedBy: body.assignedBy ? (await prisma.admin.findUnique({ where: { userId: body.assignedBy }, select: { id: true } }))?.id || null : null
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
          
          // Sync SeasonMembership
          if (body.userId && body.seasonId && body.divisionId) {
            await prisma.seasonMembership.updateMany({
              where: { userId: body.userId, seasonId: body.seasonId },
              data: { divisionId: body.divisionId }
            });
          }

          return res.status(200).json({
            success: true,
            message: "User assigned to division successfully",
            data: { assignment: retryAssignment }
          });
        } catch (retryError) {
          const body = req.body as AssignPlayerToDivisionBody;
          const retryErrorContext: Record<string, string> = {};
          if (body.userId) retryErrorContext.userId = body.userId;
          if (body.divisionId) retryErrorContext.divisionId = body.divisionId;
          logger.error('Retry assignment also failed', retryErrorContext, retryError instanceof Error ? retryError : new Error('Unknown retry error'));
          return res.status(500).json({
            success: false,
            error: "Failed to assign user to division after retry"
          });
        }
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid user, division, or admin ID"
        });
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: errorMessage || "Failed to assign user to division"
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

    const removeContext: Record<string, string> = {};
    if (userId) removeContext.userId = userId;
    if (divisionId) removeContext.divisionId = divisionId;
    if (reason) removeContext.reason = reason;
    logger.info('Removing player from division', removeContext);

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

      const removedNotifContext: Record<string, string> = { divisionId };
      if (reason) removedNotifContext.reason = reason;
      logger.notificationSent('DIVISION_REMOVED', [userId], removedNotifContext);
    } catch (notifError) {
      logger.error('Failed to send removal notification', { userId, divisionId }, notifError as Error);
    }

    logger.playerRemoved(userId, divisionId, reason || undefined, { seasonId: assignment.division.seasonId });

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
          if ((socket).userId === userId) {
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
    const removeErrorContext: Record<string, string> = {};
    if (req.params.userId) removeErrorContext.userId = req.params.userId;
    if (req.params.divisionId) removeErrorContext.divisionId = req.params.divisionId;
    logger.error('Error removing user from division', removeErrorContext, error instanceof Error ? error : new Error('Unknown error'));
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
    const transferContext: Record<string, string> = { fromDivisionId, toDivisionId };
    if ('fromDivision' in result && 'toDivision' in result && 'season' in result) {
      const transferResult = result as { fromDivision: { name: string }; toDivision: { name: string; seasonId: string }; season: { name: string } };
      try {
        const notif = notificationTemplates.division.transferred(
          transferResult.fromDivision.name,
          transferResult.toDivision.name,
          transferResult.season.name
        );

        await notificationService.createNotification({
          userIds: userId,
          ...notif,
          seasonId: transferResult.toDivision.seasonId,
        });

        transferContext.seasonId = transferResult.toDivision.seasonId;
        logger.notificationSent('DIVISION_TRANSFERRED', [userId], transferContext);
      } catch (notifError) {
        logger.error('Failed to send transfer notification', { userId, fromDivisionId, toDivisionId }, notifError as Error);
      }
    }

    const playerTransferredContext: Record<string, string> = {};
    if (reason) playerTransferredContext.reason = reason;
    if ('toDivision' in result && (result as { toDivision?: { seasonId?: string } }).toDivision?.seasonId) {
      playerTransferredContext.seasonId = (result as { toDivision: { seasonId: string } }).toDivision.seasonId;
    }
    logger.playerTransferred(userId, fromDivisionId, toDivisionId, playerTransferredContext);

    // Socket notifications
    if ((req as any).io && 'fromDivision' in result && 'toDivision' in result) {
      const socketResult = result as { fromDivision: { name: string }; toDivision: { name: string } };
      (req as any).io.to(userId).emit('division_transferred', {
        fromDivision: socketResult.fromDivision,
        toDivision: socketResult.toDivision,
        message: `Transferred from ${socketResult.fromDivision.name} to ${socketResult.toDivision.name}`,
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
    const assignmentsErrorContext: Record<string, string> = {};
    if (req.params.divisionId) assignmentsErrorContext.divisionId = req.params.divisionId;
    logger.error('Error fetching division assignments', assignmentsErrorContext, error as Error);
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
    const userAssignmentsErrorContext: Record<string, string> = {};
    if (req.params.userId) userAssignmentsErrorContext.userId = req.params.userId;
    logger.error('Error fetching user assignments', userAssignmentsErrorContext, error as Error);
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
      assignedCount: result.assignments?.length || 0,
      failedCount: result.errors?.length || 0 
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

    const queryParams: Parameters<typeof getDivisionsBySeasonIdService>[0] = {
      seasonId,
      page: Number(page),
      limit: Number(limit),
      ...(gameType !== undefined && { gameType: gameType as string }),
      ...(level !== undefined && { level: level as string }),
      ...(genderCategory !== undefined && { genderCategory: genderCategory as string }),
      includeAssignments: includeAssignments === 'true'
    };
    // Only include isActive if it's a valid boolean value
    if (isActive !== undefined && isActive !== '') {
      const isActiveValue = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
      if (isActiveValue !== undefined) {
        queryParams.isActive = isActiveValue;
      }
    }
    const result = await getDivisionsBySeasonIdService(queryParams);

    return res.json({
      success: true,
      data: result.divisions,
      season: result.season,
      pagination: result.pagination,
      filters: result.filters
    });

  } catch (error) {
    const divisionsBySeasonErrorContext: Record<string, string> = {};
    if (req.params.seasonId) divisionsBySeasonErrorContext.seasonId = req.params.seasonId;
    logger.error('Error fetching divisions by season', divisionsBySeasonErrorContext, error as Error);

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
    const summaryErrorContext: Record<string, string> = {};
    if (req.params.seasonId) summaryErrorContext.seasonId = req.params.seasonId;
    const summaryError = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error fetching division summary', summaryErrorContext, summaryError);
    return res.status(500).json({
      success: false,
      error: summaryError.message || "Failed to fetch division summary"
    });
  }
};

/**
 * Backfill standings for all players who are in divisions but don't have standing records yet.
 * This is a utility function to fix existing data where players joined before standings were auto-created.
 */
export const backfillDivisionStandings = async (req: Request, res: Response) => {
  try {
    const { seasonId, divisionId } = req.body;
    
    logger.info('Starting standings backfill', { seasonId, divisionId });

    // Build the query filter
    const assignmentFilter: any = {};
    if (divisionId) {
      assignmentFilter.divisionId = divisionId;
    }
    if (seasonId) {
      assignmentFilter.division = { seasonId };
    }

    // Get all division assignments
    const assignments = await prisma.divisionAssignment.findMany({
      where: assignmentFilter,
      include: {
        division: {
          select: {
            id: true,
            name: true,
            seasonId: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    logger.info(`Found ${assignments.length} division assignments to check`);

    let created = 0;
    let skipped = 0;
    const errors: Array<{ userId: string; divisionId: string; error: string }> = [];
    const createdStandings: Array<{ userId: string; userName: string; divisionId: string; divisionName: string }> = [];

    // Process each assignment
    for (const assignment of assignments) {
      try {
        // Check if standing already exists
        const existingStanding = await prisma.divisionStanding.findFirst({
          where: {
            userId: assignment.userId,
            divisionId: assignment.divisionId,
          }
        });

        if (existingStanding) {
          skipped++;
          continue;
        }

        // Create the standing with zero stats
        await prisma.divisionStanding.create({
          data: {
            divisionId: assignment.divisionId,
            seasonId: assignment.division.seasonId,
            userId: assignment.userId,
            rank: 0, // Will be recalculated
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
            matchesScheduled: 9,
            totalPoints: 0,
            countedWins: 0,
            countedLosses: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            best6SetsWon: 0,
            best6SetsTotal: 0,
            best6GamesWon: 0,
            best6GamesTotal: 0,
            winPoints: 0,
            setPoints: 0,
            completionBonus: 0,
            setDifferential: 0,
            headToHead: {},
          }
        });

        created++;
        createdStandings.push({
          userId: assignment.userId,
          userName: assignment.user?.name || 'Unknown',
          divisionId: assignment.divisionId,
          divisionName: assignment.division.name,
        });

        logger.info(`Created standing for user ${assignment.userId} in division ${assignment.division.name}`);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push({
          userId: assignment.userId,
          divisionId: assignment.divisionId,
          error: errorMessage,
        });
        logger.error('Error creating standing', { userId: assignment.userId, divisionId: assignment.divisionId }, err as Error);
      }
    }

    // Recalculate ranks for affected divisions
    const affectedDivisionIds = [...new Set(createdStandings.map(s => s.divisionId))];
    logger.info(`Recalculating ranks for ${affectedDivisionIds.length} divisions`);

    for (const divId of affectedDivisionIds) {
      try {
        await recalculateDivisionRanks(divId);
        logger.info(`Recalculated ranks for division ${divId}`);
      } catch (err) {
        logger.error('Error recalculating ranks', { divisionId: divId }, err as Error);
      }
    }

    const result = {
      success: true,
      message: `Backfill completed. Created ${created} standings, skipped ${skipped} existing.`,
      summary: {
        totalAssignments: assignments.length,
        created,
        skipped,
        errors: errors.length,
        divisionsUpdated: affectedDivisionIds.length,
      },
      createdStandings,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info('Standings backfill completed', result.summary);

    return res.json(result);

  } catch (error) {
    logger.error('Error in backfill standings', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: "Failed to backfill standings"
    });
  }
};

/**
 * Sync division counts based on actual DivisionAssignments.
 * This fixes any inconsistencies between currentSinglesCount/currentDoublesCount and actual assignments.
 * POST /api/division/sync-counts
 */
export const syncDivisionCounts = async (req: Request, res: Response) => {
  try {
    const { seasonId, divisionId } = req.body;
    
    logger.info('Starting division counts sync', { seasonId, divisionId });

    // Build where clause
    const whereClause: any = {};
    if (seasonId) whereClause.seasonId = seasonId;
    if (divisionId) whereClause.id = divisionId;

    // Get all divisions (or filtered by season/divisionId)
    const divisions = await prisma.division.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        gameType: true,
        currentSinglesCount: true,
        currentDoublesCount: true,
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    const updates: Array<{
      divisionId: string;
      divisionName: string;
      gameType: string;
      oldCount: number;
      newCount: number;
    }> = [];

    for (const division of divisions) {
      const actualCount = division._count.assignments;
      const isSingles = division.gameType === 'SINGLES';
      const currentCount = isSingles 
        ? division.currentSinglesCount 
        : division.currentDoublesCount;

      if (currentCount !== actualCount) {
        // Update the count
        await prisma.division.update({
          where: { id: division.id },
          data: isSingles 
            ? { currentSinglesCount: actualCount }
            : { currentDoublesCount: actualCount }
        });

        updates.push({
          divisionId: division.id,
          divisionName: division.name,
          gameType: division.gameType,
          oldCount: currentCount || 0,
          newCount: actualCount
        });
      }
    }

    const result = {
      success: true,
      message: `Synced ${updates.length} divisions`,
      summary: {
        totalDivisions: divisions.length,
        updatedDivisions: updates.length,
      },
      updates: updates.length > 0 ? updates : undefined,
    };

    logger.info('Division counts sync completed', result.summary);

    return res.json(result);

  } catch (error) {
    logger.error('Error syncing division counts', {}, error as Error);
    return res.status(500).json({
      success: false,
      error: "Failed to sync division counts"
    });
  }
};
