import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../types/notificationTypes';

/**
 * Division Notification Templates
 */
export const divisionNotifications = {
  created: (
    divisionName: string,
    seasonName: string,
    createdByName?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_CREATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_CREATED),
    title: 'New Division Created',
    message: ` Admin ${createdByName} has created ${divisionName} for ${seasonName}.`,
    metadata: { divisionName, seasonName, createdByName },
  }),
  
  assigned: (divisionName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_ASSIGNED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_ASSIGNED),
    title: 'Division Assignment',
    message: `You have been assigned to ${divisionName} for ${seasonName}`,
    metadata: { divisionName, seasonName },
  }),

  transferred: (
    fromDivision: string,
    toDivision: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_TRANSFERRED),
    title: 'Division Transfer',
    message: `You have been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
  }),

  removed: (divisionName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REMOVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REMOVED),
    title: 'Division Removal',
    message: `You have been removed from ${divisionName} in ${seasonName}${
      reason ? `. Reason: ${reason}` : ''
    }`,
    metadata: { divisionName, seasonName, reason },
  }),
};

/**
 * Chat Notification Templates
 */
export const chatNotifications = {
  groupAdded: (chatName: string, divisionName?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.GROUP_CHAT_ADDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.GROUP_CHAT_ADDED),
    title: 'Added to Group Chat',
    message: `You have been added to ${chatName}${
      divisionName ? ` for ${divisionName}` : ''
    }`,
    metadata: { chatName, divisionName },
  }),

  newMessage: (senderName: string, chatName: string, preview: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_MESSAGE),
    title: `New message from ${senderName}`,
    message: preview,
    metadata: { senderName, chatName, preview },
  }),
};

/**
 * Season Notification Templates
 */
export const seasonNotifications = {
  registrationConfirmed: (seasonName: string, amount: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED),
    title: 'Registration Confirmed',
    message: `Your registration for ${seasonName} has been confirmed. Entry fee: ${amount}`,
    metadata: { seasonName, amount },
  }),

  startingSoon: (seasonName: string, startDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_STARTING_SOON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_STARTING_SOON),
    title: 'Season Starting Soon',
    message: `${seasonName} starts on ${startDate}. Get ready!`,
    metadata: { seasonName, startDate },
  }),

  ended: (seasonName: string, divisionName?: string, finalPosition?: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_ENDED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_ENDED),
    title: 'Season Ended',
    message: `${seasonName} has ended${
      finalPosition ? `. You finished in position ${finalPosition}` : ''
    }${divisionName ? ` in ${divisionName}` : ''}. Thank you for participating!`,
    metadata: { seasonName, divisionName, finalPosition },
  }),

  cancelled: (seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SEASON_CANCELLED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SEASON_CANCELLED),
    title: 'Season Cancelled',
    message: `${seasonName} has been cancelled${reason ? `. Reason: ${reason}` : ''}`,
    metadata: { seasonName, reason },
  }),
};

/**
 * Payment Notification Templates
 */
export const paymentNotifications = {
  confirmed: (seasonName: string, amount: string, paymentMethod: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_CONFIRMED),
    title: 'Payment Confirmed',
    message: `Your payment of ${amount} for ${seasonName} has been confirmed via ${paymentMethod}`,
    metadata: { seasonName, amount, paymentMethod },
  }),

  failed: (seasonName: string, amount: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_FAILED),
    title: 'Payment Failed',
    message: `Payment of ${amount} for ${seasonName} failed${
      reason ? `. Reason: ${reason}` : ''
    }. Please try again.`,
    metadata: { seasonName, amount, reason },
  }),

  reminder: (seasonName: string, amount: string, dueDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAYMENT_REMINDER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAYMENT_REMINDER),
    title: 'Payment Reminder',
    message: `Payment of ${amount} for ${seasonName} is due by ${dueDate}`,
    metadata: { seasonName, amount, dueDate },
  }),
};

/**
 * Admin Notification Templates
 */
export const adminNotifications = {
  message: (title: string, message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_MESSAGE),
    title,
    message,
    metadata: {},
  }),

  systemMaintenance: (maintenanceTime: string, duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE),
    title: 'System Maintenance Scheduled',
    message: `System maintenance is scheduled for ${maintenanceTime}. Expected duration: ${duration}.`,
    metadata: { maintenanceTime, duration },
  }),

  newFeature: (featureName: string, description: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_FEATURE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_FEATURE),
    title: 'New Feature Available',
    message: `${featureName} is now available! ${description}`,
    metadata: { featureName, description },
  }),
};

/**
 * Inactivity Notification Templates
 */
export const inactivityNotifications = {
  warning: (daysSinceLastMatch: number, daysRemaining: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVITY_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVITY_WARNING),
    title: 'Inactivity Warning',
    message: `It's been ${daysSinceLastMatch} days since your last match. Play within ${daysRemaining} days to stay active!`,
    metadata: { daysSinceLastMatch, daysRemaining },
  }),

  statusChanged: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.STATUS_CHANGED_TO_INACTIVE),
    title: 'Account Status Changed',
    message: 'Your account has been marked inactive. Play a match to reactivate your rating!',
    metadata: { newStatus: 'INACTIVE' },
  }),

  reactivated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REACTIVATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REACTIVATED),
    title: 'Welcome Back!',
    message: 'Your account has been reactivated. Keep playing to maintain your rating!',
    metadata: { previousStatus: 'INACTIVE' },
  }),
};

