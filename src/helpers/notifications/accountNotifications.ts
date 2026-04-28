/**
 * Account & System Notification Templates
 * Category: Account & System (from masterlist)
 *
 * TODO (2026-04-22, docs/issues/backlog/notification-cron-timing-audit-round-9-2026-04-22.md I4):
 * All notification templates across this directory hardcode English strings
 * (title + message). No locale parameter. Malaysia context suggests Malay
 * and Chinese speakers may want localized pushes. If/when product requires
 * i18n:
 *   1. Add User.locale String @default("en") column.
 *   2. Wrap template strings in t(key, params, locale) with a JSON catalog.
 *   3. Pass user's locale at construction time.
 * Not a bug today — deferred pending product decision.
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const accountNotifications = {

  profileIncompleteReminder: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER
    ),
    title: "How Good Are You?",
    message:
      "Answer a few questions and we'll set your starting DMR.",
    metadata: {},
  }),

  profilePhotoMissing: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING
    ),
    title: "Put a Face to the Game",
    message:
      "Add a profile photo so opponents know who they're up against.",
    metadata: {},
  }),

  tosUpdated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOS_UPDATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOS_UPDATED),
    title: "Terms Updated",
    message: "Our Terms of Service have been updated. Please review",
    metadata: {},
  }),

  // matchesPlayedMilestone: (count: number): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE
  //   ),
  //   title: "Milestone Reached",
  //   message: `${count} matches played! You are becoming a DEUCE regular`,
  //   metadata: { count },
  // }),

  // firstLeagueCompleted: (seasonName: string): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.FIRST_LEAGUE_COMPLETED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.FIRST_LEAGUE_COMPLETED
  //   ),
  //   title: "First League Complete",
  //   message: `Thank you for completing your first DEUCE League season. We look forward to seeing you on court next season`,
  //   metadata: { seasonName },
  // }),

  // leaguesCompletedMilestone: (count: number): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.LEAGUES_COMPLETED_MILESTONE,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.LEAGUES_COMPLETED_MILESTONE
  //   ),
  //   title: "League Veteran",
  //   message: `${count} league seasons completed! You are a pro`,
  //   metadata: { count },
  // }),

  newWeeklyStreak: (weeks: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_WEEKLY_STREAK,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.NEW_WEEKLY_STREAK
    ),
    title: `🔥 ${weeks}-Week Streak!`,
    message: `You've played matches ${weeks} weeks in a row, Keep it rolling.`,
    metadata: { weeks },
  }),

  streakAtRisk: (weeks: number, deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STREAK_AT_RISK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STREAK_AT_RISK),
    title: "You're Losing Your Streak!",
    message: `Your  ${weeks}-week streak is at risk! Play a match to keep it alive.`,
    metadata: { weeks, deadline },
  }),

  appUpdateAvailable: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE
    ),
    title: "Update Available",
    message: "DEUCE update available! New features and improvements",
    metadata: {},
  }),

  scheduledMaintenance: (
    maintenanceTime: string,
    duration: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED
    ),
    title: "Upcoming Maintenance",
    message: `DEUCE will be scheduled for maintenance on ${maintenanceTime} for ${duration}`,
    metadata: { maintenanceTime, duration },
  }),

  maintenanceComplete: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MAINTENANCE_COMPLETE
    ),
    title: "We're Back",
    message: "DEUCE is back online! Thanks for your patience",
    metadata: {},
  }),

  maintenanceInProgress: (duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_IN_PROGRESS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MAINTENANCE_IN_PROGRESS
    ),
    title: "Maintenance in Progress",
    message: `DEUCE is currently down for maintenance. Expected duration: ${duration}. We'll be back soon!`,
    metadata: { duration },
  }),

  // TODO (TS-040 follow-up, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
  // Template re-enabled 2026-04-27 (commit 19b7c95) to fix the runtime
  // TypeError at systemMaintenanceService.ts:354. However the delivery-type
  // mapping for MAINTENANCE_CANCELLED is still commented out in
  // src/types/notificationDeliveryTypes.ts:38 (commented by Zawad's commit
  // b29c84f, "Updated Notif templates", 2026-04-17). Result: notifications
  // currently dispatch as IN_APP-only (the default for unmapped types) instead
  // of the originally-intended BOTH (push + in-app). 3 maintenance-related
  // tests in tests/unit/notifications/maintenanceNotification.test.ts still
  // fail because of this. Restore `MAINTENANCE_CANCELLED: NotificationDeliveryType.BOTH`
  // in notificationDeliveryTypes.ts after product confirms push is desired
  // when admin cancels a previously-announced maintenance window.
  maintenanceCancelled: (reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MAINTENANCE_CANCELLED
    ),
    title: "Maintenance Cancelled",
    message: `The scheduled maintenance has been cancelled.${reason ? ` Reason: ${reason}` : " No disruption expected."}`,
    metadata: { reason },
  }),

  // TODO (TS-004 follow-up, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
  // Template added 2026-04-27 (commit 19b7c95) to fix the runtime TypeError at
  // achievementEvaluationService.ts:170. Copy below was modeled on the existing
  // test mock (tests/unit/achievement/achievementEvaluation.test.ts:55-59,
  // title "Achievement Unlocked") and the codebase's emoji-heavy notification
  // style. Product/Zawad should review the user-facing copy before launch —
  // these notifications fire on every match-completion that newly unlocks an
  // achievement, so word choice has high visibility.
  achievementUnlocked: (achievementTitle: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED
    ),
    title: "🏆 Achievement Unlocked!",
    message: `You've unlocked: ${achievementTitle}`,
    metadata: { achievementTitle },
  }),

  withdrawalRequestSubmitted: (
    playerName: string,
    seasonName: string,
    reason?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED
    ),
    title: "Withdrawal Request",
    message: `${playerName} has requested to withdraw from ${seasonName}${
      reason ? `. Reason: ${reason}` : ""
    }`,
    metadata: { playerName, seasonName, reason },
  }),
};
