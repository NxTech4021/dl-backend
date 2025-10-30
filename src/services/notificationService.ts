import { PrismaClient, NotificationType } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

interface CreateNotificationData {
  userIds: string | string[];
  type: NotificationType;
  title?: string;
  message: string;
  seasonId?: string;
  divisionId?: string;
  matchId?: string;
  partnershipId?: string;
  threadId?: string;
  pairRequestId?: string;
  achievementId?: string;
  withdrawalRequestId?: string;
  entityUserId?: string;
}

class NotificationService {
  private io: SocketIOServer | null = null;

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  // Create notification for single or multiple users
  async createNotification(data: CreateNotificationData) {
    const {
      userIds,
      type,
      title,
      message,
      seasonId,
      divisionId,
      matchId,
      partnershipId,
      threadId,
      pairRequestId,
      withdrawalRequestId,
      entityUserId,
    } = data;

    try {
      // Ensure userIds is an array
      const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

      // Create the main notification
      const notification = await prisma.notification.create({
        data: {
          type,
          title,
          message,
          seasonId,
          divisionId,
          matchId,
          partnershipId,
          threadId,
          pairRequestId,
          withdrawalRequestId,
          userId: entityUserId,
        },
      });

      // Create user notifications for each target user
      const userNotifications = await Promise.all(
        targetUserIds.map(userId =>
          prisma.userNotification.create({
            data: {
              userId,
              notificationId: notification.id,
            },
            include: {
              notification: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        )
      );

      // Send real-time notifications via Socket.IO
      if (this.io) {
        targetUserIds.forEach(userId => {
          this.io?.to(userId).emit('notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt,
            read: false,
          });
        });
      }

      console.log(`📱 ${type} notification sent to ${targetUserIds.length} user(s): ${message}`);
      return { notification, userNotifications };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Get user notifications with pagination and type filtering
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      archived?: boolean;
      type?: NotificationType;
      types?: NotificationType[];
    } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false, archived = false, type, types } = options;
    const skip = (page - 1) * limit;

    const where: any = { userId, archive: archived };
    
    if (unreadOnly) {
      where.read = false;
    }

    // Filter by notification type(s)
    if (type) {
      where.notification = { type };
    } else if (types && types.length > 0) {
      where.notification = { type: { in: types } };
    }

    try {
      const [userNotifications, totalCount, unreadCount] = await Promise.all([
        prisma.userNotification.findMany({
          where,
          include: {
            notification: {
              include: {
                season: { select: { id: true, name: true } },
                division: { select: { id: true, name: true } },
                match: { select: { id: true, matchDate: true } },
                partnership: { select: { id: true } },
                thread: { select: { id: true, name: true } },
                pairRequest: { select: { id: true } },
                // achievement: { select: { id: true, title: true } },
                withdrawalRequest: { select: { id: true } },
              },
            },
          },
          orderBy: {
            notification: {
              createdAt: 'desc',
            },
          },
          skip,
          take: limit,
        }),
        prisma.userNotification.count({ where }),
        prisma.userNotification.count({
          where: { userId, read: false, archive: false },
        }),
      ]);

      return {
        notifications: userNotifications,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        unreadCount,
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Get notifications by type for analytics
  async getNotificationsByType(type: NotificationType, limit: number = 100) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { type },
        include: {
          userNotifications: {
            select: {
              userId: true,
              read: true,
              readAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notifications;
    } catch (error) {
      console.error('Error getting notifications by type:', error);
      throw error;
    }
  }

  // Get notification statistics
  async getNotificationStats(userId?: string) {
    try {
      const where = userId ? { userId } : {};

      const [
        totalNotifications,
        unreadNotifications,
        notificationsByType,
      ] = await Promise.all([
        prisma.userNotification.count({ where }),
        prisma.userNotification.count({ where: { ...where, read: false } }),
        prisma.userNotification.groupBy({
          by: ['notificationId'],
          where,
          _count: {
            id: true,
          },
        }),
      ]);

      return {
        total: totalNotifications,
        unread: unreadNotifications,
        byType: notificationsByType,
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  // Rest of the methods remain the same...
  async markAsRead(notificationId: string, userId: string) {
    try {
      const userNotification = await prisma.userNotification.updateMany({
        where: {
          notificationId,
          userId,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return userNotification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    try {
      const userNotifications = await prisma.userNotification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return userNotifications;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async archiveNotification(notificationId: string, userId: string) {
    try {
      const userNotification = await prisma.userNotification.updateMany({
        where: {
          notificationId,
          userId,
        },
        data: {
          archive: true,
        },
      });

      return userNotification;
    } catch (error) {
      console.error('Error archiving notification:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await prisma.userNotification.count({
        where: {
          userId,
          read: false,
          archive: false,
        },
      });

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  async deleteOldNotifications(daysOld: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deletedNotifications = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`🗑️ Deleted ${deletedNotifications.count} old notifications`);
      return deletedNotifications;
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();