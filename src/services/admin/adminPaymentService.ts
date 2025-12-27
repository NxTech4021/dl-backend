/**
 * Admin Payment Service
 * Handles payment management operations for admin: list payments, update status, get stats
 * Works with SeasonMembership records and their paymentStatus field
 */

import { prisma } from '../../lib/prisma';
import { PaymentStatus, MembershipStatus, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

interface PaymentFilters {
  search?: string | undefined;
  seasonId?: string | undefined;
  status?: PaymentStatus | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'joinedAt' | 'user.name' | 'season.name' | 'season.entryFee' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

interface UpdatePaymentStatusInput {
  membershipId: string;
  adminId: string;
  paymentStatus: PaymentStatus;
  notes?: string;
}

interface BulkUpdatePaymentStatusInput {
  membershipIds: string[];
  adminId: string;
  paymentStatus: PaymentStatus;
  notes?: string;
}

/**
 * Get payments (SeasonMemberships) with filters and pagination
 */
export async function getPaymentsWithFilters(filters: PaymentFilters) {
  const {
    search,
    seasonId,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'joinedAt',
    sortOrder = 'desc'
  } = filters;

  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.SeasonMembershipWhereInput = {};

  // Only include memberships from seasons that require payment
  where.season = {
    paymentRequired: true
  };

  // Filter by season
  if (seasonId) {
    where.seasonId = seasonId;
  }

  // Filter by payment status
  if (status) {
    where.paymentStatus = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    where.joinedAt = {};
    if (startDate) {
      where.joinedAt.gte = startDate;
    }
    if (endDate) {
      where.joinedAt.lte = endDate;
    }
  }

  // Search by user name or username
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { displayUsername: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  // Build orderBy
  let orderBy: Prisma.SeasonMembershipOrderByWithRelationInput = {};
  switch (sortBy) {
    case 'user.name':
      orderBy = { user: { name: sortOrder } };
      break;
    case 'season.name':
      orderBy = { season: { name: sortOrder } };
      break;
    case 'season.entryFee':
      orderBy = { season: { entryFee: sortOrder } };
      break;
    case 'joinedAt':
    default:
      orderBy = { joinedAt: sortOrder };
      break;
  }

  // Execute query with count
  const [memberships, total] = await prisma.$transaction([
    prisma.seasonMembership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            displayUsername: true,
            image: true
          }
        },
        season: {
          select: {
            id: true,
            name: true,
            entryFee: true,
            paymentRequired: true,
            status: true
          }
        }
      },
      skip,
      take: limit,
      orderBy
    }),
    prisma.seasonMembership.count({ where })
  ]);

  // Transform to expected format
  const data = memberships.map(m => ({
    id: m.id,
    userId: m.userId,
    seasonId: m.seasonId,
    divisionId: m.divisionId,
    status: m.status,
    joinedAt: m.joinedAt,
    paymentStatus: m.paymentStatus,
    withdrawalReason: m.withdrawalReason,
    user: m.user,
    season: {
      ...m.season,
      sportType: null // Frontend expects this field but it's not on Season model
    }
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get payment statistics across all seasons (or for a specific season)
 */
export async function getPaymentStats(seasonId?: string) {
  // Base where clause - only seasons with payment required
  const baseWhere: Prisma.SeasonMembershipWhereInput = {
    season: {
      paymentRequired: true
    }
  };

  if (seasonId) {
    baseWhere.seasonId = seasonId;
  }

  // Get counts by payment status
  const [total, completed, pending, failed, membershipsWithFees] = await prisma.$transaction([
    // Total count
    prisma.seasonMembership.count({ where: baseWhere }),

    // Completed (paid) count
    prisma.seasonMembership.count({
      where: { ...baseWhere, paymentStatus: PaymentStatus.COMPLETED }
    }),

    // Pending count
    prisma.seasonMembership.count({
      where: { ...baseWhere, paymentStatus: PaymentStatus.PENDING }
    }),

    // Failed count
    prisma.seasonMembership.count({
      where: { ...baseWhere, paymentStatus: PaymentStatus.FAILED }
    }),

    // Get memberships with season entry fees for revenue calculation
    prisma.seasonMembership.findMany({
      where: baseWhere,
      select: {
        paymentStatus: true,
        season: {
          select: {
            entryFee: true
          }
        }
      }
    })
  ]);

  // Calculate revenue from completed payments
  let totalRevenue = 0;
  let outstandingAmount = 0;

  for (const membership of membershipsWithFees) {
    const entryFee = membership.season.entryFee?.toNumber() || 0;

    if (membership.paymentStatus === PaymentStatus.COMPLETED) {
      totalRevenue += entryFee;
    } else if (membership.paymentStatus === PaymentStatus.PENDING) {
      outstandingAmount += entryFee;
    }
  }

  return {
    total,
    completed,
    pending,
    failed,
    totalRevenue,
    outstandingAmount
  };
}

/**
 * Update payment status for a single membership
 */
export async function updatePaymentStatus(input: UpdatePaymentStatusInput) {
  const { membershipId, adminId, paymentStatus, notes } = input;

  // Verify membership exists
  const membership = await prisma.seasonMembership.findUnique({
    where: { id: membershipId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      season: { select: { id: true, name: true } }
    }
  });

  if (!membership) {
    throw new Error('Membership not found');
  }

  const previousStatus = membership.paymentStatus;

  // Update the membership
  const updatedMembership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: {
      paymentStatus,
      // If marking as completed, also set membership to active
      ...(paymentStatus === PaymentStatus.COMPLETED && membership.status === MembershipStatus.PENDING
        ? { status: MembershipStatus.ACTIVE }
        : {})
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          image: true
        }
      },
      season: {
        select: {
          id: true,
          name: true,
          entryFee: true,
          paymentRequired: true,
          status: true
        }
      }
    }
  });

  logger.info(
    `Payment status updated for membership ${membershipId}: ${previousStatus} -> ${paymentStatus} by admin ${adminId}`
  );

  return {
    membership: {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      seasonId: updatedMembership.seasonId,
      divisionId: updatedMembership.divisionId,
      status: updatedMembership.status,
      joinedAt: updatedMembership.joinedAt,
      paymentStatus: updatedMembership.paymentStatus,
      user: updatedMembership.user,
      season: {
        ...updatedMembership.season,
        sportType: null // Frontend expects this field but it's not on Season model
      }
    },
    previousStatus
  };
}

