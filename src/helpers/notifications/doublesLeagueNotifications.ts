import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Doubles League Notification Templates
 * Total: 13 notifications
 * Category: LEAGUE
 */

export const doublesLeagueNotifications = {
  pairRequestReceived: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED),
    title: 'Partner Request',
    message: `${playerName} wants to partner with you for ${seasonName}`,
    metadata: { playerName, seasonName },
  }),

  pairRequestAccepted: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED),
    title: 'Request Accepted',
    message: `${playerName} accepted your partner request for ${seasonName}!`,
    metadata: { playerName, seasonName },
  }),

  pairRequestRejected: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED),
    title: 'Request Declined',
    message: `${playerName} declined your partner request for ${seasonName}`,
    metadata: { playerName, seasonName },
  }),

  pairRequestDeclined: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED),
    title: 'Request Declined',
    message: `${playerName} declined your partner request for ${seasonName}`,
    metadata: { playerName, seasonName },
  }),

  partnerAssigned: (partnerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNER_ASSIGNED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PARTNER_ASSIGNED),
    title: 'Partner Assigned',
    message: `You have been paired with ${partnerName} for ${seasonName}`,
    metadata: { partnerName, seasonName },
  }),

  partnerRequestSent: (partnerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNER_REQUEST_SENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PARTNER_REQUEST_SENT),
    title: 'Partner Request Sent',
    message: `Waiting for ${partnerName} to accept your doubles request for ${leagueName}`,
    metadata: { partnerName, leagueName },
  }),

  partnershipDissolved: (partnerName: string, seasonName: string, reason?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED),
    title: 'Partnership Ended',
    message: `Your partnership with ${partnerName} for ${seasonName} has ended${reason ? `: ${reason}` : ''}`,
    metadata: { partnerName, seasonName, reason },
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

  registrationDeadlineCaptain: (leagueName: string, deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN),
    title: 'Captain Reminder',
    message: `Complete team registration for ${leagueName} by ${deadline}`,
    metadata: { leagueName, deadline },
  }),

  waitingForCaptain: (captainName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN),
    title: 'Waiting for Registration',
    message: `${captainName} hasn't completed registration yet for ${leagueName}. You may want to remind them!`,
    metadata: { captainName, leagueName },
  }),

  registrationDeadlinePartner: (leagueName: string, deadline: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER),
    title: 'Registration Deadline',
    message: `Your team captain needs to complete registration for ${leagueName} by ${deadline}`,
    metadata: { leagueName, deadline },
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
