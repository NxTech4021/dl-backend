import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

// REMOVED FOR NOW, MIGHT BE REQUESTED IN THE FUTURE

export const divisionNotifications = {

    //   // Division lifecycle notifications
//   created: (
//     divisionName: string,
//     seasonName: string,
//     adminName?: string
//   ): NotificationPayload => ({
//     type: NOTIFICATION_TYPES.DIVISION_CREATED,
//     category: getCategoryForNotificationType(
//       NOTIFICATION_TYPES.DIVISION_CREATED
//     ),
//     title: "Division Created",
//     message: `Division ${divisionName} has been created for ${seasonName}${
//       adminName ? ` by ${adminName}` : ""
//     }`,
//     metadata: { divisionName, seasonName, adminName },
//   }),

//   assigned: (
//     divisionName: string,
//     seasonName: string
//   ): NotificationPayload => ({
//     type: NOTIFICATION_TYPES.DIVISION_ASSIGNED,
//     category: getCategoryForNotificationType(
//       NOTIFICATION_TYPES.DIVISION_ASSIGNED
//     ),
//     title: "Division Assignment",
//     message: `You've been assigned to ${divisionName} for ${seasonName}. Check out your division and start scheduling matches!`,
//     metadata: { divisionName, seasonName },
//   }),

//   removed: (
//     divisionName: string,
//     seasonName: string,
//     reason?: string
//   ): NotificationPayload => ({
//     type: NOTIFICATION_TYPES.DIVISION_REMOVED,
//     category: getCategoryForNotificationType(
//       NOTIFICATION_TYPES.DIVISION_REMOVED
//     ),
//     title: "Removed from Division",
//     message: `You've been removed from ${divisionName} in ${seasonName}${
//       reason ? `: ${reason}` : ""
//     }`,
//     metadata: { divisionName, seasonName, reason },
//   }),

//   transferred: (
//     fromDivision: string,
//     toDivision: string,
//     seasonName: string
//   ): NotificationPayload => ({
//     type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
//     category: getCategoryForNotificationType(
//       NOTIFICATION_TYPES.DIVISION_TRANSFERRED
//     ),
//     title: "Division Transfer",
//     message: `You've been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
//     metadata: { fromDivision, toDivision, seasonName },
//   }),

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
