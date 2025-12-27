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
  // League match notifications
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

  // IN-APP NOTIFICATIONS

  friendlyMatchPosted: (
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED
    ),
    title: "Friendly Match Posted",
    message: `📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { date, time, venue },
  }),

  opponentReportedIssue: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE
    ),
    title: "Issue Reported",
    message: `${opponentName} reported an issue. Admin will contact you if needed`,
    metadata: { opponentName },
  }),

  // PUSH NOTIFICATIONS

  friendlyMatchJoinRequest: (
    playerName: string,
    date: string,
    time: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST
    ),
    title: "Join Request",
    message: `${playerName} wants to join your match\n📅 ${date} • ${time}`,
    metadata: { playerName, date, time },
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
    message: `${playerName} joined your match\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { playerName, date, time, venue },
  }),

  friendlyMatchRequestAccepted: (
    hostName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED
    ),
    title: "Request Accepted!",
    message: `${hostName} accepted your match request\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { hostName, date, time, venue },
  }),

  friendlyMatchRequestDeclined: (hostName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED
    ),
    title: "Request Declined",
    message: `${hostName} declined your join request`,
    metadata: { hostName },
  }),

  friendlyMatchCancelled: (
    hostName: string,
    date: string,
    time: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED
    ),
    title: "Match Cancelled",
    message: `${hostName} cancelled the match\n📅 ${date} • ${time}`,
    metadata: { hostName, date, time },
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
    title: "Player Left Match",
    message: `${playerName} left your match\n📅 ${date} • ${time}`,
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
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED
    ),
    title: "Match Details Updated",
    message: `Match details have been changed\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { date, time, venue },
  }),

  matchReminder24h: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: "Match Tomorrow",
    message: `Match vs ${opponentName} is tomorrow\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  matchReminder2h: (
    opponentName: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: "Match in 2 Hours",
    message: `⏰ Match vs ${opponentName} starting soon\n🕐 ${time}\n📍 ${venue}`,
    metadata: { opponentName, time, venue },
  }),

  matchMorningReminder: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_MORNING_REMINDER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_MORNING_REMINDER
    ),
    title: "Match Day Reminder",
    message: `Good morning! Your match vs ${opponentName} is today\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
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
    message: `You've been awarded the match vs ${opponentName}`,
    metadata: { opponentName },
  }),

  matchWalkoverLost: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_WALKOVER_LOST,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MATCH_WALKOVER_LOST
    ),
    title: "No-show",
    message: `You were marked as no-show vs ${opponentName}. Match recorded as loss`,
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
    message: `${opponentName} reported you as no-show for the match on ${date}. Confirm or dispute within 24 hours`,
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
    message: `Your record vs ${opponentName}: ${record}`,
    metadata: { opponentName, record },
  }),

  scoreSubmissionReminder: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER
    ),
    title: "Submit Match Result",
    message: `How did the match go? Submit your match result vs ${opponentName}`,
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
    title: "Review Score",
    message: `${opponentName} submitted match result. Review and confirm`,
    metadata: { opponentName },
  }),

  pendingScoreSubmission: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION
    ),
    title: "Reminder to Submit Score",
    message: "Last call to submit match result before it's locked",
    metadata: {},
  }),

  pendingScoreConfirmation: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION
    ),
    title: "Reminder to Confirm Score",
    message: "Last call to confirm match result before it's locked",
    metadata: {},
  }),

  scoreAutoConfirmed: (
    opponentName: string,
    score: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED
    ),
    title: "Score Auto-confirmed",
    message: `Match result vs ${opponentName} has been confirmed based on submitted score: ${score}`,
    metadata: { opponentName, score },
  }),

  forfeitDisciplinary: (
    opponentName: string,
    reason: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY
    ),
    title: "Match Forfeited",
    message: `Match vs ${opponentName} has been forfeited. Reason: ${reason}`,
    metadata: { opponentName, reason },
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
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH
    ),
    title: "League Match Available",
    message: `${opponentName} posted a league match\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
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
    title: "Opponent Joined Your Match",
    message: `${opponentName} joined your league match\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  leagueMatchCancelledByOpponent: (
    opponentName: string,
    date: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT
    ),
    title: "League Match Cancelled",
    message: `${opponentName} cancelled the league match\n📅 ${date} • ${time}\n📍 ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),
};
