/**
 * Account & System Notification Templates
 * Category: Account & System (from masterlist)
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

  // firstMatchCompleted: (): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED
  //   ),
  //   title: "First Match Completed!",
  //   message: "Your DEUCE journey has begun, thanks for playing!",
  //   metadata: {},
  // }),

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

  perfectAttendance: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERFECT_ATTENDANCE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PERFECT_ATTENDANCE
    ),
    title: "You Never Missed a Week",
    message: `You played every week of ${leagueName}! Great commitment!`,
    metadata: { leagueName },
  }),

  multiLeaguePlayer: (leagueCount: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MULTI_LEAGUE_PLAYER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MULTI_LEAGUE_PLAYER
    ),
    title: "Multi-league Player",
    message: `You are competing in ${leagueCount} leagues! Looks like you're gearing up for a big season`,
    metadata: { leagueCount },
  }),

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

  maintenanceCancelled: (reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MAINTENANCE_CANCELLED
    ),
    title: "Maintenance Cancelled",
    message: `The scheduled maintenance has been cancelled.${reason ? ` Reason: ${reason}` : " No disruption expected."}`,
    metadata: { reason },
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
