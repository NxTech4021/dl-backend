/**
 * Special Circumstances Notification Templates
 * Category: Special Circumstances (from masterlist)
 */

import {
  NotificationPayload,
  NOTIFICATION_TYPES,
  getCategoryForNotificationType,
} from "../../types/notificationTypes";

export const specialCircumstancesNotifications = {
  // IN-APP NOTIFICATIONS

  disputeSubmitted: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_SUBMITTED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DISPUTE_SUBMITTED
    ),
    title: "Dispute Submitted",
    message:
      "Your dispute has been received. We'll look into it and keep you updated",
    metadata: {},
  }),

  // PUSH NOTIFICATIONS

  disputeResolutionRequired: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED
    ),
    title: "Dispute Under Review",
    message: `Your dispute with ${opponentName} is being reviewed. Check updates`,
    metadata: { opponentName },
  }),

  disputeResolved: (opponentName: string): NotificationPayload => ({
    type: NOTIFICATION_TYPES.DISPUTE_RESOLVED,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.DISPUTE_RESOLVED
    ),
    title: "Dispute Resolved",
    message: `Your dispute with ${opponentName} has been resolved. View outcome`,
    metadata: { opponentName },
  }),

  codeOfConductWarning: (): NotificationPayload => ({
    type: NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING,
    category: getCategoryForNotificationType(
      NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING
    ),
    title: "Code of Conduct",
    message:
      "You've received a warning from the league admin. Please check the details and ensure your future conduct follows our guidelines",
    metadata: {},
  }),

  suspensionNotice: (
    duration: string,
    reason: string
  ): NotificationPayload => ({
    type: NOTIFICATION_TYPES.ADMIN_MESSAGE,
    category: getCategoryForNotificationType(NOTIFICATION_TYPES.ADMIN_MESSAGE),
    title: "Account Suspended",
    message: `Your account has been suspended for ${duration}. Reason: ${reason}`,
    metadata: { duration, reason },
  }),
};
