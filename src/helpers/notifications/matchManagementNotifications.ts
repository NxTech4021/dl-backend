/**
 * Match Management Notification Templates
 * Category: Match Management (from masterlist)
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const matchManagementNotifications = {

  matchScheduled: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_SCHEDULED
    ),
    title: "Match Scheduled",
    message: `Your match vs ${opponentName} is scheduled for ${date} at ${time} at ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  matchCancelled: (
    opponentName: string,
    reason?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_CANCELLED
    ),
    title: "Match Cancelled",
    message: `Your match vs ${opponentName} has been cancelled${
      reason ? `: ${reason}` : ""
    }`,
    metadata: { opponentName, reason },
  }),

  winningStreak: (
    streakCount: number,
    sportName?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WINNING_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WINNING_STREAK),
    title: "Winning Streak!",
    message: `You're on fire! ${streakCount} wins in a row${
      sportName ? ` in ${sportName}` : ""
    }. Keep it up!`,
    metadata: { streakCount, sportName },
  }),

 
  // friendlyMatchPosted: (
  //   date: string,
  //   time: string,
  //   venue: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED
  //   ),
  //   title: "Friendly Match Posted",
  //   message: `📅 ${date} • ${time}\n📍 ${venue}`,
  //   metadata: { date, time, venue },
  // }),

  opponentReportedIssue: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE
    ),
    title: "Issue Reported",
    message: `${opponentName} reported an issue. Admin will contact you if needed`,
    metadata: { opponentName },
  }),

  friendlyMatchPlayerJoined: (
    playerName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_PLAYER_JOINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_PLAYER_JOINED
    ),
    title: "Player Joined",
    message: `${playerName} joined your match\n📅 ${date} • ${time} at ${venue}`,
    metadata: { playerName, date, time, venue },
  }),

  friendlyMatchCancelled: (
    hostName: string,
    date: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED
    ),
    title: "Match Cancelled",
    message: `${hostName} cancelled the match ${date} at ${venue}`,
    metadata: { hostName, date, venue },
  }),

  playerLeftFriendlyMatch: (
    playerName: string,
    date: string,
    time: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH
    ),
    title: "Player Left",
    message: `${playerName} left your match scheduled for ${date} at ${time}.`,
    metadata: { playerName, date, time },
  }),

  schedulingConflictDetected: (
    conflictDetails: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED
    ),
    title: "Scheduling Conflict",
    message: `Conflict detected: ${conflictDetails}. Please review your schedule`,
    metadata: { conflictDetails },
  }),

  friendlyMatchDetailsChanged: (
    hostName: string,
    newDate: string,
    newTime: string,
    newVenue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED
    ),
    title: "Match Updated",
    message: `${hostName} changed your match to ${newDate} at ${newTime} at ${newVenue}.`,
    metadata: { hostName, newDate, newTime, newVenue },
  }),

  matchReminder24h: (
    opponentName: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: "📅 Match Tomorrow",
    message: `You're playing ${opponentName} tomorrow at ${time}, ${venue}.`,
    metadata: { opponentName, time, venue },
  }),

  matchReminder2h: (
    opponentName: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: "⏰ Match in 2 Hours",
    message: `You're playing ${opponentName} in 2 hours at ${venue}. Get ready.`,
    metadata: { opponentName, time, venue },
  }),

  matchMorningReminder: (
    opponentName: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_MORNING_REMINDER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_MORNING_REMINDER
    ),
    title: "🎾 Game Day",
    message: `You have a match vs ${opponentName} at ${time}, ${venue}. Bring your best!`,
    metadata: { opponentName, time, venue },
  }),

  matchRescheduleRequest: (
    opponentName: string,
    newDate: string,
    newTime: string,
    newVenue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_REQUEST,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_RESCHEDULE_REQUEST
    ),
    title: "Match Change Request",
    message: `${opponentName} wants to reschedule\n📅 ${newDate} • ${newTime}\n📍 ${newVenue}`,
    metadata: { opponentName, newDate, newTime, newVenue },
  }),

  matchRescheduleAccepted: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_ACCEPTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_RESCHEDULE_ACCEPTED
    ),
    title: "Change Accepted",
    message: `${opponentName} accepted the reschedule\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  matchRescheduleDeclined: (
    opponentName: string,
    originalDate: string,
    originalTime: string,
    originalVenue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_DECLINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_RESCHEDULE_DECLINED
    ),
    title: "Change Declined",
    message: `${opponentName} declined the reschedule. Original:\n📅 ${originalDate} • ${originalTime}\n📍 ${originalVenue}`,
    metadata: { opponentName, originalDate, originalTime, originalVenue },
  }),

  matchWalkoverWon: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_WALKOVER_WON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_WALKOVER_WON
    ),
    title: "Walkover Win",
    message: `Match vs ${opponentName} awarded to you.`,
    metadata: { opponentName },
  }),

  matchWalkoverLost: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_WALKOVER_LOST,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_WALKOVER_LOST
    ),
    title: "No-Show Recorded",
    message: `You didn't show for ${opponentName}. This one counts as a loss. Repeated no-shows may lead to suspension.`,
    metadata: { opponentName },
  }),

  noShowStrikeWarning: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NO_SHOW_STRIKE_WARNING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.NO_SHOW_STRIKE_WARNING
    ),
    title: "No-show Warning",
    message: `You received a no-show strike for the match vs ${opponentName}. Regular no-shows will result in league suspension`,
    metadata: { opponentName },
  }),

  opponentClaimsNoShow: (
    opponentName: string,
    date: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW
    ),
    title: "No-show Claim",
    message: `${opponentName} says you didn't show on ${date}. You have 24 hours to respond.`,
    metadata: { opponentName, date },
  }),

  headToHeadHistory: (
    opponentName: string,
    record: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY
    ),
    title: "Head-to-Head",
    message: `You've played ${opponentName} before. Record: ${record}. View match history.`,
    metadata: { opponentName, record },
  }),

  scoreSubmissionReminder: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER
    ),
    title: "How'd your match go?",
    message: `Add your score vs ${opponentName}.`,
    metadata: { opponentName },
  }),

  scoreDisputeAlert: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_DISPUTE_ALERT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_DISPUTE_ALERT
    ),
    title: "Score Discrepancy",
    message: `Score discrepancy with ${opponentName}. Review and confirm the correct result`,
    metadata: { opponentName },
  }),

  opponentSubmittedScore: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE
    ),
    title: "Confirm the Score",
    message: `${opponentName} added the match result. Review and confirm.`,
    metadata: { opponentName },
  }),

  pendingScoreSubmission: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION
    ),
    title: "Last Call \u2013 Submit Your Score",
    message: `Add your result with ${opponentName} or this match will be marked as not played.`,
    metadata: { opponentName },
  }),

  pendingScoreConfirmation: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION
    ),
    title: "Last Call \u2013 Confirm the Score",
    message: `Confirm your match result with ${opponentName} before it's auto-confirmed.`,
    metadata: { opponentName },
  }),

  scoreConfirmed: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_CONFIRMED
    ),
    title: "\u2705 Score Confirmed",
    message: `${opponentName} confirmed the match result. All set.`,
    metadata: { opponentName },
  }),

  scoreAutoConfirmed: (
    opponentName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED
    ),
    title: "Result Confirmed Automatically",
    message: `Looks like ${opponentName} missed the confirmation window. The submitted result has been auto-confirmed.`,
    metadata: { opponentName },
  }),

  forfeitDisciplinary: (
    opponentName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY
    ),
    title: "Match Forfeit",
    message: `Your match vs ${opponentName} has been recorded as a forfeit due to a conduct violation.`,
    metadata: { opponentName },
  }),

  opponentChanged: (
    oldOpponentName: string,
    newOpponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_CHANGED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_CHANGED
    ),
    title: "Opponent Changed",
    message: `Your match opponent has changed from ${oldOpponentName} to ${newOpponentName}. Match on ${date} at ${time} at ${venue}`,
    metadata: { oldOpponentName, newOpponentName, date, time, venue },
  }),

  // LEAGUE MATCH NOTIFICATIONS
  opponentPostedLeagueMatch: (
    opponentName: string,
    date: string,
    time: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH
    ),
    title: "\uD83C\uDFBE League Match Available",
    message: `${opponentName} posted a league match for ${date} at ${time}. Game on?`,
    metadata: { opponentName, date, time },
  }),

  leagueMatchConfirmedYouJoined: (
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_YOU_JOINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_YOU_JOINED
    ),
    title: "League Match Confirmed",
    message: `You joined a league match. Good luck!\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { date, time, venue },
  }),

  leagueMatchConfirmedOpponentJoined: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_OPPONENT_JOINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_OPPONENT_JOINED
    ),
    title: "\u2705 Game On!",
    message: `${opponentName} just joined your match. Say hello and arrange your game!`,
    metadata: { opponentName, date, time, venue },
  }),

  leagueMatchCancelledByOpponent: (
    opponentName: string,
    date: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT
    ),
    title: "Match Cancelled",
    message: `${opponentName} cancelled your league match ${date}.`,
    metadata: { opponentName, date },
  }),
};
