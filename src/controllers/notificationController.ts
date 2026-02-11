import { Request, Response } from 'express';
import { NotificationCategory } from '@prisma/client';
import { NotificationType, NOTIFICATION_TYPES } from '../types/notificationTypes';
import { notificationService } from '../services/notificationService';
import { prisma } from '../lib/prisma';
import { Expo } from 'expo-server-sdk';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

// Validate Expo push token format
function isValidExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

// Get user notifications
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      archived = false,
      category,
      categories,
      type,
      types,
    } = req.query;

    // Parse categories array if provided
    let parsedCategories: NotificationCategory[] | undefined;
    if (categories && typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories);
      } catch (error) {
        return sendError(res, 'Invalid categories format. Expected JSON array.', 400);
      }
    }

    // Parse types array if provided
    let parsedTypes: NotificationType[] | undefined;
    if (types && typeof types === 'string') {
      try {
        parsedTypes = JSON.parse(types);
      } catch (error) {
        return sendError(res, 'Invalid types format. Expected JSON array.', 400);
      }
    }

    const result = await notificationService.getUserNotifications(userId, {
      page: Number(page),
      limit: Number(limit),
      unreadOnly: unreadOnly === 'true',
      archived: archived === 'true',
      category: category as NotificationCategory,
      categories: parsedCategories || [],
      type: type as NotificationType,
      types: parsedTypes,
    });

    sendPaginated(res, result.notifications, result.pagination);
  } catch (error) {
    console.error('Error getting notifications:', error);
    sendError(res, 'Failed to get notifications');
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!id) {
      return sendError(res, 'Notification ID is required', 400);
    }

    await notificationService.markAsRead(id, userId);

    sendSuccess(res, null, 'Notification marked as read');
  } catch (error) {
    console.error('Error marking notification as read:', error);
    sendError(res, 'Failed to mark notification as read');
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const result = await notificationService.markAllAsRead(userId);

    sendSuccess(res, { updatedCount: result.count }, `${result.count} notifications marked as read`);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    sendError(res, 'Failed to mark all notifications as read');
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!id) {
      return sendError(res, 'Notification ID is required', 400);
    }

    await notificationService.deleteNotification(id, userId);

    sendSuccess(res, null, 'Notification archived');
  } catch (error) {
    console.error('Error archiving notification:', error);
    sendError(res, 'Failed to archive notification');
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const count = await notificationService.getUnreadCount(userId);

    sendSuccess(res, { unreadCount: count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    sendError(res, 'Failed to get unread count');
  }
};


// Get notifications by category
export const getNotificationsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit = 100 } = req.query;

    if (!category || !Object.values(NotificationCategory).includes(category as NotificationCategory)) {
      return sendError(res, 'Valid notification category is required', 400);
    }

    const notifications = await notificationService.getNotificationsByCategory(
      category as NotificationCategory,
      Number(limit)
    );

    sendSuccess(res, notifications);
  } catch (error) {
    console.error('Error getting notifications by category:', error);
    sendError(res, 'Failed to get notifications by category');
  }
};


// Send test notification (admin only)
export const sendTestNotification = async (req: Request, res: Response) => {
  try {
    const {
      userIds,
      type,
      category,
      title,
      message,
      seasonId,
      divisionId,
      matchId,
      partnershipId,
      threadId,
      pairRequestId,
      withdrawalRequestId,
    } = req.body;

    // Validation
    if (!userIds || (!Array.isArray(userIds) && typeof userIds !== 'string')) {
      return sendError(res, 'userIds is required (string or array of strings)', 400);
    }

    if (!category || !Object.values(NotificationCategory).includes(category)) {
      return sendError(res, 'Valid notification category is required', 400);
    }

    if (!message) {
      return sendError(res, 'message is required', 400);
    }

    const result = await notificationService.createNotification({
      userIds,
      type: type || 'TEST_NOTIFICATION',
      category,
      title,
      message,
      seasonId,
      divisionId,
      matchId,
      partnershipId,
      threadId,
      pairRequestId,
      withdrawalRequestId,
    });

    sendSuccess(res, result, `Test notification sent to ${Array.isArray(userIds) ? userIds.length : 1} user(s)`);
  } catch (error) {
    console.error('Error sending test notification:', error);
    sendError(res, 'Failed to send test notification');
  }
};

