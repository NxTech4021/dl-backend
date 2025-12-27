/**
 * Admin Log Service
 * Handles logging and retrieval of admin actions across the system
 */

import { prisma } from '../../lib/prisma';
import { AdminActionType, AdminTargetType, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

interface CreateAdminLogInput {
  adminId: string;
  actionType: AdminActionType;
  targetType: AdminTargetType;
  targetId?: string | undefined;
  description: string;
  oldValue?: Record<string, unknown> | undefined;
  newValue?: Record<string, unknown> | undefined;
  metadata?: Record<string, unknown> | undefined;
}

interface GetAdminLogsOptions {
  page?: number | undefined;
  limit?: number | undefined;
  adminId?: string | undefined;
  actionType?: AdminActionType | undefined;
  targetType?: AdminTargetType | undefined;
  targetId?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  search?: string | undefined;
}

/**
 * Create an admin log entry
 */
export async function createAdminLog(input: CreateAdminLogInput) {
  const { adminId, actionType, targetType, targetId, description, oldValue, newValue, metadata } = input;

  try {
    // Verify admin exists
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { id: true }
    });

    if (!admin) {
      logger.warn(`Admin log creation failed: Admin not found for userId ${adminId}`);
      return null;
    }

    const log = await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        actionType,
        targetType,
        targetId: targetId || null,
        description,
        oldValue: oldValue ? oldValue as Prisma.InputJsonValue : Prisma.JsonNull,
        newValue: newValue ? newValue as Prisma.InputJsonValue : Prisma.JsonNull,
        metadata: metadata ? metadata as Prisma.InputJsonValue : Prisma.JsonNull
      }
    });

    logger.info(`Admin action logged: ${actionType} on ${targetType}${targetId ? ` (${targetId})` : ''} by admin ${adminId}`);

    return log;
  } catch (error: unknown) {
    logger.error('Failed to create admin log:', { error: error instanceof Error ? error.message : String(error) });
    // Don't throw - logging should not break the main operation
    return null;
  }
}

/**
 * Get admin logs with filtering and pagination
 */
export async function getAdminLogs(options?: GetAdminLogsOptions) {
  const {
    page = 1,
    limit = 50,
    adminId,
    actionType,
    targetType,
    targetId,
    startDate,
    endDate,
    search
  } = options || {};

  const skip = (page - 1) * limit;

  const where: Prisma.AdminLogWhereInput = {};

  if (adminId) {
    // Need to find the admin by userId first
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { id: true }
    });
    if (admin) {
      where.adminId = admin.id;
    }
  }

  if (actionType) {
    where.actionType = actionType;
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (targetId) {
    where.targetId = targetId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  if (search) {
    where.description = {
      contains: search,
      mode: 'insensitive'
    };
  }

  const [logs, total] = await prisma.$transaction([
    prisma.adminLog.findMany({
      where,
      include: {
        admin: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.adminLog.count({ where })
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      description: log.description,
      oldValue: log.oldValue,
      newValue: log.newValue,
      metadata: log.metadata,
      createdAt: log.createdAt,
      admin: log.admin.user ? {
        id: log.admin.user.id,
        name: log.admin.user.name,
        email: log.admin.user.email,
        image: log.admin.user.image
      } : null
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get logs for a specific target (e.g., all actions on a specific player)
 */
export async function getTargetLogs(targetType: AdminTargetType, targetId: string, options?: {
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const { page = 1, limit = 20 } = options || {};
  const skip = (page - 1) * limit;

  const [logs, total] = await prisma.$transaction([
    prisma.adminLog.findMany({
      where: {
        targetType,
        targetId
      },
      include: {
        admin: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.adminLog.count({
      where: {
        targetType,
        targetId
      }
    })
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      actionType: log.actionType,
      description: log.description,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt,
      admin: log.admin.user ? {
        name: log.admin.user.name,
        email: log.admin.user.email
      } : null
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get admin activity summary (for dashboard)
 */
export async function getAdminActivitySummary(options?: {
  days?: number | undefined;
  adminId?: string | undefined;
}) {
  const { days = 30, adminId } = options || {};
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where: Prisma.AdminLogWhereInput = {
    createdAt: { gte: startDate }
  };

  if (adminId) {
    const admin = await prisma.admin.findFirst({
      where: { userId: adminId },
      select: { id: true }
    });
    if (admin) {
      where.adminId = admin.id;
    }
  }

  // Get counts by action type
  const actionCounts = await prisma.adminLog.groupBy({
    by: ['actionType'],
    where,
    _count: true
  });

  // Get counts by target type
  const targetCounts = await prisma.adminLog.groupBy({
    by: ['targetType'],
    where,
    _count: true
  });

  // Get daily counts
  const logs = await prisma.adminLog.findMany({
    where,
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const dailyCounts: Record<string, number> = {};
  logs.forEach(log => {
    const dateKey = log.createdAt.toISOString().split('T')[0] ?? '';
    if (dateKey) {
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  // Get total count
  const totalActions = await prisma.adminLog.count({ where });

  return {
    totalActions,
    byActionType: actionCounts.map(item => ({
      actionType: item.actionType,
      count: item._count
    })),
    byTargetType: targetCounts.map(item => ({
      targetType: item.targetType,
      count: item._count
    })),
    dailyCounts: Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count
    })),
    period: {
      startDate,
      endDate: new Date(),
      days
    }
  };
}

// Helper functions for common logging scenarios

/**
 * Log a player action
 */
export function logPlayerAction(
  adminId: string,
  actionType: AdminActionType,
  playerId: string,
  description: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  return createAdminLog({
    adminId,
    actionType,
    targetType: AdminTargetType.PLAYER,
    targetId: playerId,
    description,
    oldValue,
    newValue,
    metadata
  });
}

/**
 * Log a league action
 */
export function logLeagueAction(
  adminId: string,
  actionType: AdminActionType,
  leagueId: string,
  description: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  return createAdminLog({
    adminId,
    actionType,
    targetType: AdminTargetType.LEAGUE,
    targetId: leagueId,
    description,
    oldValue,
    newValue,
    metadata
  });
}

/**
 * Log a match action
 */
export function logMatchAction(
  adminId: string,
  actionType: AdminActionType,
  matchId: string,
  description: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  return createAdminLog({
    adminId,
    actionType,
    targetType: AdminTargetType.MATCH,
    targetId: matchId,
    description,
    oldValue,
    newValue,
    metadata
  });
}

/**
 * Log a settings change
 */
export function logSettingsAction(
  adminId: string,
  settingName: string,
  description: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  return createAdminLog({
    adminId,
    actionType: AdminActionType.SETTINGS_UPDATE,
    targetType: AdminTargetType.SETTINGS,
    targetId: settingName,
    description,
    oldValue,
    newValue,
    metadata
  });
}
