import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Admin Notification Templates
 * Category: ADMIN
 */

export const adminNotifications = {
  adminMessage: (title: string, message: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_MESSAGE),
    title,
    message,
    metadata: {},
  }),

  systemMaintenance: (maintenanceTime: string, duration: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE),
    title: 'System Maintenance Scheduled',
    message: `System maintenance is scheduled for ${maintenanceTime}. Expected duration: ${duration}.`,
    metadata: { maintenanceTime, duration },
  }),

  newFeature: (featureName: string, description: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.NEW_FEATURE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.NEW_FEATURE),
    title: 'New Feature Available',
    message: `${featureName} is now available! ${description}`,
    metadata: { featureName, description },
  }),

  adminWithdrawalRequest: (playerName: string, seasonName: string, reason: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_WITHDRAWAL_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_WITHDRAWAL_REQUEST),
    title: 'Withdrawal Request',
    message: `${playerName} requested to withdraw from ${seasonName}. Reason: ${reason}`,
    metadata: { playerName, seasonName, reason },
  }),

  adminDisputeSubmitted: (submitterName: string, opponentName: string, matchDate: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_DISPUTE_SUBMITTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_DISPUTE_SUBMITTED),
    title: 'Dispute Submitted',
    message: `${submitterName} submitted a dispute for match vs ${opponentName} on ${matchDate}`,
    metadata: { submitterName, opponentName, matchDate },
  }),

  adminTeamChangeRequest: (playerName: string, requestType: string, details: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_TEAM_CHANGE_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_TEAM_CHANGE_REQUEST),
    title: 'Team Change Request',
    message: `${playerName} requested ${requestType}: ${details}`,
    metadata: { playerName, requestType, details },
  }),

  adminSeasonJoinRequest: (playerName: string, seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_SEASON_JOIN_REQUEST,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_SEASON_JOIN_REQUEST),
    title: 'Late Join Request',
    message: `${playerName} requested to join ${seasonName} after registration closed`,
    metadata: { playerName, seasonName },
  }),

  adminPlayerReport: (reporterName: string, reportedPlayer: string, reason: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_PLAYER_REPORT,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_PLAYER_REPORT),
    title: 'Player Reported',
    message: `${reporterName} reported ${reportedPlayer}. Reason: ${reason}`,
    metadata: { reporterName, reportedPlayer, reason },
  }),

  withdrawalRequestReceived: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED),
    title: 'Withdrawal Request Received',
    message: `Your withdrawal request from ${seasonName} has been received and is under review`,
    metadata: { seasonName },
  }),

  withdrawalRequestApproved: (seasonName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED),
    title: 'Withdrawal Approved',
    message: `Your withdrawal from ${seasonName} has been approved`,
    metadata: { seasonName },
  }),

  withdrawalRequestRejected: (seasonName: string, reason: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_REJECTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_REJECTED),
    title: 'Withdrawal Request Rejected',
    message: `Your withdrawal request from ${seasonName} was rejected. Reason: ${reason}`,
    metadata: { seasonName, reason },
  }),
};
