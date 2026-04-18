import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const divisionNotifications = {

//   // Division lifecycle notifications

  divisionRebalanced: (newDivision: string, leagueName: string, gameType?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REBALANCED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_REBALANCED),
    title: "🔄 You're in a New Division",
    message: `${gameType === 'DOUBLES' ? 'Your Team has' : 'You\'ve'} been moved to ${newDivision} in ${leagueName} for competitive balance.`,
    metadata: { newDivision, leagueName, gameType: gameType ?? '' },
  }),

  divisionUpdateNewPlayer: (leagueName: string, gameType?: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER),
    title: "New Opponent in Your Division",
    message: `A new ${gameType === 'DOUBLES' ? 'team' : 'player'} has joined your division in ${leagueName}. Time to arrange a match!`,
    metadata: { leagueName, gameType: gameType ?? '' },
  }),

};
