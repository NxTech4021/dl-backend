import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const divisionNotifications = {
  // Division lifecycle notifications
  created: (
    divisionName: string,
    seasonName: string,
    adminName?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_CREATED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_CREATED
    ),
    title: "Division Created",
    message: `Division ${divisionName} has been created for ${seasonName}${
      adminName ? ` by ${adminName}` : ""
    }`,
    metadata: { divisionName, seasonName, adminName },
  }),

  assigned: (
    divisionName: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_ASSIGNED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_ASSIGNED
    ),
    title: "Division Assignment",
    message: `You've been assigned to ${divisionName} for ${seasonName}. Check out your division and start scheduling matches!`,
    metadata: { divisionName, seasonName },
  }),

  removed: (
    divisionName: string,
    seasonName: string,
    reason?: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_REMOVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_REMOVED
    ),
    title: "Removed from Division",
    message: `You've been removed from ${divisionName} in ${seasonName}${
      reason ? `: ${reason}` : ""
    }`,
    metadata: { divisionName, seasonName, reason },
  }),

  transferred: (
    fromDivision: string,
    toDivision: string,
    seasonName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_TRANSFERRED
    ),
    title: "Division Transfer",
    message: `You've been transferred from ${fromDivision} to ${toDivision} in ${seasonName}`,
    metadata: { fromDivision, toDivision, seasonName },
  }),

  divisionRebalanced: (
    newDivision: string,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_TRANSFERRED
    ),
    title: "Division Change",
    message: `You've been moved to Division ${newDivision} of ${leagueName} to balance the competition. View your new division`,
    metadata: { newDivision, leagueName },
  }),

  divisionUpdateNewPlayer: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER
    ),
    title: "Division Update",
    message: `A new player has joined your division in ${leagueName}. You may now arrange matches with them`,
    metadata: { leagueName },
  }),

  midSeasonUpdate: (
    position: number,
    leagueName: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.MID_SEASON_UPDATE
    ),
    title: "Halfway There!",
    message: `You are #${position} in ${leagueName}`,
    metadata: { position, leagueName },
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.LATE_SEASON_NUDGE
    ),
    title: "Last Stretch",
    message: "Schedule your remaining matches and finish the season strong",
    metadata: {},
  }),
};
