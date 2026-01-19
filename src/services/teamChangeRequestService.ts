/**
 * Team Change Request Service
 * Handles team/division change request lifecycle with transaction safety
 */

import { prisma } from '../lib/prisma';
import { TeamChangeRequestStatus } from '@prisma/client';
import { NotificationService } from './notificationService';
import { notifyAdminsTeamChange } from './notification/adminNotificationService';

// Types
export interface CreateTeamChangeRequestInput {
  userId: string;
  currentDivisionId: string;
  requestedDivisionId: string;
  seasonId: string;
  reason?: string;
}

export interface ProcessTeamChangeRequestInput {
  requestId: string;
  status: 'APPROVED' | 'DENIED';
  adminId: string;
  adminNotes?: string;
}

export interface FormattedTeamChangeRequest {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    username: string;
  } | null;
  currentDivisionId: string;
  currentDivision: {
    id: string;
    name: string;
  } | null;
  requestedDivisionId: string;
  requestedDivision: {
    id: string;
    name: string;
  } | null;
  seasonId: string;
  season: {
    id: string;
    name: string;
  } | null;
  reason: string | null;
  status: TeamChangeRequestStatus;
  reviewedByAdminId: string | null;
  reviewedByAdmin: {
    id: string;
    user: {
      name: string;
    } | null;
  } | null;
  reviewedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Include query for consistent data fetching
const teamChangeRequestInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      username: true
    }
  },
  currentDivision: {
    select: {
      id: true,
      name: true
    }
  },
  requestedDivision: {
    select: {
      id: true,
      name: true
    }
  },
  season: {
    select: {
      id: true,
      name: true
    }
  },
  reviewedByAdmin: {
    select: {
      id: true,
      user: {
        select: {
          name: true
        }
      }
    }
  }
};

/**
 * Create a new team change request
 */
export async function createTeamChangeRequest(
  data: CreateTeamChangeRequestInput
): Promise<FormattedTeamChangeRequest> {
  const { userId, currentDivisionId, requestedDivisionId, seasonId, reason } = data;

  // Validate divisions exist and are in same season
  const [currentDivision, requestedDivision] = await Promise.all([
    prisma.division.findUnique({
      where: { id: currentDivisionId },
      select: { id: true, name: true, seasonId: true }
    }),
    prisma.division.findUnique({
      where: { id: requestedDivisionId },
      select: { id: true, name: true, seasonId: true }
    })
  ]);

  if (!currentDivision) {
    throw new Error('Current division not found');
  }

  if (!requestedDivision) {
    throw new Error('Requested division not found');
  }

  if (currentDivision.seasonId !== requestedDivision.seasonId) {
    throw new Error('Cannot request transfer between divisions in different seasons');
  }

  if (currentDivision.seasonId !== seasonId) {
    throw new Error('Division does not belong to the specified season');
  }

  // Check if user already has a pending request
  const existingRequest = await prisma.teamChangeRequest.findFirst({
    where: {
      userId,
      seasonId,
      status: 'PENDING'
    }
  });

  if (existingRequest) {
    throw new Error('You already have a pending team change request for this season');
  }

  // Create the request
  const request = await prisma.teamChangeRequest.create({
    data: {
      userId,
      currentDivisionId,
      requestedDivisionId,
      seasonId,
      reason: reason || null,
      status: 'PENDING'
    },
    include: teamChangeRequestInclude
  });

  // Get user info for notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });

  // Notify admins
  try {
    const notificationService = new NotificationService();
    await notifyAdminsTeamChange(notificationService, {
      playerName: user?.name || 'Unknown Player',
      currentTeam: currentDivision.name,
      requestedTeam: requestedDivision.name,
      seasonId,
      requestId: request.id
    });
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    // Don't fail the request if notification fails
  }

  console.log(`✅ Team change request ${request.id} created for user ${userId}`);

  return request as FormattedTeamChangeRequest;
}

/**
 * Process a team change request (APPROVE or DENY)
 */
