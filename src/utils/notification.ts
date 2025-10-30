import { NotificationType } from '@prisma/client';

// Division Notifications
const notificationDivisionAssigned = (divisionName: string, seasonName: string) => {
  return {
    type: NotificationType.DIVISION_ASSIGNED,
    title: '🎯 Welcome to Your Division!',
    message: `You have been assigned to ${divisionName} for ${seasonName}. Good luck!`,
  };
};

const notificationDivisionTransferred = (fromDivision: string, toDivision: string, seasonName: string) => {
  return {
    type: NotificationType.DIVISION_TRANSFERRED,
    title: '🔄 Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}.`,
  };
};

const notificationDivisionRemoved = (divisionName: string, seasonName: string, reason?: string) => {
  return {
    type: NotificationType.DIVISION_REMOVED,
    title: '❌ Removed from Division',
    message: `You have been removed from ${divisionName} in ${seasonName}${reason ? `. Reason: ${reason}` : '.'}`,
  };
};

// Group Chat Notifications
const notificationGroupChatAdded = (groupName: string, divisionName: string) => {
  return {
    type: NotificationType.GROUP_CHAT_ADDED,
    title: '💬 Added to Group Chat',
    message: `Welcome to the ${groupName} group chat for ${divisionName}!`,
  };
};

const notificationNewMessage = (groupName: string, senderName: string, messagePreview: string) => {
  return {
    type: NotificationType.NEW_MESSAGE,
    title: `💬 New Message in ${groupName}`,
    message: `${senderName}: ${messagePreview}`,
  };
};

// Match Notifications
const notificationMatchScheduled = (opponent: string, matchDate: string, location: string) => {
  return {
    type: NotificationType.MATCH_SCHEDULED,
    title: '🎾 Match Scheduled',
    message: `Your match against ${opponent} is scheduled for ${matchDate} at ${location}.`,
  };
};

const notificationMatchReminder = (opponent: string, timeUntil: string, location: string) => {
  return {
    type: NotificationType.MATCH_REMINDER,
    title: '⏰ Match Reminder',
    message: `Your match against ${opponent} starts in ${timeUntil} at ${location}.`,
  };
};

const notificationMatchResult = (opponent: string, result: 'won' | 'lost', score: string) => {
  return {
    type: NotificationType.MATCH_RESULT,
    title: `🏆 Match ${result === 'won' ? 'Victory' : 'Result'}`,
    message: `You ${result} against ${opponent} with score ${score}.`,
  };
};

const notificationMatchCancelled = (opponent: string, matchDate: string, reason?: string) => {
  return {
    type: NotificationType.MATCH_CANCELLED,
    title: '❌ Match Cancelled',
    message: `Your match against ${opponent} on ${matchDate} has been cancelled${reason ? `. Reason: ${reason}` : '.'}`,
  };
};

// Season Notifications
const notificationSeasonRegistrationConfirmed = (seasonName: string, entryFee: string) => {
  return {
    type: NotificationType.SEASON_REGISTRATION_CONFIRMED,
    title: '✅ Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed! Entry fee: ${entryFee}`,
  };
};

const notificationSeasonStartingSoon = (seasonName: string, startDate: string) => {
  return {
    type: NotificationType.SEASON_STARTING_SOON,
    title: '🚀 Season Starting Soon',
    message: `Get ready! ${seasonName} starts on ${startDate}.`,
  };
};

const notificationSeasonEnded = (seasonName: string, divisionName: string, finalPosition?: string) => {
  return {
    type: NotificationType.SEASON_ENDED,
    title: '🏁 Season Completed',
    message: `${seasonName} has ended. You competed in ${divisionName}${finalPosition ? ` and finished in position ${finalPosition}` : ''}.`,
  };
};

const notificationSeasonCancelled = (seasonName: string, reason?: string) => {
  return {
    type: NotificationType.SEASON_CANCELLED,
    title: '❌ Season Cancelled',
    message: `${seasonName} has been cancelled${reason ? `. Reason: ${reason}` : ''}.`,
  };
};

// Pairing Notifications
const notificationPairRequestReceived = (requesterName: string, seasonName: string, message?: string) => {
  return {
    type: NotificationType.PAIR_REQUEST_RECEIVED,
    title: '🤝 New Pair Request',
    message: `${requesterName} wants to pair with you for ${seasonName}${message ? `. Message: "${message}"` : '.'}`,
  };
};

const notificationPairRequestAccepted = (recipientName: string, seasonName: string) => {
  return {
    type: NotificationType.PAIR_REQUEST_ACCEPTED,
    title: '🎉 Pair Request Accepted',
    message: `${recipientName} accepted your pair request for ${seasonName}! You're now partners.`,
  };
};

const notificationPairRequestRejected = (recipientName: string, seasonName: string) => {
  return {
    type: NotificationType.PAIR_REQUEST_REJECTED,
    title: '❌ Pair Request Declined',
    message: `${recipientName} declined your pair request for ${seasonName}.`,
  };
};

const notificationPartnershipDissolved = (partnerName: string, seasonName: string, reason?: string) => {
  return {
    type: NotificationType.PARTNERSHIP_DISSOLVED,
    title: '💔 Partnership Dissolved',
    message: `Your partnership with ${partnerName} for ${seasonName} has been dissolved${reason ? `. Reason: ${reason}` : '.'}`,
  };
};

