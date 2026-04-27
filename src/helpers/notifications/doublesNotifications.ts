/**
 * Doubles League Notification Templates
 * Category: Doubles League (from masterlist)
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const doublesNotifications = {


  waitingForCaptain: (
    captainName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN
    ),
    title: "Waiting on Your Captain",
    message: `${captainName} hasn't registered your team for ${leagueName} yet. A friendly reminder might help.`,
    metadata: { captainName, leagueName },
  }),

  registrationDeadlinePartner: (
    leagueName: string,
    captainName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER
    ),
    title: "⏰ Registration Closing – Action Needed",
    message: `Registration for ${leagueName} closes tomorrow and your team isn't in yet. Time to check in with ${captainName}.`,
    metadata: { leagueName, captainName },
  }),

  // NOTIF-031 (M5 + I3 resolved 2026-04-25): wired from seasonController.ts
  // doubles-registration branch (replaces the prior NOTIF-064 misuse).
  doublesTeamRegisteredCaptain: (
    leagueName: string,
    partnerName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN
    ),
    title: "✅ Team Registered!",
    message: `You and ${partnerName} are ready for ${leagueName}. Time to compete!`,
    metadata: { leagueName, partnerName },
  }),

  partnerRequestReceived: (
    playerName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED
    ),
    title: "Partner Up?",
    message: `${playerName} wants to team up for ${leagueName}. Accept or decline.`,
    metadata: { playerName, leagueName },
  }),

  partnerRequestAcceptedCaptain: (
    partnerName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED
    ),
    title: "🤝 You've Got a Partner!",
    message: `${partnerName} accepted! Complete registration to secure your spot in ${leagueName}.`,
    metadata: { partnerName, leagueName },
  }),

  // partnerRequestAcceptedPartner: (
  //   captainName: string,
  //   leagueName: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED
  //   ),
  //   title: "Team Confirmed!",
  //   message: `You are now teaming with ${captainName} for ${leagueName}. Waiting for ${captainName} to complete registration`,
  //   metadata: { captainName, leagueName },
  // }),

  partnerRequestDeclinedCaptain: (
    partnerName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED
    ),
    title: "Partner Request Declined",
    message: `${partnerName} declined your doubles request for ${leagueName}. Find another partner to team up with.`,
    metadata: { partnerName, leagueName },
  }),


  teamRegistrationReminder24h: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H
    ),
    title: "Complete Your Team Registration!",
    message: `Register your doubles team for ${leagueName}. Don't lose your spot!`,
    metadata: { leagueName },
  }),

  registrationDeadlineCaptain: (
    leagueName: string,
    partnerName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN
    ),
    title: "⏰ Last Chance to Register!",
    message: `Your doubles team isn't registered yet! Registration for ${leagueName} closes tomorrow. Chop chop!`,
    metadata: { leagueName, partnerName },
  }),

  doublesTeamRegisteredPartner: (
    captainName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER
    ),
    title: "✅ Team Registered!",
    message: `Good news! ${captainName} completed registration! Your doubles team is ready for ${leagueName}`,
    metadata: { captainName, leagueName },
  }),

  // partnerChanged: (
  //   oldPartnerName: string,
  //   newPartnerName: string,
  //   date: string,
  //   time: string,
  //   venue: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.PARTNER_CHANGED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.PARTNER_CHANGED
  //   ),
  //   title: "Partner Changed",
  //   message: `Your doubles partner has changed from ${oldPartnerName} to ${newPartnerName}. Match on ${date} at ${time} at ${venue}`,
  //   metadata: { oldPartnerName, newPartnerName, date, time, venue },
  // }),

  // Partner Replacement Notifications

  partnerLeftPartnership: (
    partnerName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED
    ),
    title: "Partner Left",
    message: `${partnerName} has left your doubles partnership for ${leagueName}. Find a new partner to continue playing.`,
    metadata: { partnerName, leagueName },
  }),

  // replacementInviteSent: (
  //   recipientName: string,
  //   leagueName: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.PARTNER_REQUEST_SENT,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.PARTNER_REQUEST_SENT
  //   ),
  //   title: "Partner Invite Sent",
  //   message: `Waiting for ${recipientName} to join your team for ${leagueName}`,
  //   metadata: { recipientName, leagueName },
  // }),

  // replacementInviteReceived: (
  //   captainName: string,
  //   leagueName: string
  // ): NotificationPayload => ({
  //   type: NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED,
  //   category: getCategoryForNotificationType(
  //     NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED
  //   ),
  //   title: "Join Doubles Team",
  //   message: `${captainName} invited you to join their doubles team for ${leagueName}. They're looking for a new partner!`,
  //   metadata: { captainName, leagueName },
  // }),

  newPartnerJoined: (
    newPartnerName: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED
    ),
    title: "Partner Joined!",
    message: `${newPartnerName} has joined your team for ${leagueName}. You're ready to play matches again!`,
    metadata: { newPartnerName, leagueName },
  }),

  partnerPostedMatch: (
    partnerName: string,
    matchDate: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_POSTED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_POSTED_MATCH
    ),
    title: "🎾 Your Partner Scheduled a Match",
    message: `${partnerName} posted a match for ${matchDate} at ${time}, ${venue}. Can you join?`,
    metadata: { partnerName, matchDate, time, venue },
  }),

  partnerConfirmedPostedMatch: (
    partnerName: string,
    matchDate: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_POSTED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_POSTED_MATCH
    ),
    title: "✅ Your Partner Confirmed the Match",
    message: `${partnerName} confirmed the match ${matchDate} at ${time}, ${venue}. You're both set.`,
    metadata: { partnerName, matchDate, time, venue },
  }),

  partnerDeclinedPostedMatch: (
    partnerName: string,
    matchDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_POSTED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_POSTED_MATCH
    ),
    title: "❌ Your Partner Can't Make It",
    message: `${partnerName} can't make the match ${matchDate}. Reschedule or cancel the match?`,
    metadata: { partnerName, matchDate },
  }),

  partnerJoinedMatch: (
    partnerName: string,
    matchDate: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_JOINED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_JOINED_MATCH
    ),
    title: "🎾 Your Partner Accepted a Match",
    message: `${partnerName} joined a match ${matchDate} at ${time}, ${venue}. Can you join?`,
    metadata: { partnerName, matchDate, time, venue },
  }),

  partnerConfirmedJoinedMatch: (
    partnerName: string,
    matchDate: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_JOINED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_JOINED_MATCH
    ),
    title: "✅ Your Partner Confirmed the Match",
    message: `${partnerName} confirmed the match ${matchDate} at ${time}, ${venue}. You're both set.`,
    metadata: { partnerName, matchDate, time, venue },
  }),

  partnerDeclinedJoinedMatch: (
    partnerName: string,
    matchDate: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_JOINED_MATCH,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_JOINED_MATCH
    ),
    title: "❌ Your Partner Can't Make It",
    message: `${partnerName} can't make the match ${matchDate}. Reschedule the match?`,
    metadata: { partnerName, matchDate },
  }),

  matchCancelledPartnerDeclined: (
    matchDate: string,
    time: string,
    venue: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DOUBLES_MATCH_CANCELLED_PARTNER_DECLINED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DOUBLES_MATCH_CANCELLED_PARTNER_DECLINED
    ),
    title: "🚫 Match Cancelled",
    message: `Opponent team cancelled the match ${matchDate} at ${time}, ${venue}.`,
    metadata: { matchDate, time, venue },
  }),
};
