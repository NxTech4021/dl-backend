import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Rating & Ranking Notification Templates
 * Total: 9 notifications
 * Category: LEAGUE
 */

export const ratingRankingNotifications = {
  movedUpInStandings: (newPosition: number, leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS),
    title: 'You Moved Up!',
    message: `You are now #${newPosition} in ${leagueName} ${divisionName}`,
    metadata: { newPosition, leagueName, divisionName },
    isPush: true, // Push notification (NOTIF-097)
  }),

  enteredTop10: (leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_10,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_10),
    title: 'Top 5!',
    message: `You are now in the top 5 of ${leagueName} ${divisionName}`,
    metadata: { leagueName, divisionName },
    isPush: true, // Push notification (NOTIF-098)
  }),

  enteredTop3: (position: number, leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_3,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_3),
    title: 'Top 3!',
    message: `You are now #${position} in ${leagueName} ${divisionName}`,
    metadata: { position, leagueName, divisionName },
    isPush: true, // Push notification (NOTIF-099)
  }),

  leagueLeader: (leagueName: string, divisionName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_LEADER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_LEADER),
    title: 'League Leader!',
    message: `You are now leading ${leagueName} ${divisionName}! Keep it up!`,
    metadata: { leagueName, divisionName },
    isPush: true, // Push notification (NOTIF-100)
  }),

  weeklyRankingUpdate: (position: number, leagueName: string, weekNumber: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE),
    title: `Week ${weekNumber} Rankings`,
    message: `You are #${position} in ${leagueName}! Keep playing to climb higher`,
    metadata: { position, leagueName, weekNumber },
    isPush: false, // In-App only (NOTIF-101)
  }),

  dmrIncreased: (sport: string, newRating: number, change: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DMR_INCREASED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
    title: 'DMR Increased',
    message: `Your ${sport} DMR is now ${newRating} (+${change})`,
    metadata: { sport, newRating, change },
    isPush: true, // Push notification (NOTIF-102)
  }),

  monthlyDmrRecap: (summary: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MONTHLY_DMR_RECAP,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MONTHLY_DMR_RECAP),
    title: 'Your Monthly DMR Summary',
    message: summary,
    metadata: {},
    isPush: true, // Push notification (NOTIF-103)
  }),

  personalBestRating: (sport: string, newRating: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERSONAL_BEST_RATING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PERSONAL_BEST_RATING),
    title: 'Personal Best!',
    message: `Your ${sport} DMR is now ${newRating} - your highest ever!`,
    metadata: { sport, newRating },
    isPush: true, // Push notification (NOTIF-104)
  }),

  ratingMilestone: (rating: number, sport: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RATING_MILESTONE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.RATING_MILESTONE),
    title: 'Milestone Achieved!',
    message: `You've reached ${rating} DMR in ${sport}`,
    metadata: { rating, sport },
    isPush: true, // Push notification (NOTIF-105)
  }),

  ratingUpdate: (sport: string, newRating: number, oldRating: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RATING_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.RATING_UPDATE),
    title: 'Rating Updated',
    message: `Your ${sport} DMR changed from ${oldRating} to ${newRating}`,
    metadata: { sport, newRating, oldRating },
  }),

  ratingAdjusted: (sport: string, newRating: number, reason: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RATING_ADJUSTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.RATING_ADJUSTED),
    title: 'Rating Adjusted',
    message: `Your ${sport} DMR has been adjusted to ${newRating}. Reason: ${reason}`,
    metadata: { sport, newRating, reason },
  }),

  rankingUpdate: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RANKING_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.RANKING_UPDATE),
    title: 'Ranking Update',
    message: `You are now ranked #${position} in ${leagueName}`,
    metadata: { position, leagueName },
  }),
};
