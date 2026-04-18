/**
 * Promotional Notification Templates
 * Category: Promotional (from masterlist)
 * All notifications in this category are PUSH notifications
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const promotionalNotifications = {
  nextSeasonOpeningSoon: (
    sport: string,
    date: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON
    ),
    title: "Next Season Soon",
    message: `New ${sport} season opens ${date}! Set a reminder`,
    metadata: { sport, date },
  }),

  sponsoredLeagueAnnouncement: (
    sponsorName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT
    ),
    title: "Sponsored League",
    message: `${sponsorName} presents: ${leagueName}! Registration open`,
    metadata: { sponsorName, leagueName },
  }),

  referralBonusAvailable: (reward: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE
    ),
    title: "Invite Friends",
    message: `Invite friends and earn ${reward} when they join`,
    metadata: { reward },
  }),

  inactivePlayer14Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS
    ),
    title: "It's Been a While",
    message: "There are matches waiting for you. Jump back in.",
    metadata: {},
  }),

  inactivePlayer30Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS
    ),
    title: "Long Time No Match",
    message: "New leagues and matches are available. Don't miss out.",
    metadata: {},
  }),

  leagueBetweenBreaks: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS
    ),
    title: "\ud83c\udfc6 Back for More?",
    message: `${leagueName} has a new season open. You know you want in.`,
    metadata: { leagueName },
  }),

  incompleteRegistration: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION
    ),
    title: "Almost There!",
    message: `You're one step away from ${leagueName}. Don't let your spot slip \ud83d\udc40`,
    metadata: { leagueName },
  }),

  venueSpecialOffer: (
    venueName: string,
    discount: string,
    validUntil: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER
    ),
    title: "Court Discount Available",
    message: `${venueName} is offering ${discount}% off for DEUCE players! Valid until ${validUntil}`,
    metadata: { venueName, discount, validUntil },
  }),
};
