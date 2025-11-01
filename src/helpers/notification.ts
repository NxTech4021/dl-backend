import { NotificationPayload, NotificationType } from '../types/notificationTypes';
/**
 * Division Notification Templates
 */
export const divisionNotifications = {
  assigned: (divisionName: string, seasonName: string): NotificationPayload => ({
    type: NotificationType.DIVISION_ASSIGNED,
    title: 'Division Assignment',
    message: `You have been assigned to ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName },
  }),

  transferred: (
    fromDivision: string,
    toDivision: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NotificationType.DIVISION_TRANSFERRED,
    title: 'Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
  }),

  removed: (divisionName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NotificationType.DIVISION_REMOVED,
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
    type: NotificationType.GROUP_CHAT_ADDED,
    title: 'Added to Group Chat',
    message: `You have been added to ${chatName}${
      divisionName ? ` for ${divisionName}` : ''
    }`,
    metadata: { chatName, divisionName },
  }),

  newMessage: (senderName: string, chatName: string, preview: string): NotificationPayload => ({
    type: NotificationType.NEW_MESSAGE,
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
    type: NotificationType.SEASON_REGISTRATION_CONFIRMED,
    title: 'Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed. Entry fee: ${amount}`,
    metadata: { seasonName, amount },
  }),

  startingSoon: (seasonName: string, startDate: string): NotificationPayload => ({
    type: NotificationType.SEASON_STARTING_SOON,
    title: 'Season Starting Soon',
    message: `${seasonName} starts on ${startDate}. Get ready!`,
    metadata: { seasonName, startDate },
  }),

  ended: (seasonName: string, divisionName?: string, finalPosition?: number): NotificationPayload => ({
    type: NotificationType.SEASON_ENDED,
    title: 'Season Ended',
    message: `${seasonName} has ended${
      finalPosition ? `. You finished in position ${finalPosition}` : ''
    }${divisionName ? ` in ${divisionName}` : ''}. Thank you for participating!`,
    metadata: { seasonName, divisionName, finalPosition },
  }),

  cancelled: (seasonName: string, reason?: string): NotificationPayload => ({
    type: NotificationType.SEASON_CANCELLED,
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
    type: NotificationType.PAYMENT_CONFIRMED,
    title: 'Payment Confirmed',
    message: `Your payment of ${amount} for ${seasonName} has been confirmed via ${paymentMethod}`,
    metadata: { seasonName, amount, paymentMethod },
  }),

  failed: (seasonName: string, amount: string, reason?: string): NotificationPayload => ({
    type: NotificationType.PAYMENT_FAILED,
    title: 'Payment Failed',
    message: `Payment of ${amount} for ${seasonName} failed${
      reason ? `. Reason: ${reason}` : ''
    }. Please try again.`,
    metadata: { seasonName, amount, reason },
  }),

  reminder: (seasonName: string, amount: string, dueDate: string): NotificationPayload => ({
    type: NotificationType.PAYMENT_REMINDER,
    title: 'Payment Reminder',
    message: `Payment of ${amount} for ${seasonName} is due by ${dueDate}`,
    metadata: { seasonName, amount, dueDate },
  }),
};

/**
 * Withdrawal Notification Templates
 */
