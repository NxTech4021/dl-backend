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
import {
  getNotificationDeliveryType,
  shouldSendPushNotification,
  NotificationDeliveryType,
} from "../types/notificationDeliveryTypes";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { sendEmail as sendEmailViaResend } from "../config/nodemailer";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import {
  isPushEnabled,
  isEmailEnabled,
} from "./notification/notificationPreferenceService";

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
  data?: Record<string, string> | undefined;
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

      // Conditions for push & in-app
      const deliveryType = type ? getNotificationDeliveryType(type) : "UNKNOWN";
      const willSendPush = type ? shouldSendPushNotification(type) : false;

      // console.log('🔔 [NotificationService] Creating notification:', {
      //   type,
      //   category,
      //   title,
      //   userCount: Array.isArray(userIds) ? userIds.length : 1,
      //   deliveryType,
      //   willSendPush,
      // });

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
        console.warn("⚠️  [NotificationService] Some users not found:", {
          missingIds,
        });
        logger.warn("Some users not found", { missingIds });
      }
      const validUserIds = users.map((u) => u.id);

      // Always send push notification if required
      if (willSendPush) {
        // Send push notifications to users who have push enabled
        // This runs in the background to not block the response
        this.sendPushNotificationsToUsers(validUserIds, {
          title: title ?? "Deuce League",
          body: message,
          data: {
            type: type ?? "",
            category: category,
            ...Object.fromEntries(
              Object.entries(entityIds)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            ),
            // Include metadata in push payload (sport, location, seasonName, etc.)
            ...(metadata && Object.fromEntries(
              Object.entries(metadata)
                .filter(([_, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])
            )),
          },
        }).catch((error) => {
          logger.error(
            "Failed to send push notifications",
            { type, category },
            error as Error
          );
        });
      }

      // Only create in-app notification if delivery type is IN_APP
      if (deliveryType === NotificationDeliveryType.IN_APP) {
        const createData: any = {
          message,
          category,
        };
        if (title !== undefined) createData.title = title;
        if (type !== undefined) createData.type = type;

        // Filter out invalid Prisma fields and convert entity IDs to proper format
        const validEntityIds: Record<string, any> = {};
        Object.entries(entityIds).forEach(([key, value]) => {
          if (value !== undefined && key !== "isPush" && key !== "skipPush") {
            if (key === "threadId" && value) {
              createData.threadId = value;
            } else if (key === "divisionId" && value) {
              createData.divisionId = value;
            } else if (key === "seasonId" && value) {
              createData.seasonId = value;
            } else if (key === "matchId" && value) {
              createData.matchId = value;
            } else if (key === "partnershipId" && value) {
              createData.partnershipId = value;
            } else if (key === "pairRequestId" && value) {
              createData.pairRequestId = value;
            } else if (key === "withdrawalRequestId" && value) {
              createData.withdrawalRequestId = value;
            }
            validEntityIds[key] = value;
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

        // Send real-time notifications via Socket.IO
        if (this.io) {
          console.log(
            "📡 [NotificationService] Emitting via Socket.IO to users:",
            validUserIds
          );
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
              ...validEntityIds,
            },
            readAt: undefined,
          });
        }

        logger.info("In-app notification created and sent", {
          category,
          type,
          userCount: validUserIds.length,
          deliveryType,
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
            ...validEntityIds,
          },
        }));
      }

      // If PUSH only, return empty array (no in-app notification created)
      return [];
    } catch (error) {
      console.error(
        "❌ [NotificationService] Error creating notification:",
        error
      );
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
          metadata: {
            ...((un.notification.metadata as Record<string, any>) || {}),
            // Include entity IDs from separate DB columns for navigation
            ...(un.notification.matchId && {
              matchId: un.notification.matchId,
            }),
            ...(un.notification.threadId && {
              threadId: un.notification.threadId,
            }),
            ...(un.notification.seasonId && {
              seasonId: un.notification.seasonId,
            }),
            ...(un.notification.divisionId && {
              divisionId: un.notification.divisionId,
            }),
          },
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
          this.prisma.userNotification.count({
            where: { userId, read: false },
          }),
          this.prisma.userNotification.count({
            where: { userId, archive: true },
          }),
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
        metadata: notif.metadata as Record<string, any> | undefined,
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
   * Send push notifications to multiple users
   */
  private async sendPushToUsers(
    userIds: string[],
    pushData: { title: string; body: string; data?: Record<string, any> }
  ): Promise<void> {
    const pushTokens = await prisma.userPushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });

    if (pushTokens.length === 0) {
      console.log("No active push tokens found for users:", userIds);
      return;
    }

    const messages = pushTokens.map((tokenRecord) => ({
      to: tokenRecord.token,
      sound: "default",
      title: pushData.title,
      body: pushData.body,
      data: pushData.data || {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    console.log("Push notifications sent successfully:", tickets);
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

      logger.info("Preparing to send push notification", { message });

      const chunks = expo.chunkPushNotifications([message]);

      for (const chunk of chunks) {
        logger.info("Sending push notification chunk", { chunk });
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        logger.info("Received ticket chunk from Expo", { ticketChunk });

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
              logger.warn(
                "Token deactivated due to DeviceNotRegistered error",
                { token }
              );
            }
          } else {
            logger.info("Push notification sent successfully", {
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
   * Checks user preferences and gets active push tokens
   */
  private async sendPushNotificationsToUsers(
    userIds: string[],
    notification: { title: string; body: string; data?: Record<string, string> }
  ): Promise<void> {
    if (userIds.length === 0) return;

    try {
      // Get users who have push notifications enabled
      const usersWithPushEnabled = await Promise.all(
        userIds.map(async (userId) => {
          const enabled = await isPushEnabled(userId);
          return enabled ? userId : null;
        })
      );
      const eligibleUserIds = usersWithPushEnabled.filter(
        (id): id is string => id !== null
      );

      if (eligibleUserIds.length === 0) {
        logger.debug("No users with push notifications enabled", { userIds });
        return;
      }

      // Get active push tokens for eligible users
      const tokens = await this.prisma.userPushToken.findMany({
        where: {
          userId: { in: eligibleUserIds },
          isActive: true,
        },
        select: { token: true, userId: true },
      });

      if (tokens.length === 0) {
        logger.debug("No active push tokens found", {
          userIds: eligibleUserIds,
        });
        return;
      }

      logger.info("Sending push notifications", {
        eligibleUsers: eligibleUserIds.length,
        tokens: tokens.length,
      });

      // Send push notifications in parallel (with error handling per token)
      await Promise.allSettled(
        tokens.map(({ token }) =>
          this.sendPushNotification({
            token,
            title: notification.title,
            body: notification.body,
            data: notification.data,
          })
        )
      );
    } catch (error) {
      logger.error(
        "Error sending push notifications to users",
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

console.log("NOTIFICATION SERVICE IS RUNNING");
export const notificationService = new NotificationService();
