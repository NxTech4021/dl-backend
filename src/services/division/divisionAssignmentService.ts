/**
 * Division Assignment Service
 * Handles player/team assignment operations
 * DEPENDS ON: divisionCapacityService, divisionValidationService
 */

import { prisma } from '../../lib/prisma';
import { Prisma, GameType } from "@prisma/client";
import { checkDivisionCapacity, updateDivisionCounts, updateDivisionCountsInTransaction } from './divisionCapacityService';

/**
 * Assign player data
 */
export interface AssignPlayerData {
  userId: string;
  divisionId: string;
  seasonId: string;
  adminId?: string | null;
  notes?: string | null;
  autoAssignment?: boolean;
}

/**
 * Assign a player to a division
 * @param data - Assignment data
 * @returns Created assignment with relations
 */
export async function assignPlayerToDivision(data: AssignPlayerData) {
  const { userId, divisionId, seasonId, adminId, notes, autoAssignment } = data;

  // Check if user is already assigned to this division
  const existingAssignment = await prisma.divisionAssignment.findUnique({
    where: { divisionId_userId: { divisionId, userId } }
  });

  if (existingAssignment) {
    throw new Error("User is already assigned to this division");
  }

  // Check if user has season membership
  let seasonMembership = await prisma.seasonMembership.findUnique({
    where: { userId_seasonId_divisionId: { userId, seasonId, divisionId } }
  });

  // Create or update season membership
  if (!seasonMembership) {
    // Check if user has any membership in this season
    const existingMembership = await prisma.seasonMembership.findFirst({
      where: { userId, seasonId }
    });

    if (existingMembership) {
      // Update existing membership to include division
      seasonMembership = await prisma.seasonMembership.update({
        where: { id: existingMembership.id },
        data: { divisionId }
      });
    } else {
      // Create new season membership
      seasonMembership = await prisma.seasonMembership.create({
        data: {
          userId,
          seasonId,
          divisionId,
          status: "ACTIVE"
        }
      });
    }
  }

  // Create division assignment
  const assignment = await prisma.divisionAssignment.create({
    data: {
      divisionId,
      userId,
      assignedBy: adminId ?? null,
      notes: notes ?? (autoAssignment ? "Auto-assigned based on rating" : null)
    },
    include: {
      user: { select: { id: true, name: true, username: true } },
      division: { select: { id: true, name: true, level: true, gameType: true } },
    }
  });

  // Update division counts
  await updateDivisionCounts(divisionId, true);

  console.log(`✅ User ${userId} assigned to division ${divisionId} successfully`);

  return assignment;
}

/**
 * Remove player from division
 * @param divisionId - Division ID
 * @param userId - User ID
 * @returns Removed assignment info
 */
export async function removePlayerFromDivision(
  divisionId: string,
  userId: string
) {
  // Check if assignment exists
  const assignment = await prisma.divisionAssignment.findUnique({
    where: { divisionId_userId: { divisionId, userId } },
    include: {
      user: { select: { name: true } },
      division: { select: { name: true, seasonId: true, gameType: true } }
    }
  });

  if (!assignment) {
    throw new Error("User is not assigned to this division");
  }

  // Remove the assignment
  await prisma.divisionAssignment.delete({
    where: { divisionId_userId: { divisionId, userId } }
  });

  // Update season membership to remove division
  await prisma.seasonMembership.updateMany({
    where: {
      userId,
      seasonId: assignment.division.seasonId,
      divisionId
    },
    data: { divisionId: null }
  });

  // Update division counts
  await updateDivisionCounts(divisionId, false);

  console.log(`✅ User ${userId} removed from division ${divisionId}`);

  return assignment;
}

/**
 * Get division assignments with pagination
 * @param divisionId - Division ID
 * @param page - Page number
 * @param limit - Items per page
 * @returns Assignments and metadata
 */
