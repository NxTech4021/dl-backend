import { Request, Response } from 'express';
import { NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService';

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
      type,
      types,
    } = req.query;

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

// Archive notification
export const archiveNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    await notificationService.archiveNotification(id, userId);

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

// Get notification statistics
export const getNotificationStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification stats',
    });
  }
};

// Get notifications by type
export const getNotificationsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { limit = 100 } = req.query;

    if (!type || !Object.values(NotificationType).includes(type as NotificationType)) {
      return res.status(400).json({ 
        error: 'Valid notification type is required',
        validTypes: Object.values(NotificationType),
      });
    }

    const notifications = await notificationService.getNotificationsByType(
      type as NotificationType,
      Number(limit)
    );

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('Error getting notifications by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications by type',
    });
  }
};

// Send test notification (admin only)
export const sendTestNotification = async (req: Request, res: Response) => {
  try {
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
    } = req.body;

    // Validation
    if (!userIds || (!Array.isArray(userIds) && typeof userIds !== 'string')) {
      return res.status(400).json({
        error: 'userIds is required (string or array of strings)',
      });
    }

    if (!type || !Object.values(NotificationType).includes(type)) {
      return res.status(400).json({
        error: 'Valid notification type is required',
        validTypes: Object.values(NotificationType),
      });
    }

    if (!message) {
      return res.status(400).json({
        error: 'message is required',
      });
    }

    const result = await notificationService.createNotification({
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


// Delete old notifications (admin only - for cleanup)
export const deleteOldNotifications = async (req: Request, res: Response) => {
  try {
    const { daysOld = 30 } = req.query;

    const result = await notificationService.deleteOldNotifications(Number(daysOld));

    res.json({
      success: true,
      data: { deletedCount: result.count },
      message: `Deleted ${result.count} notifications older than ${daysOld} days`,
    });
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete old notifications',
    });
  }
};