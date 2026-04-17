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

  registrationConfirmed: (
    seasonName: string,
    leagueName: string,
    categoryName: string,
    startDate: string,
    amount: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED
    ),
    title: "\u2705 You're Registered",
    message: `Confirmed for ${leagueName} – ${categoryName}. Season starts ${startDate}.`,
    metadata: { seasonName, amount, leagueName, startDate, categoryName },
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
    title: "Matches Behind Pace",
    message: `Less than 6 matches played in ${leagueName}. Your standings are based on your best 6 — play more to strengthen your finish.`,
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


  // divisionRebalanced: (
  //   newDivision: string,
  //   leagueName: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.DIVISION_TRANSFERRED
  //   ),
  //   title: "🔄 You're in a New Division",
  //   message: `You've been moved to ${newDivision} in ${leagueName} for competitive balance.`,
  //   metadata: { newDivision, leagueName },
  // }),

  // divisionUpdateNewPlayer: (leagueName: string): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER
  //   ),
  //   title: "New Opponent Available",
  //   message: `A new player has joined your division in ${leagueName}. Time to arrange a match!`,
  //   metadata: { leagueName },
  // }),

  winningStreak: (streakCount: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WINNING_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WINNING_STREAK),
    title: `🔥 ${streakCount}-Match Win Streak!`,
    message: `You're on fire! That's ${streakCount} straight wins. Who's next?`,
    metadata: { streakCount },
  }),

  scheduleMatchSoon: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON
    ),
    title: "Time to Get Started",
    message: "The season's underway. Get your first match in the bag!",
    metadata: {},
  }),

  earlySeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.EARLY_SEASON_NUDGE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.EARLY_SEASON_NUDGE
    ),
    title: "🔥 Two Weeks In",
    message: "The season's heating up. Schedule your next match to stay active. You can do it!",
    metadata: {},
  }),

  midSeasonUpdate: (
    position: number,
    divisionName: string,
    leagueName: string,
    categoryName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MID_SEASON_UPDATE
    ),
    title: "📍 You're Halfway There",
    message: `#${position} in ${divisionName}, ${leagueName} – ${categoryName}. Push on, you're getting there!`,
    metadata: { position, divisionName, leagueName, categoryName },
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LATE_SEASON_NUDGE
    ),
    title: "🏁 Final Stretch",
    message: "Two weeks to go now! Make every match count.",
    metadata: {},
  }),

  inactivePlayerWarning7Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS
    ),
    title: "Get Back On Court",
    message: "It's been a week since your last match. Stay in the mix — schedule your next one.",
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
    title: "Stay in the Game",
    message: "It's been two weeks since your last league match. The season's still on.",
    metadata: {},
  }),

  inactivityDeadline7Days: (midpointDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS
    ),
    title: "🚨 Play or Forfeit. Action Needed.",
    message: `You must play at least one match before ${midpointDate} to stay in the league.`,
    metadata: { midpointDate },
  }),

  inactivityDeadline3Days: (date: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS
    ),
    title: "🚨 Final Warning — 3 Days Left",
    message: `3 days to play a match or you may lose your spot in ${leagueName}.`,
    metadata: { date, leagueName },
  }),

  finalWeekAlert: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FINAL_WEEK_ALERT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FINAL_WEEK_ALERT
    ),
    title: "🏁 Final Week",
    message: `Last week of ${seasonName}, ${leagueName}. Make every match count.`,
    metadata: { seasonName, leagueName },
  }),

  lastMatchDeadline48h: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H
    ),
    title: "⏳ 48 Hours Left",
    message: `48 hours until ${seasonName} of ${leagueName} ends. Finish what you started.`,
    metadata: { seasonName, leagueName },
  }),

  leagueEndedFinalResults: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: "🏁 That's a Wrap",
    message: `${seasonName} of ${leagueName} is done. Results incoming once scores are finalised.`,
    metadata: { seasonName, leagueName },
  }),

  leagueWinner: (divisionName: string, leagueName: string, categoryName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_WINNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_WINNER),
    title: "🏆 Champion!",
    message: `You won ${divisionName}, ${leagueName} – ${categoryName}! What a season.`,
    metadata: { divisionName, leagueName, categoryName },
  }),

  top3Finish: (position: number, divisionName: string, leagueName: string, categoryName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOP_3_FINISH,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOP_3_FINISH),
    title: "🏅 Top 3 Finish!",
    message: `#${position} in ${divisionName}, ${leagueName} – ${categoryName}. Well earned.`,
    metadata: { position, divisionName, leagueName, categoryName },
  }),

  leagueCompleteBanner: (
    leagueName: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER
    ),
    title: "📊 Season Results",
    message: `${seasonName} of ${leagueName} is done! See where you finished and get ready for next season.`,
    metadata: { leagueName , seasonName },
  }),

  leagueCancelled: (
    leagueName: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_CANCELLED
    ),
    title: "League Cancelled",
    message: `${seasonName} of ${leagueName} has been cancelled. Your refund is on its way — we'll keep you posted on what's next.`,
    metadata: { leagueName , seasonName },
  }),

  leagueExtended: (
    leagueName: string,
    seasonName: string,
    newEndDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_EXTENDED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_EXTENDED
    ),
    title: "More Time on the Clock",
    message: `${seasonName} of ${leagueName} extended. New end date: ${newEndDate}. More time to compete!`,
    metadata: { leagueName, seasonName, newEndDate },
  }),

  leagueShortened: (
    leagueName: string,
    seasonName: string,
    newEndDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_SHORTENED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_SHORTENED
    ),
    title: "Schedule Change",
    message: `${seasonName} of ${leagueName} has been shortened. New end date: ${newEndDate}. Complete your remaining matches soon.`,
    metadata: { leagueName, newEndDate, seasonName },
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
    leagueName: string,
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT
    ),
    title: "📢 New League Open",
    message: `A new ${leagueName} is open for registration!`,
    metadata: { leagueName },
  }),

  newSeasonAnnouncement: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_SEASON_ANNOUNCEMENT.trim(),
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.NEW_SEASON_ANNOUNCEMENT
    ),
    title: "📢 New Season Is Here",
    message: `${seasonName} of ${leagueName} is live. You in?`,
    metadata: { seasonName, leagueName },
  }),

  waitlistPromoted: (
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WAITLIST_PROMOTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WAITLIST_PROMOTED
    ),
    title: "You're In!",
    message: `You've been added to ${seasonName} from the waitlist. Welcome aboard!`,
    metadata: { seasonName },
  }),

  registrationClosing3Days: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS
    ),
    title: "⏳ Registration Closing Soon",
    message: `${seasonName} of ${leagueName} registration closes in 3 days. Don't miss out.`,
    metadata: { seasonName, leagueName },
  }),

  registrationClosing24Hours: (
    seasonName: string,
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS
    ),
    title: "⏳ Last Day to Register",
    message: `Final call! League registration for ${seasonName} closes tomorrow`,
    metadata: { seasonName },
  }),

  seasonStarting3Days: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_STARTING_SOON
    ),
    title: "📅 Starting in 3 Days",
    message: `${seasonName} of ${leagueName} kicks off in 3 days. Get ready!`,
    metadata: { seasonName, leagueName },
  }),

  // seasonStartsTomorrow: (
  //   seasonName: string,
  //   leagueName: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.SEASON_STARTING_SOON
  //   ),
  //   title: "Season Starts Tomorrow",
  //   message: `${seasonName} of the ${leagueName} starts tomorrow! Get ready for matches`,
  //   metadata: { seasonName, leagueName },
  // }),

  seasonStartedWelcome: (
    seasonName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SEASON_STARTING_SOON
    ),
    title: "🟢 Game On!",
    message: `${seasonName} of ${leagueName} is officially underway. View your division and line up your first match.`,
    metadata: { seasonName, leagueName },
  }),

  paymentFailed: (seasonName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: "Payment Failed",
    message: `Payment for ${leagueName} didn't go through. Update your payment method to keep your spot.`,
    metadata: { seasonName, leagueName },
  }),

  withdrawalApproved: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED
    ),
    title: "Withdrawal Confirmed",
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
    title: "Refund on Its Way",
    message: `Your RM-${amount} refund for [League Name] has been processed. Allow 3–7 business days.`,
    metadata: { amount, leagueName },
  }),

  divisionUpdateNewPlayer: (leagueName: string, gameType?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER),
    title: "New Opponent in Your Division",
    message: `A new ${gameType === 'DOUBLES' ? 'team' : 'player'} has joined your division in ${leagueName}. Time to arrange a match!`,
    metadata: { leagueName, gameType: gameType ?? '' },
  }),
};
