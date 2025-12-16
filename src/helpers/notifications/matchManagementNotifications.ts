import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Match Management Notification Templates
 * Total: 37 notifications
 * Category: MATCH
 */

export const matchManagementNotifications = {
  matchScheduled: (opponentName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_SCHEDULED),
    title: 'Match Scheduled',
    message: `Match vs ${opponentName} scheduled for ${date} at ${time} at ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  matchReminder24Hours: (opponentName: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: 'Match Tomorrow',
    message: `You are playing ${opponentName} tomorrow at ${time} at ${venue}`,
    metadata: { opponentName, time, venue },
  }),

  matchReminder2Hours: (opponentName: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: 'Match Starting Soon',
    message: `Get ready! You are playing ${opponentName} in 2 hours at ${venue}`,
    metadata: { opponentName, venue },
  }),

  matchDayMorning: (opponentName: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_REMINDER),
    title: 'Match Today',
    message: `You have a match against ${opponentName} at ${time} at ${venue}`,
    metadata: { opponentName, time, venue },
  }),

  friendlyMatchPosted: (date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED),
    title: 'Friendly Match Posted',
    message: `Your match on ${date} at ${time} at ${venue} is now open for players to join`,
    metadata: { date, time, venue },
  }),

  leagueMatchPosted: (date: string, time: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_SCHEDULED),
    title: 'League Match Posted',
    message: `Waiting for player to join your match on ${date} at ${time}`,
    metadata: { date, time },
  }),

  opponentPostedLeagueMatch: (opponentName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_SCHEDULED),
    title: 'League Match Available',
    message: `${opponentName} posted a league match on ${date} at ${time} at ${venue}. Join now!`,
    metadata: { opponentName, date, time, venue },
  }),

  leagueMatchConfirmedYouJoined: (opponentName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_SCHEDULED),
    title: 'Match Confirmed!',
    message: `You are playing ${opponentName} on ${date} at ${time} at ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  leagueMatchConfirmedOpponentJoined: (opponentName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_SCHEDULED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_SCHEDULED),
    title: 'Match Confirmed!',
    message: `${opponentName} joined your match on ${date} at ${time} at ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  leagueMatchCancelledByOpponent: (opponentName: string, date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_CANCELLED),
    title: 'Match Cancelled',
    message: `${opponentName} cancelled your league match on ${date}`,
    metadata: { opponentName, date },
  }),

  friendlyMatchJoinRequest: (playerName: string, date: string, time: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST),
    title: 'Join Request',
    message: `${playerName} wants to join your match on ${date} at ${time}. Accept or decline`,
    metadata: { playerName, date, time },
  }),

  friendlyMatchPlayerJoined: (playerName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_PLAYER_JOINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_PLAYER_JOINED),
    title: 'Player Joined',
    message: `${playerName} joined your match on ${date} at ${time} at ${venue}`,
    metadata: { playerName, date, time, venue },
  }),

  friendlyMatchRequestAccepted: (organizerName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED),
    title: 'Request Accepted',
    message: `${organizerName} accepted your request! Match on ${date} at ${time} at ${venue}`,
    metadata: { organizerName, date, time, venue },
  }),

  friendlyMatchRequestDeclined: (organizerName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED),
    title: 'Request Declined',
    message: `${organizerName} declined your request to join their match`,
    metadata: { organizerName },
  }),

  friendlyMatchCancelled: (organizerName: string, date: string, time: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED),
    title: 'Match Cancelled',
    message: `${organizerName} cancelled the match on ${date} at ${time}`,
    metadata: { organizerName, date, time },
  }),

  playerLeftFriendlyMatch: (playerName: string, date: string, time: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH),
    title: 'Player Left',
    message: `${playerName} left your match on ${date} at ${time}`,
    metadata: { playerName, date, time },
  }),

  schedulingConflictDetected: (date: string, time: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED),
    title: 'Scheduling Conflict',
    message: `Just a heads-up, you already have a match scheduled on ${date} at ${time}`,
    metadata: { date, time },
  }),

  friendlyMatchDetailsChanged: (organizerName: string, newDate: string, newTime: string, newVenue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED),
    title: 'Match Updated',
    message: `${organizerName} changed match to ${newDate} at ${newTime} at ${newVenue}`,
    metadata: { organizerName, newDate, newTime, newVenue },
  }),

  matchRescheduleRequest: (opponentName: string, newDate: string, newTime: string, newVenue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESCHEDULE_REQUEST),
    title: 'Match Change Request',
    message: `${opponentName} wants to change your match to ${newDate} at ${newTime} at ${newVenue}. Accept or decline`,
    metadata: { opponentName, newDate, newTime, newVenue },
  }),

  matchRescheduleAccepted: (opponentName: string, date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_ACCEPTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESCHEDULE_ACCEPTED),
    title: 'Change Accepted',
    message: `${opponentName} accepted the change. Match now ${date} at ${time} at ${venue}`,
    metadata: { opponentName, date, time, venue },
  }),

  matchRescheduleDeclined: (opponentName: string, originalDate: string, originalTime: string, originalVenue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESCHEDULE_DECLINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESCHEDULE_DECLINED),
    title: 'Change Declined',
    message: `${opponentName} declined the change. Original match: ${originalDate} at ${originalTime} at ${originalVenue}`,
    metadata: { opponentName, originalDate, originalTime, originalVenue },
  }),

  matchCancelled: (opponentName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_CANCELLED),
    title: 'Match Cancelled',
    message: `Match vs ${opponentName} has been cancelled${reason ? `: ${reason}` : ''}`,
    metadata: { opponentName, reason },
  }),

  matchWalkoverWon: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_WALKOVER_WON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_WALKOVER_WON),
    title: 'Walkover Win',
    message: `You've been awarded the match vs ${opponentName}`,
    metadata: { opponentName },
  }),

  matchWalkoverLost: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_WALKOVER_LOST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_WALKOVER_LOST),
    title: 'No-show',
    message: `You were marked as no-show vs ${opponentName}. Match recorded as loss`,
    metadata: { opponentName },
  }),

  noShowStrikeWarning: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NO_SHOW_STRIKE_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NO_SHOW_STRIKE_WARNING),
    title: 'No-show Warning',
    message: `You received a no-show strike for the match vs ${opponentName}. Regular no-shows will result in league suspension`,
    metadata: { opponentName },
  }),

  opponentClaimsNoShow: (opponentName: string, date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW),
    title: 'No-show Claim',
    message: `${opponentName} reported you as no-show for the match on ${date}. Confirm or dispute within 24 hours`,
    metadata: { opponentName, date },
  }),

  headToHeadHistory: (opponentName: string, record: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY),
    title: "You've Played Before",
    message: `You've played ${opponentName} before. Your record: ${record}. View past results`,
    metadata: { opponentName, record },
  }),

  scoreSubmissionReminder: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER),
    title: 'Submit Match Result',
    message: `How did the match go? Submit your match result vs ${opponentName}`,
    metadata: { opponentName },
  }),

  scoreDisputeAlert: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_DISPUTE_ALERT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SCORE_DISPUTE_ALERT),
    title: 'Score Discrepancy',
    message: `Score discrepancy with ${opponentName}. Review and confirm the correct result`,
    metadata: { opponentName },
  }),

  opponentSubmittedScore: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE),
    title: 'Review Score',
    message: `${opponentName} submitted match result. Review and confirm`,
    metadata: { opponentName },
  }),

  pendingScoreSubmission: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION),
    title: 'Reminder to Submit Score',
    message: 'Last call to submit match result before it\'s locked',
    metadata: {},
  }),

  pendingScoreConfirmation: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION),
    title: 'Reminder to Confirm Score',
    message: 'Last call to confirm match result before it\'s locked',
    metadata: {},
  }),

  scoreAutoConfirmed: (opponentName: string, score: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED),
    title: 'Score Auto-confirmed',
    message: `Match result vs ${opponentName} has been confirmed based on submitted score: ${score}`,
    metadata: { opponentName, score },
  }),

  scoreConfirmed: (yourScore: string, opponentScore: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESULT_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESULT_CONFIRMED),
    title: 'Match Result Confirmed',
    message: `${yourScore}-${opponentScore}, ${yourScore}-${opponentScore}`,
    metadata: { yourScore, opponentScore },
  }),

  forfeitDisciplinary: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY),
    title: 'Match Forfeit',
    message: `Your match vs ${opponentName} has been recorded as a forfeit due to code of conduct violation. View details`,
    metadata: { opponentName },
  }),

  winningStreak: (streakCount: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WINNING_STREAK,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WINNING_STREAK),
    title: 'Winning Streak!',
    message: `${streakCount} match winning streak! Keep the momentum going`,
    metadata: { streakCount },
  }),

  scheduleMatchSoon: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON),
    title: 'Schedule Your Matches',
    message: 'You haven\'t scheduled a match yet. Reach out and find a time that works to get your first game in!',
    metadata: {},
  }),

  matchesRemaining: (leagueName: string, matchesPlayed: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCHES_REMAINING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCHES_REMAINING),
    title: 'Matches Behind Schedule',
    message: `Less than 6 matches played so far in ${leagueName}. League standings are based on your best 6 results, complete more matches to secure your strongest finish`,
    metadata: { leagueName, matchesPlayed },
  }),

  opponentChanged: (oldOpponent: string, newOpponent: string, date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_CHANGED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.OPPONENT_CHANGED),
    title: 'Opponent Changed',
    message: `Your opponent for the match on ${date} changed from ${oldOpponent} to ${newOpponent}`,
    metadata: { oldOpponent, newOpponent, date },
  }),

  partnerChanged: (oldPartner: string, newPartner: string, matchDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNER_CHANGED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PARTNER_CHANGED),
    title: 'Partner Changed',
    message: `Your partner for the match on ${matchDate} changed from ${oldPartner} to ${newPartner}`,
    metadata: { oldPartner, newPartner, matchDate },
  }),

  matchResult: (opponentName: string, result: string, score: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESULT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESULT),
    title: 'Match Result',
    message: `Match vs ${opponentName}: ${result}. Final score: ${score}`,
    metadata: { opponentName, result, score },
  }),

  matchResultSubmitted: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESULT_SUBMITTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESULT_SUBMITTED),
    title: 'Result Submitted',
    message: `Your match result vs ${opponentName} has been submitted`,
    metadata: { opponentName },
  }),

  matchResultDisputed: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESULT_DISPUTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESULT_DISPUTED),
    title: 'Result Disputed',
    message: `${opponentName} disputed the match result. Admin review required`,
    metadata: { opponentName },
  }),

  matchResultApproved: (opponentName: string, score: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MATCH_RESULT_APPROVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MATCH_RESULT_APPROVED),
    title: 'Result Approved',
    message: `Match result vs ${opponentName} (${score}) has been approved`,
    metadata: { opponentName, score },
  }),

  shareScorecardPrompt: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT),
    title: 'Share Your Win',
    message: 'Great match! Share your scorecard with friends',
    metadata: {},
  }),
};
