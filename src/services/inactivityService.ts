/**
 * Inactivity Detection Service
 * Monitors player activity and manages status changes
 */

import { prisma } from '../lib/prisma';
import { UserStatus } from '@prisma/client';
import { NotificationService } from './notificationService';
import {
  INACTIVITY_CONFIG,
  InactivityCheckResult,
  PlayerActivityStatus
} from '../config/inactivity.config';
import { getEffectiveThreshold } from './admin/adminInactivityService';
import { logger } from '../utils/logger';

export class InactivityService {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Main function: Check all players and update statuses
   * Called by cron job daily
   */
  async checkAndUpdateInactivity(): Promise<InactivityCheckResult> {
    const startTime = Date.now();
    logger.info('🕒 Starting inactivity check...');

    const results: InactivityCheckResult = {
      total: 0,
      warnings: 0,
      markedInactive: 0,
      errors: 0,
      duration: 0,
    };

    try {
      // Get thresholds from database or defaults
      const thresholds = await getEffectiveThreshold();
      logger.info(`Using thresholds: inactive=${thresholds.inactivityDays}, warning=${thresholds.warningDays}`);

      // Get all eligible users
      const users = await this.getEligibleUsers();
      results.total = users.length;

      logger.info(`Found ${users.length} eligible users to check`);

      // Process each user
      for (const user of users) {
        try {
          await this.processUserWithThresholds(user.id, user.createdAt, thresholds, results);
        } catch (error) {
          logger.error(`Error processing user ${user.id}:`, {}, error as Error);
          results.errors++;
        }
      }

      results.duration = Date.now() - startTime;
      logger.info('✅ Inactivity check complete:', {
        total: results.total,
        warnings: results.warnings,
        markedInactive: results.markedInactive,
        errors: results.errors,
        duration: results.duration
      });

      return results;
    } catch (error) {
      logger.error('Fatal error in inactivity check:', {}, error as Error);
      throw error;
    }
  }

  /**
   * Process individual user with custom thresholds
   */
  private async processUserWithThresholds(
    userId: string,
    createdAt: Date,
    thresholds: { inactivityDays: number; warningDays: number },
    results: InactivityCheckResult
  ): Promise<void> {
    // Get days since last match
    const daysSinceLastMatch = await this.getDaysSinceLastMatch(userId);

    // Handle users who have never played
    if (daysSinceLastMatch === null) {
      // Only mark as inactive if user has been registered long enough
      const daysSinceRegistration = this.calculateDaysSince(createdAt);

      if (daysSinceRegistration >= thresholds.inactivityDays) {
        await this.markAsInactive(userId, 'Never played a match');
        results.markedInactive++;
      }
      return;
    }

    // Check thresholds
    if (daysSinceLastMatch >= thresholds.inactivityDays) {
      await this.markAsInactive(userId, `${daysSinceLastMatch} days since last match`);
      results.markedInactive++;
    } else if (daysSinceLastMatch >= thresholds.warningDays) {
      await this.sendWarningNotificationWithThreshold(userId, daysSinceLastMatch, thresholds.inactivityDays);
      results.warnings++;
    }
  }

  /**
   * Process individual user
   */
  private async processUser(
    userId: string,
    createdAt: Date,
    results: InactivityCheckResult
  ): Promise<void> {
    // Get days since last match
    const daysSinceLastMatch = await this.getDaysSinceLastMatch(userId);

    // Handle users who have never played
    if (daysSinceLastMatch === null) {
      // Only mark as inactive if user has been registered long enough
      const daysSinceRegistration = this.calculateDaysSince(createdAt);

      if (daysSinceRegistration >= INACTIVITY_CONFIG.INACTIVE_THRESHOLD) {
        await this.markAsInactive(userId, 'Never played a match');
        results.markedInactive++;
      }
      return;
    }

    // Check thresholds
    if (daysSinceLastMatch >= INACTIVITY_CONFIG.INACTIVE_THRESHOLD) {
      await this.markAsInactive(userId, `${daysSinceLastMatch} days since last match`);
      results.markedInactive++;
    } else if (daysSinceLastMatch >= INACTIVITY_CONFIG.WARNING_THRESHOLD) {
      await this.sendWarningNotification(userId, daysSinceLastMatch);
      results.warnings++;
    }
  }

  /**
   * Get users eligible for inactivity check
   */
  private async getEligibleUsers() {
    const gracePeriodDate = new Date();
    gracePeriodDate.setDate(
      gracePeriodDate.getDate() - INACTIVITY_CONFIG.EXCLUSIONS.NEW_USER_GRACE_PERIOD
    );

    return prisma.user.findMany({
      where: {
        role: 'USER',
        status: {
          notIn: INACTIVITY_CONFIG.EXCLUSIONS.EXCLUDED_STATUSES as any,
        },
        completedOnboarding: true,
        createdAt: {
          lte: gracePeriodDate, // Only check users older than grace period
        },
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
      },
    });
  }

