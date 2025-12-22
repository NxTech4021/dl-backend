import { Server as SocketIOServer } from "socket.io";
import { prisma, PrismaClient } from "../lib/prisma";
import { NotificationCategory } from "@prisma/client";
import {
  CreateNotificationData,
  NotificationFilter,
  NotificationResult,
  PaginatedNotifications,
  NotificationStats,
  NotificationType,
} from "../types/notificationTypes";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { sendEmail as sendEmailViaResend } from "../config/nodemailer";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { isPushNotification, getNotificationPriority } from "../helpers/notificationConfig";

// Initialize Expo SDK for push notifications
const expo = new Expo();

// Email sending input type
interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
}

// Push notification input type
interface SendPushInput {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationService {
  static sendNotification(arg0: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data: { matchId: string; inviterId: string };
  }) {
    throw new Error("Method not implemented.");
  }
  private io: SocketIOServer | null = null;
  private prisma: PrismaClient;

  /**
   * Create a new NotificationService instance
   * @param prismaClient - Optional Prisma client for dependency injection (useful for testing)
   */
  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    logger.info("Socket.IO instance set for NotificationService");
  }

  /**
   * Create and send notification(s)
   */
  async createNotification(
    data: CreateNotificationData
  ): Promise<NotificationResult[]> {
    try {
      const {
        userIds,
        type,
        category,
        title,
        message,
        metadata,
        ...entityIds
      } = data;

      // Normalize userIds to array
      const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

      if (userIdArray.length === 0) {
        throw new AppError("At least one user ID is required", 400);
      }

      // Validate users exist
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIdArray } },
        select: { id: true },
      });

      if (users.length !== userIdArray.length) {
        const existingIds = users.map((u) => u.id);
        const missingIds = userIdArray.filter(
          (id) => !existingIds.includes(id)
        );
        logger.warn("Some users not found", { missingIds });
      }

      const validUserIds = users.map((u) => u.id);

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
      const notification = await this.prisma.notification.create({
        data: createData,
      });

      // Create UserNotification records for each user
      await this.prisma.userNotification.createMany({
        data: validUserIds.map((userId) => ({
          userId,
          notificationId: notification.id,
        })),
      });

      // Send real-time notifications via Socket.IO (for in-app display)
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
          readAt: undefined,
        });
      }

      // Send push notifications if notification type requires it
      if (type && isPushNotification(type)) {
        await this.sendPushToUsers(validUserIds, {
          title: title || 'DEUCE',
          body: message,
          data: {
            notificationId: notification.id,
            type,
            category,
            ...metadata,
          },
        });
      }

      logger.info("Notification created and sent", {
        notificationId: notification.id,
        category,
        type,
        userCount: validUserIds.length,
        isPush: type ? isPushNotification(type) : false,
      });

      return validUserIds.map((userId) => ({
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
        },
      }));
    } catch (error) {
      logger.error("Error creating notification", {}, error as Error);
      throw error instanceof AppError
        ? error
        : new AppError("Failed to create notification", 500);
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
        where.notification = {
          ...where.notification,
          category: { in: categories },
        };
      }

      // Type filtering
      if (type) {
        where.notification = { ...where.notification, type };
      } else if (types && types.length > 0) {
        where.notification = { ...where.notification, type: { in: types } };
      }

      const [userNotifications, total] = await Promise.all([
        this.prisma.userNotification.findMany({
          where,
          include: {
            notification: true,
          },
          orderBy: {
            notification: {
              createdAt: "desc",
            },
          },
          skip,
          take: limit,
        }),
        this.prisma.userNotification.count({ where }),
      ]);

      const notifications: NotificationResult[] = userNotifications.map(
        (un) => ({
          id: un.notification.id,
          title: un.notification.title || undefined,
          message: un.notification.message,
          category: un.notification.category,
          type: un.notification.type || undefined,
          read: un.read,
          archive: un.archive,
          createdAt: un.notification.createdAt,
          readAt: un.readAt || undefined,
        })
      );

      const pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      };

      logger.debug("Retrieved user notifications", {
        userId,
        count: notifications.length,
      });

      return { notifications, pagination };
    } catch (error) {
      logger.error(
        "Error getting user notifications",
        { userId },
        error as Error
      );
      throw new AppError("Failed to retrieve notifications", 500);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.prisma.userNotification.update({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit("notification_read", {
          notificationId,
          readAt: new Date(),
        });
      }

      logger.debug("Notification marked as read", { notificationId, userId });
    } catch (error) {
      logger.error(
        "Error marking notification as read",
        { notificationId, userId },
        error as Error
      );
      throw new AppError("Failed to mark notification as read", 500);
    }
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      const result = await this.prisma.userNotification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Emit real-time update
      if (this.io) {
        this.io.to(userId).emit("all_notifications_read", {
          timestamp: new Date(),
        });
      }

      logger.info("All notifications marked as read", {
        userId,
        count: result.count,
      });

      return { count: result.count };
    } catch (error) {
      logger.error(
        "Error marking all notifications as read",
        { userId },
        error as Error
      );
      throw new AppError("Failed to mark all notifications as read", 500);
    }
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.prisma.userNotification.delete({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
      });

      logger.debug("Notification deleted for user", { notificationId, userId });
    } catch (error) {
      logger.error(
        "Error deleting notification for user",
        { notificationId, userId },
        error as Error
      );
      throw new AppError("Failed to delete notification", 500);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.prisma.userNotification.count({
        where: {
          userId,
          read: false,
          archive: false,
        },
      });

      return count;
    } catch (error) {
      logger.error("Error getting unread count", { userId }, error as Error);
      throw new AppError("Failed to get unread count", 500);
    }
  }

  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const [total, unread, archived, byTypeData, byCategoryData] =
        await Promise.all([
          this.prisma.userNotification.count({ where: { userId } }),
          this.prisma.userNotification.count({ where: { userId, read: false } }),
          this.prisma.userNotification.count({ where: { userId, archive: true } }),
          // Group by notification type
          this.prisma.userNotification.findMany({
            where: { userId },
            include: { notification: { select: { type: true } } },
          }),
          // Group by notification category
          this.prisma.userNotification.findMany({
            where: { userId },
            include: { notification: { select: { category: true } } },
          }),
        ]);

      // Count by type
      const byType: Record<NotificationType, number> = {};
      byTypeData.forEach((un) => {
        if (un.notification.type) {
          const type = un.notification.type;
          byType[type] = (byType[type] || 0) + 1;
        }
      });

      // Count by category
      const byCategory: Record<NotificationCategory, number> = {} as Record<
        NotificationCategory,
        number
      >;
      byCategoryData.forEach((un) => {
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
      logger.error(
        "Error getting notification stats",
        { userId },
        error as Error
      );
      throw new AppError("Failed to get notification statistics", 500);
    }
  }

  // Add new method for category filtering
  async getNotificationsByCategory(
    category: NotificationCategory,
    limit: number = 100
  ): Promise<NotificationResult[]> {
    try {
      const notifications = await this.prisma.notification.findMany({
        where: { category },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return notifications.map((notif) => ({
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
      logger.error(
        "Error getting notifications by category",
        { category },
        error as Error
      );
      throw new AppError("Failed to get notifications by category", 500);
    }
  }

  async deleteOldNotifications(
    daysOld: number = 30
  ): Promise<{ count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Delete UserNotifications first (foreign key constraint)
      await this.prisma.userNotification.deleteMany({
        where: {
          notification: {
            createdAt: { lt: cutoffDate },
          },
        },
      });

      // Then delete Notifications
      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info("Deleted old notifications", {
        daysOld,
        count: result.count,
      });

      return { count: result.count };
    } catch (error) {
      logger.error(
        "Error deleting old notifications",
        { daysOld },
        error as Error
      );
      throw new AppError("Failed to delete old notifications", 500);
    }
  }

  /**
   * Send email notification using Resend
   */
  async sendEmail(input: SendEmailInput): Promise<void> {
    const { to, subject, body, recipientName } = input;

    try {
      // Create HTML email template
      const html = this.createEmailTemplate(subject, body, recipientName);

      await sendEmailViaResend(to, subject, html);

      logger.info("Email sent successfully", { to, subject });
    } catch (error) {
      logger.error("Failed to send email", { to, subject }, error as Error);
      throw new AppError("Failed to send email", 500);
    }
  }

  /**
   * Send push notification via Expo
   */
  async sendPushNotification(input: SendPushInput): Promise<void> {
    const { token, title, body, data } = input;

    // Validate token format
    if (!Expo.isExpoPushToken(token)) {
      logger.warn("Invalid Expo push token", { token });
      // Mark token as inactive if invalid
      await this.deactivatePushToken(token);
      return;
    }

    try {
      const message: ExpoPushMessage = {
        to: token,
        sound: "default",
        title,
        body,
        data: data || {},
      };

      const chunks = expo.chunkPushNotifications([message]);

      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        // Handle tickets and potential errors
        for (const ticket of ticketChunk) {
          if (ticket.status === "error") {
            logger.error("Push notification error", {
              token,
              error: ticket.message,
              details: ticket.details,
            });

            // If device not registered, deactivate token
            if (ticket.details?.error === "DeviceNotRegistered") {
              await this.deactivatePushToken(token);
            }
          } else {
            logger.info("Push notification sent", {
              token,
              ticketId: ticket.id,
            });
          }
        }
      }
    } catch (error) {
      logger.error(
        "Failed to send push notification",
        { token },
        error as Error
      );
      throw new AppError("Failed to send push notification", 500);
    }
  }

  /**
   * Deactivate a push token that is no longer valid
   */
  private async deactivatePushToken(token: string): Promise<void> {
    try {
      await this.prisma.userPushToken.updateMany({
        where: { token },
        data: {
          isActive: false,
          failureCount: { increment: 1 },
        },
      });
      logger.info("Push token deactivated", { token });
    } catch (error) {
      logger.error(
        "Failed to deactivate push token",
        { token },
        error as Error
      );
    }
  }

  /**
   * Send push notifications to multiple users
   * Fetches active push tokens for users and sends notifications
   */
  async sendPushToUsers(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Get active push tokens for the specified users
      const pushTokens = await prisma.userPushToken.findMany({
        where: {
          userId: { in: userIds },
          isActive: true,
        },
        select: {
          token: true,
          userId: true,
        },
      });

      if (pushTokens.length === 0) {
        logger.info("No active push tokens found for users", { userIds });
        return;
      }

      // Send push notification to each token
      const pushPromises = pushTokens.map(({ token }) =>
        this.sendPushNotification(
          token,
          notification.title,
          notification.body,
          notification.data
        )
      );

      await Promise.allSettled(pushPromises);
      logger.info("Push notifications sent to users", {
        userCount: userIds.length,
        tokenCount: pushTokens.length,
      });
    } catch (error) {
      logger.error(
        "Failed to send push notifications to users",
        { userIds },
        error as Error
      );
    }
  }

  /**
   * Create HTML email template
   */
  private createEmailTemplate(
    subject: string,
    body: string,
    recipientName?: string
  ): string {
    const greeting = recipientName ? `Hello ${recipientName},` : "Hello,";
    const logoUrl =
      process.env.EMAIL_LOGO_URL || "https://deuceleague.com/logo.png";
    const companyName = process.env.COMPANY_NAME || "Deuce League";
    const primaryColor = process.env.EMAIL_PRIMARY_COLOR || "#1a73e8";

    return `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${logoUrl}" alt="${companyName} Logo" style="height: 60px;" />
        </div>
        <h2 style="color: ${primaryColor};">${subject}</h2>
        <p>${greeting}</p>
        <div style="margin: 20px 0; line-height: 1.6;">
          ${body.replace(/\n/g, "<br/>")}
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eaeaea;" />
        <p style="font-size: 12px; color: #888; text-align: center;">
          &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  private emitNotifications(
    userIds: string[],
    notification: NotificationResult
  ): void {
    if (!this.io) return;

    userIds.forEach((userId) => {
      this.io!.to(userId).emit("new_notification", {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    });

    logger.debug("Real-time notifications emitted", {
      userCount: userIds.length,
    });
  }
}

export const notificationService = new NotificationService();
