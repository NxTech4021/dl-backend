import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Account & System Notification Templates
 * Total: 21 notifications
 * Category: GENERAL
 */

export const accountSystemNotifications = {
  welcomeToDeuce: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WELCOME_TO_DEUCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WELCOME_TO_DEUCE),
    title: 'Welcome to Deuce!',
    message: 'Explore leagues, connect with players in your area, and start playing',
    metadata: {},
    isPush: false, // In-App only (NOTIF-001)
  }),

  profileIncompleteReminder: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER),
    title: 'Complete Your Profile',
    message: 'Answer a quick questionnaire to get your starting DEUCE Match Rating (DMR)',
    metadata: {},
    isPush: false, // In-App only (NOTIF-002)
  }),

  profilePhotoMissing: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING),
    title: 'Add Profile Photo',
    message: 'Add a profile photo to help opponents recognize you at the courts',
    metadata: {},
    isPush: false, // In-App only (NOTIF-003)
  }),

  profileVerificationNeeded: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PROFILE_VERIFICATION_NEEDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PROFILE_VERIFICATION_NEEDED),
    title: 'Verification Required',
    message: 'Verify your account to continue using the app',
    metadata: {},
    isPush: false, // In-App only (NOTIF-004)
  }),

  firstMatchCompleted: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FIRST_MATCH_COMPLETED),
    title: 'First Match Completed!',
    message: 'Your DEUCE journey has begun, thanks for playing!',
    metadata: {},
    isPush: true, // Push notification (NOTIF-005)
  }),

  matchesPlayedMilestone: (count: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCHES_PLAYED_MILESTONE),
    title: 'Milestone Reached',
    message: `${count} matches played! You are becoming a DEUCE regular`,
    metadata: { count },
    isPush: true, // Push notification (NOTIF-006)
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
    isPush: true, // Push notification (NOTIF-007)
  }),

  newWeeklyStreak: (weeks: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_WEEKLY_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_WEEKLY_STREAK),
    title: 'Weekly Streak!',
    message: `${weeks}-week streak! You've played matches for ${weeks} consecutive weeks`,
    metadata: { weeks },
    isPush: true, // Push notification (NOTIF-008)
  }),

  streakAtRisk: (weeks: number, deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STREAK_AT_RISK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STREAK_AT_RISK),
    title: 'Streak Ending Soon',
    message: `Your ${weeks}-week streak is at risk! Play a match before ${deadline} to keep it alive`,
    metadata: { weeks, deadline },
    isPush: true, // Push notification (NOTIF-009)
  }),

  appUpdateAvailable: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.APP_UPDATE_AVAILABLE),
    title: 'Update Available',
    message: 'DEUCE update available! New features and improvements',
    metadata: {},
    isPush: false, // In-App only (NOTIF-010)
  }),

  maintenanceComplete: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MAINTENANCE_COMPLETE),
    title: "We're Back",
    message: 'DEUCE is back online! Thanks for your patience',
    metadata: {},
    isPush: false, // In-App only (NOTIF-011)
  }),

  tosUpdated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOS_UPDATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOS_UPDATED),
    title: 'Tos Updated',
    message: 'Our Terms of Service have been updated. Please review',
    metadata: {},
    isPush: false, // In-App only (NOTIF-012)
  }),

  achievementUnlocked: (achievementName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED),
    title: 'Achievement Unlocked',
    message: achievementName,
    metadata: { achievementName },
    isPush: true, // Push notification (NOTIF-013)
  }),

  scheduledMaintenance: (time: string, duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE),
    title: 'Maintenance Tomorrow',
    message: `DEUCE will be down tomorrow ${time} for ${duration}`,
    metadata: { time, duration },
    isPush: false, // In-App only (NOTIF-014)
  }),

  featureAnnouncement: (featureName: string, description: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_FEATURE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_FEATURE),
    title: 'New Feature',
    message: `${featureName}! ${description}`,
    metadata: { featureName, description },
    isPush: false, // In-App only (NOTIF-015)
  }),

  inactivityWarning: (daysSinceLastMatch: number, daysRemaining: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'Inactivity Warning',
    message: `It's been ${daysSinceLastMatch} days since your last match. Play within ${daysRemaining} days to stay active!`,
    metadata: { daysSinceLastMatch, daysRemaining },
    isPush: false, // In-App only (NOTIF-016)
  }),

  statusChangedToInactive: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE),
    title: 'Account Status Changed',
    message: 'Your account has been marked inactive. Play a match to reactivate your rating!',
    metadata: { newStatus: 'INACTIVE' },
    isPush: false, // In-App only (NOTIF-017)
  }),

  reactivated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REACTIVATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REACTIVATED),
    title: 'Welcome Back!',
    message: 'Your account has been reactivated. Keep playing to maintain your rating!',
    metadata: { previousStatus: 'INACTIVE' },
    isPush: false, // In-App only (NOTIF-018)
  }),

  inactivityDeadline7Days: (deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS),
    title: '7 Days to Stay Active',
    message: `Play a match within 7 days to stay active in the league. Deadline: ${deadline}`,
    metadata: { deadline },
    isPush: false, // In-App only (NOTIF-019)
  }),

  inactivityDeadline3Days: (deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS),
    title: '3 Days to Stay Active',
    message: `Only 3 days left! Play a match by ${deadline} to avoid being marked inactive`,
    metadata: { deadline },
    isPush: false, // In-App only (NOTIF-020)
  }),

  divisionUpdateNewPlayer: (playerName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER),
    title: 'New Player in Division',
    message: `${playerName} joined ${divisionName}. Welcome them!`,
    metadata: { playerName, divisionName },
    isPush: false, // In-App only (NOTIF-021)
  }),
};
