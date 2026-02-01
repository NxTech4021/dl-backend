/**
 * Notification Test Factory
 *
 * Factory functions for creating test notifications and related data.
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { NotificationCategory, NotificationDeliveryChannel } from '@prisma/client';

export interface CreateNotificationOptions {
  userId: string;
  category?: NotificationCategory;
  type?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  isArchived?: boolean;
  seasonId?: string;
  matchId?: string;
  partnershipId?: string;
  pairRequestId?: string;
}

// Helper to generate random string
const randomString = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Create a test notification directly in the database
 */
export const createTestNotification = async (
  options: CreateNotificationOptions
) => {
  const {
    userId,
    category = 'GENERAL',
    type = 'WELCOME_TO_DEUCE',
    title = `Test Notification ${randomString(6)}`,
    message = 'This is a test notification message',
    isRead = false,
    isArchived = false,
    seasonId,
    matchId,
    partnershipId,
    pairRequestId,
  } = options;

  return prismaTest.notification.create({
    data: {
      userId,
      category,
      type,
      title,
      message,
      isRead,
      isArchived,
      seasonId,
      matchId,
      partnershipId,
      pairRequestId,
      deliveryChannels: [NotificationDeliveryChannel.IN_APP],
    },
  });
};

/**
 * Create multiple test notifications for a user
 */
export const createTestNotifications = async (
  userId: string,
  count: number,
  options: Partial<CreateNotificationOptions> = {}
) => {
  const notifications = [];
  for (let i = 0; i < count; i++) {
    const notification = await createTestNotification({
      userId,
      title: `Notification ${i + 1}`,
      message: `Message ${i + 1}`,
      ...options,
    });
    notifications.push(notification);
  }
  return notifications;
};

/**
 * Create an unread notification
 */
export const createUnreadNotification = async (
  userId: string,
  options: Partial<CreateNotificationOptions> = {}
) => {
  return createTestNotification({
    userId,
    isRead: false,
    ...options,
  });
};

/**
 * Create a read notification
 */
export const createReadNotification = async (
  userId: string,
  options: Partial<CreateNotificationOptions> = {}
) => {
  return createTestNotification({
    userId,
    isRead: true,
    ...options,
  });
};

/**
 * Create an archived notification
 */
export const createArchivedNotification = async (
  userId: string,
  options: Partial<CreateNotificationOptions> = {}
) => {
  return createTestNotification({
    userId,
    isArchived: true,
    ...options,
  });
};

/**
 * Create a match notification
 */
export const createMatchNotification = async (
  userId: string,
  matchId: string,
  options: Partial<CreateNotificationOptions> = {}
) => {
  return createTestNotification({
    userId,
    matchId,
    category: 'MATCH',
    type: 'MATCH_SCHEDULED',
    title: 'Match Scheduled',
    message: 'Your match has been scheduled',
    ...options,
  });
};

/**
 * Create a partnership notification
 */
export const createPartnershipNotification = async (
  userId: string,
  partnershipId: string,
  options: Partial<CreateNotificationOptions> = {}
) => {
  return createTestNotification({
    userId,
    partnershipId,
    category: 'DOUBLES',
    type: 'PARTNER_JOINED',
    title: 'Partner Joined',
    message: 'Your partner has joined the team',
    ...options,
  });
};

/**
 * Create an old notification for cleanup testing
 */
export const createOldNotification = async (
  userId: string,
  daysOld: number,
  options: Partial<CreateNotificationOptions> = {}
) => {
  const notification = await createTestNotification({
    userId,
    ...options,
  });

  // Update createdAt to be in the past
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - daysOld);

  await prismaTest.notification.update({
    where: { id: notification.id },
    data: { createdAt: oldDate },
  });

  return prismaTest.notification.findUnique({
    where: { id: notification.id },
  });
};