// Register push notification token
export const registerPushToken = async (req: Request, res: Response) => {
  try {
    // Get user ID from auth middleware only (secure - no header fallback)
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Authentication required - valid session needed', 401);
    }

    const { token, platform = "android", deviceId } = req.body;

    if (!token) {
      return sendError(res, 'Push token is required', 400);
    }

    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      return sendError(res, 'Valid platform is required (ios, android, or web)', 400);
    }

    // Validate Expo push token format before storing
    if (!isValidExpoPushToken(token)) {
      return sendError(res, 'Invalid push token format. Expected Expo push token format (ExponentPushToken[...] or ExpoPushToken[...])', 400);
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Upsert push token - update if exists, create if not
    const pushToken = await prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        deviceId: deviceId || null,
        isActive: true,
        failureCount: 0,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId: deviceId || null,
        isActive: true,
      },
    });

    sendSuccess(res, {
      id: pushToken.id,
      platform: pushToken.platform,
      isActive: pushToken.isActive,
      userId: pushToken.userId, // Added for debugging
    }, 'Push token registered successfully');
  } catch (error) {
    console.error('Error registering push token:', error);
    sendError(res, 'Failed to register push token');
  }
};

// Unregister push notification token
export const unregisterPushToken = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { token } = req.body;

    if (!token) {
      return sendError(res, 'Push token is required', 400);
    }

    // Deactivate the token instead of deleting (for audit trail)
    await prisma.userPushToken.updateMany({
      where: {
        token,
        userId, // Only allow user to deactivate their own tokens
      },
      data: {
        isActive: false,
      },
    });

    sendSuccess(res, null, 'Push token unregistered successfully');
  } catch (error) {
    console.error('Error unregistering push token:', error);
    sendError(res, 'Failed to unregister push token');
  }
};

// Get user's registered push tokens
export const getUserPushTokens = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const tokens = await prisma.userPushToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    sendSuccess(res, tokens);
  } catch (error) {
    console.error('Error getting push tokens:', error);
    sendError(res, 'Failed to get push tokens');
  }
};

// Send test LOCAL/IN-APP notification (creates database record only)
export const sendTestLocalNotification = async (req: Request, res: Response) => {
  try {
    const {
      userIds,
      type,
      category,
      title,
      message,
      seasonId,
      divisionId,
      matchId,
      partnershipId,
      threadId,
      pairRequestId,
      withdrawalRequestId,
    } = req.body;

    // Validation
    if (!userIds || (!Array.isArray(userIds) && typeof userIds !== 'string')) {
      return sendError(res, 'userIds is required (string or array of strings)', 400);
    }

    if (!category || !Object.values(NotificationCategory).includes(category)) {
      return sendError(res, 'Valid notification category is required', 400);
    }

    if (!message) {
      return sendError(res, 'message is required', 400);
    }

    const result = await notificationService.createNotification({
      userIds,
      type: type || 'TEST_NOTIFICATION',
      category,
      title,
      message,
      seasonId,
      divisionId,
      matchId,
      partnershipId,
      threadId,
      pairRequestId,
      withdrawalRequestId,
    });

    sendSuccess(res, { ...result, type: 'LOCAL_IN_APP' }, `Local notification created for ${Array.isArray(userIds) ? userIds.length : 1} user(s)`);
  } catch (error) {
    console.error('Error sending local notification:', error);
    sendError(res, 'Failed to send local notification');
  }
};

// Send test PUSH notification (sends to Expo push service only)
export const sendTestPushNotification = async (req: Request, res: Response) => {
  try {
    const { userIds, title, message, data } = req.body;

    if (!userIds || !title || !message) {
      return sendError(res, 'Missing required fields: userIds, title, message', 400);
    }

    // Ensure userIds is an array
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

    // Get push tokens for users
    const pushTokens = await prisma.userPushToken.findMany({
      where: {
        userId: { in: userIdArray },
        isActive: true,
      },
    });

    if (pushTokens.length === 0) {
      return sendError(res, 'No active push tokens found', 400);
    }

    // Send to Expo push service directly
    const expo = new Expo();
    const messages = pushTokens.map(tokenRecord => ({
      to: tokenRecord.token,
      sound: 'default',
      title,
      body: message,
      data: data || {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const results = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        results.push(...ticketChunk);
        console.log('Push notification sent:', ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    sendSuccess(res, {
      type: 'PUSH_NOTIFICATION',
      tokensAttempted: pushTokens.length,
      results,
      title,
      message,
      userIds: userIdArray,
      tokenCount: pushTokens.length,
    }, 'Push notification sent');
  } catch (error) {
    console.error('Error sending push notification:', error);
    sendError(res, 'Failed to send push notification');
  }
};
