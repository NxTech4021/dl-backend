/**
 * League Lifecycle Notification Templates
 * Category: League Lifecycle (from masterlist)
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const leagueLifecycleNotifications = {
  // IN-APP NOTIFICATIONS

  registrationConfirmed: (
    seasonName: string,
    amount: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED
    ),
    title: "Registration Confirmed",
    message: `You are registered for ${seasonName}! League starts [Date]`,
    metadata: { seasonName, amount },
  }),

  paymentConfirmed: (
    seasonName: string,
    amount: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PAYMENT_CONFIRMED
    ),
    title: "Payment Successful",
    message: `Payment confirmed for ${seasonName}. Get ready to play`,
    metadata: { seasonName, amount },
  }),

  matchesRemaining: (
    leagueName: string,
    matchesPlayed: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCHES_REMAINING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCHES_REMAINING
    ),
    title: "Matches Behind Schedule",
    message: `Less than 6 matches played so far in ${leagueName}. League standings are based on your best 6 results, complete more matches to secure your strongest finish`,
    metadata: { leagueName, matchesPlayed },
  }),

  leaguePerformanceSummary: (
    leagueName: string,
    record: string,
    ratingChange: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_PERFORMANCE_SUMMARY
    ),
    title: "League Complete",
    message: `${leagueName}: ${record} record, ${ratingChange} DMR change. View full stats`,
    metadata: { leagueName, record, ratingChange },
  }),

  // PUSH NOTIFICATIONS

  divisionRebalanced: (
    newDivision: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_TRANSFERRED
    ),
    title: "Division Change",
    message: `You've been moved to Division ${newDivision} of ${leagueName} to balance the competition. View your new division`,
    metadata: { newDivision, leagueName },
  }),

  divisionUpdateNewPlayer: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER
    ),
    title: "Division Update",
    message: `A new player has joined your division in ${leagueName}. You may now arrange matches with them`,
    metadata: { leagueName },
  }),

  winningStreak: (streakCount: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WINNING_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WINNING_STREAK),
    title: "Winning Streak!",
    message: `${streakCount} match winning streak! Keep the momentum going`,
    metadata: { streakCount },
  }),

  scheduleMatchSoon: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON
    ),
    title: "Schedule Your Matches",
    message:
      "You haven't scheduled a match yet. Reach out and find a time that works to get your first game in!",
    metadata: {},
  }),

  earlySeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EARLY_SEASON_NUDGE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.EARLY_SEASON_NUDGE
    ),
    title: "Keep the Momentum",
    message: "Schedule your next match and stay active this season",
    metadata: {},
  }),

  midSeasonUpdate: (
    position: number,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MID_SEASON_UPDATE
    ),
    title: "Halfway There!",
    message: `You are #${position} in ${leagueName}`,
    metadata: { position, leagueName },
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LATE_SEASON_NUDGE
    ),
    title: "Last Stretch",
    message: "Schedule your remaining matches and finish the season strong",
    metadata: {},
  }),

  inactivePlayerWarning7Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS
    ),
    title: "Get Back in",
    message:
      "You haven't played in a week. Schedule your league matches to stay competitive!",
    metadata: {},
  }),

  inactivityDuringLeagueSeasonNoMatch: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DURING_LEAGUE_SEASON_NO_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DURING_LEAGUE_SEASON_NO_MATCH
    ),
    title: "The League Is Heating Up",
    message:
      "Players in your league are already competing. Join in and play your first match",
    metadata: {},
  }),

  inactivityDuringLeagueSeason2Weeks: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DURING_LEAGUE_SEASON_2_WEEKS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DURING_LEAGUE_SEASON_2_WEEKS
    ),
    title: "Keep It Going",
    message: "Your season's still on. Play your next match and stay in the mix",
    metadata: {},
  }),

  inactivityDeadline7Days: (midpointDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS
    ),
    title: "Action Needed",
    message: `You haven't played a match this season. Play at least one match before ${midpointDate} to avoid disqualification`,
    metadata: { midpointDate },
  }),

  inactivityDeadline3Days: (date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS
    ),
    title: "Don't Lose Your Spot",
    message: `Midpoint of the season is approaching. Play at least one match before ${date} to remain in the league`,
    metadata: { date },
  }),

  finalWeekAlert: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FINAL_WEEK_ALERT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FINAL_WEEK_ALERT
    ),
    title: "Final Week!",
    message: `Final week of ${leagueName}! Make every match count`,
    metadata: { leagueName },
  }),

  lastMatchDeadline48h: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H
    ),
    title: "48 Hours Left",
    message:
      "⏰ The season is wrapping up soon. Get your remaining matches in before time's up",
    metadata: {},
  }),

  leagueEndedFinalResults: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: "Season Complete",
    message: `Thank you for being part of ${seasonName}. Final results will be available once all scores are confirmed`,
    metadata: { seasonName },
  }),

  leagueWinner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_WINNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_WINNER),
    title: "Champion!",
    message: `What a season. You won ${leagueName}! Congratulations!`,
    metadata: { leagueName },
  }),

  top3Finish: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOP_3_FINISH,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOP_3_FINISH),
    title: "Top 3 Finish!",
    message: `You finished #${position} in ${leagueName}! Great job!`,
    metadata: { position, leagueName },
  }),

  leagueCompleteBanner: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER
    ),
    title: "League Standing",
    message: `${leagueName} complete! See where you placed and get ready to level up next season`,
    metadata: { leagueName },
  }),

  leagueCancelled: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_CANCELLED
    ),
    title: "League Cancelled",
    message: `We're unable to run the ${leagueName} season this time. Refunds will be processed, and we'll share updates on future seasons soon`,
    metadata: { leagueName },
  }),

  leagueExtended: (
    leagueName: string,
    weeks: number,
    newEndDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_EXTENDED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_EXTENDED
    ),
    title: "League Extended",
    message: `${leagueName} has been extended by ${weeks} week(s). New end date: ${newEndDate}. More time to compete!`,
    metadata: { leagueName, weeks, newEndDate },
  }),

  leagueShortened: (
    leagueName: string,
    newEndDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_SHORTENED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_SHORTENED
    ),
    title: "League Schedule Changed",
    message: `${leagueName} has been shortened. New end date: ${newEndDate}. Complete your remaining matches soon`,
    metadata: { leagueName, newEndDate },
  }),

  emergencyLeagueUpdate: (message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE
    ),
    title: "Important League Update",
    message,
    metadata: {},
  }),

  newLeagueAnnouncement: (
    location: string,
    sport: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT
    ),
    title: "New League Opening",
    message: `New ${location}  League for ${sport} is now open!`,
    metadata: { location, sport },
  }),

  newSeasonAnnouncement: (
    seasonName: string,
    location: string,
    sport: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_SEASON_ANNOUNCEMENT.trim(),
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.NEW_SEASON_ANNOUNCEMENT
    ),
    title: "New Season Incoming",
    message: `Season ${seasonName} of the ${location} ${sport} League is now open for registration. Sign up now!`,
    metadata: { seasonName, location, sport },
  }),

  registrationClosing3Days: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS
    ),
    title: "Registration Closes Soon",
    message: `Registration for ${seasonName} of ${leagueName} closes in 3 days. Secure your spot!`,
    metadata: { seasonName, leagueName },
  }),

  registrationClosing24Hours: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS
    ),
    title: "Final Call",
    message: `Final call! Registration for ${seasonName} of the ${leagueName} closes tomorrow`,
    metadata: { seasonName, leagueName },
  }),

  seasonStarting3Days: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_STARTING_SOON
    ),
    title: "Season Starts Soon",
    message: `${seasonName} starts in 3 days! Get ready to compete`,
    metadata: { seasonName },
  }),

  seasonStartsTomorrow: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_STARTING_SOON
    ),
    title: "Season Starts Tomorrow",
    message: `${seasonName} of the ${leagueName} starts tomorrow! Get ready for matches`,
    metadata: { seasonName, leagueName },
  }),

  seasonStartedWelcome: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_STARTING_SOON
    ),
    title: "Season Commences!",
    message: `${seasonName} of the ${leagueName} has began! View your division and schedule your first game`,
    metadata: { seasonName, leagueName },
  }),

  paymentFailed: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: "Payment Failed",
    message: `Payment failed for ${seasonName}. Update payment method to secure your spot`,
    metadata: { seasonName, amount },
  }),

  withdrawalApproved: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED
    ),
    title: "Withdrawal Approved",
    message: `Your withdrawal from ${leagueName} is confirmed. Refund will be processed shortly`,
    metadata: { leagueName },
  }),

  refundProcessed: (
    amount: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFUND_PROCESSED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REFUND_PROCESSED
    ),
    title: "Refund Processed",
    message: `Your refund of RM${amount} for ${leagueName} has been processed. It will appear in your account within 5-7 business days`,
    metadata: { amount, leagueName },
  }),
};