// Continue with other notification categories...
// (Withdrawal, reminder, match, pairing notifications with similar pattern)

/**
 * Account & System Notification Templates
 */
export const accountNotifications = {
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

  maintenanceComplete: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MAINTENANCE_COMPLETE),
    title: "We're Back",
    message: 'DEUCE is back online! Thanks for your patience',
    metadata: {},
  }),

  tosUpdated: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOS_UPDATED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOS_UPDATED),
    title: 'TOS Updated',
    message: 'Our Terms of Service have been updated. Please review',
    metadata: {},
  }),
};

/**
 * Match Management Notification Templates
 */
export const matchNotifications = {
  friendlyMatchPosted: (date: string, time: string, venue: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED),
    title: 'Friendly Match Posted',
    message: `Your match on ${date} at ${time} at ${venue} is now open for players to join`,
    metadata: { date, time, venue },
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
};

/**
 * Rating & Ranking Notification Templates
 */
export const ratingNotifications = {
  movedUpInStandings: (newPosition: number, leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS),
    title: 'You Moved Up!',
    message: `You are now #${newPosition} in ${leagueName} ${divisionName}`,
    metadata: { newPosition, leagueName, divisionName },
  }),

  enteredTop10: (leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_10,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_10),
    title: 'Top 5!',
    message: `You are now in the top 5 of ${leagueName} ${divisionName}`,
    metadata: { leagueName, divisionName },
  }),

  enteredTop3: (position: number, leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_3,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_3),
    title: 'Top 3!',
    message: `You are now #${position} in ${leagueName} ${divisionName}`,
    metadata: { position, leagueName, divisionName },
  }),

  leagueLeader: (leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_LEADER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_LEADER),
    title: 'League Leader!',
    message: `You are now leading ${leagueName} ${divisionName}! Keep it up!`,
    metadata: { leagueName, divisionName },
  }),

  weeklyRankingUpdate: (position: number, leagueName: string, weekNumber: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE),
    title: `Week ${weekNumber} Rankings`,
    message: `You are #${position} in ${leagueName}! Keep playing to climb higher`,
    metadata: { position, leagueName, weekNumber },
  }),

  dmrIncreased: (sport: string, newRating: number, change: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DMR_INCREASED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
    title: 'DMR Increased',
    message: `Your ${sport} DMR is now ${newRating} (+${change})`,
    metadata: { sport, newRating, change },
  }),

  monthlyDmrRecap: (summary: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MONTHLY_DMR_RECAP,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MONTHLY_DMR_RECAP),
    title: 'Your Monthly DMR Summary',
    message: summary,
    metadata: {},
  }),

  personalBestRating: (sport: string, newRating: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERSONAL_BEST_RATING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PERSONAL_BEST_RATING),
    title: 'Personal Best!',
    message: `Your ${sport} DMR is now ${newRating} - your highest ever!`,
    metadata: { sport, newRating },
  }),

  ratingMilestone: (rating: number, sport: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RATING_MILESTONE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.RATING_MILESTONE),
    title: 'Milestone Achieved!',
    message: `You've reached ${rating} DMR in ${sport}`,
    metadata: { rating, sport },
  }),
};

/**
 * League Lifecycle Notification Templates
 */
export const leagueNotifications = {
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

  refundProcessed: (amount: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFUND_PROCESSED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REFUND_PROCESSED),
    title: 'Refund Processed',
    message: `Your refund of RM${amount} for ${leagueName} has been processed. It will appear in your account within 5-7 business days`,
    metadata: { amount, leagueName },
  }),
};

/**
 * Doubles League Notification Templates
 */
