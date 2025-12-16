/**
 * @deprecated This file is deprecated. Use helpers/notifications/index.ts instead
 * 
 * This file is kept for backward compatibility only.
 * All new code should import from: import { notificationTemplates } from './helpers/notifications'
 * 
 * Migration Guide:
 * - OLD: import { divisionNotifications } from './helpers/notification'
 * - NEW: import { notificationTemplates } from './helpers/notifications'
 * - USE: notificationTemplates.leagueLifecycle.divisionCreated(...)
 */

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

// Re-export the main templates object
export { notificationTemplates };

/**
 * @deprecated Use notificationTemplates.leagueLifecycle instead
 */
export const divisionNotifications = leagueLifecycleNotifications;

/**
 * @deprecated Use notificationTemplates.socialCommunity instead
 */
export const chatNotifications = socialCommunityNotifications;

/**
 * @deprecated Use notificationTemplates.leagueLifecycle instead
 */
export const seasonNotifications = leagueLifecycleNotifications;

/**
 * @deprecated Use notificationTemplates.payment instead
 */
export { paymentNotifications };

/**
 * @deprecated Use notificationTemplates.admin instead
 */
export { adminNotifications };

/**
 * @deprecated Use notificationTemplates.accountSystem instead
 */
export const inactivityNotifications = accountSystemNotifications;

/**
 * @deprecated Use notificationTemplates.accountSystem instead
 */
export const accountNotifications = accountSystemNotifications;

/**
 * @deprecated Use notificationTemplates.matchManagement instead
 */
export const matchNotifications = matchManagementNotifications;

/**
 * @deprecated Use notificationTemplates.ratingRanking instead
 */
export const ratingNotifications = ratingRankingNotifications;

/**
 * @deprecated Use notificationTemplates.leagueLifecycle instead
 */
export const leagueNotifications = leagueLifecycleNotifications;

/**
 * @deprecated Use notificationTemplates.doublesLeague instead
 */
export const doublesNotifications = doublesLeagueNotifications;

/**
 * @deprecated Use notificationTemplates.promotional instead
 */
export { promotionalNotifications };

/**
 * @deprecated Use notificationTemplates.specialCircumstances instead
 */
export { specialCircumstancesNotifications };