export const withdrawalNotifications = {
  requestReceived: (seasonName: string): NotificationPayload => ({
    type: NotificationType.WITHDRAWAL_REQUEST_RECEIVED,
    title: 'Withdrawal Request Received',
    message: `Your withdrawal request for ${seasonName} has been received and is being processed`,
    metadata: { seasonName },
  }),

  approved: (seasonName: string, refundInfo?: string): NotificationPayload => ({
    type: NotificationType.WITHDRAWAL_REQUEST_APPROVED,
    title: 'Withdrawal Request Approved',
    message: `Your withdrawal request for ${seasonName} has been approved${
      refundInfo ? `. ${refundInfo}` : ''
    }`,
    metadata: { seasonName, refundInfo },
  }),

  rejected: (seasonName: string, reason?: string): NotificationPayload => ({
    type: NotificationType.WITHDRAWAL_REQUEST_REJECTED,
    title: 'Withdrawal Request Rejected',
    message: `Your withdrawal request for ${seasonName} has been rejected${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { seasonName, reason },
  }),
};

/**
 * Reminder Notification Templates
 */
export const reminderNotifications = {
  matchUpcoming: (opponentName: string, timeUntil: string, location: string): NotificationPayload => ({
    type: NotificationType.MATCH_UPCOMING,
    title: 'Match Reminder',
    message: `Your match against ${opponentName} is in ${timeUntil} at ${location}`,
    metadata: { opponentName, timeUntil, location },
  }),

  registrationDeadline: (seasonName: string, daysLeft: number): NotificationPayload => ({
    type: NotificationType.REGISTRATION_DEADLINE,
    title: 'Registration Deadline Approaching',
    message: `Registration for ${seasonName} closes in ${daysLeft} day${
      daysLeft !== 1 ? 's' : ''
    }`,
    metadata: { seasonName, daysLeft },
  }),

  paymentDue: (seasonName: string, amount: string, daysLeft: number): NotificationPayload => ({
    type: NotificationType.PAYMENT_DUE,
    title: 'Payment Due Soon',
    message: `Payment of ${amount} for ${seasonName} is due in ${daysLeft} day${
      daysLeft !== 1 ? 's' : ''
    }`,
    metadata: { seasonName, amount, daysLeft },
  }),
};

/**
 * Match Notification Templates
 */
export const matchNotifications = {
  scheduled: (
    opponentName: string,
    date: string,
    time: string,
    location: string
  ): NotificationPayload => ({
    type: NotificationType.MATCH_SCHEDULED,
    title: 'Match Scheduled',
    message: `Match scheduled against ${opponentName} on ${date} at ${time}, ${location}`,
    metadata: { opponentName, date, time, location },
  }),

  result: (opponentName: string, result: string, score: string): NotificationPayload => ({
    type: NotificationType.MATCH_RESULT,
    title: 'Match Result',
    message: `Match against ${opponentName}: ${result} (${score})`,
    metadata: { opponentName, result, score },
  }),

  cancelled: (opponentName: string, reason?: string): NotificationPayload => ({
    type: NotificationType.MATCH_CANCELLED,
    title: 'Match Cancelled',
    message: `Match against ${opponentName} has been cancelled${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { opponentName, reason },
  }),
};

/**
 * Pairing Notification Templates
 */
export const pairingNotifications = {
  requestReceived: (requesterName: string, seasonName: string): NotificationPayload => ({
    type: NotificationType.PAIR_REQUEST_RECEIVED,
    title: 'Pair Request Received',
    message: `${requesterName} wants to pair with you for ${seasonName}`,
    metadata: { requesterName, seasonName },
  }),

  requestAccepted: (recipientName: string, seasonName: string): NotificationPayload => ({
    type: NotificationType.PAIR_REQUEST_ACCEPTED,
    title: 'Pair Request Accepted',
    message: `${recipientName} has accepted your pairing request for ${seasonName}`,
    metadata: { recipientName, seasonName },
  }),

  requestRejected: (recipientName: string, seasonName: string): NotificationPayload => ({
    type: NotificationType.PAIR_REQUEST_REJECTED,
    title: 'Pair Request Rejected',
    message: `${recipientName} has declined your pairing request for ${seasonName}`,
    metadata: { recipientName, seasonName },
  }),

  partnershipDissolved: (partnerName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NotificationType.PARTNERSHIP_DISSOLVED,
    title: 'Partnership Dissolved',
    message: `Your partnership with ${partnerName} for ${seasonName} has been dissolved${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { partnerName, seasonName, reason },
  }),
};

/**
 * Convenient export of all notification templates
 */
export const notificationTemplates = {
  division: divisionNotifications,
  chat: chatNotifications,
  season: seasonNotifications,
  payment: paymentNotifications,
  withdrawal: withdrawalNotifications,
  reminder: reminderNotifications,
  match: matchNotifications,
  pairing: pairingNotifications,
};