/**
 * Social & Community Notification Templates
 * Category: Social & Community (from masterlist)
 * All notifications in this category are PUSH notifications
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const socialCommunityNotifications = {
  friendActivityScorecard: (
    friendName: string,
    achievement: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_ACTIVITY_SCORECARD,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIEND_ACTIVITY_SCORECARD
    ),
    title: "Friend Activity",
    message: `${friendName} ${achievement}`,
    metadata: { friendName, achievement },
  }),

  friendActivityPost: (
    friendName: string,
    activity: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_ACTIVITY_POST,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.FRIEND_ACTIVITY_POST
    ),
    title: "Friend Update",
    message: `${friendName} ${activity}`,
    metadata: { friendName, activity },
  }),

  similarSkillPlayerNearby: (
    playerName: string,
    rating: number,
    distance: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SIMILAR_SKILL_PLAYER_NEARBY,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SIMILAR_SKILL_PLAYER_NEARBY
    ),
    title: "Player Nearby",
    message: `${playerName} (DMR ${rating}) is ${distance} away. Connect and play!`,
    metadata: { playerName, rating, distance },
  }),

  shareScorecardPrompt: (matchDetails: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT
    ),
    title: "Share Your Win!",
    message: `Great match! Share your scorecard: ${matchDetails}`,
    metadata: { matchDetails },
  }),

  friendRequest: (playerName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.FRIEND_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.FRIEND_REQUEST),
    title: "Friend Request",
    message: `${playerName} wants to connect with you`,
    metadata: { playerName },
  }),

  postLiked: (likerName: string, postId: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.POST_LIKED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.POST_LIKED),
    title: "New Like",
    message: `${likerName} liked your post`,
    metadata: { likerName, postId },
  }),

  postLikedGrouped: (
    likerNames: string[],
    postId: string,
    totalCount: number
  ): NotificationPayload => {
    let message: string;
    if (totalCount === 1) {
      message = `${likerNames[0]} liked your post`;
    } else if (totalCount === 2) {
      message = `${likerNames[0]} and ${likerNames[1]} liked your post`;
    } else {
      const othersCount = totalCount - 1;
      message = `${likerNames[0]} and ${othersCount} other${othersCount > 1 ? "s" : ""} liked your post`;
    }
    return {
      type: NOTIFICATION_TYPES.POST_LIKED,
      category: getCategoryForNotificationType(NOTIFICATION_TYPES.POST_LIKED),
      title: "New Likes",
      message,
      metadata: { likerNames, postId, totalCount },
    };
  },

  postCommented: (
    commenterName: string,
    postId: string,
    commentPreview: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.POST_COMMENTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.POST_COMMENTED),
    title: "New Comment",
    message: `${commenterName} commented: ${commentPreview}`,
    metadata: { commenterName, postId, commentPreview },
  }),

  // Chat notifications
  newMessage: (
    senderName: string,
    chatName: string,
    messagePreview: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_MESSAGE),
    title: `${senderName} in ${chatName}`,
    message: messagePreview,
    metadata: { senderName, chatName, messagePreview },
  }),

  groupAdded: (groupName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.GROUP_CHAT_ADDED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.GROUP_CHAT_ADDED
    ),
    title: "Added to Group Chat",
    message: `You've been added to ${groupName}`,
    metadata: { groupName },
  }),
};