  /**
   * Calculate days since last match
   */
  async getDaysSinceLastMatch(userId: string): Promise<number | null> {
    const lastMatch = await prisma.match.findFirst({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { matchDate: 'desc' },
      select: { matchDate: true },
    });

    if (!lastMatch) return null;

    return this.calculateDaysSince(lastMatch.matchDate);
  }

  /**
   * Helper: Calculate days since a date
   */
  private calculateDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Mark user as inactive
   */
  private async markAsInactive(userId: string, reason: string): Promise<void> {
    logger.info(`Marking user ${userId} as inactive: ${reason}`);

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.INACTIVE,
        lastActivityCheck: new Date(),
      },
    });

    // Send status change notification
    await this.notificationService.createNotification({
      userIds: userId,
      type: 'STATUS_CHANGED_TO_INACTIVE',
      category: 'GENERAL',
      title: 'Account Status Changed',
      message: 'Your account has been marked inactive due to not playing matches. Play a match to reactivate!',
      metadata: {
        newStatus: 'INACTIVE',
        reason,
      },
    });
  }

  /**
   * Send warning notification
   */
  private async sendWarningNotification(
    userId: string,
    daysSinceLastMatch: number
  ): Promise<void> {
    const daysRemaining = INACTIVITY_CONFIG.INACTIVE_THRESHOLD - daysSinceLastMatch;

    logger.info(`Sending warning to user ${userId}: ${daysSinceLastMatch} days since last match`);

    await this.notificationService.createNotification({
      userIds: userId,
      type: 'INACTIVITY_WARNING',
      category: 'GENERAL',
      title: 'Inactivity Warning',
      message: `It's been ${daysSinceLastMatch} days since your last match. Play within ${daysRemaining} days to stay active!`,
      metadata: {
        daysSinceLastMatch,
        daysRemaining,
        threshold: INACTIVITY_CONFIG.INACTIVE_THRESHOLD,
      },
    });

    // Update last activity check
    await prisma.user.update({
      where: { id: userId },
      data: { lastActivityCheck: new Date() },
    });
  }

  /**
   * Send warning notification with custom threshold
   */
  private async sendWarningNotificationWithThreshold(
    userId: string,
    daysSinceLastMatch: number,
    inactivityThreshold: number
  ): Promise<void> {
    const daysRemaining = inactivityThreshold - daysSinceLastMatch;

    logger.info(`Sending warning to user ${userId}: ${daysSinceLastMatch} days since last match`);

    await this.notificationService.createNotification({
      userIds: userId,
      type: 'INACTIVITY_WARNING',
      category: 'GENERAL',
      title: 'Inactivity Warning',
      message: `It's been ${daysSinceLastMatch} days since your last match. Play within ${daysRemaining} days to stay active!`,
      metadata: {
        daysSinceLastMatch,
        daysRemaining,
        threshold: inactivityThreshold,
      },
    });

    // Update last activity check
    await prisma.user.update({
      where: { id: userId },
      data: { lastActivityCheck: new Date() },
    });
  }

  /**
   * Reactivate user when they play a match
   * Called after match creation
   */
  async reactivateUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, name: true },
    });

    if (!user) return;

    if (user.status === UserStatus.INACTIVE) {
      logger.info(`Reactivating user ${userId} (${user.name})`);

      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          lastActivityCheck: new Date(),
        },
      });

      // Send welcome back notification
      await this.notificationService.createNotification({
        userIds: userId,
        type: 'REACTIVATED',
        category: 'GENERAL',
        title: 'Welcome Back!',
        message: 'Your account has been reactivated. Keep playing to maintain your rating!',
        metadata: { previousStatus: 'INACTIVE' },
      });
    }
  }

  /**
   * Get activity status for a specific player
   * Used by API endpoint
   */
  async getPlayerActivityStatus(userId: string): Promise<PlayerActivityStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        lastActivityCheck: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const lastMatch = await prisma.match.findFirst({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { matchDate: 'desc' },
      select: { matchDate: true },
    });

    const lastMatchDate = lastMatch?.matchDate || null;
    const daysSinceLastMatch = lastMatchDate
      ? this.calculateDaysSince(lastMatchDate)
      : null;

    const isAtRisk = daysSinceLastMatch !== null
      && daysSinceLastMatch >= INACTIVITY_CONFIG.WARNING_THRESHOLD;

    const daysUntilInactive = daysSinceLastMatch !== null
      ? Math.max(0, INACTIVITY_CONFIG.INACTIVE_THRESHOLD - daysSinceLastMatch)
      : null;

    return {
      userId,
      status: user.status,
      lastMatchDate,
      daysSinceLastMatch,
      isAtRisk,
      daysUntilInactive,
      lastActivityCheck: user.lastActivityCheck,
    };
  }
}

// Export singleton instance
let inactivityServiceInstance: InactivityService | null = null;

export function getInactivityService(notificationService: NotificationService): InactivityService {
  if (!inactivityServiceInstance) {
    inactivityServiceInstance = new InactivityService(notificationService);
  }
  return inactivityServiceInstance;
}
