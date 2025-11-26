/**
 * League Notification Service
 * Handles all notifications related to league/season lifecycle
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notification';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Send season registration confirmed notification
 */
export async function sendSeasonRegistrationConfirmed(
  userId: string,
  seasonId: string
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true },
    });

    if (!season) return;

    const confirmationNotif = notificationTemplates.season.registrationConfirmed(
      season.name,
      'Entry fee confirmed' // Amount would come from payment
    );

    await notificationService.createNotification({
      ...confirmationNotif,
      userIds: userId,
      seasonId,
    });

    logger.info('Season registration confirmed notification sent', { userId, seasonId });
  } catch (error) {
    logger.error('Failed to send season registration confirmed', { userId, seasonId }, error as Error);
  }
}

/**
 * Send league starting soon notification (3 days before)
 */
export async function sendLeagueStartingSoonNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        startDate: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season || !season.startDate) return;

    const playerIds = season.registrations.map(r => r.playerId);

    if (playerIds.length === 0) return;

    await notificationService.createNotification({
      type: 'LEAGUE_STARTING_3_DAYS',
      category: 'SEASON',
      title: 'League Starts Soon',
      message: `${season.name} starts in 3 days! Get ready to compete`,
      userIds: playerIds,
      seasonId,
      metadata: { seasonName: season.name, startDate: season.startDate.toISOString() },
    });

    logger.info('League starting soon notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league starting soon notifications', { seasonId }, error as Error);
  }
}

/**
 * Send league starts tomorrow notification
 */
export async function sendLeagueStartsTomorrowNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    if (playerIds.length === 0) return;

    await notificationService.createNotification({
      type: 'LEAGUE_STARTS_TOMORROW',
      category: 'SEASON',
      title: 'League Starts Tomorrow',
      message: `${season.name} starts tomorrow! Get ready for matches`,
      userIds: playerIds,
      seasonId,
      metadata: { seasonName: season.name },
    });

    logger.info('League starts tomorrow notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league starts tomorrow notifications', { seasonId }, error as Error);
  }
}

/**
 * Send league started welcome notification
 */
export async function sendLeagueStartedWelcomeNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    if (playerIds.length === 0) return;

    await notificationService.createNotification({
      type: 'LEAGUE_STARTED_WELCOME',
      category: 'SEASON',
      title: 'Season Commences!',
      message: `${season.name} has begun! View your division and schedule your first game`,
      userIds: playerIds,
      seasonId,
      metadata: { seasonName: season.name },
    });

    logger.info('League started welcome notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league started welcome notifications', { seasonId }, error as Error);
  }
}

/**
 * Send final week alert
 */
export async function sendFinalWeekAlertNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    const finalWeekNotif = notificationTemplates.league.finalWeekAlert(season.name);

    await notificationService.createNotification({
      ...finalWeekNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('Final week alert sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send final week alert', { seasonId }, error as Error);
  }
}

/**
 * Send league ended notifications
 */
export async function sendLeagueEndedNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    await notificationService.createNotification({
      type: 'SEASON_ENDED',
      category: 'SEASON',
      title: 'Season Complete',
      message: `Thank you for being part of ${season.name}. Final results will be available once all scores are confirmed`,
      userIds: playerIds,
      seasonId,
      metadata: { seasonName: season.name },
    });

    logger.info('League ended notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league ended notifications', { seasonId }, error as Error);
  }
}

/**
 * Send league winner announcement
 */
export async function sendLeagueWinnerAnnouncement(
  userId: string,
  seasonId: string,
  divisionId: string
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true },
    });

    if (!season) return;

    const winnerNotif = notificationTemplates.league.leagueWinner(season.name);

    await notificationService.createNotification({
      ...winnerNotif,
      userIds: userId,
      seasonId,
      divisionId,
    });

    logger.info('League winner announcement sent', { userId, seasonId });
  } catch (error) {
    logger.error('Failed to send league winner announcement', { userId, seasonId }, error as Error);
  }
}

/**
 * Send top 3 finish notification
 */
