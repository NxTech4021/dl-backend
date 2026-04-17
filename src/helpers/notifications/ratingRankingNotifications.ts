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
    divisionName: string,
    leagueName: string,
    categoryName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS
    ),
    title: "\ud83d\udcc8 You Moved Up!",
    message: `#${newPosition} in ${divisionName}, ${leagueName} \u2022 ${categoryName}. Keep the momentum going! \ud83d\udd25`,
    metadata: { newPosition, divisionName, leagueName, categoryName },
  }),

  enteredTop10: (
    divisionName: string,
    leagueName: string,
    categoryName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_10,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_10),
    title: "\u2b50 Top 5! Yes, Really.",
    message: `You just cracked the top 5 in ${divisionName}, ${categoryName} \u2022 ${leagueName}.`,
    metadata: { divisionName, leagueName, categoryName },
  }),

  enteredTop3: (
    position: number,
    divisionName: string,
    leagueName: string,
    categoryName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ENTERED_TOP_3,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ENTERED_TOP_3),
    title: "\ud83c\udfd6\ufe0f  You're on the Podium!",
    message: `You're #${position} in ${divisionName}, ${categoryName} \u2022 ${leagueName}. The air's different up here \ud83d\udc40`,
    metadata: { position, divisionName, leagueName, categoryName },
  }),

  leagueLeader: (
    divisionName: string,
    leagueName: string,
    categoryName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_LEADER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_LEADER),
    title: "\ud83d\udc51 You're #1!",
    message: `Top of ${divisionName}, ${leagueName} \u2022 ${categoryName}. Everyone's chasing you now.`,
    metadata: { divisionName, leagueName, categoryName },
  }),

  dmrIncreased: (
    sport: string,
    newRating: number,
    change: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DMR_INCREASED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
    title: "\ud83d\udcc8 DMR Up!",
    message: `${sport} DMR: ${newRating} (+${change}). Wins look good on you \ud83d\ude0f`,
    metadata: { sport, newRating, change },
  }),

  personalBestRating: (
    sport: string,
    newRating: number
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PERSONAL_BEST_RATING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PERSONAL_BEST_RATING
    ),
    title: "\ud83c\udfc5 New Personal Best!",
    message: `${sport} DMR: ${newRating}. Your highest ever.`,
    metadata: { sport, newRating },
  }),

  // ratingMilestone: (rating: number, sport: string): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.RATING_MILESTONE,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.RATING_MILESTONE
  //   ),
  //   title: "Milestone Achieved!",
  //   message: `You've reached ${rating} DMR in ${sport}`,
  //   metadata: { rating, sport },
  // }),

  // ratingUpdate: (
  //   oldRating: number,
  //   newRating: number,
  //   changeStr: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.DMR_INCREASED,
  //   category: getCategoryForNotificationType(NOTIFICATION_TYPES.DMR_INCREASED),
  //   title: "Rating Updated",
  //   message: `Your rating has changed from ${oldRating} to ${newRating} (${changeStr})`,
  //   metadata: { oldRating, newRating, changeStr },
  // }),
};
