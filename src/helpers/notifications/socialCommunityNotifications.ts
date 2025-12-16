import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Social & Community Notification Templates
 * Total: 9 notifications
 * Category: CHAT/GENERAL
 */

export const socialCommunityNotifications = {
  groupChatAdded: (chatName: string, divisionName?: string): NotificationPayload => ({
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

  matchChatMessage: (opponentName: string, messagePreview: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_MESSAGE),
    title: opponentName,
    message: messagePreview,
    metadata: { opponentName, messagePreview },
  }),

  friendRequest: (playerName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIEND_REQUEST),
    title: 'Friend Request',
    message: `${playerName} wants to add you as friend`,
    metadata: { playerName },
  }),

  groupChatMessage: (groupName: string, playerName: string, messagePreview: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_MESSAGE),
    title: groupName,
    message: `${playerName}: ${messagePreview}`,
    metadata: { groupName, playerName, messagePreview },
  }),

  friendActivityScorecard: (friendName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_ACTIVITY_SCORECARD,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIEND_ACTIVITY_SCORECARD),
    title: `${friendName} Played Today`,
    message: 'See their scorecard',
    metadata: { friendName },
  }),

  friendActivityPost: (friendName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_ACTIVITY_POST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIEND_ACTIVITY_POST),
    title: `${friendName} Played Today`,
    message: 'View their scorecard and photo',
    metadata: { friendName },
  }),

  similarSkillPlayerNearby: (city: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SIMILAR_SKILL_PLAYER_NEARBY,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SIMILAR_SKILL_PLAYER_NEARBY),
    title: 'Player Nearby',
    message: `New player with similar DMR joined in ${city}!`,
    metadata: { city },
  }),

  tournamentInvitation: (tournamentName: string, date: string, organizer: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOURNAMENT_INVITATION,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOURNAMENT_INVITATION),
    title: 'Tournament Invitation',
    message: `${organizer} invited you to ${tournamentName} on ${date}`,
    metadata: { tournamentName, date, organizer },
  }),

  tournamentResult: (tournamentName: string, position: number): NotificationPayload => ({
    type: NOTIFICATION_TYPES.TOURNAMENT_RESULT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.TOURNAMENT_RESULT),
    title: 'Tournament Complete',
    message: `You finished in position ${position} in ${tournamentName}!`,
    metadata: { tournamentName, position },
  }),

  adminAnnouncement: (title: string, message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT),
    title,
    message,
    metadata: {},
  }),
};