// Payment Notifications
const notificationPaymentConfirmed = (seasonName: string, amount: string, paymentMethod: string) => {
  return {
    type: NotificationType.PAYMENT_CONFIRMED,
    title: '💳 Payment Confirmed',
    message: `Your payment of ${amount} for ${seasonName} has been confirmed via ${paymentMethod}.`,
  };
};

const notificationPaymentFailed = (seasonName: string, amount: string, reason?: string) => {
  return {
    type: NotificationType.PAYMENT_FAILED,
    title: '❌ Payment Failed',
    message: `Your payment of ${amount} for ${seasonName} failed${reason ? `. Reason: ${reason}` : ''}. Please try again.`,
  };
};

const notificationPaymentReminder = (seasonName: string, amount: string, dueDate: string) => {
  return {
    type: NotificationType.PAYMENT_REMINDER,
    title: '💰 Payment Reminder',
    message: `Payment of ${amount} for ${seasonName} is due on ${dueDate}. Please complete your payment.`,
  };
};


// Withdrawal Notifications
const notificationWithdrawalRequestReceived = (seasonName: string) => {
  return {
    type: NotificationType.WITHDRAWAL_REQUEST_RECEIVED,
    title: '📝 Withdrawal Request Received',
    message: `Your withdrawal request for ${seasonName} has been received and is being reviewed.`,
  };
};

const notificationWithdrawalRequestApproved = (seasonName: string, refundAmount?: string) => {
  return {
    type: NotificationType.WITHDRAWAL_REQUEST_APPROVED,
    title: '✅ Withdrawal Request Approved',
    message: `Your withdrawal request for ${seasonName} has been approved${refundAmount ? `. Refund of ${refundAmount} will be processed` : ''}.`,
  };
};

const notificationWithdrawalRequestRejected = (seasonName: string, reason?: string) => {
  return {
    type: NotificationType.WITHDRAWAL_REQUEST_REJECTED,
    title: '❌ Withdrawal Request Rejected',
    message: `Your withdrawal request for ${seasonName} has been rejected${reason ? `. Reason: ${reason}` : ''}.`,
  };
};

// Admin Notifications
const notificationAdminMessage = (adminName: string, subject: string, message: string) => {
  return {
    type: NotificationType.ADMIN_MESSAGE,
    title: `📢 Message from ${adminName}`,
    message: `${subject}: ${message}`,
  };
};

const notificationSystemMaintenance = (startTime: string, endTime: string, affectedFeatures?: string) => {
  return {
    type: NotificationType.SYSTEM_MAINTENANCE,
    title: '⚙️ Scheduled Maintenance',
    message: `System maintenance scheduled from ${startTime} to ${endTime}${affectedFeatures ? `. Affected: ${affectedFeatures}` : ''}.`,
  };
};

const notificationNewFeature = (featureName: string, description: string) => {
  return {
    type: NotificationType.NEW_FEATURE,
    title: '🆕 New Feature Available',
    message: `${featureName}: ${description}`,
  };
};

// Reminder Notifications
const reminderMatchUpcoming = (opponent: string, timeUntil: string, location: string) => {
  return {
    type: NotificationType.MATCH_UPCOMING,
    title: '⏰ Match Reminder',
    message: `Your match against ${opponent} is in ${timeUntil} at ${location}. Don't forget!`,
  };
};

const reminderRegistrationDeadline = (seasonName: string, daysLeft: number) => {
  return {
    type: NotificationType.REGISTRATION_DEADLINE,
    title: '⏳ Registration Deadline Approaching',
    message: `Registration for ${seasonName} closes in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Register now!`,
  };
};

const reminderPaymentDue = (seasonName: string, amount: string, daysLeft: number) => {
  return {
    type: NotificationType.PAYMENT_DUE,
    title: '💰 Payment Due Soon',
    message: `Payment of ${amount} for ${seasonName} is due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
  };
};


export {
  // Division
  notificationDivisionAssigned,
  notificationDivisionTransferred,
  notificationDivisionRemoved,
  
  // Chat
  notificationGroupChatAdded,
  notificationNewMessage,
  
  // Match
  notificationMatchScheduled,
  notificationMatchReminder,
  notificationMatchResult,
  notificationMatchCancelled,
  
  // Season
  notificationSeasonRegistrationConfirmed,
  notificationSeasonStartingSoon,
  notificationSeasonEnded,
  notificationSeasonCancelled,
  
  // Pairing
  notificationPairRequestReceived,
  notificationPairRequestAccepted,
  notificationPairRequestRejected,
  notificationPartnershipDissolved,
  
  // Payment
  notificationPaymentConfirmed,
  notificationPaymentFailed,
  notificationPaymentReminder,
  
  // Withdrawal
  notificationWithdrawalRequestReceived,
  notificationWithdrawalRequestApproved,
  notificationWithdrawalRequestRejected,
  
  // Admin
  notificationAdminMessage,
  notificationSystemMaintenance,
  notificationNewFeature,
  
  // Reminders
  reminderMatchUpcoming,
  reminderRegistrationDeadline,
  reminderPaymentDue,
 
};