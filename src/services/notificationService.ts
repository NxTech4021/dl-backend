import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { NotificationCategory } from '@prisma/client';
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
      const { userIds, type, category, title, message, metadata, ...entityIds } = data;
      
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
        logger.warn('Some users not found', { missingIds });
      }

      const validUserIds = users.map(u => u.id);

      const createData: any = {
        message,
        category,
      };

      // Only add fields if they have values (not undefined)
      if (title !== undefined) createData.title = title;
      if (type !== undefined) createData.type = type;
      
      // Add entity IDs only if they have values
      Object.entries(entityIds).forEach(([key, value]) => {
        if (value !== undefined) {
          createData[key] = value;
        }
      });

      // Create notification in database
      const notification = await prisma.notification.create({
        data: createData
      });

      // Create UserNotification records for each user
      await prisma.userNotification.createMany({
        data: validUserIds.map(userId => ({
          userId,
          notificationId: notification.id,
        }))
      });

      // Send real-time notifications via Socket.IO
      if (this.io) {
        this.emitNotifications(validUserIds, {
          id: notification.id,
          title: notification.title ?? undefined,
          message: notification.message,
          category: notification.category,
          type: notification.type ?? undefined,
          read: false,
          archive: false,
          createdAt: notification.createdAt,
          metadata: {
            ...metadata,
            ...entityIds,
          },
          readAt: undefined
        });
      }

      logger.info('Notification created and sent', { 
        notificationId: notification.id,
        category,
        type, 
        userCount: validUserIds.length 
      });

      return validUserIds.map(userId => ({
        id: notification.id,
        title: notification.title ?? undefined,
        message: notification.message,
        category: notification.category,
        type: notification.type ?? undefined,
        read: false,
        archive: false,
        createdAt: notification.createdAt,
        readAt: undefined,
        metadata: {
          ...metadata,
          ...entityIds,
        }
      }));
    } catch (error) {
      logger.error('Error creating notification', {}, error as Error);
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
        category,
        categories,
        type,
        types,
      } = filter;

      const skip = (page - 1) * limit;

      const where: any = {
        userId,
        ...(unreadOnly && { read: false }),
        ...(archived !== undefined && { archive: archived }),
      };

      // Category filtering
      if (category) {
        where.notification = { ...where.notification, category };
      } else if (categories && categories.length > 0) {
        where.notification = { ...where.notification, category: { in: categories } };
      }

      // Type filtering
      if (type) {
        where.notification = { ...where.notification, type };
      } else if (types && types.length > 0) {
        where.notification = { ...where.notification, type: { in: types } };
      }

      const [userNotifications, total] = await Promise.all([
        prisma.userNotification.findMany({
          where,
          include: {
            notification: true,
          },
          orderBy: {
            notification: {
              createdAt: 'desc'
            }
          },
          skip,
          take: limit,
        }),
        prisma.userNotification.count({ where })
      ]);

      const notifications: NotificationResult[] = userNotifications.map(un => ({
        id: un.notification.id,
        title: un.notification.title || undefined,
        message: un.notification.message,
        category: un.notification.category,
        type: un.notification.type || undefined,
        read: un.read,
        archive: un.archive,
        createdAt: un.notification.createdAt,
        readAt: un.readAt || undefined,
      }));

      const pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      };

      logger.debug('Retrieved user notifications', { userId, count: notifications.length });

      return { notifications, pagination };
    } catch (error) {
      logger.error('Error getting user notifications', { userId }, error as Error);
      throw new AppError('Failed to retrieve notifications', 500);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.userNotification.update({
        where: {
          userId_notificationId: {
            userId,
            notificationId
          }
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });
      
      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit('notification_read', {
          notificationId,
          readAt: new Date(),
        });
      }

      logger.debug('Notification marked as read', { notificationId, userId });
    } catch (error) {
      logger.error('Error marking notification as read', { notificationId, userId }, error as Error);
      throw new AppError('Failed to mark notification as read', 500);
    }
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      const result = await prisma.userNotification.updateMany({
        where: { 
          userId,
          read: false
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit('all_notifications_read', {
          timestamp: new Date(),
        });
      }

      logger.info('All notifications marked as read', { userId, count: result.count });

      return { count: result.count };
    } catch (error) {
      logger.error('Error marking all notifications as read', { userId }, error as Error);
      throw new AppError('Failed to mark all notifications as read', 500);
    }
  }
  
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.userNotification.delete({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
      });

      logger.debug('Notification deleted for user', { notificationId, userId });
    } catch (error) {
      logger.error('Error deleting notification for user', { notificationId, userId }, error as Error);
      throw new AppError('Failed to delete notification', 500);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.userNotification.count({
        where: { 
          userId,
          read: false,
          archive: false
        }
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count', { userId }, error as Error);
      throw new AppError('Failed to get unread count', 500);
    }
  }

  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const [total, unread, archived, byTypeData, byCategoryData] = await Promise.all([
        prisma.userNotification.count({ where: { userId } }),
        prisma.userNotification.count({ where: { userId, read: false } }),
        prisma.userNotification.count({ where: { userId, archive: true } }),
        // Group by notification type
        prisma.userNotification.findMany({
          where: { userId },
          include: { notification: { select: { type: true } } }
        }),
        // Group by notification category
        prisma.userNotification.findMany({
          where: { userId },
          include: { notification: { select: { category: true } } }
        })
      ]);

      // Count by type
      const byType: Record<NotificationType, number> = {};
      byTypeData.forEach(un => {
        if (un.notification.type) {
          const type = un.notification.type;
          byType[type] = (byType[type] || 0) + 1;
        }
      });

      // Count by category
      const byCategory: Record<NotificationCategory, number> = {} as Record<NotificationCategory, number>;
      byCategoryData.forEach(un => {
        const category = un.notification.category;
        byCategory[category] = (byCategory[category] || 0) + 1;
      });

      const stats: NotificationStats = {
        total,
        unread,
        archived,
        byCategory,
        byType,
      };

      return stats;
    } catch (error) {
      logger.error('Error getting notification stats', { userId }, error as Error);
      throw new AppError('Failed to get notification statistics', 500);
    }
  }

  // Add new method for category filtering
  async getNotificationsByCategory(
    category: NotificationCategory,
    limit: number = 100
  ): Promise<NotificationResult[]> {
    try {
      const notifications = await prisma.notification.findMany({
        where: { category },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notifications.map(notif => ({
        id: notif.id,
        title: notif.title || undefined,
        message: notif.message,
        category: notif.category,
        type: notif.type || undefined,
        read: false,
        archive: false,
        createdAt: notif.createdAt,
        readAt: undefined,
      }));
    } catch (error) {
      logger.error('Error getting notifications by category', { category }, error as Error);
      throw new AppError('Failed to get notifications by category', 500);
    }
  }

  async deleteOldNotifications(daysOld: number = 30): Promise<{ count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Delete UserNotifications first (foreign key constraint)
      await prisma.userNotification.deleteMany({
        where: {
          notification: {
            createdAt: { lt: cutoffDate }
          }
        }
      });

      // Then delete Notifications
      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      logger.info('Deleted old notifications', { daysOld, count: result.count });

      return { count: result.count };
    } catch (error) {
      logger.error('Error deleting old notifications', { daysOld }, error as Error);
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

    logger.debug('Real-time notifications emitted', { userCount: userIds.length });
  }
}

export const notificationService = new NotificationService();