export async function sendTop3FinishNotification(
  userId: string,
  position: number,
  seasonId: string,
  divisionId: string
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true },
    });

    if (!season) return;

    const top3Notif = notificationTemplates.league.top3Finish(position, season.name);

    await notificationService.createNotification({
      ...top3Notif,
      userIds: userId,
      seasonId,
      divisionId,
    });

    logger.info('Top 3 finish notification sent', { userId, position, seasonId });
  } catch (error) {
    logger.error('Failed to send top 3 finish notification', { userId, seasonId }, error as Error);
  }
}

/**
 * Send league complete banner to all non-top-3 players
 */
export async function sendLeagueCompleteBannerNotifications(
  seasonId: string,
  divisionId: string,
  excludePlayerIds: string[]
): Promise<void> {
  try {
    const [season, registrations] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.registration.findMany({
        where: {
          seasonId,
          divisionId,
          playerId: { notIn: excludePlayerIds },
        },
        select: { playerId: true },
      }),
    ]);

    if (!season || registrations.length === 0) return;

    const playerIds = registrations.map(r => r.playerId);

    const completeBannerNotif = notificationTemplates.league.leagueCompleteBanner(season.name);

    await notificationService.createNotification({
      ...completeBannerNotif,
      userIds: playerIds,
      seasonId,
      divisionId,
    });

    logger.info('League complete banner sent', { seasonId, divisionId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league complete banner', { seasonId, divisionId }, error as Error);
  }
}

/**
 * Send league extended notification
 */
export async function sendLeagueExtendedNotifications(
  seasonId: string,
  weeksExtended: number,
  newEndDate: Date
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    const extendedNotif = notificationTemplates.league.leagueExtended(
      season.name,
      weeksExtended,
      newEndDate.toLocaleDateString()
    );

    await notificationService.createNotification({
      ...extendedNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('League extended notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league extended notifications', { seasonId }, error as Error);
  }
}

/**
 * Send league shortened notification
 */
export async function sendLeagueShortenedNotifications(
  seasonId: string,
  newEndDate: Date
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    const shortenedNotif = notificationTemplates.league.leagueShortened(
      season.name,
      newEndDate.toLocaleDateString()
    );

    await notificationService.createNotification({
      ...shortenedNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('League shortened notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league shortened notifications', { seasonId }, error as Error);
  }
}

/**
 * Send emergency league update
 */
export async function sendEmergencyLeagueUpdate(
  seasonId: string,
  message: string
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        registrations: {
          select: { playerId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.registrations.map(r => r.playerId);

    const emergencyNotif = notificationTemplates.league.emergencyLeagueUpdate(message);

    await notificationService.createNotification({
      ...emergencyNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('Emergency league update sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send emergency league update', { seasonId }, error as Error);
  }
}

/**
 * Send refund processed notification
 */
export async function sendRefundProcessedNotification(
  userId: string,
  amount: string,
  seasonId: string
): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true },
    });

    if (!season) return;

    const refundNotif = notificationTemplates.league.refundProcessed(amount, season.name);

    await notificationService.createNotification({
      ...refundNotif,
      userIds: userId,
      seasonId,
    });

    logger.info('Refund processed notification sent', { userId, amount, seasonId });
  } catch (error) {
    logger.error('Failed to send refund processed notification', { userId, seasonId }, error as Error);
  }
}

/**
 * Send mid-season update to all players
 */
export async function sendMidSeasonUpdateNotifications(
  seasonId: string,
  divisionId: string
): Promise<void> {
  try {
    const [season, leaderboard] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.leaderboard.findMany({
        where: { divisionId },
        orderBy: { totalPoints: 'desc' },
        select: {
          registration: {
            select: { playerId: true },
          },
        },
      }),
    ]);

    if (!season) return;

    // Send to each player with their position
    for (let i = 0; i < leaderboard.length; i++) {
      const position = i + 1;
      const playerId = leaderboard[i].registration.playerId;

      const midSeasonNotif = notificationTemplates.league.midSeasonUpdate(position, season.name);

      await notificationService.createNotification({
        ...midSeasonNotif,
        userIds: playerId,
        seasonId,
        divisionId,
      });
    }

    logger.info('Mid-season update notifications sent', { seasonId, divisionId, playerCount: leaderboard.length });
  } catch (error) {
    logger.error('Failed to send mid-season update notifications', { seasonId, divisionId }, error as Error);
  }
}
