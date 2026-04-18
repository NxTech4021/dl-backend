/**
 * Player Notification Service
 * Handles player-facing notifications for matches, ratings, and season events
 */

import { NotificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notifications';
import { filterUsersByPreference } from './notificationPreferenceService';
import { NOTIFICATION_TYPES } from '../../types/notificationTypes';
import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { accountNotifications } from '../../helpers/notifications/accountNotifications';
import { notificationService as defaultNotificationService } from '../notificationService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { MALAYSIA_TIMEZONE } from '../../utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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

    const opponentChangeNotif = notificationTemplates.match.opponentChanged(
      data.oldOpponentName,
      data.newOpponentName,
      data.matchDate,
      data.matchTime,
      data.location || 'TBD'
    );

    await notificationService.createNotification({
      ...opponentChangeNotif,
      userIds: data.userId,
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

    // partnerChanged removed — not used
    // const partnerChangeNotif = notificationTemplates.doubles.partnerChanged(...);
    // await notificationService.createNotification({ ...partnerChangeNotif, userIds: data.userId, matchId: data.matchId });

    logger.info('Partner change notification skipped (function removed)', { userId: data.userId, matchId: data.matchId });
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

    const ratingChangeNotif = notificationTemplates.rating.ratingUpdate(
      data.oldRating,
      data.newRating,
      changeStr
    );

    await notificationService.createNotification({
      ...ratingChangeNotif,
      userIds: data.userId,
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

    const registrationNotif = notificationTemplates.league.newSeasonAnnouncement(
      data.seasonName,
      'Location TBD', // location - would need to be passed in data
      'Tennis' // sport - would need to be passed in data
    );

    await notificationService.createNotification({
      ...registrationNotif,
      userIds: recipients,
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

// ─── Weekly Streak Helpers (mirrors profileService.ts) ───────────────────────

function getWeekStartKey(utcDate: Date): string {
  const d = dayjs(utcDate).tz(MALAYSIA_TIMEZONE);
  const day = d.day(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return d.subtract(daysFromMonday, 'day').startOf('day').format('YYYY-MM-DD');
}

function getPrevWeekKey(weekKey: string): string {
  return dayjs.tz(weekKey, MALAYSIA_TIMEZONE).subtract(7, 'day').format('YYYY-MM-DD');
}

async function getUserWeeklyStreak(userId: string): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      participants: { some: { userId } },
      status: 'COMPLETED',
    },
    select: { matchDate: true },
  });

  if (matches.length === 0) return 0;

  const playedWeeks = new Set<string>();
  for (const { matchDate } of matches) {
    if (matchDate) playedWeeks.add(getWeekStartKey(matchDate));
  }

  const nowKey = getWeekStartKey(new Date());
  let startKey = nowKey;
  if (!playedWeeks.has(startKey)) {
    startKey = getPrevWeekKey(nowKey);
    if (!playedWeeks.has(startKey)) return 0;
  }

  let streak = 0;
  let cursor = startKey;
  while (playedWeeks.has(cursor)) {
    streak++;
    cursor = getPrevWeekKey(cursor);
  }
  return streak;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOTIF-014: Check whether a user has reached a new weekly streak milestone
 * (2+ consecutive weeks with ≥1 completed match) and send an in-app notification.
 *
 * Must be called fire-and-forget after a match is confirmed COMPLETED.
 * Uses a 7-day dedup window so the same streak count is only celebrated once.
 */
export async function checkAndSendWeeklyStreakNotification(
  userId: string,
  matchId: string
): Promise<void> {
  try {
    const streak = await getUserWeeklyStreak(userId);

    // Only celebrate when the player has maintained the streak for at least 2 weeks
    if (streak < 2) return;

    await defaultNotificationService.createNotification({
      ...accountNotifications.newWeeklyStreak(streak),
      userIds: userId,
      matchId,
      // Deduplicate within a week — one celebration per streak increment
      skipDuplicateWithinMs: 6 * 24 * 60 * 60 * 1000,
    });

    logger.info('NOTIF-014: Weekly streak notification sent', { userId, streak, matchId });
  } catch (error) {
    logger.error('NOTIF-014: Failed to send weekly streak notification', { userId }, error as Error);
  }
}
