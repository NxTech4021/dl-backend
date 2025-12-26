/**
 * Notification Delivery Type Configuration
 * Maps each notification type to its delivery method (PUSH or IN_APP)
 * Based on the DEUCE Notifications Masterlist V1.0
 */

export enum NotificationDeliveryType {
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

/**
 * Mapping of notification types to their delivery methods
 * Generated from: deuce notifications masterlist.xlsx - All Notifications (V1.0).csv
 */
export const NOTIFICATION_DELIVERY_MAP: Record<string, NotificationDeliveryType> = {
  // Account & System - IN_APP
  WELCOME_TO_DEUCE: NotificationDeliveryType.IN_APP,
  PROFILE_INCOMPLETE_REMINDER: NotificationDeliveryType.IN_APP,
  PROFILE_PHOTO_MISSING: NotificationDeliveryType.IN_APP,
  PROFILE_VERIFICATION_NEEDED: NotificationDeliveryType.IN_APP,
  ACHIEVEMENT_UNLOCKED: NotificationDeliveryType.IN_APP,
  TOS_UPDATED: NotificationDeliveryType.IN_APP,
  FEATURE_ANNOUNCEMENT: NotificationDeliveryType.IN_APP,
  
  // Account & System - PUSH
  FIRST_MATCH_COMPLETED: NotificationDeliveryType.PUSH,
  MATCHES_PLAYED_MILESTONE: NotificationDeliveryType.PUSH,
  FIRST_LEAGUE_COMPLETED: NotificationDeliveryType.PUSH,
  LEAGUES_COMPLETED_MILESTONE: NotificationDeliveryType.PUSH,
  PERFECT_ATTENDANCE: NotificationDeliveryType.PUSH,
  MULTI_LEAGUE_PLAYER: NotificationDeliveryType.PUSH,
  NEW_WEEKLY_STREAK: NotificationDeliveryType.PUSH,
  STREAK_AT_RISK: NotificationDeliveryType.PUSH,
  APP_UPDATE_AVAILABLE: NotificationDeliveryType.PUSH,
  SCHEDULED_MAINTENANCE: NotificationDeliveryType.PUSH,
  MAINTENANCE_COMPLETE: NotificationDeliveryType.PUSH,
  
  // Doubles League - IN_APP
  PARTNER_REQUEST_SENT: NotificationDeliveryType.IN_APP,
  PARTNER_REQUEST_DECLINED_PARTNER: NotificationDeliveryType.IN_APP,
  WAITING_FOR_CAPTAIN: NotificationDeliveryType.IN_APP,
  REGISTRATION_DEADLINE_PARTNER: NotificationDeliveryType.IN_APP,
  DOUBLES_TEAM_REGISTERED_CAPTAIN: NotificationDeliveryType.IN_APP,
  
  // Doubles League - PUSH
  PARTNER_REQUEST_RECEIVED: NotificationDeliveryType.PUSH,
  PARTNER_REQUEST_ACCEPTED_CAPTAIN: NotificationDeliveryType.PUSH,
  PARTNER_REQUEST_ACCEPTED_PARTNER: NotificationDeliveryType.PUSH,
  PARTNER_REQUEST_DECLINED_CAPTAIN: NotificationDeliveryType.PUSH,
  TEAM_REGISTRATION_REMINDER_2H: NotificationDeliveryType.PUSH,
  TEAM_REGISTRATION_REMINDER_24H: NotificationDeliveryType.PUSH,
  REGISTRATION_DEADLINE_CAPTAIN: NotificationDeliveryType.PUSH,
  DOUBLES_TEAM_REGISTERED_PARTNER: NotificationDeliveryType.PUSH,
  
  // League Lifecycle - IN_APP
  REGISTRATION_CONFIRMED: NotificationDeliveryType.IN_APP,
  PAYMENT_CONFIRMED: NotificationDeliveryType.IN_APP,
  MATCHES_REMAINING: NotificationDeliveryType.IN_APP,
  LEAGUE_PERFORMANCE_SUMMARY: NotificationDeliveryType.IN_APP,
  
  // League Lifecycle - PUSH
  DIVISION_REBALANCED: NotificationDeliveryType.PUSH,
  DIVISION_UPDATE_NEW_PLAYER: NotificationDeliveryType.PUSH,
  WINNING_STREAK: NotificationDeliveryType.PUSH,
  LEAGUE_ANNOUNCEMENT: NotificationDeliveryType.PUSH,
  SCHEDULE_MATCH_SOON: NotificationDeliveryType.PUSH,
  EARLY_SEASON_NUDGE: NotificationDeliveryType.PUSH,
  MID_SEASON_UPDATE: NotificationDeliveryType.PUSH,
  LATE_SEASON_NUDGE: NotificationDeliveryType.PUSH,
  INACTIVE_PLAYER_WARNING_7_DAYS: NotificationDeliveryType.PUSH,
  INACTIVITY_DURING_LEAGUE_SEASON_NO_MATCH: NotificationDeliveryType.PUSH,
  INACTIVITY_DURING_LEAGUE_SEASON_2_WEEKS: NotificationDeliveryType.PUSH,
  INACTIVITY_DEADLINE_7_DAYS: NotificationDeliveryType.PUSH,
  INACTIVITY_DEADLINE_3_DAYS: NotificationDeliveryType.PUSH,
  FINAL_WEEK_ALERT: NotificationDeliveryType.PUSH,
  LAST_MATCH_DEADLINE_48H: NotificationDeliveryType.PUSH,
  LEAGUE_ENDED_FINAL_RESULTS: NotificationDeliveryType.PUSH,
  LEAGUE_WINNER: NotificationDeliveryType.PUSH,
  TOP_3_FINISH: NotificationDeliveryType.PUSH,
  LEAGUE_COMPLETE_BANNER: NotificationDeliveryType.PUSH,
  LEAGUE_CANCELLED: NotificationDeliveryType.PUSH,
  LEAGUE_EXTENDED: NotificationDeliveryType.PUSH,
  LEAGUE_SHORTENED: NotificationDeliveryType.PUSH,
  EMERGENCY_LEAGUE_UPDATE: NotificationDeliveryType.PUSH,
  NEW_LEAGUE_ANNOUNCEMENT: NotificationDeliveryType.PUSH,
  NEW_SEASON_ANNOUNCEMENT: NotificationDeliveryType.PUSH,
  REGISTRATION_CLOSING_3_DAYS: NotificationDeliveryType.PUSH,
  REGISTRATION_CLOSING_24_HOURS: NotificationDeliveryType.PUSH,
  LEAGUE_STARTING_3_DAYS: NotificationDeliveryType.PUSH,
  LEAGUE_STARTS_TOMORROW: NotificationDeliveryType.PUSH,
  LEAGUE_STARTED_WELCOME: NotificationDeliveryType.PUSH,
  PAYMENT_FAILED: NotificationDeliveryType.PUSH,
  WITHDRAWAL_APPROVED: NotificationDeliveryType.PUSH,
  REFUND_PROCESSED: NotificationDeliveryType.PUSH,
  
  // Match Management - IN_APP
  FRIENDLY_MATCH_POSTED: NotificationDeliveryType.IN_APP,
  OPPONENT_REPORTED_ISSUE: NotificationDeliveryType.IN_APP,
  
  // Match Management - PUSH
  FRIENDLY_MATCH_JOIN_REQUEST: NotificationDeliveryType.PUSH,
  FRIENDLY_MATCH_PLAYER_JOINED: NotificationDeliveryType.PUSH,
  FRIENDLY_MATCH_REQUEST_ACCEPTED: NotificationDeliveryType.PUSH,
  FRIENDLY_MATCH_REQUEST_DECLINED: NotificationDeliveryType.PUSH,
  FRIENDLY_MATCH_CANCELLED: NotificationDeliveryType.PUSH,
  PLAYER_LEFT_FRIENDLY_MATCH: NotificationDeliveryType.PUSH,
  SCHEDULING_CONFLICT_DETECTED: NotificationDeliveryType.PUSH,
  FRIENDLY_MATCH_DETAILS_CHANGED: NotificationDeliveryType.PUSH,
  MATCH_REMINDER_24H: NotificationDeliveryType.PUSH,
  MATCH_REMINDER_2H: NotificationDeliveryType.PUSH,
  MATCH_RESCHEDULE_REQUEST: NotificationDeliveryType.PUSH,
  MATCH_RESCHEDULE_ACCEPTED: NotificationDeliveryType.PUSH,
  MATCH_RESCHEDULE_DECLINED: NotificationDeliveryType.PUSH,
  MATCH_WALKOVER_WON: NotificationDeliveryType.PUSH,
  MATCH_WALKOVER_LOST: NotificationDeliveryType.PUSH,
  NO_SHOW_STRIKE_WARNING: NotificationDeliveryType.PUSH,
  OPPONENT_CLAIMS_NO_SHOW: NotificationDeliveryType.PUSH,
  HEAD_TO_HEAD_HISTORY: NotificationDeliveryType.PUSH,
  SCORE_SUBMISSION_REMINDER: NotificationDeliveryType.PUSH,
  SCORE_DISPUTE_ALERT: NotificationDeliveryType.PUSH,
  OPPONENT_SUBMITTED_SCORE: NotificationDeliveryType.PUSH,
  PENDING_SCORE_SUBMISSION: NotificationDeliveryType.PUSH,
  PENDING_SCORE_CONFIRMATION: NotificationDeliveryType.PUSH,
  SCORE_AUTO_CONFIRMED: NotificationDeliveryType.PUSH,
  FORFEIT_DISCIPLINARY: NotificationDeliveryType.PUSH,
  
  // Rating & Ranking - PUSH
  MOVED_UP_IN_STANDINGS: NotificationDeliveryType.PUSH,
  ENTERED_TOP_10: NotificationDeliveryType.PUSH,
  ENTERED_TOP_3: NotificationDeliveryType.PUSH,
  LEAGUE_LEADER: NotificationDeliveryType.PUSH,
  WEEKLY_RANKING_UPDATE: NotificationDeliveryType.PUSH,
  DMR_INCREASED: NotificationDeliveryType.PUSH,
  MONTHLY_DMR_RECAP: NotificationDeliveryType.PUSH,
  PERSONAL_BEST_RATING: NotificationDeliveryType.PUSH,
  RATING_MILESTONE: NotificationDeliveryType.PUSH,
  
  // Social & Community - PUSH
  FRIEND_ACTIVITY_SCORECARD: NotificationDeliveryType.PUSH,
  FRIEND_ACTIVITY_POST: NotificationDeliveryType.PUSH,
  SIMILAR_SKILL_PLAYER_NEARBY: NotificationDeliveryType.PUSH,
  SHARE_SCORECARD_PROMPT: NotificationDeliveryType.PUSH,
  FRIEND_REQUEST: NotificationDeliveryType.PUSH,
  NEW_MESSAGE: NotificationDeliveryType.PUSH,
  GROUP_CHAT_ADDED: NotificationDeliveryType.PUSH,
  UNREAD_MESSAGES: NotificationDeliveryType.IN_APP,
  
  // Promotional - PUSH
  NEXT_SEASON_OPENING_SOON: NotificationDeliveryType.PUSH,
  SPONSORED_LEAGUE_ANNOUNCEMENT: NotificationDeliveryType.PUSH,
  REFERRAL_BONUS_AVAILABLE: NotificationDeliveryType.PUSH,
  INACTIVE_PLAYER_14_DAYS: NotificationDeliveryType.PUSH,
  INACTIVE_PLAYER_30_DAYS: NotificationDeliveryType.PUSH,
  LEAGUE_BETWEEN_BREAKS: NotificationDeliveryType.PUSH,
  INCOMPLETE_REGISTRATION: NotificationDeliveryType.PUSH,
  VENUE_SPECIAL_OFFER: NotificationDeliveryType.PUSH,
  
  // Special Circumstances - IN_APP
  DISPUTE_SUBMITTED: NotificationDeliveryType.IN_APP,
  
  // Special Circumstances - PUSH
  DISPUTE_RESOLUTION_REQUIRED: NotificationDeliveryType.PUSH,
  DISPUTE_RESOLVED: NotificationDeliveryType.PUSH,
  CODE_OF_CONDUCT_WARNING: NotificationDeliveryType.PUSH,
  SUSPENSION_NOTICE: NotificationDeliveryType.PUSH,
};

/**
 * Get the delivery type for a notification
 */
export function getNotificationDeliveryType(notificationType: string): NotificationDeliveryType {
  return NOTIFICATION_DELIVERY_MAP[notificationType] || NotificationDeliveryType.IN_APP;
}

/**
 * Check if a notification should be sent as push
 */
export function shouldSendPushNotification(notificationType: string): boolean {
  return getNotificationDeliveryType(notificationType) === NotificationDeliveryType.PUSH;
}

/**
 * Check if a notification should be shown in-app only
 */
export function isInAppOnlyNotification(notificationType: string): boolean {
  return getNotificationDeliveryType(notificationType) === NotificationDeliveryType.IN_APP;
}
