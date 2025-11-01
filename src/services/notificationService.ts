import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import {
  CreateNotificationData,
  NotificationFilter,
  NotificationResult,
  PaginatedNotifications,
  NotificationStats,
  NotificationType,
} from '../types/notificationTypes';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export class NotificationService {
  private io: SocketIOServer | null = null;

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    logger.info('Socket.IO instance set for NotificationService');
  }

  /**
   * Create and send notification(s)
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationResult[]> {
    try {
      const { userIds, type, title, message, metadata, ...entityIds } = data;
      
      // Normalize userIds to array
      const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

      if (userIdArray.length === 0) {
        throw new AppError('At least one user ID is required', 400);
      }

      // Validate users exist
      const users = await prisma.user.findMany({
        where: { id: { in: userIdArray } },
        select: { id: true },
      });

      if (users.length !== userIdArray.length) {
        const existingIds = users.map(u => u.id);
        const missingIds = userIdArray.filter(id => !existingIds.includes(id));
        logger.warn(`Users not found: ${missingIds.join(', ')}`);
      }

      const validUserIds = users.map(u => u.id);

      // Create notification record in memory (since we don't have DB model yet)
      const notificationId = this.generateId();
      const notification: NotificationResult = {
        id: notificationId,
        title,
        message,
        type,
        read: false,
        archive: false,
        createdAt: new Date(),
        metadata: {
          ...metadata,
          ...entityIds,
        },
      };

      // Send real-time notifications via Socket.IO
      if (this.io) {
        this.emitNotifications(validUserIds, notification);
      }

      // Store in cache or send to queue for persistence
      await this.persistNotifications(validUserIds, notification);

      logger.info(`Notification sent to ${validUserIds.length} users: ${type}`);

      return validUserIds.map(userId => ({
        ...notification,
        id: `${notificationId}_${userId}`,
      }));
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error instanceof AppError ? error : new AppError('Failed to create notification', 500);
    }
  }

  /**
   * Get user notifications with pagination and filtering
   */
  async getUserNotifications(
    userId: string,
    filter: NotificationFilter = {}
  ): Promise<PaginatedNotifications> {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        archived = false,
        type,
        types,
      } = filter;

      // TODO: Replace with actual database query when notification model is added
      // For now, return mock data structure
      const notifications: NotificationResult[] = [];
      const total = 0;

      const pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      };

      logger.info(`Retrieved ${notifications.length} notifications for user ${userId}`);

      return { notifications, pagination };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw new AppError('Failed to retrieve notifications', 500);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // TODO: Implement database update when notification model is added
      
      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit('notification_read', {
          notificationId,
          readAt: new Date(),
        });
      }

      logger.info(`Notification ${notificationId} marked as read for user ${userId}`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw new AppError('Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      // TODO: Implement database update when notification model is added
      const count = 0;

      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit('all_notifications_read', {
          timestamp: new Date(),
        });
      }

      logger.info(`All notifications marked as read for user ${userId}`);

      return { count };
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw new AppError('Failed to mark all notifications as read', 500);
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // TODO: Implement database update when notification model is added

      logger.info(`Notification ${notificationId} archived for user ${userId}`);
    } catch (error) {
      logger.error('Error archiving notification:', error);
      throw new AppError('Failed to archive notification', 500);
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // TODO: Implement database query when notification model is added
      const count = 0;

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw new AppError('Failed to get unread count', 500);
    }
  }

  /**
   * Get notification statistics for user
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      // TODO: Implement database query when notification model is added
      const stats: NotificationStats = {
        total: 0,
        unread: 0,
        archived: 0,
        byType: {} as Record<NotificationType, number>,
      };

      return stats;
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw new AppError('Failed to get notification statistics', 500);
    }
  }

  /**
   * Get notifications by type
   */
  async getNotificationsByType(
    type: NotificationType,
    limit: number = 100
  ): Promise<NotificationResult[]> {
    try {
      // TODO: Implement database query when notification model is added
      const notifications: NotificationResult[] = [];

      return notifications;
    } catch (error) {
      logger.error('Error getting notifications by type:', error);
      throw new AppError('Failed to get notifications by type', 500);
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<{ count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // TODO: Implement database deletion when notification model is added
      const count = 0;

      logger.info(`Deleted ${count} notifications older than ${daysOld} days`);

      return { count };
    } catch (error) {
      logger.error('Error deleting old notifications:', error);
      throw new AppError('Failed to delete old notifications', 500);
    }
  }

  private emitNotifications(userIds: string[], notification: NotificationResult): void {
    if (!this.io) return;

    userIds.forEach(userId => {
      this.io!.to(userId).emit('new_notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    });

    logger.debug(`Real-time notifications emitted to ${userIds.length} users`);
  }

  private async persistNotifications(
    userIds: string[],
    notification: NotificationResult
  ): Promise<void> {
    // TODO: Implement actual persistence when notification model is added
    // This could be:
    // 1. Direct database insert
    // 2. Queue for batch processing
    // 3. Cache storage with expiration
    
    logger.debug(`Persisting notifications for ${userIds.length} users`);
  }

  /**
   * Private: Generate unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export const notificationService = new NotificationService();