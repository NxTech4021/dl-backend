import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * League Lifecycle Notification Templates
 * Total: 30 notifications
 * Category: SEASON/LEAGUE
 */

export const leagueLifecycleNotifications = {
  seasonRegistrationOpen: (seasonName: string, sport: string, closeDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN),
    title: 'Registration Open',
    message: `${sport} ${seasonName} registration is now open! Register by ${closeDate}`,
    metadata: { seasonName, sport, closeDate },
  }),

  registrationClosing3Days: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS),
    title: '3 Days Left',
    message: `Registration for ${seasonName} closes in 3 days. Don't miss out!`,
    metadata: { seasonName },
  }),

  registrationClosing24Hours: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS),
    title: 'Last Call!',
    message: `⏰ Registration for ${seasonName} closes tomorrow. Secure your spot now!`,
    metadata: { seasonName },
  }),

  seasonRegistrationConfirmed: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED),
    title: 'Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed. Entry fee: ${amount}`,
    metadata: { seasonName, amount },
  }),

  leagueStarting3Days: (seasonName: string, startDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTING_3_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTING_3_DAYS),
    title: 'League Starting Soon',
    message: `${seasonName} starts in 3 days on ${startDate}. Get ready!`,
    metadata: { seasonName, startDate },
  }),

  leagueStartsTomorrow: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTS_TOMORROW,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTS_TOMORROW),
    title: 'League Starts Tomorrow',
    message: `${seasonName} starts tomorrow! Time to bring your A-game`,
    metadata: { seasonName },
  }),

  leagueStartedWelcome: (seasonName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTED_WELCOME,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTED_WELCOME),
    title: 'League Started!',
    message: `${seasonName} is underway! You are in ${divisionName}. Schedule your first match`,
    metadata: { seasonName, divisionName },
  }),

  earlySeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EARLY_SEASON_NUDGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.EARLY_SEASON_NUDGE),
    title: 'Keep the Momentum',
    message: 'Schedule your next match and stay active this season',
    metadata: {},
  }),

  midSeasonUpdate: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MID_SEASON_UPDATE),
    title: 'Halfway There!',
    message: `You are #${position} in ${leagueName}`,
    metadata: { position, leagueName },
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LATE_SEASON_NUDGE),
    title: 'Last Stretch',
    message: 'Schedule your remaining matches and finish the season strong',
    metadata: {},
  }),

  finalWeekAlert: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FINAL_WEEK_ALERT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FINAL_WEEK_ALERT),
    title: 'Final Week!',
    message: `Final week of ${leagueName}! Make every match count`,
    metadata: { leagueName },
  }),

  lastMatchDeadline48h: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H),
    title: '48 Hours Left',
    message: '⏰ The season is wrapping up soon. Get your remaining matches in before time\'s up',
    metadata: {},
  }),

  leagueWinner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_WINNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_WINNER),
    title: 'Champion!',
    message: `What a season. You won ${leagueName}! Congratulations!`,
    metadata: { leagueName },
  }),

  top3Finish: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOP_3_FINISH,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOP_3_FINISH),
    title: 'Top 3 Finish!',
    message: `You finished #${position} in ${leagueName}! Great job!`,
    metadata: { position, leagueName },
  }),

  seasonEnded: (seasonName: string, divisionName?: string, finalPosition?: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: 'Season Ended',
    message: `${seasonName} has ended${
      finalPosition ? `. You finished in position ${finalPosition}` : ''
    }${divisionName ? ` in ${divisionName}` : ''}. Thank you for participating!`,
    metadata: { seasonName, divisionName, finalPosition },
  }),

  leagueCompleteBanner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER),
    title: 'League Standing',
    message: `${leagueName} complete! See where you placed and get ready to level up next season`,
    metadata: { leagueName },
  }),

  leaguePerformanceSummary: (leagueName: string, record: string, ratingChange: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY),
    title: 'League Complete',
    message: `${leagueName}: ${record} record, ${ratingChange} DMR change. View full stats`,
    metadata: { leagueName, record, ratingChange },
  }),

  leagueExtended: (leagueName: string, weeks: number, newEndDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_EXTENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_EXTENDED),
    title: 'League Extended',
    message: `${leagueName} has been extended by ${weeks} week(s). New end date: ${newEndDate}. More time to compete!`,
    metadata: { leagueName, weeks, newEndDate },
  }),

  leagueShortened: (leagueName: string, newEndDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_SHORTENED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_SHORTENED),
    title: 'League Schedule Changed',
    message: `${leagueName} has been shortened. New end date: ${newEndDate}. Complete your remaining matches soon`,
    metadata: { leagueName, newEndDate },
  }),

  emergencyLeagueUpdate: (message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE),
    title: 'Important League Update',
    message,
    metadata: {},
  }),

  seasonCancelled: (seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_CANCELLED),
    title: 'Season Cancelled',
    message: `${seasonName} has been cancelled${reason ? `. Reason: ${reason}` : ''}`,
    metadata: { seasonName, reason },
  }),

  refundProcessed: (amount: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFUND_PROCESSED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REFUND_PROCESSED),
    title: 'Refund Processed',
    message: `Your refund of RM${amount} for ${leagueName} has been processed. It will appear in your account within 5-7 business days`,
    metadata: { amount, leagueName },
  }),

  divisionAssignment: (divisionName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_ASSIGNMENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_ASSIGNMENT),
    title: 'Division Assignment',
    message: `You have been assigned to ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName },
  }),

  divisionPromotion: (newDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_PROMOTION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_PROMOTION),
    title: 'Promoted!',
    message: `Congratulations! You've been promoted to ${newDivision} for ${seasonName}`,
    metadata: { newDivision, seasonName },
  }),

  divisionDemotion: (newDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_DEMOTION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_DEMOTION),
    title: 'Division Change',
    message: `You've been moved to ${newDivision} for ${seasonName}`,
    metadata: { newDivision, seasonName },
  }),

  divisionCreated: (divisionName: string, seasonName: string, createdByName?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_CREATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_CREATED),
    title: 'New Division Created',
    message: `Admin ${createdByName} has created ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName, createdByName },
  }),

  divisionTransferred: (fromDivision: string, toDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_TRANSFERRED),
    title: 'Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
  }),

  divisionRemoved: (divisionName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REMOVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REMOVED),
    title: 'Division Removal',
    message: `You have been removed from ${divisionName} in ${seasonName}${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { divisionName, seasonName, reason },
  }),
};
