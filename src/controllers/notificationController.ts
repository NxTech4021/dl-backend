import { Request, Response } from 'express';
import { NotificationCategory } from '@prisma/client';
import { NotificationType, NOTIFICATION_TYPES } from '../types/notificationTypes';
import { notificationService } from '../services/notificationService';
import { prisma } from '../lib/prisma';
import { Expo } from 'expo-server-sdk';
import { notificationTemplates } from '../helpers/notification';

// Validate Expo push token format
function isValidExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}


// Get user notifications
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
        return res.status(400).json({ 
          error: 'Invalid categories format. Expected JSON array.' 
        });
      }
    }

    // Parse types array if provided
    let parsedTypes: NotificationType[] | undefined;
    if (types && typeof types === 'string') {
      try {
        parsedTypes = JSON.parse(types);
      } catch (error) {
        return res.status(400).json({ 
          error: 'Invalid types format. Expected JSON array.' 
        });
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

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications',
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    await notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `${result.count} notifications marked as read`,
      data: { updatedCount: result.count },
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification archived',
    });
  } catch (error) {
    console.error('Error archiving notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive notification',
    });
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
    });
  }
};


// Get notifications by category
export const getNotificationsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit = 100 } = req.query;

    if (!category || !Object.values(NotificationCategory).includes(category as NotificationCategory)) {
      return res.status(400).json({ 
        error: 'Valid notification category is required',
        validCategories: Object.values(NotificationCategory),
      });
    }

    const notifications = await notificationService.getNotificationsByCategory(
      category as NotificationCategory,
      Number(limit)
    );

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('Error getting notifications by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications by category',
    });
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
      return res.status(400).json({
        error: 'userIds is required (string or array of strings)',
      });
    }

    if (!category || !Object.values(NotificationCategory).includes(category)) {
      return res.status(400).json({
        error: 'Valid notification category is required',
        validCategories: Object.values(NotificationCategory),
      });
    }

    if (!message) {
      return res.status(400).json({
        error: 'message is required',
      });
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

    res.json({
      success: true,
      data: result,
      message: `Test notification sent to ${Array.isArray(userIds) ? userIds.length : 1} user(s)`,
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
    });
  }
};

// Register push notification token
export const registerPushToken = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token, platform, deviceId } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        error: 'Valid platform is required (ios, android, or web)'
      });
    }

    // Validate Expo push token format before storing
    if (!isValidExpoPushToken(token)) {
      return res.status(400).json({
        error: 'Invalid push token format. Expected Expo push token format (ExponentPushToken[...] or ExpoPushToken[...])'
      });
    }

    // Upsert push token - update if exists, create if not
    const pushToken = await prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId, // Transfer token to current user if different
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

    res.json({
      success: true,
      message: 'Push token registered successfully',
      data: {
        id: pushToken.id,
        platform: pushToken.platform,
        isActive: pushToken.isActive,
      },
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register push token',
    });
  }
};

// Unregister push notification token
export const unregisterPushToken = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
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

    res.json({
      success: true,
      message: 'Push token unregistered successfully',
    });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unregister push token',
    });
  }
};

// Get user's registered push tokens
export const getUserPushTokens = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    console.error('Error getting push tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get push tokens',
    });
  }
};

// Send a test push notification (uses a real push notification template)
export const sendTestPushNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use the "League Winner" push notification template as a test
    const testNotification = notificationTemplates.leagueLifecycle.leagueWinner('Test League');

    const result = await notificationService.createNotification({
      userIds: userId,
      ...testNotification,
    });

    res.json({
      success: true,
      data: result,
      message: '🎉 Test push notification sent! Check your device.',
      notification: {
        title: testNotification.title,
        message: testNotification.message,
        isPush: testNotification.isPush,
      },
    });
  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test push notification',
    });
  }
};