export async function getDivisionAssignments(
  divisionId: string,
  page: number = 1,
  limit: number = 20
) {
  console.log(`📋 Fetching assignments for division ${divisionId}`);

  const skip = (Number(page) - 1) * Number(limit);

  const [assignments, totalCount, division] = await Promise.all([
    prisma.divisionAssignment.findMany({
      where: { divisionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            email: true
          }
        },
        assignedByAdmin: {
          select: {
            id: true,
            userId: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.divisionAssignment.count({ where: { divisionId } }),
    prisma.division.findUnique({
      where: { id: divisionId },
      select: {
        name: true,
        maxSinglesPlayers: true,
        maxDoublesTeams: true,
        currentSinglesCount: true,
        currentDoublesCount: true,
        gameType: true
      }
    })
  ]);

  console.log(`✅ Found ${assignments.length} assignments for division ${divisionId}`);

  return {
    assignments,
    division,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / Number(limit))
    }
  };
}

/**
 * Get user's division assignments
 * @param userId - User ID
 * @returns User's assignments
 */
export async function getUserDivisionAssignments(userId: string) {
  console.log(`👤 Fetching division assignments for user ${userId}`);

  const assignments = await prisma.divisionAssignment.findMany({
    where: { userId },
    include: {
      division: {
        select: {
          id: true,
          name: true,
          level: true,
          gameType: true,
          genderCategory: true,
          season: {
            select: {
              id: true,
              name: true,
              isActive: true,
              startDate: true,
              endDate: true
            }
          }
        }
      },
      assignedByAdmin: {
        select: { id: true, userId: true }
      }
    },
    orderBy: { assignedAt: 'desc' }
  });

  console.log(`✅ Found ${assignments.length} assignments for user ${userId}`);

  return assignments;
}

/**
 * Auto-assign players to divisions based on rating
 * @param seasonId - Season ID
 * @param assignedBy - Admin ID (optional)
 * @returns Assignment results
 */
export async function autoAssignPlayersToDivisions(
  seasonId: string,
  assignedBy?: string | null
) {
  console.log(`🤖 Starting auto-assignment for season ${seasonId}`);

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
    throw new Error("No divisions available for auto-assignment");
  }

  const assignments = [];
  const errors = [];

  for (const membership of unassignedUsers) {
    try {
      const userRating = membership.user.initialRatingResult?.[0]?.rating || 0;

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
      } else {
        errors.push({
          userId: membership.userId,
          userName: membership.user.name,
          reason: "No suitable division found or all divisions at capacity"
        });
      }

    } catch (error: any) {
      errors.push({
        userId: membership.userId,
        userName: membership.user.name,
        reason: error.message
      });
    }
  }

  console.log(`✅ Auto-assignment completed: ${assignments.length} successful, ${errors.length} failed`);

  return {
    assignmentsCreated: assignments.length,
    assignments,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Transfer player between divisions (within same season)
 * @param userId - User ID
 * @param fromDivisionId - Source division ID
 * @param toDivisionId - Target division ID
 * @param transferredBy - Admin ID (optional)
 * @param reason - Transfer reason (optional)
 * @returns New assignment
 */
export async function transferPlayerBetweenDivisions(
  userId: string,
  fromDivisionId: string,
  toDivisionId: string,
  transferredBy?: string | null,
  reason?: string | null
) {
  console.log(`🔄 Transferring user ${userId} from division ${fromDivisionId} to ${toDivisionId}`);

  // Verify current assignment exists
  const currentAssignment = await prisma.divisionAssignment.findUnique({
    where: { divisionId_userId: { divisionId: fromDivisionId, userId } },
    include: {
      division: { select: { seasonId: true, name: true } }
    }
  });

  if (!currentAssignment) {
    throw new Error("User is not currently assigned to the source division");
  }

  // Check target division
  const targetDivision = await prisma.division.findUnique({
    where: { id: toDivisionId },
    select: {
      id: true,
      name: true,
      seasonId: true,
      gameType: true,
      isActiveDivision: true
    }
  });

  if (!targetDivision) {
    throw new Error("Target division not found");
  }

  // Verify both divisions are in the same season
  if (currentAssignment.division.seasonId !== targetDivision.seasonId) {
    throw new Error("Cannot transfer between divisions in different seasons");
  }

  // Check target division capacity
  const capacityCheck = await checkDivisionCapacity(toDivisionId, targetDivision.gameType);
  if (!capacityCheck.hasCapacity) {
    throw new Error("Target division is at full capacity");
  }

  // Perform transfer in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Remove from current division
    await tx.divisionAssignment.delete({
      where: { divisionId_userId: { divisionId: fromDivisionId, userId } }
    });

    // Create new assignment
    const newAssignment = await tx.divisionAssignment.create({
      data: {
        divisionId: toDivisionId,
        userId,
        assignedBy: transferredBy || null,
        reassignmentCount: currentAssignment.reassignmentCount + 1,
        notes: reason || "Transferred between divisions"
      },
      include: {
        user: { select: { name: true } },
        division: { select: { name: true } }
      }
    });

    await tx.seasonMembership.updateMany({
      where: {
        userId,
        seasonId: targetDivision.seasonId,
        divisionId: fromDivisionId
      },
      data: { divisionId: toDivisionId }
    });

    return newAssignment;
  });

  // Update division counts (outside transaction to avoid deadlocks)
  await updateDivisionCounts(fromDivisionId, false); // Decrement source
  await updateDivisionCounts(toDivisionId, true);     // Increment target

  console.log(`✅ User ${userId} transferred successfully`);

  return result;
}
