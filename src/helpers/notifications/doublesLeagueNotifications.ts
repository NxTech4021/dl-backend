import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Doubles League Notification Templates
 * Total: 13 notifications
 * Category: LEAGUE
 */

export const doublesLeagueNotifications = {
  pairRequestReceived: (playerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED),
    title: 'Doubles Partner Request',
    message: `${playerName} wants to team up with you for ${leagueName}. Accept or decline`,
    metadata: { playerName, leagueName },
  }),

  pairRequestAcceptedCaptain: (partnerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED),
    title: 'Team Confirmed!',
    message: `${partnerName} accepted! You are now a team for ${leagueName}. Complete registration to secure your spot`,
    metadata: { partnerName, leagueName },
  }),

  pairRequestAcceptedPartner: (captainName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED),
    title: 'Team Confirmed!',
    message: `You are now teaming with ${captainName} for ${leagueName}. Waiting for ${captainName} to complete registration`,
    metadata: { captainName, leagueName },
  }),

  pairRequestRejected: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED),
    title: 'Request Declined',
    message: `${playerName} declined your partner request for ${seasonName}`,
    metadata: { playerName, seasonName },
  }),

  pairRequestDeclinedCaptain: (partnerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED),
    title: 'Request Declined',
    message: `${partnerName} declined your doubles request for ${leagueName}. Send a request to another partner`,
    metadata: { partnerName, leagueName },
  }),

  pairRequestDeclinedPartner: (playerName: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.PAIR_REQUEST_DECLINED),
    title: 'Request Declined',
    message: `You declined ${playerName}'s doubles request for ${leagueName}`,
    metadata: { playerName, leagueName },
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

  registrationDeadlineCaptainApproaching: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN),
    title: 'Registration Closes Soon',
    message: `Your team isn't registered for ${leagueName} yet. Register your doubles team for ${leagueName} before registration closes tomorrow`,
    metadata: { leagueName },
  }),

  registrationDeadlinePartnerApproaching: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER),
    title: 'Registration Closes Soon',
    message: `Your team isn't registered for ${leagueName} yet. Ask your captain to complete the payment before registration closes tomorrow`,
    metadata: { leagueName },
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
