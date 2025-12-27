/**
 * Rating & Ranking Notification Templates
 * Category: Rating & Ranking (from masterlist)
 * All notifications in this category are PUSH notifications
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const ratingRankingNotifications = {
  movedUpInStandings: (
    newPosition: number,
    leagueName: string,
    divisionName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS
    ),
    title: "You Moved Up!",
    message: `You are now #${newPosition} in ${leagueName} ${divisionName}`,
    metadata: { newPosition, leagueName, divisionName },
  }),

  enteredTop10: (
    leagueName: string,
    divisionName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_10,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_10),
    title: "Top 5!",
    message: `You are now in the top 5 of ${leagueName} ${divisionName}`,
    metadata: { leagueName, divisionName },
  }),

  enteredTop3: (
    position: number,
    leagueName: string,
    divisionName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_3,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_3),
    title: "Top 3!",
    message: `You are now #${position} in ${leagueName} ${divisionName}`,
    metadata: { position, leagueName, divisionName },
  }),

  leagueLeader: (
    leagueName: string,
    divisionName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_LEADER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_LEADER),
    title: "League Leader!",
    message: `You are now leading ${leagueName} ${divisionName}! Keep it up!`,
    metadata: { leagueName, divisionName },
  }),

  weeklyRankingUpdate: (
    position: number,
    leagueName: string,
    weekNumber: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WEEKLY_RANKING_UPDATE
    ),
    title: `Week ${weekNumber} Rankings`,
    message: `You are #${position} in ${leagueName}! Keep playing to climb higher`,
    metadata: { position, leagueName, weekNumber },
  }),

  dmrIncreased: (
    sport: string,
    newRating: number,
    change: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DMR_INCREASED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
    title: "DMR Increased",
    message: `Your ${sport} DMR is now ${newRating} (+${change})`,
    metadata: { sport, newRating, change },
  }),

  monthlyDmrRecap: (summary: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MONTHLY_DMR_RECAP,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MONTHLY_DMR_RECAP
    ),
    title: "Your Monthly DMR Summary",
    message: summary,
    metadata: {},
  }),

  personalBestRating: (
    sport: string,
    newRating: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERSONAL_BEST_RATING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PERSONAL_BEST_RATING
    ),
    title: "Personal Best!",
    message: `Your ${sport} DMR is now ${newRating} - your highest ever!`,
    metadata: { sport, newRating },
  }),

  ratingMilestone: (rating: number, sport: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.RATING_MILESTONE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.RATING_MILESTONE
    ),
    title: "Milestone Achieved!",
    message: `You've reached ${rating} DMR in ${sport}`,
    metadata: { rating, sport },
  }),

  ratingUpdate: (
    oldRating: number,
    newRating: number,
    changeStr: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DMR_INCREASED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
    title: "Rating Updated",
    message: `Your rating has changed from ${oldRating} to ${newRating} (${changeStr})`,
    metadata: { oldRating, newRating, changeStr },
  }),
};
