/**
 * Feature Announcement Service
 * Handles new feature announcements and app update notifications
 */

import { prisma } from '../lib/prisma';
import { FeatureAnnouncementStatus } from '@prisma/client';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

export interface CreateFeatureAnnouncementInput {
  title: string;
  description: string;
  featureDetails?: Record<string, any> | undefined;
  releaseDate?: Date | undefined;
  targetAudience?: string[] | undefined; // e.g., ["ALL"], ["ADMIN"], ["USER"], etc.
}

export interface UpdateFeatureAnnouncementInput {
  id: string;
  title?: string;
  description?: string;
  featureDetails?: Record<string, any>;
  releaseDate?: Date;
  status?: FeatureAnnouncementStatus;
  targetAudience?: string[];
}

export class FeatureAnnouncementService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a new feature announcement
   */
  async createAnnouncement(input: CreateFeatureAnnouncementInput) {
    const announcement = await prisma.featureAnnouncement.create({
      data: {
        title: input.title,
        description: input.description,
        featureDetails: input.featureDetails || {},
        releaseDate: input.releaseDate,
        targetAudience: input.targetAudience || ['ALL'],
        status: FeatureAnnouncementStatus.DRAFT
      }
    });

    logger.info('Feature announcement created', { announcementId: announcement.id });
    return announcement;
  }

  /**
   * Update feature announcement
   */
  async updateAnnouncement(input: UpdateFeatureAnnouncementInput) {
    const { id, ...data } = input;

    const announcement = await prisma.featureAnnouncement.update({
      where: { id },
      data
    });

    logger.info('Feature announcement updated', { announcementId: announcement.id });
    return announcement;
  }

  /**
   * Publish and send announcement notification
   */
  async publishAnnouncement(announcementId: string) {
    const announcement = await prisma.featureAnnouncement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (announcement.status === FeatureAnnouncementStatus.PUBLISHED) {
      throw new Error('Announcement already published');
    }

    if (announcement.notificationSent) {
      logger.warn('Announcement notification already sent', { announcementId });
      return announcement;
    }

    // Determine target users
    const targetUserIds = await this.getTargetUsers(announcement.targetAudience);

    if (targetUserIds.length === 0) {
      logger.warn('No target users found for announcement', { announcementId });
      return announcement;
    }

    try {
      // Send notification
      await this.notificationService.createNotification({
        type: 'NEW_FEATURE',
        category: 'GENERAL',
        title: announcement.title,
        message: announcement.description,
        userIds: targetUserIds,
        metadata: {
          announcementId: announcement.id,
          featureDetails: announcement.featureDetails,
          releaseDate: announcement.releaseDate?.toISOString()
        }
      });

      // Mark as published and notification sent
      const updatedAnnouncement = await prisma.featureAnnouncement.update({
        where: { id: announcementId },
        data: {
          status: FeatureAnnouncementStatus.PUBLISHED,
          notificationSent: true,
          announcementDate: new Date()
        }
      });

      logger.info('Feature announcement published and notifications sent', {
        announcementId,
        userCount: targetUserIds.length
      });

      return updatedAnnouncement;
    } catch (error) {
      logger.error('Failed to publish announcement', { announcementId }, error as Error);
      throw error;
    }
  }

  /**
   * Send app update available notification
   */
  async sendAppUpdateNotification(targetAudience: string[] = ['ALL']) {
    const targetUserIds = await this.getTargetUsers(targetAudience);

    if (targetUserIds.length === 0) {
      logger.warn('No target users found for app update notification');
      return;
    }

    try {
      await this.notificationService.createNotification({
        type: 'APP_UPDATE_AVAILABLE',
        category: 'GENERAL',
        title: 'Update Available',
        message: 'DEUCE update available! New features and improvements',
        userIds: targetUserIds,
        metadata: {
          updateType: 'app_update'
        }
      });

      logger.info('App update notification sent', { userCount: targetUserIds.length });
    } catch (error) {
      logger.error('Failed to send app update notification', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get all published announcements
   */
  async getPublishedAnnouncements(limit: number = 10) {
    return await prisma.featureAnnouncement.findMany({
      where: { status: FeatureAnnouncementStatus.PUBLISHED },
      orderBy: { announcementDate: 'desc' },
      take: limit
    });
  }

  /**
   * Archive an announcement
   */
  async archiveAnnouncement(announcementId: string) {
    const announcement = await prisma.featureAnnouncement.update({
      where: { id: announcementId },
      data: { status: FeatureAnnouncementStatus.ARCHIVED }
    });

    logger.info('Feature announcement archived', { announcementId });
    return announcement;
  }

  /**
   * Helper: Get target user IDs based on audience criteria
   */
  private async getTargetUsers(targetAudience: string[]): Promise<string[]> {
    // If targeting all users
    if (targetAudience.includes('ALL')) {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true }
      });
      return users.map(u => u.id);
    }

    // If targeting specific roles
    const roleFilters = [];
    
    if (targetAudience.includes('ADMIN')) {
      roleFilters.push('ADMIN', 'SUPER_ADMIN');
    }
    
    if (targetAudience.includes('USER')) {
      roleFilters.push('USER');
    }

    if (roleFilters.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          role: { in: roleFilters as any }
        },
        select: { id: true }
      });
      return users.map(u => u.id);
    }

    return [];
  }
}

// Singleton instance
let featureAnnouncementServiceInstance: FeatureAnnouncementService | null = null;

export function getFeatureAnnouncementService(): FeatureAnnouncementService {
  if (!featureAnnouncementServiceInstance) {
    featureAnnouncementServiceInstance = new FeatureAnnouncementService();
  }
  return featureAnnouncementServiceInstance;
}
