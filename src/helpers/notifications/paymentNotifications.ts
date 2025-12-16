import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Payment Notification Templates
 * Category: PAYMENT
 */

export const paymentNotifications = {
  paymentReceived: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_RECEIVED),
    title: 'Payment Received',
    message: `Your payment of ${amount} for ${seasonName} has been received`,
    metadata: { seasonName, amount },
  }),

  paymentConfirmed: (seasonName: string, amount: string, paymentMethod: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_CONFIRMED),
    title: 'Payment Confirmed',
    message: `Your payment of ${amount} for ${seasonName} has been confirmed via ${paymentMethod}`,
    metadata: { seasonName, amount, paymentMethod },
  }),

  paymentFailed: (seasonName: string, amount: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: 'Payment Failed',
    message: `Payment of ${amount} for ${seasonName} failed${
      reason ? `. Reason: ${reason}` : ''
    }. Please try again.`,
    metadata: { seasonName, amount, reason },
  }),

  paymentReminder: (seasonName: string, amount: string, dueDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_REMINDER),
    title: 'Payment Reminder',
    message: `Payment of ${amount} for ${seasonName} is due by ${dueDate}`,
    metadata: { seasonName, amount, dueDate },
  }),

  paymentDue: (seasonName: string, amount: string, dueDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_DUE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_DUE),
    title: 'Payment Due',
    message: `Payment of ${amount} for ${seasonName} is due by ${dueDate}`,
    metadata: { seasonName, amount, dueDate },
  }),
};
