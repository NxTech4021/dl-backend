/**
 * Notification Triggers Index
 * Central export point for all notification services
 */

// Onboarding notifications
export {
  sendWelcomeNotification,
  checkAndSendProfileReminders,
  sendProfileVerificationNotification,
  sendFirstMatchCompletedNotification,
  checkMatchesMilestone,
  sendFirstLeagueCompletedNotification,
  checkLeaguesMilestone,
  initializeUserOnboarding,
} from './onboardingNotificationService';

// Match notifications
export {
  sendMatchScheduledNotification,
  sendMatchReminder24h,
  sendMatchReminder2h,
  sendScoreSubmissionReminder,
  sendOpponentSubmittedScoreNotification,
  sendScoreDisputeAlert,
  sendMatchCancelledNotification,
  sendMatchRescheduleRequest,
  checkAndSendWinningStreakNotification,
} from './matchNotificationService';

// League lifecycle notifications
export {
  sendSeasonRegistrationConfirmed,
  sendLeagueStartingSoonNotifications,
  sendLeagueStartsTomorrowNotifications,
  sendLeagueStartedWelcomeNotifications,
  sendFinalWeekAlertNotifications,
  sendLeagueEndedNotifications,
  sendLeagueWinnerAnnouncement,
  sendTop3FinishNotification,
  sendLeagueCompleteBannerNotifications,
  sendLeagueExtendedNotifications,
  sendLeagueShortenedNotifications,
  sendEmergencyLeagueUpdate,
  sendRefundProcessedNotification,
  sendMidSeasonUpdateNotifications,
} from './leagueNotificationService';

// Standings & rating notifications
export {
  checkAndSendStandingsNotifications,
  sendDMRIncreasedNotification,
  sendWeeklyRankingUpdates,
  sendMovedUpInStandingsNotification,
  sendMonthlyDMRRecap,
} from './standingsNotificationService';

// Admin notifications (already exists)
export {
  notifyAdmins,
  notifyAdminsWithdrawalRequest,
  notifyAdminsDispute,
  notifyAdminsTeamChange,
  notifyAdminsSeasonJoinRequest,
  notifyAdminsPlayerReport,
} from './adminNotificationService';
