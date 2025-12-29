/**
 * System Maintenance Service
 * Handles system maintenance scheduling and notifications
 */

import { prisma } from '../lib/prisma';
import { MaintenanceStatus } from '@prisma/client';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

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
  status?: MaintenanceStatus;
  affectedServices?: string[];
}

export class SystemMaintenanceService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a new maintenance schedule
   */
  async createMaintenance(input: CreateMaintenanceInput) {
    const maintenance = await prisma.systemMaintenance.create({
      data: {
        title: input.title,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        affectedServices: input.affectedServices || [],
        status: MaintenanceStatus.SCHEDULED
      }
    });

    logger.info('System maintenance scheduled', { maintenanceId: maintenance.id });
    return maintenance;
  }

  /**
   * Update maintenance schedule
   */
  async updateMaintenance(input: UpdateMaintenanceInput) {
    const { id, ...data } = input;

    const maintenance = await prisma.systemMaintenance.update({
      where: { id },
      data
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

    // Calculate maintenance duration
    const duration = this.calculateDuration(maintenance.startDateTime, maintenance.endDateTime);
    const maintenanceTime = this.formatDateTime(maintenance.startDateTime);

    try {
      await this.notificationService.createNotification({
        type: 'SYSTEM_MAINTENANCE',
        category: 'GENERAL',
        title: 'Scheduled Maintenance',
        message: `DEUCE will be down ${maintenanceTime} for ${duration}. ${maintenance.description || ''}`,
        userIds,
        metadata: {
          maintenanceId: maintenance.id,
          startDateTime: maintenance.startDateTime.toISOString(),
          endDateTime: maintenance.endDateTime.toISOString(),
          affectedServices: maintenance.affectedServices
        }
      });

      // Mark notification as sent
      await prisma.systemMaintenance.update({
        where: { id: maintenanceId },
        data: { notificationSent: true }
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

    // Get all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const userIds = users.map(u => u.id);

    try {
      await this.notificationService.createNotification({
        type: 'MAINTENANCE_COMPLETE',
        category: 'GENERAL',
        title: "We're Back",
        message: "DEUCE is back online! Thanks for your patience",
        userIds,
        metadata: {
          maintenanceId: maintenance.id,
          completedAt: new Date().toISOString()
        }
      });

      // Update maintenance status and mark completion notification as sent
      await prisma.systemMaintenance.update({
        where: { id: maintenanceId },
        data: { 
          completionSent: true,
          status: MaintenanceStatus.COMPLETED
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
   * Get upcoming maintenance schedules
   */
  async getUpcomingMaintenance() {
    return await prisma.systemMaintenance.findMany({
      where: {
        status: MaintenanceStatus.SCHEDULED,
        startDateTime: {
          gte: new Date()
        }
      },
      orderBy: { startDateTime: 'asc' }
    });
  }

  /**
   * Start maintenance (mark as in progress)
   */
  async startMaintenance(maintenanceId: string) {
    return await prisma.systemMaintenance.update({
      where: { id: maintenanceId },
      data: { status: MaintenanceStatus.IN_PROGRESS }
    });
  }

  /**
   * Cancel maintenance
   */
  async cancelMaintenance(maintenanceId: string, reason?: string) {
    const maintenance = await prisma.systemMaintenance.update({
      where: { id: maintenanceId },
      data: { 
        status: MaintenanceStatus.CANCELLED,
        description: reason 
          ? `${maintenance.description || ''}\n\nCancellation reason: ${reason}`
          : maintenance.description
      }
    });

    logger.info('Maintenance cancelled', { maintenanceId });
    return maintenance;
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
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleDateString('en-US', options);
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