export const doublesNotifications = {
  partnerRequestSent: (partnerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNER_REQUEST_SENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PARTNER_REQUEST_SENT),
    title: 'Partner Request Sent',
    message: `Waiting for ${partnerName} to accept your doubles request for ${leagueName}`,
    metadata: { partnerName, leagueName },
  }),

  teamRegistrationReminder2h: (leagueName: string, partnerName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_2H,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_2H),
    title: 'Complete Registration',
    message: `⏰ Complete registration for your doubles team in ${leagueName} with ${partnerName}`,
    metadata: { leagueName, partnerName },
  }),

  teamRegistrationReminder24h: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H),
    title: 'Registration Pending',
    message: `Register your doubles team for ${leagueName}. Don't lose your spot!`,
    metadata: { leagueName },
  }),

  waitingForCaptain: (captainName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN),
    title: 'Waiting for Registration',
    message: `${captainName} hasn't completed registration yet for ${leagueName}. You may want to remind them!`,
    metadata: { captainName, leagueName },
  }),

  doublesTeamRegisteredCaptain: (leagueName: string, partnerName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN),
    title: 'Team Registered!',
    message: `Your doubles team is registered for ${leagueName}! You and ${partnerName} are ready to compete`,
    metadata: { leagueName, partnerName },
  }),

  doublesTeamRegisteredPartner: (captainName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER),
    title: 'Team Registered!',
    message: `${captainName} completed registration! Your doubles team is ready for ${leagueName}`,
    metadata: { captainName, leagueName },
  }),
};

/**
 * Promotional Notification Templates
 */
export const promotionalNotifications = {
  nextSeasonOpeningSoon: (sport: string, date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON),
    title: 'Next Season Soon',
    message: `New ${sport} season opens ${date}! Set a reminder`,
    metadata: { sport, date },
  }),

  sponsoredLeagueAnnouncement: (sponsorName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT),
    title: 'Sponsored League',
    message: `${sponsorName} presents: ${leagueName}! Registration open`,
    metadata: { sponsorName, leagueName },
  }),

  referralBonusAvailable: (reward: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE),
    title: 'Invite Friends',
    message: `Invite friends and earn ${reward} when they join`,
    metadata: { reward },
  }),

  inactivePlayer14Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS),
    title: 'Fun Games Are Calling!',
    message: 'Jump back in, play a match, and meet new people',
    metadata: {},
  }),

  inactivePlayer30Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS),
    title: 'We Miss You!',
    message: 'It is been awhile, see new league or friendly matches and join the action!',
    metadata: {},
  }),

  leagueBetweenBreaks: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS),
    title: 'Miss the Competition?',
    message: `${leagueName} registration is open!`,
    metadata: { leagueName },
  }),

  incompleteRegistration: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION),
    title: 'Complete Registration',
    message: `Complete your registration for ${leagueName} to secure your spot!`,
    metadata: { leagueName },
  }),

  venueSpecialOffer: (venueName: string, discount: string, validUntil: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER),
    title: 'Court Discount Available',
    message: `${venueName} is offering ${discount}% off for DEUCE players! Valid until ${validUntil}`,
    metadata: { venueName, discount, validUntil },
  }),
};

/**
 * Special Circumstances Notification Templates
 */
export const specialCircumstancesNotifications = {
  disputeResolutionRequired: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED),
    title: 'Dispute Under Review',
    message: `Your dispute with ${opponentName} is being reviewed. Check updates`,
    metadata: { opponentName },
  }),

  disputeResolved: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_RESOLVED),
    title: 'Dispute Resolved',
    message: `Your dispute with ${opponentName} has been resolved. View outcome`,
    metadata: { opponentName },
  }),

  codeOfConductWarning: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING),
    title: 'Code of Conduct',
    message: 'You\'ve received a warning from the league admin. Please check the details and ensure your future conduct follows our guidelines',
    metadata: {},
  }),

  disputeSubmitted: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_SUBMITTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_SUBMITTED),
    title: 'Dispute Submitted',
    message: 'Your dispute has been received. We\'ll look into it and keep you updated',
    metadata: {},
  }),

  opponentReportedIssue: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE),
    title: 'Issue Reported',
    message: `${opponentName} reported an issue. Admin will contact you if needed`,
    metadata: { opponentName },
  }),
};

/**
 * Convenient export of all notification templates
 */
export const notificationTemplates = {
  account: accountNotifications,
  division: divisionNotifications,
  chat: chatNotifications,
  season: seasonNotifications,
  payment: paymentNotifications,
  admin: adminNotifications,
  inactivity: inactivityNotifications,
  match: matchNotifications,
  rating: ratingNotifications,
  league: leagueNotifications,
  doubles: doublesNotifications,
  promotional: promotionalNotifications,
  specialCircumstances: specialCircumstancesNotifications,
};