/**
 * @deprecated This file is deprecated. Use helpers/notifications/index.ts instead
 * 
 * This file is kept for backward compatibility only.
 * All new code should import from: import { notificationTemplates } from './helpers/notifications'
 */

import { NotificationPayload, NOTIFICATION_TYPES, getCategoryForNotificationType } from '../types/notificationTypes';

// Import from new structured notification files
import {
  notificationTemplates,
  accountSystemNotifications,
  matchManagementNotifications,
  leagueLifecycleNotifications,
  ratingRankingNotifications,
  doublesLeagueNotifications,
  socialCommunityNotifications,
  promotionalNotifications,
  specialCircumstancesNotifications,
  paymentNotifications,
  adminNotifications,
} from './notifications';

// Re-export for backward compatibility
export { notificationTemplates };
