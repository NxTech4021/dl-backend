/**
 * Notification Triggers Index
 * Central export point for all notification services
 */

// Onboarding notifications
// TODO: `sendWelcomeNotification` was previously re-exported here but never
// implemented in onboardingNotificationService — no spec exists, no caller
// imports it, and the aspirational `notificationTemplates.account.welcomeToDeuce()`
// template referenced in helpers/notifications/index.ts JSDoc is also absent.
// See docs/issues/backlog/tsc-baseline-errors-2026-04-27.md (TS-028). Re-add
// the export here only after implementing both the service and template.
export {
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
  sendSeasonStartingSoonNotifications,
  sendSeasonStartsTomorrowNotifications,
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