/**
 * Bulk update payment status for multiple memberships
 */
export async function bulkUpdatePaymentStatus(input: BulkUpdatePaymentStatusInput) {
  const { membershipIds, adminId, paymentStatus, notes } = input;

  if (!membershipIds || membershipIds.length === 0) {
    throw new Error('No membership IDs provided');
  }

  // Verify all memberships exist
  const memberships = await prisma.seasonMembership.findMany({
    where: { id: { in: membershipIds } },
    select: { id: true, paymentStatus: true, status: true }
  });

  if (memberships.length !== membershipIds.length) {
    const foundIds = memberships.map(m => m.id);
    const missingIds = membershipIds.filter(id => !foundIds.includes(id));
    throw new Error(`Memberships not found: ${missingIds.join(', ')}`);
  }

  // Update all memberships
  const updateData: Prisma.SeasonMembershipUpdateManyMutationInput = {
    paymentStatus
  };

  // If marking as completed, also set pending memberships to active
  if (paymentStatus === PaymentStatus.COMPLETED) {
    // We need to do this in a transaction with individual updates for conditional logic
    const results = await prisma.$transaction(
      membershipIds.map(id => {
        const membership = memberships.find(m => m.id === id);
        return prisma.seasonMembership.update({
          where: { id },
          data: {
            paymentStatus,
            ...(membership?.status === MembershipStatus.PENDING
              ? { status: MembershipStatus.ACTIVE }
              : {})
          }
        });
      })
    );

    logger.info(
      `Bulk payment status update: ${membershipIds.length} memberships updated to ${paymentStatus} by admin ${adminId}`
    );

    return {
      updated: results.length,
      paymentStatus
    };
  }

  // For non-COMPLETED status, we can use updateMany
  const result = await prisma.seasonMembership.updateMany({
    where: { id: { in: membershipIds } },
    data: updateData
  });

  logger.info(
    `Bulk payment status update: ${result.count} memberships updated to ${paymentStatus} by admin ${adminId}`
  );

  return {
    updated: result.count,
    paymentStatus
  };
}

/**
 * Get seasons that have payment required (for filter dropdown)
 */
export async function getSeasonsWithPayment() {
  const seasons = await prisma.season.findMany({
    where: { paymentRequired: true },
    select: {
      id: true,
      name: true,
      entryFee: true,
      status: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // Add sportType as null since frontend expects it
  return seasons.map(s => ({
    ...s,
    sportType: null
  }));
}
