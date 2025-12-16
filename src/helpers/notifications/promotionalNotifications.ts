import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Promotional Notification Templates
 * Total: 8 notifications
 * Category: GENERAL
 */

export const promotionalNotifications = {
  nextSeasonOpeningSoon: (sport: string, date: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEXT_SEASON_OPENING_SOON),
    title: 'Next Season Soon',
    message: `New ${sport} season opens ${date}! Set a reminder`,
    metadata: { sport, date },
    isPush: true, // Push notification (NOTIF-128)
  }),

  sponsoredLeagueAnnouncement: (sponsorName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SPONSORED_LEAGUE_ANNOUNCEMENT),
    title: 'Sponsored League',
    message: `${sponsorName} presents: ${leagueName}! Registration open`,
    metadata: { sponsorName, leagueName },
    isPush: true, // Push notification (NOTIF-129)
  }),

  referralBonusAvailable: (reward: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REFERRAL_BONUS_AVAILABLE),
    title: 'Invite Friends',
    message: `Invite friends and earn ${reward} when they join`,
    metadata: { reward },
    isPush: true, // Push notification (NOTIF-130)
  }),

  inactivePlayer14Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS),
    title: 'Fun Games Are Calling!',
    message: 'Jump back in, play a match, and meet new people',
    metadata: {},
    isPush: true, // Push notification (NOTIF-131)
  }),

  inactivePlayer30Days: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS),
    title: 'We Miss You!',
    message: 'It is been awhile, see new league or friedly matches and join the action!',
    metadata: {},
    isPush: true, // Push notification (NOTIF-132)
  }),

  leagueBetweenBreaks: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS),
    title: 'Miss the Competition?',
    message: `${leagueName} registration is open!`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-133)
  }),

  incompleteRegistration: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION),
    title: 'Complete Registration',
    message: `Complete your registration for ${leagueName} to secure your spot!`,
    metadata: { leagueName },
    isPush: true, // Push notification (NOTIF-134)
  }),

  venueSpecialOffer: (venueName: string, discount: string, validUntil: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.VENUE_SPECIAL_OFFER),
    title: 'Court Discount Available',
    message: `${venueName} is offering ${discount}% off for DEUCE players! Valid until ${validUntil}`,
    metadata: { venueName, discount, validUntil },
    isPush: true, // Push notification (NOTIF-135)
  }),
};
