import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * League Lifecycle Notification Templates
 * Total: 30 notifications
 * Category: SEASON/LEAGUE
 */

export const leagueLifecycleNotifications = {
  newLeagueAnnouncement: (location: string, sport: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN),
    title: 'New League Opening',
    message: `New ${location} ${sport} League is now open. Join now`,
    metadata: { location, sport },
    isPush: true, // Push notification (NOTIF-067)
  }),

  newSeasonAnnouncement: (seasonNumber: string, location: string, sport: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN),
    title: 'New Season Incoming',
    message: `Season ${seasonNumber} of the ${location} ${sport} League is now open for registration. Sign up now!`,
    metadata: { seasonNumber, location, sport },
    isPush: true, // Push notification (NOTIF-068)
  }),

  registrationClosing3Days: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS),
    title: 'Registration Closes Soon',
    message: `Registration for ${seasonName} of ${leagueName} closes in 3 days. Secure your spot!`,
    metadata: { seasonName, leagueName },
    isPush: true, // Push notification (NOTIF-069)
  }),

  registrationClosing24Hours: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS),
    title: 'Final Call',
    message: `Final call! Registration for ${seasonName} of the ${leagueName} closes tomorrow`,
    metadata: { seasonName, leagueName },
    isPush: true, // Push notification (NOTIF-070)
  }),

  registrationConfirmed: (leagueName: string, startDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED),
    title: 'Registration Confirmed',
    message: `You are registered for ${leagueName}! League starts ${startDate}`,
    metadata: { leagueName, startDate },
    isPush: true, // Push notification (NOTIF-071)
  }),

  paymentConfirmed: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_CONFIRMED),
    title: 'Payment Successful',
    message: `Payment confirmed for ${leagueName}. Get ready to play`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-141)
  }),

  paymentFailed: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: 'Payment Failed',
    message: `Payment failed for ${leagueName}. Update payment method to secure your spot`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-142)
  }),

  withdrawalApproved: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED),
    title: 'Withdrawal Approved',
    message: `Your withdrawal from ${leagueName} is confirmed. Refund will be processed shortly`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-145)
  }),

  seasonRegistrationConfirmed: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED),
    title: 'Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed. Entry fee: ${amount}`,
    metadata: { seasonName, amount },
    isPush: true, // Push notification (NOTIF-072)
  }),

  leagueStarting3Days: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTING_3_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTING_3_DAYS),
    title: 'League Starts Soon',
    message: `${leagueName} starts in 3 days! Get ready to compete`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-073)
  }),

  SeasonStartsTomorrow: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTS_TOMORROW,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTS_TOMORROW),
    title: 'Season Starts Tomorrow',
    message: `${seasonName} of the ${leagueName} starts tomorrow! Get ready for matches`,
    metadata: { seasonName, leagueName },
    isPush: true, // Push notification (NOTIF-074)
  }),

  leagueStartedWelcome: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_STARTED_WELCOME,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_STARTED_WELCOME),
    title: 'Season Commences!',
    message: `${seasonName} of the ${leagueName} has began! View your division and schedule your first game`,
    metadata: { seasonName, leagueName },
    isPush: true, // Push notification (NOTIF-075)
  }),

  inactivePlayerWarning7Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'Get Back in',
    message: "You haven't played in a week. Schedule your league matches to stay competitive!",
    metadata: {},
    isPush: false, // In-App only (NOTIF-076)
  }),

  inactivityDuringLeague2Weeks: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'The League Is Heating Up',
    message: 'Players in your league are already competing. Join in and play your first match',
    metadata: {},
    isPush: false, // In-App only (NOTIF-077)
  }),

  inactivityMidSeason: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'Keep It Going',
    message: "Your season's still on. Play your next match and stay in the mix",
    metadata: {},
    isPush: false, // In-App only (NOTIF-078)
  }),

  earlySeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EARLY_SEASON_NUDGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.EARLY_SEASON_NUDGE),
    title: 'Keep the Momentum',
    message: 'Schedule your next match and stay active this season',
    metadata: {},
    isPush: false, // In-App only (NOTIF-079)
  }),

  midSeasonUpdate: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MID_SEASON_UPDATE),
    title: 'Halfway There!',
    message: `You are #${position} in ${leagueName}`,
    metadata: { position, leagueName },
    isPush: true, // Push notification (NOTIF-080)
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LATE_SEASON_NUDGE),
    title: 'Last Stretch',
    message: 'Schedule your remaining matches and finish the season strong',
    metadata: {},
    isPush: false, // In-App only (NOTIF-081)
  }),

  finalWeekAlert: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FINAL_WEEK_ALERT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FINAL_WEEK_ALERT),
    title: 'Final Week!',
    message: `Final week of ${leagueName}! Make every match count`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-082)
  }),

  lastMatchDeadline48h: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H),
    title: '48 Hours Left',
    message: '⏰ The season is wrapping up soon. Get your remaining matches in before time\'s up',
    metadata: {},
    isPush: true, // Push notification (NOTIF-083)
  }),

  leagueWinner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_WINNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_WINNER),
    title: 'Champion!',
    message: `What a season. You won ${leagueName}! Congratulations!`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-084)
  }),

  top3Finish: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOP_3_FINISH,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOP_3_FINISH),
    title: 'Top 3 Finish!',
    message: `You finished #${position} in ${leagueName}! Great job!`,
    metadata: { position, leagueName },
    isPush: true, // Push notification (NOTIF-085)
  }),

  seasonEnded: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: 'Season Complete',
    message: `Thank you for being part of ${leagueName}. Final results will be available once all scores are confirmed`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-086)
  }),

  leagueCompleteBanner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER),
    title: 'League Standing',
    message: `${leagueName} complete! See where you placed and get ready to level up next season`,
    metadata: { leagueName },
    isPush: false, // In-App only (NOTIF-087)
  }),

  leaguePerformanceSummary: (leagueName: string, record: string, ratingChange: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY),
    title: 'League Complete',
    message: `${leagueName}: ${record} record, ${ratingChange} DMR change. View full stats`,
    metadata: { leagueName, record, ratingChange },
    isPush: false, // In-App only (NOTIF-088)
  }),

  leagueExtended: (leagueName: string, weeks: number, newEndDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_EXTENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_EXTENDED),
    title: 'League Extended',
    message: `${leagueName} has been extended by ${weeks} week(s). New end date: ${newEndDate}. More time to compete!`,
    metadata: { leagueName, weeks, newEndDate },
    isPush: true, // Push notification (NOTIF-089)
  }),

  leagueShortened: (leagueName: string, newEndDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_SHORTENED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_SHORTENED),
    title: 'League Schedule Changed',
    message: `${leagueName} has been shortened. New end date: ${newEndDate}. Complete your remaining matches soon`,
    metadata: { leagueName, newEndDate },
    isPush: true, // Push notification (NOTIF-090)
  }),

  emergencyLeagueUpdate: (message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE),
    title: 'Important League Update',
    message,
    metadata: {},
    isPush: true, // Push notification (NOTIF-091)
  }),

  seasonCancelled: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_CANCELLED),
    title: 'League Cancelled',
    message: `We're unable to run the ${leagueName} season this time. Refunds will be processed, and we'll share updates on future seasons soon`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-092)
  }),

  refundProcessed: (amount: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFUND_PROCESSED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REFUND_PROCESSED),
    title: 'Refund Processed',
    message: `Your refund of RM${amount} for ${leagueName} has been processed. It will appear in your account within 5-7 business days`,
    metadata: { amount, leagueName },
    isPush: true, // Push notification (NOTIF-143)
  }),

  divisionAssignment: (divisionName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_ASSIGNMENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_ASSIGNMENT),
    title: 'Division Assignment',
    message: `You have been assigned to ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName },
    isPush: true, // Push notification (NOTIF-093)
  }),

  divisionRebalanced: (newDivision: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REBALANCED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REBALANCED),
    title: 'Division Change',
    message: `You've been moved to Division ${newDivision} of ${leagueName} to balance the competition. View your new division`,
    metadata: { newDivision, leagueName },
    isPush: true, // Push notification (NOTIF-094)
  }),

  divisionUpdateNewPlayer: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER),
    title: 'Division Update',
    message: `A new player has joined your division in ${leagueName}. You may now arrange matches with them`,
    metadata: { leagueName },
    isPush: false, // In-App only (NOTIF-095)
  }),

  divisionPromotion: (newDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_PROMOTION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_PROMOTION),
    title: 'Promoted!',
    message: `Congratulations! You've been promoted to ${newDivision} for ${seasonName}`,
    metadata: { newDivision, seasonName },
    isPush: true, // Push notification (NOTIF-096)
  }),

  divisionDemotion: (newDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_DEMOTION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_DEMOTION),
    title: 'Division Change',
    message: `You've been moved to ${newDivision} for ${seasonName}`,
    metadata: { newDivision, seasonName },
    isPush: true, // Push notification (Admin)
  }),

  divisionCreated: (divisionName: string, seasonName: string, createdByName?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_CREATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_CREATED),
    title: 'New Division Created',
    message: `Admin ${createdByName} has created ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName, createdByName },
    isPush: false, // In-App only (Admin)
  }),

  divisionTransferred: (fromDivision: string, toDivision: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_TRANSFERRED),
    title: 'Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
    isPush: true, // Push notification (Admin)
  }),

  divisionRemoved: (divisionName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REMOVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REMOVED),
    title: 'Division Removal',
    message: `You have been removed from ${divisionName} in ${seasonName}${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { divisionName, seasonName, reason },
    isPush: true, // Push notification (Admin)
  }),
};
