/**
 * Admin Status Service
 * Handles admin status management: suspend, activate, status history
 */

import { prisma } from '../../lib/prisma';
import { AdminStatus, StatusChangeReason, AdminActionType, AdminTargetType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { createAdminLog } from './adminLogService';

interface SuspendAdminInput {
  targetAdminId: string;
  actingAdminUserId: string;
  reason: string;
  notes?: string;
}

interface ActivateAdminInput {
  targetAdminId: string;
  actingAdminUserId: string;
  notes?: string;
}

/**
 * Suspend an admin
 * Sets status to SUSPENDED and records the status change
 */
export async function suspendAdmin(input: SuspendAdminInput) {
  const { targetAdminId, actingAdminUserId, reason, notes } = input;

  // Find target admin
  const targetAdmin = await prisma.admin.findUnique({
    where: { id: targetAdminId },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  if (!targetAdmin) {
    throw new Error('Admin not found');
  }

  if (targetAdmin.status !== AdminStatus.ACTIVE) {
    if (targetAdmin.status === AdminStatus.PENDING) {
      throw new Error('Cannot suspend a pending admin');
    }
    throw new Error('Admin is already suspended');
  }

  // Find acting admin
  const actingAdmin = await prisma.admin.findFirst({
    where: { userId: actingAdminUserId },
    select: { id: true }
  });

  if (!actingAdmin) {
    throw new Error('Acting admin not found');
  }

  // Self-suspend guard
  if (actingAdmin.id === targetAdminId) {
    throw new Error('Cannot suspend yourself');
  }

  // Update status and create status change record
  const [updatedAdmin, statusChange] = await prisma.$transaction([
    prisma.admin.update({
      where: { id: targetAdminId },
      data: { status: AdminStatus.SUSPENDED }
    }),
    prisma.adminStatusChange.create({
      data: {
        adminId: targetAdminId,
        previousStatus: AdminStatus.ACTIVE,
        newStatus: AdminStatus.SUSPENDED,
        reason: StatusChangeReason.ADMIN_SUSPEND,
        notes: notes ? `${reason}\n\nNotes: ${notes}` : reason,
        triggeredById: actingAdmin.id
      }
    })
  ]);

  logger.info(`Admin ${targetAdminId} suspended by ${actingAdminUserId}. Reason: ${reason}`);

  // Log admin action
  await createAdminLog({
    adminId: actingAdminUserId,
    actionType: AdminActionType.ADMIN_SUSPEND,
    targetType: AdminTargetType.ADMIN,
    targetId: targetAdminId,
    description: `Suspended admin ${targetAdmin.user?.name || targetAdmin.user?.email || targetAdminId}`,
    oldValue: { status: AdminStatus.ACTIVE },
    newValue: { status: AdminStatus.SUSPENDED },
    metadata: { reason, notes }
  });

  return {
    admin: updatedAdmin,
    statusChange,
    previousStatus: AdminStatus.ACTIVE
  };
}

/**
 * Activate a suspended admin
 * Sets status back to ACTIVE and records the status change
 */
export async function activateAdmin(input: ActivateAdminInput) {
  const { targetAdminId, actingAdminUserId, notes } = input;

  // Find target admin
  const targetAdmin = await prisma.admin.findUnique({
    where: { id: targetAdminId },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  if (!targetAdmin) {
    throw new Error('Admin not found');
  }

  if (targetAdmin.status !== AdminStatus.SUSPENDED) {
    throw new Error('Admin is not suspended');
  }

  // Find acting admin
  const actingAdmin = await prisma.admin.findFirst({
    where: { userId: actingAdminUserId },
    select: { id: true }
  });

  if (!actingAdmin) {
    throw new Error('Acting admin not found');
  }

  // Update status and create status change record
  const [updatedAdmin, statusChange] = await prisma.$transaction([
    prisma.admin.update({
      where: { id: targetAdminId },
      data: { status: AdminStatus.ACTIVE }
    }),
    prisma.adminStatusChange.create({
      data: {
        adminId: targetAdminId,
        previousStatus: AdminStatus.SUSPENDED,
        newStatus: AdminStatus.ACTIVE,
        reason: StatusChangeReason.ADMIN_ACTIVATE,
        notes: notes || 'Reactivated by admin',
        triggeredById: actingAdmin.id
      }
    })
  ]);

  logger.info(`Admin ${targetAdminId} activated by ${actingAdminUserId}`);

  // Log admin action
  await createAdminLog({
    adminId: actingAdminUserId,
    actionType: AdminActionType.ADMIN_ACTIVATE,
    targetType: AdminTargetType.ADMIN,
    targetId: targetAdminId,
    description: `Activated admin ${targetAdmin.user?.name || targetAdmin.user?.email || targetAdminId}`,
    oldValue: { status: AdminStatus.SUSPENDED },
    newValue: { status: AdminStatus.ACTIVE },
    metadata: { notes }
  });

  return {
    admin: updatedAdmin,
    statusChange,
    previousStatus: AdminStatus.SUSPENDED
  };
}

/**
 * Get admin status change history
 */
export async function getAdminStatusHistory(adminId: string) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  const history = await prisma.adminStatusChange.findMany({
    where: { adminId },
    include: {
      triggeredBy: {
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
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
    } : null
  }));
}

/**
 * Get full admin details for profile view
 * Accepts userId OR admin record ID for compatibility with frontend
 * (fetchAllAdmins returns user.id for active admins, admin.id for pending admins)
 */
export async function getAdminDetailForProfile(id: string) {
  const admin = await prisma.admin.findFirst({
    where: { OR: [{ userId: id }, { id }] },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          image: true,
          gender: true,
          area: true,
          role: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          accounts: {
            select: {
              providerId: true,
              createdAt: true
            }
          },
          sessions: {
            select: {
              ipAddress: true,
              userAgent: true,
              expiresAt: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      },
      invite: {
        select: {
          email: true,
          createdAt: true,
          expiresAt: true
        }
      },
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          status: true,
          createdAt: true
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: {
          leagues: true,
          reviewedDisputes: true,
          resolvedDisputes: true,
          adminMatchActions: true,
          statusChanges: true
        }
      }
    }
  });

  if (!admin) {
    throw new Error('Admin not found');
  }

  return admin;
}
