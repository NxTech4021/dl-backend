/**
 * Notification Preference Service
 * Manages user notification preferences and provides helpers for preference checking
 */

import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

// Type for preference keys
export type NotificationPreferenceKey =
  | 'matchReminders'
  | 'matchRescheduled'
  | 'matchCancelled'
  | 'matchResults'
  | 'partnerChange'
  | 'opponentChange'
  | 'ratingChange'
  | 'inactivityAlerts'
  | 'chatNotifications'
  | 'invitations'
  | 'seasonRegistration'
  | 'seasonUpdates'
  | 'disputeAlerts'
  | 'teamChangeRequests'
  | 'withdrawalRequests'
  | 'playerReports'
  | 'seasonJoinRequests';

export interface NotificationPreferenceInput {
  matchReminders?: boolean;
  matchRescheduled?: boolean;
  matchCancelled?: boolean;
  matchResults?: boolean;
  partnerChange?: boolean;
  opponentChange?: boolean;
  ratingChange?: boolean;
  inactivityAlerts?: boolean;
  chatNotifications?: boolean;
  invitations?: boolean;
  seasonRegistration?: boolean;
  seasonUpdates?: boolean;
  disputeAlerts?: boolean;
  teamChangeRequests?: boolean;
  withdrawalRequests?: boolean;
  playerReports?: boolean;
  seasonJoinRequests?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

/**
 * Get user notification preferences
 * Returns default preferences if none exist
 */
export async function getUserPreferences(userId: string) {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId }
  });

  if (!preferences) {
    // Return default preferences
    return {
      matchReminders: true,
      matchRescheduled: true,
      matchCancelled: true,
      matchResults: true,
      partnerChange: true,
      opponentChange: true,
      ratingChange: true,
      inactivityAlerts: true,
      chatNotifications: true,
      invitations: true,
      seasonRegistration: true,
      seasonUpdates: true,
      disputeAlerts: true,
      teamChangeRequests: true,
      withdrawalRequests: true,
      playerReports: true,
      seasonJoinRequests: true,
      pushEnabled: true,
      emailEnabled: false
    };
  }

  return preferences;
}

/**
 * Update user notification preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: NotificationPreferenceInput
) {
  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    update: preferences,
    create: {
      userId,
      ...preferences
    }
  });

  logger.info('Updated notification preferences', { userId });
  return updated;
}

/**
 * Check if a user has a specific notification preference enabled
 */
export async function isPreferenceEnabled(
  userId: string,
  preferenceKey: NotificationPreferenceKey
): Promise<boolean> {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { [preferenceKey]: true }
  });

  // Default to true if no preferences set
  if (!preferences) {
    return true;
  }

  return (preferences as Record<string, boolean>)[preferenceKey] ?? true;
}

/**
 * Filter user IDs based on their notification preferences
 * Returns only users who have the specified preference enabled
 */
export async function filterUsersByPreference(
  userIds: string[],
  preferenceKey: NotificationPreferenceKey
): Promise<string[]> {
  if (userIds.length === 0) return [];

  // Get preferences for all users
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, [preferenceKey]: true }
  });

  const preferencesMap = new Map<string, boolean>(
    preferences.map((p: any) => [p.userId, p[preferenceKey]])
  );

  // Filter users - include if preference is true or not set (default true)
  return userIds.filter(userId => {
    const preference = preferencesMap.get(userId);
    return preference === undefined || preference === true;
  });
}

/**
 * Get all admin user IDs
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPERADMIN'] },
      status: 'ACTIVE'
    },
    select: { id: true }
  });

  return admins.map(a => a.id);
}

/**
 * Get admin user IDs who have a specific notification preference enabled
 */
export async function getAdminsWithPreference(
  preferenceKey: NotificationPreferenceKey
): Promise<string[]> {
  const adminIds = await getAdminUserIds();
  return filterUsersByPreference(adminIds, preferenceKey);
}

/**
 * Check if push notifications are enabled for a user
 */
export async function isPushEnabled(userId: string): Promise<boolean> {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { pushEnabled: true }
  });

  return preferences?.pushEnabled ?? true;
}

/**
 * Check if email notifications are enabled for a user
 */
export async function isEmailEnabled(userId: string): Promise<boolean> {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { emailEnabled: true }
  });

  return preferences?.emailEnabled ?? false;
}

/**
 * Create default preferences for a new user
 */
export async function createDefaultPreferences(userId: string) {
  return prisma.notificationPreference.create({
    data: { userId }
  });
}

/**
 * Delete user preferences (for account deletion)
 */
export async function deleteUserPreferences(userId: string) {
  return prisma.notificationPreference.delete({
    where: { userId }
  }).catch(() => null); // Ignore if doesn't exist
}
