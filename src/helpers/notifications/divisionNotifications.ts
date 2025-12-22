import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

export const divisionNotifications = {
  divisionRebalanced: (newDivision: string, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_TRANSFERRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_TRANSFERRED),
    title: 'Division Change',
    message: `You've been moved to Division ${newDivision} of ${leagueName} to balance the competition. View your new division`,
    metadata: { newDivision, leagueName },
  }),

  divisionUpdateNewPlayer: (leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DIVISION_UPDATE_NEW_PLAYER),
    title: 'Division Update',
    message: `A new player has joined your division in ${leagueName}. You may now arrange matches with them`,
    metadata: { leagueName },
  }),

  midSeasonUpdate: (position: number, leagueName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.MID_SEASON_UPDATE),
    title: 'Halfway There!',
    message: `You are #${position} in ${leagueName}`,
    metadata: { position, leagueName },
  }),

  lateSeasonNudge: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.LATE_SEASON_NUDGE),
    title: 'Last Stretch',
    message: 'Schedule your remaining matches and finish the season strong',
    metadata: {},
  }),
};