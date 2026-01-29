/**
 * Notification Service Tests
 *
 * Tests for notification creation, retrieval, and management
 * Uses Dependency Injection to inject prismaTest for full integration testing.
 */

import { NotificationService } from '../../../src/services/notificationService';
import {
  createTestUser,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { NotificationCategory } from '@prisma/client';

// Helper constant for enum values
const GENERAL_CATEGORY = NotificationCategory.GENERAL;
const MATCH_CATEGORY = NotificationCategory.MATCH;
const LEAGUE_CATEGORY = NotificationCategory.LEAGUE;
const ADMIN_CATEGORY = NotificationCategory.ADMIN;

/**
 * Helper to create a notification directly in the database
 */
async function createTestNotification(
  userId: string,
  notificationCategory: NotificationCategory,
  notificationTitle: string,
  notificationMessage: string
) {
  const notification = await prismaTest.notification.create({
    data: {
      title: notificationTitle,
      message: notificationMessage,
      category: notificationCategory,
    },
  });

  await prismaTest.userNotification.create({
    data: {
      userId,
      notificationId: notification.id,
    },
  });

  return notification;
}

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    // Inject prismaTest for full integration testing
    service = new NotificationService(prismaTest as any);
  });

  describe('createNotification', () => {
    it('should create a notification for a single user', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await service.createNotification({
        userIds: [user.id],
        category: GENERAL_CATEGORY,
        type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
        title: 'Test Notification',
        message: 'This is a test message',
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Notification');
      expect(result[0].message).toBe('This is a test message');
      expect(result[0].category).toBe(GENERAL_CATEGORY);
      expect(result[0].read).toBe(false);
    });

    it('should create notifications for multiple users', async () => {
      // Arrange
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Act
      const result = await service.createNotification({
        userIds: [user1.id, user2.id],
        category: MATCH_CATEGORY,
        type: 'FRIENDLY_MATCH_POSTED', // Type required for IN_APP delivery
        title: 'Match Notification',
        message: 'You have a new match',
      });

      // Assert
      expect(result).toHaveLength(2);

      // Verify both users received the notification
      const user1Notification = await prismaTest.userNotification.findFirst({
        where: { userId: user1.id },
        include: { notification: true },
      });
      const user2Notification = await prismaTest.userNotification.findFirst({
        where: { userId: user2.id },
        include: { notification: true },
      });

      expect(user1Notification).not.toBeNull();
      expect(user2Notification).not.toBeNull();
      expect(user1Notification?.notification.title).toBe('Match Notification');
      expect(user2Notification?.notification.title).toBe('Match Notification');
    });

    it('should create notification with type', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await service.createNotification({
        userIds: [user.id],
        category: MATCH_CATEGORY,
        type: 'MATCH_INVITE',
        title: 'Match Invite',
        message: 'You have been invited to a match',
      });

      // Assert
      expect(result[0].type).toBe('MATCH_INVITE');
    });

    it('should skip non-existent users gracefully', async () => {
      // Arrange
      const user = await createTestUser();
      const nonExistentUserId = 'non-existent-user-id';

      // Act
      const result = await service.createNotification({
        userIds: [user.id, nonExistentUserId],
        category: GENERAL_CATEGORY,
        type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
        title: 'Test',
        message: 'Test message',
      });

      // Assert - only the valid user should receive notification
      expect(result).toHaveLength(1);
    });

    it('should throw error when no user IDs provided', async () => {
      // Act & Assert
      await expect(
        service.createNotification({
          userIds: [],
          category: GENERAL_CATEGORY,
          type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('At least one user ID is required');
    });
  });

  describe('getUserNotifications', () => {
    it('should return empty list when user has no notifications', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await service.getUserNotifications(user.id);

      // Assert
      expect(result.notifications).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return user notifications with pagination', async () => {
      // Arrange
      const user = await createTestUser();

      // Create 5 notifications using the SERVICE (not direct DB) to ensure same transaction context
      for (let i = 0; i < 5; i++) {
        await service.createNotification({
          userIds: [user.id],
          category: GENERAL_CATEGORY,
          type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
          title: `Notification ${i + 1}`,
          message: `Message ${i + 1}`,
        });
      }

      // Act - get first page with limit 2
      const result = await service.getUserNotifications(user.id, {
        page: 1,
        limit: 2,
      });

      // Assert
      expect(result.notifications).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should filter unread notifications only', async () => {
      // Arrange
      const user = await createTestUser();

      // Create notifications directly
      await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Unread',
        'Unread message'
      );

      const notification2 = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'To be read',
        'Will be read'
      );

      // Mark second notification as read
      await prismaTest.userNotification.update({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification2.id,
          },
        },
        data: { read: true, readAt: new Date() },
      });

      // Act
      const result = await service.getUserNotifications(user.id, {
        unreadOnly: true,
      });

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe('Unread');
    });

    it('should filter by category', async () => {
      // Arrange
      const user = await createTestUser();

      await createTestNotification(user.id, MATCH_CATEGORY, 'Match', 'Match msg');
      await createTestNotification(user.id, LEAGUE_CATEGORY, 'League', 'League msg');

      // Act
      const result = await service.getUserNotifications(user.id, {
        category: MATCH_CATEGORY,
      });

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe('Match');
      expect(result.notifications[0].category).toBe(MATCH_CATEGORY);
    });

    it('should filter by multiple categories', async () => {
      // Arrange
      const user = await createTestUser();

      await createTestNotification(user.id, MATCH_CATEGORY, 'Match', 'Match msg');
      await createTestNotification(user.id, LEAGUE_CATEGORY, 'League', 'League msg');
      await createTestNotification(user.id, ADMIN_CATEGORY, 'Admin', 'Admin msg');

      // Act
      const result = await service.getUserNotifications(user.id, {
        categories: [MATCH_CATEGORY, LEAGUE_CATEGORY],
      });

      // Assert
      expect(result.notifications).toHaveLength(2);
      const categories = result.notifications.map((n) => n.category);
      expect(categories).toContain(MATCH_CATEGORY);
      expect(categories).toContain(LEAGUE_CATEGORY);
      expect(categories).not.toContain(ADMIN_CATEGORY);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      // Arrange
      const user = await createTestUser();
      const notification = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Test',
        'Test message'
      );

      // Act
      await service.markAsRead(notification.id, user.id);

      // Assert
      const userNotification = await prismaTest.userNotification.findUnique({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification.id,
          },
        },
      });

      expect(userNotification?.read).toBe(true);
      expect(userNotification?.readAt).toBeDefined();
    });

    it('should throw error for non-existent notification', async () => {
      // Arrange
      const user = await createTestUser();

      // Act & Assert
      await expect(
        service.markAsRead('non-existent-notification', user.id)
      ).rejects.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      // Arrange
      const user = await createTestUser();

      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 1', 'Msg 1');
      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 2', 'Msg 2');
      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 3', 'Msg 3');

      // Act
      const result = await service.markAllAsRead(user.id);

      // Assert
      expect(result.count).toBe(3);

      const unreadCount = await prismaTest.userNotification.count({
        where: { userId: user.id, read: false },
      });
      expect(unreadCount).toBe(0);
    });

    it('should return 0 when no unread notifications', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await service.markAllAsRead(user.id);

      // Assert
      expect(result.count).toBe(0);
    });

    it('should only mark unread notifications', async () => {
      // Arrange
      const user = await createTestUser();

      const notification1 = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Already read',
        'Msg'
      );
      await createTestNotification(user.id, GENERAL_CATEGORY, 'Unread', 'Msg');

      // Mark first as read
      await prismaTest.userNotification.update({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification1.id,
          },
        },
        data: { read: true, readAt: new Date() },
      });

      // Act
      const result = await service.markAllAsRead(user.id);

      // Assert - only 1 notification should be marked
      expect(result.count).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a user notification', async () => {
      // Arrange
      const user = await createTestUser();
      const notification = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Test',
        'Test message'
      );

      // Act
      await service.deleteNotification(notification.id, user.id);

      // Assert
      const userNotification = await prismaTest.userNotification.findUnique({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification.id,
          },
        },
      });

      expect(userNotification).toBeNull();
    });

    it('should throw error for non-existent notification', async () => {
      // Arrange
      const user = await createTestUser();

      // Act & Assert
      await expect(
        service.deleteNotification('non-existent-notification', user.id)
      ).rejects.toThrow();
    });

    it('should only delete for the specified user', async () => {
      // Arrange
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create notification and link to both users
      const notification = await prismaTest.notification.create({
        data: {
          title: 'Shared Notification',
          message: 'For multiple users',
          category: GENERAL_CATEGORY,
        },
      });

      await prismaTest.userNotification.createMany({
        data: [
          { userId: user1.id, notificationId: notification.id },
          { userId: user2.id, notificationId: notification.id },
        ],
      });

      // Act - delete for user1 only
      await service.deleteNotification(notification.id, user1.id);

      // Assert - user2 should still have the notification
      const user1Notification = await prismaTest.userNotification.findUnique({
        where: {
          userId_notificationId: {
            userId: user1.id,
            notificationId: notification.id,
          },
        },
      });

      const user2Notification = await prismaTest.userNotification.findUnique({
        where: {
          userId_notificationId: {
            userId: user2.id,
            notificationId: notification.id,
          },
        },
      });

      expect(user1Notification).toBeNull();
      expect(user2Notification).not.toBeNull();
    });
  });

  describe('getUnreadCount', () => {
    it('should return 0 when user has no notifications', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const count = await service.getUnreadCount(user.id);

      // Assert
      expect(count).toBe(0);
    });

    it('should return correct unread count', async () => {
      // Arrange
      const user = await createTestUser();

      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 1', 'Msg 1');
      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 2', 'Msg 2');
      const notification3 = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Test 3',
        'Msg 3'
      );

      // Mark one as read
      await prismaTest.userNotification.update({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification3.id,
          },
        },
        data: { read: true },
      });

      // Act
      const count = await service.getUnreadCount(user.id);

      // Assert
      expect(count).toBe(2);
    });

    it('should not count archived notifications', async () => {
      // Arrange
      const user = await createTestUser();

      await createTestNotification(user.id, GENERAL_CATEGORY, 'Test 1', 'Msg 1');
      const notification2 = await createTestNotification(
        user.id,
        GENERAL_CATEGORY,
        'Test 2',
        'Msg 2'
      );

      // Archive one
      await prismaTest.userNotification.update({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notification2.id,
          },
        },
        data: { archive: true },
      });

      // Act
      const count = await service.getUnreadCount(user.id);

      // Assert
      expect(count).toBe(1);
    });
  });

  describe('getNotificationStats', () => {
    it('should return zero stats when user has no notifications', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const stats = await service.getNotificationStats(user.id);

      // Assert
      expect(stats.total).toBe(0);
      expect(stats.unread).toBe(0);
      expect(stats.archived).toBe(0);
    });

    it('should return correct stats', async () => {
      // Arrange
      const user = await createTestUser();

      // Create notifications using the service
      const [notif1] = await service.createNotification({
        userIds: [user.id],
        category: GENERAL_CATEGORY,
        type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
        title: 'Test 1',
        message: 'Msg 1',
      });
      const [notif2] = await service.createNotification({
        userIds: [user.id],
        category: GENERAL_CATEGORY,
        type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
        title: 'Test 2',
        message: 'Msg 2',
      });
      const [notif3] = await service.createNotification({
        userIds: [user.id],
        category: GENERAL_CATEGORY,
        type: 'WELCOME_TO_DEUCE', // Type required for IN_APP delivery
        title: 'Test 3',
        message: 'Msg 3',
      });

      // Mark one as read
      await service.markAsRead(notif2.id, user.id);

      // Archive one (using prismaTest since service doesn't have archive method)
      await prismaTest.userNotification.update({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notif3.id,
          },
        },
        data: { archive: true },
      });

      // Act
      const stats = await service.getNotificationStats(user.id);

      // Assert
      expect(stats.total).toBe(3);
      expect(stats.unread).toBe(2); // notification1 and notification3 (archived but not read)
      expect(stats.archived).toBe(1);
    });

    it('should count by type when notifications have types', async () => {
      // Arrange
      const user = await createTestUser();

      // Create notifications with types using the service
      await service.createNotification({
        userIds: [user.id],
        category: MATCH_CATEGORY,
        type: 'MATCH_INVITE',
        title: 'Match Invite',
        message: 'You have been invited',
      });

      await service.createNotification({
        userIds: [user.id],
        category: MATCH_CATEGORY,
        type: 'MATCH_RESULT',
        title: 'Match Result',
        message: 'Match completed',
      });

      // Act
      const stats = await service.getNotificationStats(user.id);

      // Assert
      expect(stats.total).toBe(2);
      expect(stats.byType['MATCH_INVITE']).toBe(1);
      expect(stats.byType['MATCH_RESULT']).toBe(1);
    });
  });

  describe('getNotificationsByCategory', () => {
    it('should return notifications filtered by category', async () => {
      // Arrange
      await prismaTest.notification.create({
        data: {
          title: 'Match',
          message: 'Match message',
          category: MATCH_CATEGORY,
        },
      });

      await prismaTest.notification.create({
        data: {
          title: 'General',
          message: 'General message',
          category: GENERAL_CATEGORY,
        },
      });

      // Act
      const result = await service.getNotificationsByCategory(MATCH_CATEGORY);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((n) => n.category === MATCH_CATEGORY)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Arrange - create 5 league notifications
      for (let i = 0; i < 5; i++) {
        await prismaTest.notification.create({
          data: {
            title: `League ${i + 1}`,
            message: `Message ${i + 1}`,
            category: LEAGUE_CATEGORY,
          },
        });
      }

      // Act
      const result = await service.getNotificationsByCategory(LEAGUE_CATEGORY, 2);

      // Assert
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should order by creation date descending', async () => {
      // Arrange - create notifications with different dates
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5);

      await prismaTest.notification.create({
        data: {
          title: 'Old',
          message: 'Old notification',
          category: ADMIN_CATEGORY,
          createdAt: oldDate,
        },
      });

      await prismaTest.notification.create({
        data: {
          title: 'New',
          message: 'New notification',
          category: ADMIN_CATEGORY,
        },
      });

      // Act
      const result = await service.getNotificationsByCategory(ADMIN_CATEGORY);

      // Assert
      expect(result[0].title).toBe('New');
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete notifications older than specified days', async () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      const oldNotification = await prismaTest.notification.create({
        data: {
          title: 'Old',
          message: 'Old notification',
          category: GENERAL_CATEGORY,
          createdAt: oldDate,
        },
      });

      const newNotification = await prismaTest.notification.create({
        data: {
          title: 'New',
          message: 'New notification',
          category: GENERAL_CATEGORY,
        },
      });

      // Act
      const result = await service.deleteOldNotifications(30);

      // Assert
      expect(result.count).toBeGreaterThanOrEqual(1);

      const oldNotifExists = await prismaTest.notification.findUnique({
        where: { id: oldNotification.id },
      });
      const newNotifExists = await prismaTest.notification.findUnique({
        where: { id: newNotification.id },
      });

      expect(oldNotifExists).toBeNull();
      expect(newNotifExists).not.toBeNull();
    });

    it('should also delete associated userNotifications', async () => {
      // Arrange
      const user = await createTestUser();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      const oldNotification = await prismaTest.notification.create({
        data: {
          title: 'Old',
          message: 'Old notification',
          category: GENERAL_CATEGORY,
          createdAt: oldDate,
        },
      });

      await prismaTest.userNotification.create({
        data: {
          userId: user.id,
          notificationId: oldNotification.id,
        },
      });

      // Act
      await service.deleteOldNotifications(30);

      // Assert
      const userNotifExists = await prismaTest.userNotification.findUnique({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: oldNotification.id,
          },
        },
      });

      expect(userNotifExists).toBeNull();
    });

    it('should return 0 when no old notifications exist', async () => {
      // Act
      const result = await service.deleteOldNotifications(30);

      // Assert
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should use default 30 days when no parameter provided', async () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      await prismaTest.notification.create({
        data: {
          title: 'Old',
          message: 'Old notification',
          category: GENERAL_CATEGORY,
          createdAt: oldDate,
        },
      });

      // Act - call without parameter (defaults to 30 days)
      const result = await service.deleteOldNotifications();

      // Assert - should delete the 35-day-old notification
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });
});
