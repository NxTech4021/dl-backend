import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../../types/notificationTypes';

/**
 * Special Circumstances Notification Templates
 * Total: 5 notifications
 * Category: ADMIN/MATCH
 */

export const specialCircumstancesNotifications = {
  disputeSubmitted: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_SUBMITTED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_SUBMITTED),
    title: 'Dispute Submitted',
    message: 'Your dispute has been received. We\'ll look into it and keep you updated',
    metadata: {},
    isPush: true, // Push notification (NOTIF-136)
  }),

  disputeResolutionRequired: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED),
    title: 'Dispute Under Review',
    message: `Your dispute with ${opponentName} is being reviewed. Check updates`,
    metadata: { opponentName },
    isPush: false, // In-App only (NOTIF-137)
  }),

  disputeResolved: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLVED,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.DISPUTE_RESOLVED),
    title: 'Dispute Resolved',
    message: `Your dispute with ${opponentName} has been resolved. View outcome`,
    metadata: { opponentName },
    isPush: true, // Push notification (NOTIF-138)
  }),

  codeOfConductWarning: (reason: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING),
    title: 'Code of Conduct',
    message: `You've received a warning from the league admin. Reason: ${reason}. Please check the details and ensure your future conduct follows our guidelines`,
    metadata: { reason },
    isPush: true, // Push notification (NOTIF-139)
  }),

  opponentReportedIssue: (opponentName: string, issueType: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.OPPONENT_REPORTED_ISSUE),
    title: 'Issue Reported',
    message: `${opponentName} reported an issue (${issueType}). Admin will contact you if needed`,
    metadata: { opponentName, issueType },
    isPush: false, // In-App only (NOTIF-140)
  }),
};
