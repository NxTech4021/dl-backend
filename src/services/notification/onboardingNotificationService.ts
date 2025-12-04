/**
 * Onboarding Notification Service
 * Handles all notifications related to user registration and profile setup
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notification';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { MatchStatus, SeasonStatus } from '@prisma/client';

/**
 * Send welcome notification to new user
 */
export async function sendWelcomeNotification(userId: string): Promise<void> {
  try {
    const welcomeNotif = notificationTemplates.account.welcomeToDeuce();

    await notificationService.createNotification({
      ...welcomeNotif,
      userIds: userId,
    });

    logger.info('Welcome notification sent', { userId });
  } catch (error) {
    logger.error('Failed to send welcome notification', { userId }, error as Error);
  }
}

/**
 * Check if profile is incomplete and send reminder
 */
export async function checkAndSendProfileReminders(userId: string): Promise<void> {
  try {
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
      logger.warn('User not found for profile reminder check', { userId });
      return;
    }

    // Check if questionnaire not completed (no PlayerRating exists)
    if (!user.playerRatings || user.playerRatings.length === 0) {
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
 */
export async function sendProfileVerificationNotification(userId: string): Promise<void> {
  try {
    const verificationNotif = notificationTemplates.account.profileVerificationNeeded();

    await notificationService.createNotification({
      ...verificationNotif,
      userIds: userId,
    });

    logger.info('Profile verification notification sent', { userId });
  } catch (error) {
    logger.error('Failed to send profile verification notification', { userId }, error as Error);
  }
}

/**
 * Send first match completed notification
 */
export async function sendFirstMatchCompletedNotification(userId: string): Promise<void> {
  try {
    // Check if this is actually the first match
    const matchCount = await prisma.match.count({
      where: {
        participants: {
          some: { userId: userId },
        },
        status: MatchStatus.COMPLETED,
      },
    });

    // Only send if this is the first match
    if (matchCount === 1) {
      const firstMatchNotif = notificationTemplates.account.firstMatchCompleted();

      await notificationService.createNotification({
        ...firstMatchNotif,
        userIds: userId,
      });

      logger.info('First match completed notification sent', { userId });
    }
  } catch (error) {
    logger.error('Failed to send first match completed notification', { userId }, error as Error);
  }
}

/**
 * Check and send matches played milestone notification
 */
export async function checkMatchesMilestone(userId: string): Promise<void> {
  try {
    const matchCount = await prisma.match.count({
      where: {
        participants: {
          some: { userId: userId },
        },
        status: MatchStatus.COMPLETED,
      },
    });

    // Milestone thresholds: 5, 10, 25, 50, 100
    const milestones = [5, 10, 25, 50, 100];

    if (milestones.includes(matchCount)) {
      const milestoneNotif = notificationTemplates.account.matchesPlayedMilestone(matchCount);

      await notificationService.createNotification({
        ...milestoneNotif,
        userIds: userId,
      });

      logger.info('Matches played milestone notification sent', { userId, matchCount });
    }
  } catch (error) {
    logger.error('Failed to check matches milestone', { userId }, error as Error);
  }
}

/**
 * Send first league completed notification
 */
export async function sendFirstLeagueCompletedNotification(
  userId: string,
  seasonName: string
): Promise<void> {
  try {
    // Check if this is the first completed league
    const completedSeasons = await prisma.seasonMembership.count({
      where: {
        userId: userId,
        season: {
          status: SeasonStatus.FINISHED,
        },
      },
    });

    // Only send if this is the first completed league
    if (completedSeasons === 1) {
      const firstLeagueNotif = notificationTemplates.account.firstLeagueCompleted(seasonName);

      await notificationService.createNotification({
        ...firstLeagueNotif,
        userIds: userId,
        seasonId: undefined, // We don't have seasonId here, but could pass it
      });

      logger.info('First league completed notification sent', { userId, seasonName });
    }
  } catch (error) {
    logger.error('Failed to send first league completed notification', { userId }, error as Error);
  }
}

/**
 * Check and send leagues completed milestone notification
 */
export async function checkLeaguesMilestone(userId: string): Promise<void> {
  try {
    const completedSeasons = await prisma.seasonMembership.count({
      where: {
        userId: userId,
        season: {
          status: SeasonStatus.FINISHED,
        },
      },
    });

    // Milestone: 3 leagues completed
    if (completedSeasons === 3) {
      const milestoneNotif = notificationTemplates.account.leaguesCompletedMilestone(3);

      await notificationService.createNotification({
        ...milestoneNotif,
        userIds: userId,
      });

      logger.info('Leagues completed milestone notification sent', { userId, count: 3 });
    }
  } catch (error) {
    logger.error('Failed to check leagues milestone', { userId }, error as Error);
  }
}

/**
 * Initialize onboarding flow for new user
 * This should be called after user registration
 */
export async function initializeUserOnboarding(userId: string): Promise<void> {
  try {
    // Send welcome notification immediately
    await sendWelcomeNotification(userId);

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
