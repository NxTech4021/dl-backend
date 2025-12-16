/**
 * Centralized Notification Templates
 * 
 * Organized by category for better maintainability
 * Total notifications: 132
 * 
 * Categories:
 * - Account & System (21)
 * - Match Management (37)
 * - League Lifecycle (30)
 * - Rating & Ranking (9)
 * - Doubles League (13)
 * - Social & Community (9)
 * - Promotional (8)
 * - Special Circumstances (5)
 * - Payment
 * - Admin
 */

import { accountSystemNotifications } from './accountSystemNotifications';
import { matchManagementNotifications } from './matchManagementNotifications';
import { leagueLifecycleNotifications } from './leagueLifecycleNotifications';
import { ratingRankingNotifications } from './ratingRankingNotifications';
import { doublesLeagueNotifications } from './doublesLeagueNotifications';
import { socialCommunityNotifications } from './socialCommunityNotifications';
import { promotionalNotifications } from './promotionalNotifications';
import { specialCircumstancesNotifications } from './specialCircumstancesNotifications';
import { paymentNotifications } from './paymentNotifications';
import { adminNotifications } from './adminNotifications';

/**
 * Main notification templates export
 * Use this import for all notification template access
 */
export const notificationTemplates = {
  accountSystem: accountSystemNotifications,
  matchManagement: matchManagementNotifications,
  leagueLifecycle: leagueLifecycleNotifications,
  ratingRanking: ratingRankingNotifications,
  doublesLeague: doublesLeagueNotifications,
  socialCommunity: socialCommunityNotifications,
  promotional: promotionalNotifications,
  specialCircumstances: specialCircumstancesNotifications,
  payment: paymentNotifications,
  admin: adminNotifications,
};

/**
 * Legacy exports for backward compatibility
 * @deprecated Use notificationTemplates.<category> instead
 */
export const accountNotifications = accountSystemNotifications;
export const matchNotifications = matchManagementNotifications;
export const leagueNotifications = leagueLifecycleNotifications;
export const ratingNotifications = ratingRankingNotifications;
export const doublesNotifications = doublesLeagueNotifications;
export const chatNotifications = socialCommunityNotifications;
export const inactivityNotifications = accountSystemNotifications;
export const divisionNotifications = leagueLifecycleNotifications;
export const seasonNotifications = leagueLifecycleNotifications;

// Re-export individual notification groups
export {
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
};
