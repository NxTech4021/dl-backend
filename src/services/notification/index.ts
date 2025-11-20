/**
 * Notification Services Index
 * Centralizes all notification-related services
 */

// Preference management
export {
  getUserPreferences,
  updateUserPreferences,
  isPreferenceEnabled,
  filterUsersByPreference,
  getAdminUserIds,
  getAdminsWithPreference,
  isPushEnabled,
  isEmailEnabled,
  createDefaultPreferences,
  deleteUserPreferences,
  NotificationPreferenceKey,
  NotificationPreferenceInput
} from './notificationPreferenceService';

// Admin notifications
export {
  notifyAdmins,
  notifyAdminsWithdrawalRequest,
  notifyAdminsDispute,
  notifyAdminsTeamChange,
  notifyAdminsSeasonJoinRequest,
  notifyAdminsPlayerReport
} from './adminNotificationService';

// Player notifications
export {
  notifyOpponentChange,
  notifyPartnerChange,
  notifyRatingChange,
  notifySeasonRegistrationOpen,
  notifyBatchRatingChanges
} from './playerNotificationService';

// Match reminders
export {
  MatchReminderService,
  getMatchReminderService
} from './matchReminderService';
