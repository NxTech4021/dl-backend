/**
 * System Maintenance Service
 * Handles system maintenance scheduling and notifications
 */

import { prisma } from '../lib/prisma';
import { $Enums } from '@prisma/client';
import { NotificationService, notificationService as notificationServiceSingleton } from './notificationService';
import { logger } from '../utils/logger';
import { formatMatchDateTime } from '../utils/timezone';
import { accountNotifications } from '../helpers/notifications/accountNotifications';

export interface CreateMaintenanceInput {
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  affectedServices?: string[];
}

export interface UpdateMaintenanceInput {
  id: string;
  title?: string;
  description?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  status?: $Enums.MaintenanceStatus;
  affectedServices?: string[];
}

export class SystemMaintenanceService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || notificationServiceSingleton;
  }

  /**
   * Create a new maintenance schedule
   */
  async createMaintenance(input: CreateMaintenanceInput) {
    const maintenance = await prisma.systemMaintenance.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        affectedServices: input.affectedServices || [],
        status: $Enums.MaintenanceStatus.SCHEDULED
      }
    });

    logger.info('System maintenance scheduled', { maintenanceId: maintenance.id });

    // Automatically send notification to all users
    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true }
      });

      const userIds = users.map(u => u.id);

      if (userIds.length > 0) {
        const duration = this.calculateDuration(maintenance.startDateTime, maintenance.endDateTime);
        const maintenanceTime = this.formatDateTime(maintenance.startDateTime);
        const notificationPayload = accountNotifications.scheduledMaintenance(maintenanceTime, duration);

        // Flag-first: mark as sent before sending, so retries don't duplicate
        await prisma.systemMaintenance.update({
          where: { id: maintenance.id },
          data: { notificationSent: true }
        });

        await this.notificationService.createNotification({
          ...notificationPayload,
          userIds,
          metadata: {
            ...notificationPayload.metadata,
            maintenanceId: maintenance.id,
            startDateTime: maintenance.startDateTime.toISOString(),
            endDateTime: maintenance.endDateTime.toISOString(),
            affectedServices: maintenance.affectedServices
          }
        });

        logger.info('Maintenance notification sent automatically to all users', {
          maintenanceId: maintenance.id,
          userCount: userIds.length
        });
      }
    } catch (error) {
      logger.error('Failed to send maintenance notification automatically', { maintenanceId: maintenance.id }, error as Error);
      // Don't throw error - maintenance should still be created even if notification fails
    }

    return maintenance;
  }

  /**
   * Update maintenance schedule
   */
  async updateMaintenance(input: UpdateMaintenanceInput) {
    const { id, ...data } = input;
    const updateData: any = { ...data };
    if ('description' in data) {
      updateData.description = data.description ?? null;
    } else {
      delete updateData.description;
    }

    // Reset notificationSent flag when time changes so admin can re-notify
    if (data.startDateTime || data.endDateTime) {
      updateData.notificationSent = false;
    }

    const maintenance = await prisma.systemMaintenance.update({
      where: { id },
      data: updateData,
    });

    logger.info('System maintenance updated', { maintenanceId: maintenance.id });
    return maintenance;
  }

  /**
   * Send scheduled maintenance notification to all users
   */
  async sendMaintenanceNotification(maintenanceId: string) {
    const maintenance = await prisma.systemMaintenance.findUnique({
      where: { id: maintenanceId }
    });

    if (!maintenance) {
      throw new Error('Maintenance schedule not found');
    }

    if (maintenance.notificationSent) {
      logger.warn('Maintenance notification already sent', { maintenanceId });
      return;
    }

    // Get all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const userIds = users.map(u => u.id);

    // Calculate maintenance duration and time
    const duration = this.calculateDuration(maintenance.startDateTime, maintenance.endDateTime);
    const maintenanceTime = this.formatDateTime(maintenance.startDateTime);

    try {
      const notificationPayload = accountNotifications.scheduledMaintenance(maintenanceTime, duration);

      // Flag-first: mark as sent before sending, so retries don't duplicate
      await prisma.systemMaintenance.update({
        where: { id: maintenanceId },
        data: { notificationSent: true }
      });

      await this.notificationService.createNotification({
        ...notificationPayload,
        userIds,
        metadata: {
          ...notificationPayload.metadata,
          maintenanceId: maintenance.id,
          startDateTime: maintenance.startDateTime.toISOString(),
          endDateTime: maintenance.endDateTime.toISOString(),
          affectedServices: maintenance.affectedServices
        }
      });

      logger.info('Maintenance notification sent to all users', {
        maintenanceId,
        userCount: userIds.length
      });
    } catch (error) {
      logger.error('Failed to send maintenance notification', { maintenanceId }, error as Error);
      throw error;
    }
  }

  /**
   * Send maintenance completion notification
   */
  async sendMaintenanceCompleteNotification(maintenanceId: string) {
    const maintenance = await prisma.systemMaintenance.findUnique({
      where: { id: maintenanceId }
    });

    if (!maintenance) {
      throw new Error('Maintenance schedule not found');
    }

    if (maintenance.completionSent) {
      logger.warn('Maintenance completion notification already sent', { maintenanceId });
      return;
    }

    if (maintenance.status === $Enums.MaintenanceStatus.CANCELLED) {
      throw new Error('Cannot complete a cancelled maintenance.');
    }

    // Get all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const userIds = users.map(u => u.id);

    try {
      // Create notification payload using the template
      const notificationPayload = accountNotifications.maintenanceComplete();

      // Use transaction to ensure notification flag and status are updated atomically
      await prisma.systemMaintenance.update({
        where: { id: maintenanceId },
        data: {
          completionSent: true,
          status: $Enums.MaintenanceStatus.COMPLETED
        }
      });

      await this.notificationService.createNotification({
        ...notificationPayload,
        userIds,
        metadata: {
          ...notificationPayload.metadata,
          maintenanceId: maintenance.id,
          completedAt: new Date().toISOString()
        }
      });

      logger.info('Maintenance completion notification sent', { 
        maintenanceId, 
        userCount: userIds.length 
      });
    } catch (error) {
      logger.error('Failed to send maintenance completion notification', { maintenanceId }, error as Error);
      throw error;
    }
  }

  /**
   * Get upcoming and active maintenance schedules
   */
  async getUpcomingMaintenance() {
    return await prisma.systemMaintenance.findMany({
      where: {
        status: { in: [$Enums.MaintenanceStatus.SCHEDULED, $Enums.MaintenanceStatus.IN_PROGRESS] }
      },
      orderBy: { startDateTime: 'asc' }
    });
  }

  /**
   * Start maintenance (mark as in progress)
   */
  async startMaintenance(maintenanceId: string) {
    const maintenance = await prisma.systemMaintenance.findUnique({
      where: { id: maintenanceId }
    });

    if (!maintenance) {
      throw new Error('Maintenance schedule not found');
    }

    if (maintenance.status !== $Enums.MaintenanceStatus.SCHEDULED) {
      throw new Error(`Cannot start maintenance in ${maintenance.status} status. Must be SCHEDULED.`);
    }

    // Update status to IN_PROGRESS
    const updatedMaintenance = await prisma.systemMaintenance.update({
      where: { id: maintenanceId },
      data: { status: $Enums.MaintenanceStatus.IN_PROGRESS }
    });

    // Get all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const userIds = users.map(u => u.id);

    if (userIds.length > 0) {
      try {
        const duration = this.calculateDuration(maintenance.startDateTime, maintenance.endDateTime);
        const notificationPayload = accountNotifications.maintenanceInProgress(duration);

        await this.notificationService.createNotification({
          ...notificationPayload,
          userIds,
          metadata: {
            ...notificationPayload.metadata,
            maintenanceId: maintenance.id,
            startDateTime: maintenance.startDateTime.toISOString(),
            endDateTime: maintenance.endDateTime.toISOString(),
            affectedServices: maintenance.affectedServices,
          }
        });

        logger.info('Maintenance start notification sent to all users', {
          maintenanceId,
          userCount: userIds.length
        });
      } catch (error) {
        logger.error('Failed to send maintenance start notification', { maintenanceId }, error as Error);
      }
    }

    return updatedMaintenance;
  }

  /**
   * Cancel maintenance
   */
  async cancelMaintenance(maintenanceId: string, reason?: string) {
    const current = await prisma.systemMaintenance.findUnique({
      where: { id: maintenanceId }
    });
    if (!current) {
      throw new Error('Maintenance schedule not found');
    }
    if (current.status === $Enums.MaintenanceStatus.COMPLETED || current.status === $Enums.MaintenanceStatus.CANCELLED) {
      throw new Error(`Cannot cancel maintenance in ${current.status} status.`);
    }
    const updated = await prisma.systemMaintenance.update({
      where: { id: maintenanceId },
      data: {
        status: $Enums.MaintenanceStatus.CANCELLED,
        description: reason
          ? `${current.description || ''}\n\nCancellation reason: ${reason}`
          : current.description ?? null
      }
    });
    logger.info('Maintenance cancelled', { maintenanceId });

    // Notify users if they were already told about this maintenance
    if (current.notificationSent) {
      try {
        const users = await prisma.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true }
        });
        const userIds = users.map(u => u.id);

        if (userIds.length > 0) {
          const notificationPayload = accountNotifications.maintenanceCancelled(reason);

          await this.notificationService.createNotification({
            ...notificationPayload,
            userIds,
            metadata: {
              ...notificationPayload.metadata,
              maintenanceId,
            }
          });

          logger.info('Maintenance cancellation notification sent', {
            maintenanceId,
            userCount: userIds.length
          });
        }
      } catch (error) {
        logger.error('Failed to send cancellation notification', { maintenanceId }, error as Error);
      }
    }

    return updated;
  }

  /**
   * Helper: Calculate duration between two dates
   */
  private calculateDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  /**
   * Helper: Format date and time for display
   */
  private formatDateTime(date: Date): string {
    return formatMatchDateTime(date);
  }
}

// Singleton instance
let maintenanceServiceInstance: SystemMaintenanceService | null = null;

export function getMaintenanceService(): SystemMaintenanceService {
  if (!maintenanceServiceInstance) {
    maintenanceServiceInstance = new SystemMaintenanceService();
  }
  return maintenanceServiceInstance;
}
