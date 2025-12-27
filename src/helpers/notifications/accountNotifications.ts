/**
 * Account & System Notification Templates
 * Category: Account & System (from masterlist)
 */

import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

export const accountNotifications = {
  // IN-APP NOTIFICATIONS
  
  welcomeToDeuce: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WELCOME_TO_DEUCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WELCOME_TO_DEUCE),
    title: 'Welcome to Deuce!',
    message: 'Explore leagues, connect with players in your area, and start playing',
    metadata: {},
  }),

  profileIncompleteReminder: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER),
    title: 'Complete Your Profile',
    message: 'Answer a quick questionnaire to get your starting DEUCE Match Rating (DMR)',
    metadata: {},
  }),

  profilePhotoMissing: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING),
    title: 'Add Profile Photo',
    message: 'Add a profile photo to help opponents recognize you at the courts',
    metadata: {},
  }),

  profileVerificationNeeded: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_VERIFICATION_NEEDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_VERIFICATION_NEEDED),
    title: 'Verification Required',
    message: 'Verify your account to continue using the app',
    metadata: {},
  }),

  achievementUnlocked: (achievementName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED),
    title: 'Achievement Unlocked',
    message: achievementName,
    metadata: { achievementName },
  }),

  tosUpdated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOS_UPDATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOS_UPDATED),
    title: 'TOS Updated',
    message: 'Our Terms of Service have been updated. Please review',
    metadata: {},
  }),

  // PUSH NOTIFICATIONS

  firstMatchCompleted: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED),
    title: 'First Match Completed!',
    message: 'Your DEUCE journey has begun, thanks for playing!',
    metadata: {},
  }),

  matchesPlayedMilestone: (count: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE),
    title: 'Milestone Reached',
    message: `${count} matches played! You are becoming a DEUCE regular`,
    metadata: { count },
  }),

  firstLeagueCompleted: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FIRST_LEAGUE_COMPLETED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FIRST_LEAGUE_COMPLETED),
    title: 'First League Complete',
    message: `Thank you for completing your first DEUCE League season. We look forward to seeing you on court next season`,
    metadata: { seasonName },
  }),

  leaguesCompletedMilestone: (count: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUES_COMPLETED_MILESTONE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUES_COMPLETED_MILESTONE),
    title: 'League Veteran',
    message: `${count} league seasons completed! You are a pro`,
    metadata: { count },
  }),

  perfectAttendance: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERFECT_ATTENDANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PERFECT_ATTENDANCE),
    title: 'You Never Missed a Week',
    message: `You played every week of ${leagueName}! Great commitment!`,
    metadata: { leagueName },
  }),

  multiLeaguePlayer: (leagueCount: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MULTI_LEAGUE_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MULTI_LEAGUE_PLAYER),
    title: 'Multi-league Player',
    message: `You are competing in ${leagueCount} leagues! Looks like you're gearing up for a big season`,
    metadata: { leagueCount },
  }),

  newWeeklyStreak: (weeks: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_WEEKLY_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_WEEKLY_STREAK),
    title: 'Weekly Streak!',
    message: `${weeks}-week streak! You've played matches for ${weeks} consecutive weeks`,
    metadata: { weeks },
  }),

  streakAtRisk: (weeks: number, deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STREAK_AT_RISK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STREAK_AT_RISK),
    title: 'Streak Ending Soon',
    message: `Your ${weeks}-week streak is at risk! Play a match before ${deadline} to keep it alive`,
    metadata: { weeks, deadline },
  }),

  appUpdateAvailable: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE),
    title: 'Update Available',
    message: 'DEUCE update available! New features and improvements',
    metadata: {},
  }),

  scheduledMaintenance: (maintenanceTime: string, duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE),
    title: 'Maintenance Tomorrow',
    message: `DEUCE will be down tomorrow ${maintenanceTime} for ${duration}`,
    metadata: { maintenanceTime, duration },
  }),

  maintenanceComplete: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MAINTENANCE_COMPLETE),
    title: "We're Back",
    message: 'DEUCE is back online! Thanks for your patience',
    metadata: {},
  }),

  withdrawalRequestSubmitted: (leagueName: string, seasonName?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED),
    title: 'Withdrawal Request Received',
    message: `Your withdrawal request from ${leagueName}${seasonName ? ` (${seasonName})` : ''} has been submitted and is pending review`,
    metadata: { leagueName, seasonName },
  }),
};
