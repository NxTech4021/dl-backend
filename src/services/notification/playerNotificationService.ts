/**
 * Player Notification Service
 * Handles player-facing notifications for matches, ratings, and season events
 */

import { NotificationService } from '../notificationService';
import { filterUsersByPreference } from './notificationPreferenceService';
import { NOTIFICATION_TYPES } from '../../types/notificationTypes';
import { logger } from '../../utils/logger';

/**
 * Notify player about opponent change
 */
export async function notifyOpponentChange(
  notificationService: NotificationService,
  data: {
    userId: string;
    oldOpponentName: string;
    newOpponentName: string;
    matchDate: string;
    matchTime: string;
    location?: string;
    matchId: string;
  }
): Promise<void> {
  try {
    // Check if user has this preference enabled
    const recipients = await filterUsersByPreference([data.userId], 'opponentChange');

    if (recipients.length === 0) {
      logger.debug('User has opponent change notifications disabled', { userId: data.userId });
      return;
    }

    const locationInfo = data.location ? ` at ${data.location}` : '';

    await notificationService.createNotification({
      userIds: data.userId,
      type: NOTIFICATION_TYPES.OPPONENT_CHANGED,
      category: 'MATCH',
      title: 'Opponent Changed',
      message: `Your opponent has changed from ${data.oldOpponentName} to ${data.newOpponentName} for your match on ${data.matchDate} at ${data.matchTime}${locationInfo}.`,
      matchId: data.matchId
    });

    logger.info('Opponent change notification sent', { userId: data.userId, matchId: data.matchId });
  } catch (error) {
    logger.error('Failed to send opponent change notification', { userId: data.userId }, error as Error);
  }
}

/**
 * Notify player about partner change (doubles)
 */
export async function notifyPartnerChange(
  notificationService: NotificationService,
  data: {
    userId: string;
    oldPartnerName: string;
    newPartnerName: string;
    matchDate: string;
    matchTime: string;
    location?: string;
    matchId: string;
  }
): Promise<void> {
  try {
    // Check if user has this preference enabled
    const recipients = await filterUsersByPreference([data.userId], 'partnerChange');

    if (recipients.length === 0) {
      logger.debug('User has partner change notifications disabled', { userId: data.userId });
      return;
    }

    const locationInfo = data.location ? ` at ${data.location}` : '';

    await notificationService.createNotification({
      userIds: data.userId,
      type: NOTIFICATION_TYPES.PARTNER_CHANGED,
      category: 'MATCH',
      title: 'Partner Changed',
      message: `Your doubles partner has changed from ${data.oldPartnerName} to ${data.newPartnerName} for your match on ${data.matchDate} at ${data.matchTime}${locationInfo}.`,
      matchId: data.matchId
    });

    logger.info('Partner change notification sent', { userId: data.userId, matchId: data.matchId });
  } catch (error) {
    logger.error('Failed to send partner change notification', { userId: data.userId }, error as Error);
  }
}

/**
 * Notify player about rating change after match
 */
export async function notifyRatingChange(
  notificationService: NotificationService,
  data: {
    userId: string;
    oldRating: number;
    newRating: number;
    matchId?: string;
    reason?: string;
  }
): Promise<void> {
  try {
    // Check if user has this preference enabled
    const recipients = await filterUsersByPreference([data.userId], 'ratingChange');

    if (recipients.length === 0) {
      logger.debug('User has rating change notifications disabled', { userId: data.userId });
      return;
    }

    const change = data.newRating - data.oldRating;
    const changeStr = change >= 0 ? `+${change}` : `${change}`;
    const reasonStr = data.reason ? ` ${data.reason}` : '';

    await notificationService.createNotification({
      userIds: data.userId,
      type: NOTIFICATION_TYPES.RATING_UPDATE,
      category: 'GENERAL',
      title: 'Rating Updated',
      message: `Your rating changed from ${data.oldRating} to ${data.newRating} (${changeStr}).${reasonStr}`,
      matchId: data.matchId
    });

    logger.info('Rating change notification sent', {
      userId: data.userId,
      oldRating: data.oldRating,
      newRating: data.newRating
    });
  } catch (error) {
    logger.error('Failed to send rating change notification', { userId: data.userId }, error as Error);
  }
}

/**
 * Notify all players when season registration opens
 */
export async function notifySeasonRegistrationOpen(
  notificationService: NotificationService,
  data: {
    seasonName: string;
    seasonId: string;
    startDate: string;
    registrationDeadline: string;
  }
): Promise<void> {
  try {
    // Get all active players
    const { prisma } = await import('../../lib/prisma');
    const activePlayers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: 'USER'
      },
      select: { id: true }
    });

    const playerIds = activePlayers.map(p => p.id);

    // Filter by preference
    const recipients = await filterUsersByPreference(playerIds, 'seasonRegistration');

    if (recipients.length === 0) {
      logger.debug('No players with season registration notifications enabled');
      return;
    }

    await notificationService.createNotification({
      userIds: recipients,
      type: NOTIFICATION_TYPES.SEASON_REGISTRATION_OPEN,
      category: 'SEASON',
      title: 'Season Registration Open',
      message: `Registration is now open for ${data.seasonName}! Season starts ${data.startDate}. Register by ${data.registrationDeadline}.`,
      seasonId: data.seasonId
    });

    logger.info('Season registration open notification sent', {
      seasonId: data.seasonId,
      recipientCount: recipients.length
    });
  } catch (error) {
    logger.error('Failed to send season registration notification', {}, error as Error);
  }
}

/**
 * Notify multiple players about rating changes (batch for match results)
 */
export async function notifyBatchRatingChanges(
  notificationService: NotificationService,
  changes: Array<{
    userId: string;
    oldRating: number;
    newRating: number;
    matchId: string;
  }>
): Promise<void> {
  for (const change of changes) {
    await notifyRatingChange(notificationService, {
      userId: change.userId,
      oldRating: change.oldRating,
      newRating: change.newRating,
      matchId: change.matchId,
      reason: 'Match result recorded.'
    });
  }
}
