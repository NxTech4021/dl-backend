/**
 * Inactivity Detection Configuration
 * Defines thresholds and settings for player activity monitoring
 */

export const INACTIVITY_CONFIG = {
  /**
   * Threshold configurations (in days)
   */
  THRESHOLDS: {
    WARNING: 21,           // Send warning notification at 21 days
    INACTIVE: 30,          // Mark as inactive at 30 days
    CRITICAL: 60,          // Future: consider rating decay
  },

  /**
   * Notification settings
   */
  NOTIFICATIONS: {
    REMINDER_FREQUENCY: 7,  // Send reminder every 7 days after warning
    MAX_REMINDERS: 2,       // Max reminders before marking inactive
  },

  /**
   * Exclusion rules
   */
  EXCLUSIONS: {
    NEW_USER_GRACE_PERIOD: 14,  // Don't check users created < 14 days ago
    EXCLUDED_STATUSES: ['SUSPENDED', 'INACTIVE'] as const,  // Skip already-inactive users
  },

  /**
   * Cron job schedule (server time)
   * Default: Daily at 2:00 AM
   */
  CRON_SCHEDULE: process.env.INACTIVITY_CHECK_SCHEDULE || '0 2 * * *',

  /**
   * Environment-based overrides
   */
  get WARNING_THRESHOLD(): number {
    return Number(process.env.INACTIVITY_WARNING_DAYS) || this.THRESHOLDS.WARNING;
  },

  get INACTIVE_THRESHOLD(): number {
    return Number(process.env.INACTIVITY_THRESHOLD_DAYS) || this.THRESHOLDS.INACTIVE;
  },
} as const;

/**
 * Type definitions
 */
export interface InactivityCheckResult {
  total: number;
  warnings: number;
  markedInactive: number;
  errors: number;
  duration: number;
}

export interface PlayerActivityStatus {
  userId: string;
  status: string;
  lastMatchDate: Date | null;
  daysSinceLastMatch: number | null;
  isAtRisk: boolean;
  daysUntilInactive: number | null;
  lastActivityCheck: Date | null;
}
