/**
 * User Activity Log Service
 * Handles logging and retrieval of player/user actions across the system.
 * Logging functions are fire-and-forget — they never throw.
 */

import { prisma } from '../lib/prisma';
import { UserActionType, UserTargetType, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

// ========================================
// Core Logging (fire-and-forget)
// ========================================

interface LogUserActivityInput {
  userId: string;
  actionType: UserActionType;
  targetType: UserTargetType;
  targetId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
}

/**
 * Create a user activity log entry.
 * Fire-and-forget: never throws, catches errors internally.
 */
export async function logUserActivity(input: LogUserActivityInput): Promise<void> {
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: input.userId,
        actionType: input.actionType,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to log user activity:', {
      error: error instanceof Error ? error.message : String(error),
      input: { userId: input.userId, actionType: input.actionType, targetType: input.targetType },
    });
  }
}

// ========================================
// Convenience Helpers
// ========================================

export function logMatchActivity(
  userId: string,
  actionType: UserActionType,
  matchId: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  return logUserActivity({ userId, actionType, targetType: UserTargetType.MATCH, targetId: matchId, metadata, ipAddress });
}

export function logPairingActivity(
  userId: string,
  actionType: UserActionType,
  partnershipOrRequestId: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  return logUserActivity({ userId, actionType, targetType: UserTargetType.PARTNERSHIP, targetId: partnershipOrRequestId, metadata, ipAddress });
}

export function logPaymentActivity(
  userId: string,
  actionType: UserActionType,
  paymentOrMembershipId: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  return logUserActivity({ userId, actionType, targetType: UserTargetType.PAYMENT, targetId: paymentOrMembershipId, metadata, ipAddress });
}

export function logSeasonActivity(
  userId: string,
  actionType: UserActionType,
  seasonId: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  return logUserActivity({ userId, actionType, targetType: UserTargetType.SEASON, targetId: seasonId, metadata, ipAddress });
}

// ========================================
// Query Functions (admin-facing)
// ========================================

interface GetUserActivityLogsOptions {
  page?: number | undefined;
  limit?: number | undefined;
  userId?: string | undefined;
  actionType?: UserActionType | undefined;
  targetType?: UserTargetType | undefined;
  targetId?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

/**
 * Get paginated user activity logs with filters (admin-only).
 */
export async function getUserActivityLogs(options?: GetUserActivityLogsOptions) {
  const {
    page = 1,
    limit = 50,
    userId,
    actionType,
    targetType,
    targetId,
    startDate,
    endDate,
  } = options || {};

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const skip = (page - 1) * safeLimit;

  const where: Prisma.UserActivityLogWhereInput = {};

  if (userId) where.userId = userId;
  if (actionType) where.actionType = actionType;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await prisma.$transaction([
    prisma.userActivityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.userActivityLog.count({ where }),
  ]);

  return {
    data: logs.map(log => ({
      id: log.id,
      userId: log.userId,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      user: {
        id: log.user.id,
        name: log.user.name,
        email: log.user.email,
        image: log.user.image,
        username: log.user.username,
      },
    })),
    pagination: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}
