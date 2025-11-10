import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../types/notificationTypes';

/**
 * Division Notification Templates
 */
export const divisionNotifications = {
  created: (
    divisionName: string,
    seasonName: string,
    createdByName?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_CREATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_CREATED),
    title: 'New Division Created',
    message: ` Admin ${createdByName} has created ${divisionName} for ${seasonName}.`,
    metadata: { divisionName, seasonName, createdByName },
  }),
  
  assigned: (divisionName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_ASSIGNED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_ASSIGNED),
    title: 'Division Assignment',
    message: `You have been assigned to ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName },
  }),

  transferred: (
    fromDivision: string,
    toDivision: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_TRANSFERRED),
    title: 'Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
  }),

  removed: (divisionName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REMOVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REMOVED),
    title: 'Division Removal',
    message: `You have been removed from ${divisionName} in ${seasonName}${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { divisionName, seasonName, reason },
  }),
};

/**
 * Chat Notification Templates
 */
export const chatNotifications = {
  groupAdded: (chatName: string, divisionName?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.GROUP_CHAT_ADDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.GROUP_CHAT_ADDED),
    title: 'Added to Group Chat',
    message: `You have been added to ${chatName}${
      divisionName ? ` for ${divisionName}` : ''
    }`,
    metadata: { chatName, divisionName },
  }),

  newMessage: (senderName: string, chatName: string, preview: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_MESSAGE),
    title: `New message from ${senderName}`,
    message: preview,
    metadata: { senderName, chatName, preview },
  }),
};

/**
 * Season Notification Templates
 */
export const seasonNotifications = {
  registrationConfirmed: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED),
    title: 'Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed. Entry fee: ${amount}`,
    metadata: { seasonName, amount },
  }),

  startingSoon: (seasonName: string, startDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_STARTING_SOON),
    title: 'Season Starting Soon',
    message: `${seasonName} starts on ${startDate}. Get ready!`,
    metadata: { seasonName, startDate },
  }),

  ended: (seasonName: string, divisionName?: string, finalPosition?: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: 'Season Ended',
    message: `${seasonName} has ended${
      finalPosition ? `. You finished in position ${finalPosition}` : ''
    }${divisionName ? ` in ${divisionName}` : ''}. Thank you for participating!`,
    metadata: { seasonName, divisionName, finalPosition },
  }),

  cancelled: (seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_CANCELLED),
    title: 'Season Cancelled',
    message: `${seasonName} has been cancelled${reason ? `. Reason: ${reason}` : ''}`,
    metadata: { seasonName, reason },
  }),
};

/**
 * Payment Notification Templates
 */
export const paymentNotifications = {
  confirmed: (seasonName: string, amount: string, paymentMethod: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_CONFIRMED),
    title: 'Payment Confirmed',
    message: `Your payment of ${amount} for ${seasonName} has been confirmed via ${paymentMethod}`,
    metadata: { seasonName, amount, paymentMethod },
  }),

  failed: (seasonName: string, amount: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: 'Payment Failed',
    message: `Payment of ${amount} for ${seasonName} failed${
      reason ? `. Reason: ${reason}` : ''
    }. Please try again.`,
    metadata: { seasonName, amount, reason },
  }),

  reminder: (seasonName: string, amount: string, dueDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_REMINDER),
    title: 'Payment Reminder',
    message: `Payment of ${amount} for ${seasonName} is due by ${dueDate}`,
    metadata: { seasonName, amount, dueDate },
  }),
};

/**
 * Admin Notification Templates
 */
export const adminNotifications = {
  message: (title: string, message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_MESSAGE),
    title,
    message,
    metadata: {},
  }),

  systemMaintenance: (maintenanceTime: string, duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE),
    title: 'System Maintenance Scheduled',
    message: `System maintenance is scheduled for ${maintenanceTime}. Expected duration: ${duration}.`,
    metadata: { maintenanceTime, duration },
  }),

  newFeature: (featureName: string, description: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_FEATURE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_FEATURE),
    title: 'New Feature Available',
    message: `${featureName} is now available! ${description}`,
    metadata: { featureName, description },
  }),
};

/**
 * Inactivity Notification Templates
 */
export const inactivityNotifications = {
  warning: (daysSinceLastMatch: number, daysRemaining: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'Inactivity Warning',
    message: `It's been ${daysSinceLastMatch} days since your last match. Play within ${daysRemaining} days to stay active!`,
    metadata: { daysSinceLastMatch, daysRemaining },
  }),

  statusChanged: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE),
    title: 'Account Status Changed',
    message: 'Your account has been marked inactive. Play a match to reactivate your rating!',
    metadata: { newStatus: 'INACTIVE' },
  }),

  reactivated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REACTIVATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REACTIVATED),
    title: 'Welcome Back!',
    message: 'Your account has been reactivated. Keep playing to maintain your rating!',
    metadata: { previousStatus: 'INACTIVE' },
  }),
};

// Continue with other notification categories...
// (Withdrawal, reminder, match, pairing notifications with similar pattern)

/**
 * Convenient export of all notification templates
 */
export const notificationTemplates = {
  division: divisionNotifications,
  chat: chatNotifications,
  season: seasonNotifications,
  payment: paymentNotifications,
  admin: adminNotifications,
  inactivity: inactivityNotifications,
  // ... other templates
};