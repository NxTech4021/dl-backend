/**
 * Notification Templates - Category-Based Organization
 * Based on DEUCE Notifications Masterlist V1.0
 * 
 * Categories:
 * - Account & System
 * - Doubles League
 * - League Lifecycle
 * - Match Management
 * - Rating & Ranking
 * - Social & Community
 * - Promotional
 * - Special Circumstances
 */

import { accountNotifications } from './accountNotifications';
import { doublesNotifications } from './doublesNotifications';
import { leagueLifecycleNotifications } from './leagueLifecycleNotifications';
import { matchManagementNotifications } from './matchManagementNotifications';
import { ratingRankingNotifications } from './ratingRankingNotifications';
import { socialCommunityNotifications } from './socialCommunityNotifications';
import { promotionalNotifications } from './promotionalNotifications';
import { specialCircumstancesNotifications } from './specialCircumstancesNotifications';

// Individual category exports
export { accountNotifications } from './accountNotifications';
export { doublesNotifications } from './doublesNotifications';
export { leagueLifecycleNotifications } from './leagueLifecycleNotifications';
export { matchManagementNotifications } from './matchManagementNotifications';
export { ratingRankingNotifications } from './ratingRankingNotifications';
export { socialCommunityNotifications } from './socialCommunityNotifications';
export { promotionalNotifications } from './promotionalNotifications';
export { specialCircumstancesNotifications } from './specialCircumstancesNotifications';

/**
 * Unified notification templates object
 * Access notifications by category
 * 
 * @example
 * ```typescript
 * import { notificationTemplates } from '@/helpers/notifications';
 * 
 * // Account notifications
 * const welcome = notificationTemplates.account.welcomeToDeuce();
 * 
 * // Match notifications
 * const reminder = notificationTemplates.match.scoreSubmissionReminder('John');
 * 
 * // League notifications
 * const winner = notificationTemplates.leagueLifecycle.leagueWinner('Summer 2024');
 * ```
 */
export const notificationTemplates = {
  account: accountNotifications,
  doubles: doublesNotifications,
  leagueLifecycle: leagueLifecycleNotifications,
  league: leagueLifecycleNotifications, // Alias for convenience
  match: matchManagementNotifications,
  rating: ratingRankingNotifications,
  social: socialCommunityNotifications,
  chat: socialCommunityNotifications, // Chat is part of social & community
  promotional: promotionalNotifications,
  specialCircumstances: specialCircumstancesNotifications,
  season: leagueLifecycleNotifications, // Alias for backward compatibility
};