export async function processTeamChangeRequest(
  data: ProcessTeamChangeRequestInput
): Promise<FormattedTeamChangeRequest> {
  const { requestId, status, adminId, adminNotes } = data;

  // Get the request
  const request = await prisma.teamChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, name: true } },
      currentDivision: { select: { id: true, name: true, seasonId: true, gameType: true } },
      requestedDivision: { select: { id: true, name: true, gameType: true } }
    }
  });

  if (!request) {
    throw new Error('Team change request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Request has already been ${request.status.toLowerCase()}`);
  }

  // Get admin info
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  // Process in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update the request
    const updatedRequest = await tx.teamChangeRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null
      },
      include: teamChangeRequestInclude
    });

    // If approved, perform the actual transfer
    if (status === 'APPROVED') {
      // Remove from current division
      await tx.divisionAssignment.deleteMany({
        where: {
          divisionId: request.currentDivisionId,
          userId: request.userId
        }
      });

      // Get current assignment for reassignment count
      const currentAssignment = await tx.divisionAssignment.findFirst({
        where: {
          divisionId: request.currentDivisionId,
          userId: request.userId
        }
      });

      // Create new assignment
      await tx.divisionAssignment.create({
        data: {
          divisionId: request.requestedDivisionId,
          userId: request.userId,
          assignedBy: adminId,
          reassignmentCount: (currentAssignment?.reassignmentCount || 0) + 1,
          notes: `Transferred via team change request: ${request.reason || 'No reason provided'}`
        }
      });

      // Update season membership
      await tx.seasonMembership.updateMany({
        where: {
          userId: request.userId,
          seasonId: request.currentDivision!.seasonId,
          divisionId: request.currentDivisionId
        },
        data: {
          divisionId: request.requestedDivisionId
        }
      });

      // Update division counts
      await tx.division.update({
        where: { id: request.currentDivisionId },
        data: {
          currentSinglesCount: { decrement: 1 }
        }
      });

      await tx.division.update({
        where: { id: request.requestedDivisionId },
        data: {
          currentSinglesCount: { increment: 1 }
        }
      });

      console.log(`✅ Player ${request.userId} transferred from ${request.currentDivision?.name} to ${request.requestedDivision?.name}`);
    }

    return updatedRequest;
  });

  console.log(`✅ Team change request ${requestId} ${status} by admin ${adminId}`);

  return result as FormattedTeamChangeRequest;
}

/**
 * Get all team change requests with optional filters
 */
export async function getTeamChangeRequests(filters?: {
  seasonId?: string;
  status?: TeamChangeRequestStatus;
  userId?: string;
}): Promise<FormattedTeamChangeRequest[]> {
  const where: any = {};

  if (filters?.seasonId) {
    where.seasonId = filters.seasonId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  const requests = await prisma.teamChangeRequest.findMany({
    where,
    include: teamChangeRequestInclude,
    orderBy: { createdAt: 'desc' }
  });

  return requests as FormattedTeamChangeRequest[];
}

/**
 * Get a team change request by ID
 */
export async function getTeamChangeRequestById(
  requestId: string
): Promise<FormattedTeamChangeRequest | null> {
  const request = await prisma.teamChangeRequest.findUnique({
    where: { id: requestId },
    include: teamChangeRequestInclude
  });

  return request as FormattedTeamChangeRequest | null;
}

/**
 * Cancel a pending team change request
 * Users can only cancel their own requests, admins can cancel any request
 */
export async function cancelTeamChangeRequest(
  requestId: string,
  userId: string,
  isAdminUser: boolean = false
): Promise<FormattedTeamChangeRequest> {
  const request = await prisma.teamChangeRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new Error('Team change request not found');
  }

  // Admins can cancel any request, users can only cancel their own
  if (!isAdminUser && request.userId !== userId) {
    throw new Error('You can only cancel your own requests');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot cancel a request that has been ${request.status.toLowerCase()}`);
  }

  const updated = await prisma.teamChangeRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
    include: teamChangeRequestInclude
  });

  const cancelledBy = isAdminUser && request.userId !== userId ? `admin ${userId}` : `user ${userId}`;
  console.log(`✅ Team change request ${requestId} cancelled by ${cancelledBy}`);

  return updated as FormattedTeamChangeRequest;
}

/**
 * Get pending team change requests count
 */
export async function getPendingTeamChangeRequestsCount(): Promise<number> {
  return prisma.teamChangeRequest.count({
    where: { status: 'PENDING' }
  });
}
