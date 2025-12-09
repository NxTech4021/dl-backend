/**
 * Admin Player Service
 * Handles player management operations: ban, unban, delete, status changes
 */

import { prisma } from '../../lib/prisma';
import { UserStatus, StatusChangeReason, Prisma, AdminActionType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { logPlayerAction } from './adminLogService';

interface BanPlayerInput {
  playerId: string;
  adminId: string;
  reason: string;
  notes?: string;
}

interface UnbanPlayerInput {
  playerId: string;
  adminId: string;
  notes?: string;
}

interface DeletePlayerInput {
  playerId: string;
  adminId: string;
  reason: string;
  hardDelete?: boolean;
}

interface UpdatePlayerStatusInput {
  playerId: string;
  adminId: string;
  newStatus: UserStatus;
  reason: StatusChangeReason;
  notes?: string;
}

interface AdminUpdatePlayerInput {
  playerId: string;
  adminId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  area?: string;
  bio?: string;
  gender?: string;
  dateOfBirth?: string;
}

/**
 * Ban a player
 * Sets status to BANNED and records the status change
 */
export async function banPlayer(input: BanPlayerInput) {
  const { playerId, adminId, reason, notes } = input;

  // Verify player exists and is not already banned
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, status: true, name: true, email: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  if (player.status === UserStatus.BANNED) {
    throw new Error('Player is already banned');
  }

  if (player.status === UserStatus.DELETED) {
    throw new Error('Cannot ban a deleted player');
  }

  // Get admin info for the record
  const admin = await prisma.admin.findFirst({
    where: { userId: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  // Update player status and create status change record
  const [updatedPlayer, statusChange] = await prisma.$transaction([
    prisma.user.update({
      where: { id: playerId },
      data: { status: UserStatus.BANNED }
    }),
    prisma.playerStatusChange.create({
      data: {
        userId: playerId,
        previousStatus: player.status,
        newStatus: UserStatus.BANNED,
        reason: StatusChangeReason.ADMIN_BAN,
        notes: notes ? `${reason}\n\nNotes: ${notes}` : reason,
        triggeredById: admin.id
      }
    })
  ]);

  logger.info(`Player ${playerId} banned by admin ${adminId}. Reason: ${reason}`);

  // Log admin action
  await logPlayerAction(
    adminId,
    AdminActionType.PLAYER_BAN,
    playerId,
    `Banned player ${player.name || player.email}`,
    { status: player.status, name: player.name, email: player.email },
    { status: UserStatus.BANNED },
    { reason, notes }
  );

  return {
    player: updatedPlayer,
    statusChange,
    previousStatus: player.status
  };
}

/**
 * Unban a player
 * Sets status back to ACTIVE and records the status change
 */
export async function unbanPlayer(input: UnbanPlayerInput) {
  const { playerId, adminId, notes } = input;

  // Verify player exists and is banned
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, status: true, name: true, email: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  if (player.status !== UserStatus.BANNED) {
    throw new Error('Player is not banned');
  }

  // Get admin info for the record
  const admin = await prisma.admin.findFirst({
    where: { userId: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  // Update player status and create status change record
  const [updatedPlayer, statusChange] = await prisma.$transaction([
    prisma.user.update({
      where: { id: playerId },
      data: { status: UserStatus.ACTIVE }
    }),
    prisma.playerStatusChange.create({
      data: {
        userId: playerId,
        previousStatus: UserStatus.BANNED,
        newStatus: UserStatus.ACTIVE,
        reason: StatusChangeReason.ADMIN_UNBAN,
        notes: notes || 'Ban lifted by admin',
        triggeredById: admin.id
      }
    })
  ]);

  logger.info(`Player ${playerId} unbanned by admin ${adminId}`);

  // Log admin action
  await logPlayerAction(
    adminId,
    AdminActionType.PLAYER_UNBAN,
    playerId,
    `Unbanned player ${player.name || player.email}`,
    { status: UserStatus.BANNED },
    { status: UserStatus.ACTIVE },
    { notes }
  );

  return {
    player: updatedPlayer,
    statusChange,
    previousStatus: UserStatus.BANNED
  };
}

/**
 * Soft delete a player
 * Sets status to DELETED, player can no longer login but data is retained
 */
export async function deletePlayer(input: DeletePlayerInput) {
  const { playerId, adminId, reason, hardDelete = false } = input;

  // Verify player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, status: true, name: true, email: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  if (player.status === UserStatus.DELETED) {
    throw new Error('Player is already deleted');
  }

  // Get admin info for the record
  const admin = await prisma.admin.findFirst({
    where: { userId: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  if (hardDelete) {
    // Hard delete - permanently remove all player data
    // This is irreversible and should be used with caution
    await prisma.$transaction([
      // Record the deletion first
      prisma.playerStatusChange.create({
        data: {
          userId: playerId,
          previousStatus: player.status,
          newStatus: UserStatus.DELETED,
          reason: StatusChangeReason.ADMIN_DELETE,
          notes: `HARD DELETE: ${reason}`,
          triggeredById: admin.id
        }
      }),
      // Then delete the user (cascades will handle related records)
      prisma.user.delete({
        where: { id: playerId }
      })
    ]);

    logger.warn(`Player ${playerId} HARD DELETED by admin ${adminId}. Reason: ${reason}`);

    // Log admin action
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_DELETE,
      playerId,
      `Hard deleted player ${player.name || player.email}`,
      { status: player.status, name: player.name, email: player.email },
      { deleted: true, hardDelete: true },
      { reason, hardDelete: true }
    );

    return {
      deleted: true,
      hardDelete: true,
      previousStatus: player.status
    };
  }

  // Soft delete - mark as deleted but retain data
  const [updatedPlayer, statusChange] = await prisma.$transaction([
    prisma.user.update({
      where: { id: playerId },
      data: { status: UserStatus.DELETED }
    }),
    prisma.playerStatusChange.create({
      data: {
        userId: playerId,
        previousStatus: player.status,
        newStatus: UserStatus.DELETED,
        reason: StatusChangeReason.ADMIN_DELETE,
        notes: reason,
        triggeredById: admin.id
      }
    })
  ]);

  logger.info(`Player ${playerId} soft deleted by admin ${adminId}. Reason: ${reason}`);

  // Log admin action
  await logPlayerAction(
    adminId,
    AdminActionType.PLAYER_DELETE,
    playerId,
    `Soft deleted player ${player.name || player.email}`,
    { status: player.status, name: player.name, email: player.email },
    { status: UserStatus.DELETED },
    { reason, hardDelete: false }
  );

  return {
    player: updatedPlayer,
    statusChange,
    deleted: true,
    hardDelete: false,
    previousStatus: player.status
  };
}

/**
 * Update player status (generic status change)
 */
export async function updatePlayerStatus(input: UpdatePlayerStatusInput) {
  const { playerId, adminId, newStatus, reason, notes } = input;

  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, status: true, name: true, email: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  if (player.status === newStatus) {
    throw new Error(`Player is already ${newStatus}`);
  }

  const admin = await prisma.admin.findFirst({
    where: { userId: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  const [updatedPlayer, statusChange] = await prisma.$transaction([
    prisma.user.update({
      where: { id: playerId },
      data: { status: newStatus }
    }),
    prisma.playerStatusChange.create({
      data: {
        userId: playerId,
        previousStatus: player.status,
        newStatus,
        reason,
        notes: notes || null,
        triggeredById: admin.id
      }
    })
  ]);

  logger.info(`Player ${playerId} status changed to ${newStatus} by admin ${adminId}`);

  // Log admin action
  await logPlayerAction(
    adminId,
    AdminActionType.PLAYER_STATUS_CHANGE,
    playerId,
    `Changed player ${player.name || player.email} status from ${player.status} to ${newStatus}`,
    { status: player.status },
    { status: newStatus },
    { reason, notes }
  );

  return {
    player: updatedPlayer,
    statusChange,
    previousStatus: player.status
  };
}

/**
 * Get player status history
 */
export async function getPlayerStatusHistory(playerId: string) {
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  const history = await prisma.playerStatusChange.findMany({
    where: { userId: playerId },
    include: {
      triggeredBy: {
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      },
      match: {
        select: { id: true, matchDate: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return history.map(record => ({
    id: record.id,
    previousStatus: record.previousStatus,
    newStatus: record.newStatus,
    reason: record.reason,
    notes: record.notes,
    createdAt: record.createdAt,
    triggeredBy: record.triggeredBy?.user ? {
      name: record.triggeredBy.user.name,
      email: record.triggeredBy.user.email
    } : null,
    relatedMatch: record.match ? {
      id: record.match.id,
      matchDate: record.match.matchDate
    } : null
  }));
}

/**
 * Get players by status for admin list views
 */
export async function getPlayersByStatus(status?: UserStatus, options?: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
}) {
  const { page = 1, limit = 20, search } = options || {};
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [players, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        status: true,
        image: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            matchParticipants: true,
            seasonMemberships: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  return {
    players,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Admin update player profile
 * Allows admins to edit player details that players may not be able to edit themselves
 */
export async function adminUpdatePlayer(input: AdminUpdatePlayerInput) {
  const { playerId, adminId, name, email, phoneNumber, area, bio, gender, dateOfBirth } = input;

  // Verify player exists and get current values for logging
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      area: true,
      bio: true,
      gender: true,
      dateOfBirth: true,
      status: true
    }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Verify admin exists
  const admin = await prisma.admin.findFirst({
    where: { userId: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  // Validate email uniqueness if being changed
  if (email && email !== player.email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        id: { not: playerId }
      }
    });

    if (existingEmail) {
      throw new Error('Email is already in use by another player');
    }
  }

  // Build update data
  const updateData: any = {
    updatedAt: new Date()
  };

  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email.trim().toLowerCase();
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.trim() || null;
  if (area !== undefined) updateData.area = area.trim() || null;
  if (bio !== undefined) updateData.bio = bio.trim() || null;
  if (gender !== undefined) updateData.gender = gender || null;
  if (dateOfBirth !== undefined) {
    updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  }

  // Update player
  const updatedPlayer = await prisma.user.update({
    where: { id: playerId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phoneNumber: true,
      area: true,
      bio: true,
      gender: true,
      dateOfBirth: true,
      status: true,
      image: true,
      updatedAt: true
    }
  });

  logger.info(`Player ${playerId} profile updated by admin ${adminId}`);

  // Log admin action - only include changed fields
  const changedFields: string[] = [];
  if (name !== undefined && name !== player.name) changedFields.push('name');
  if (email !== undefined && email.toLowerCase() !== player.email) changedFields.push('email');
  if (phoneNumber !== undefined && phoneNumber !== player.phoneNumber) changedFields.push('phoneNumber');
  if (area !== undefined && area !== player.area) changedFields.push('area');
  if (bio !== undefined && bio !== player.bio) changedFields.push('bio');
  if (gender !== undefined && gender !== player.gender) changedFields.push('gender');
  if (dateOfBirth !== undefined) changedFields.push('dateOfBirth');

  if (changedFields.length > 0) {
    await logPlayerAction(
      adminId,
      AdminActionType.PLAYER_UPDATE,
      playerId,
      `Updated player ${player.name || player.email} profile (${changedFields.join(', ')})`,
      {
        name: player.name,
        email: player.email,
        phoneNumber: player.phoneNumber,
        area: player.area,
        bio: player.bio,
        gender: player.gender,
        dateOfBirth: player.dateOfBirth?.toISOString()
      },
      {
        name: updatedPlayer.name,
        email: updatedPlayer.email,
        phoneNumber: updatedPlayer.phoneNumber,
        area: updatedPlayer.area,
        bio: updatedPlayer.bio,
        gender: updatedPlayer.gender,
        dateOfBirth: updatedPlayer.dateOfBirth?.toISOString()
      },
      { changedFields }
    );
  }

  return updatedPlayer;
}

/**
 * Get full player details for admin view
 */
export async function getPlayerDetailsForAdmin(playerId: string) {
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      username: true,
      displayUsername: true,
      image: true,
      phoneNumber: true,
      area: true,
      bio: true,
      gender: true,
      dateOfBirth: true,
      status: true,
      role: true,
      completedOnboarding: true,
      lastLogin: true,
      lastActivityCheck: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          matchParticipants: true,
          seasonMemberships: true,
          questionnaireResponses: true
        }
      }
    }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get questionnaire results for skill ratings
  const responses = await prisma.questionnaireResponse.findMany({
    where: { userId: playerId },
    include: {
      result: true
    },
    orderBy: { completedAt: 'desc' }
  });

  const skillRatings = responses
    .filter(r => r.completedAt && r.result)
    .map(r => ({
      sport: r.sport,
      completedAt: r.completedAt,
      result: r.result ? {
        singles: r.result.singles ? r.result.singles / 1000 : null,
        doubles: r.result.doubles ? r.result.doubles / 1000 : null,
        confidence: r.result.confidence
      } : null
    }));

  return {
    ...player,
    skillRatings
  };
}
