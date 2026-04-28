/**
 * Onboarding Notification Service
 * Handles all notifications related to user registration and profile setup
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notifications';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Check if profile is incomplete and send reminder
 */
export async function checkAndSendProfileReminders(userId: string): Promise<void> {
  try {
    console.log('📝 [OnboardingNotification] Checking profile completeness for user:', userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        image: true,
        phoneNumber: true,
        playerRatings: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      console.warn('⚠️  [OnboardingNotification] User not found for profile reminder check');
      logger.warn('User not found for profile reminder check', { userId });
      return;
    }

    // Check if questionnaire not completed (no PlayerRating exists)
    if (!user.playerRatings || user.playerRatings.length === 0) {
      console.log('📋 [OnboardingNotification] Sending profile incomplete reminder');
      const profileIncompleteNotif = notificationTemplates.account.profileIncompleteReminder();

      await notificationService.createNotification({
        ...profileIncompleteNotif,
        userIds: userId,
      });

      logger.info('Profile incomplete reminder sent', { userId });
    }

    // Check if profile photo is missing
    if (!user.image) {
      const photoMissingNotif = notificationTemplates.account.profilePhotoMissing();

      await notificationService.createNotification({
        ...photoMissingNotif,
        userIds: userId,
      });

      logger.info('Profile photo missing notification sent', { userId });
    }
  } catch (error) {
    logger.error('Failed to check/send profile reminders', { userId }, error as Error);
  }
}

/**
 * Send profile verification needed notification
 *
 * TODO (TS-029, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
 * `notificationTemplates.account.profileVerificationNeeded` is not
 * implemented and this trigger has zero callers anywhere in the codebase.
 * Function shell preserved (it is re-exported via notificationTriggers.ts).
 * Implement the template (and wire a caller) before re-enabling.
 */
export function sendProfileVerificationNotification(userId: string): Promise<void> {
  logger.info('sendProfileVerificationNotification skipped — template not implemented', { userId });
  return Promise.resolve();
}

/**
 * Send first match completed notification
 *
 * TODO (TS-030, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
 * `notificationTemplates.account.firstMatchCompleted` is not implemented
 * and this trigger has zero callers anywhere in the codebase. Function
 * shell preserved (it is re-exported via notificationTriggers.ts).
 * Implement the template (and wire a caller) before re-enabling.
 */
export function sendFirstMatchCompletedNotification(userId: string): Promise<void> {
  logger.info('sendFirstMatchCompletedNotification skipped — template not implemented', { userId });
  return Promise.resolve();
}

/**
 * Check and send matches played milestone notification
 *
 * TODO (TS-031, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
 * `notificationTemplates.account.matchesPlayedMilestone` is intentionally
 * commented out in accountNotifications.ts (with the body preserved) and
 * this trigger has zero callers anywhere in the codebase. Function shell
 * preserved (it is re-exported via notificationTriggers.ts). Uncomment
 * the template (and wire a caller) before re-enabling.
 */
export function checkMatchesMilestone(userId: string): Promise<void> {
  logger.info('checkMatchesMilestone skipped — template not implemented', { userId });
  return Promise.resolve();
}

/**
 * Send first league completed notification
 *
 * TODO (TS-032, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
 * `notificationTemplates.account.firstLeagueCompleted` is intentionally
 * commented out in accountNotifications.ts (with the body preserved) and
 * this trigger has zero callers anywhere in the codebase. Function shell
 * preserved (it is re-exported via notificationTriggers.ts). Uncomment
 * the template (and wire a caller) before re-enabling.
 */
export function sendFirstLeagueCompletedNotification(
  userId: string,
  seasonName: string
): Promise<void> {
  logger.info('sendFirstLeagueCompletedNotification skipped — template not implemented', { userId, seasonName });
  return Promise.resolve();
}

/**
 * Check and send leagues completed milestone notification
 *
 * TODO (TS-033, docs/issues/backlog/tsc-baseline-errors-2026-04-27.md):
 * `notificationTemplates.account.leaguesCompletedMilestone` is intentionally
 * commented out in accountNotifications.ts (with the body preserved) and
 * this trigger has zero callers anywhere in the codebase. Function shell
 * preserved (it is re-exported via notificationTriggers.ts). Uncomment
 * the template (and wire a caller) before re-enabling.
 */
export function checkLeaguesMilestone(userId: string): Promise<void> {
  logger.info('checkLeaguesMilestone skipped — template not implemented', { userId });
  return Promise.resolve();
}

/**
 * Initialize onboarding flow for new user
 * This should be called after user registration
 */
export async function initializeUserOnboarding(userId: string): Promise<void> {
  try {
    // Wait a bit before checking profile completeness
    // In production, this could be a scheduled job
    setTimeout(async () => {
      await checkAndSendProfileReminders(userId);
    }, 5000); // 5 seconds delay

    logger.info('User onboarding initialized', { userId });
  } catch (error) {
    logger.error('Failed to initialize user onboarding', { userId }, error as Error);
  }
}
