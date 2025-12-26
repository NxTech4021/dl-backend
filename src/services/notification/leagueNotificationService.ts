/**
 * League Notification Service
 * Handles all notifications related to league/season lifecycle
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notifications';
import { divisionNotifications } from '../../helpers/notifications/divisionNotifications';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { MembershipStatus } from '@prisma/client';

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
export async function sendSeasonStartingSoonNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        startDate: true,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season || !season.startDate) return;

    const playerIds = season.memberships.map(m => m.userId);

    if (playerIds.length === 0) return;

    const startingSoonNotif = notificationTemplates.league.seasonStarting3Days(season.name);

    await notificationService.createNotification({
      ...startingSoonNotif,
      userIds: playerIds,
      seasonId,
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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

    if (playerIds.length === 0) return;

    const startsTomorrowNotif = notificationTemplates.league.seasonStartsTomorrow(season.name, season.name);

    await notificationService.createNotification({
      ...startsTomorrowNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('League starts tomorrow notifications sent', { seasonId, playerCount: playerIds.length });
  } catch (error) {
    logger.error('Failed to send league starts tomorrow notifications', { seasonId }, error as Error);
  }
}

/**
 * Send league started welcome notification
 */
export async function sendSeasonStartedWelcomeNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        name: true,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

    if (playerIds.length === 0) return;

    const startedWelcomeNotif = notificationTemplates.league.seasonStartedWelcome(season.name, season.name);

    await notificationService.createNotification({
      ...startedWelcomeNotif,
      userIds: playerIds,
      seasonId,
    });

    logger.info('season started welcome notifications sent', { seasonId, playerCount: playerIds.length });
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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

    const leagueEndedNotif = notificationTemplates.league.leagueEndedFinalResults(season.name);

    await notificationService.createNotification({
      ...leagueEndedNotif,
      userIds: playerIds,
      seasonId,
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
    const [season, memberships] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.seasonMembership.findMany({
        where: {
          seasonId,
          divisionId,
          status: MembershipStatus.ACTIVE,
          userId: { notIn: excludePlayerIds },
        },
        select: { userId: true },
      }),
    ]);

    if (!season || memberships.length === 0) return;

    const playerIds = memberships.map(m => m.userId);

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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

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
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
    });

    if (!season) return;

    const playerIds = season.memberships.map(m => m.userId);

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
    const [season, standings] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.divisionStanding.findMany({
        where: { divisionId },
        orderBy: { totalPoints: 'desc' },
        select: { userId: true },
      }),
    ]);

    if (!season) return;

    // Send to each player with their position
    for (let i = 0; i < standings.length; i++) {
      const position = i + 1;
      const standing = standings[i];
      if (!standing) continue;
      const playerId = standing.userId;

      const midSeasonNotif = notificationTemplates.league.midSeasonUpdate(position, season.name);

      await notificationService.createNotification({
        ...midSeasonNotif,
        userIds: playerId || '',
        seasonId,
        divisionId,
      });
    }

    logger.info('Mid-season update notifications sent', { seasonId, divisionId, playerCount: standings.length });
  } catch (error) {
    logger.error('Failed to send mid-season update notifications', { seasonId, divisionId }, error as Error);
  }
}

/**
 * Notify users about a division reassignment
 */
export async function notifyDivisionReassignment(userId: string, divisionId: string, adminId?: string): Promise<void> {
  try {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { name: true, league: { select: { name: true } } },
    });

    if (!division) {
      throw new Error("Division not found");
    }

    const notification = divisionNotifications.divisionRebalanced(division.name, division.league.name);

    await notificationService.createNotification({
      ...notification,
      userIds: [userId],
      metadata: { divisionId },
    });
  } catch (error) {
    logger.error("Failed to send division reassignment notification", { userId, divisionId } );
  }
}

/**
 * Notify users about a new player in their division
 */
export async function notifyNewPlayerInDivision(userId: string, divisionId: string, newPlayerName: string): Promise<void> {
  try {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { name: true, league: { select: { name: true } } },
    });

    if (!division) {
      throw new Error("Division not found");
    }

    const notification = divisionNotifications.divisionUpdateNewPlayer(division.league.name);

    await notificationService.createNotification({
      ...notification,
      userIds: [userId],
      metadata: { divisionId },
    });
  } catch (error) {
    logger.error("Failed to send new player in division notification", { userId, divisionId, newPlayerName });
  }
}

/**
 * Notify users about a mid-season update
 */
export async function notifyMidSeasonUpdate(userId: string, seasonId: string, position: number): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true, league: { select: { name: true } } },
    });

    if (!season) {
      throw new Error("Season not found");
    }

    const notification = divisionNotifications.midSeasonUpdate(position, season.league.name);

    await notificationService.createNotification({
      ...notification,
      userIds: [userId],
      metadata: { seasonId },
    });
  } catch (error) {
    logger.error("Failed to send mid-season update notification", { userId, seasonId, position });
  }
}

/**
 * Notify users about a late-season nudge
 */
export async function notifyLateSeasonNudge(userId: string, seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true, league: { select: { name: true } } },
    });

    if (!season) {
      throw new Error("Season not found");
    }

    const notification = divisionNotifications.lateSeasonNudge();

    await notificationService.createNotification({
      ...notification,
      userIds: [userId],
      metadata: { seasonId },
    });
  } catch (error) {
    logger.error("Failed to send late-season nudge notification", { userId, seasonId }, error);
  }
}

/**
 * Send registration closing 3 days notifications
 */
export async function sendRegistrationClosing3DaysNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        leagues: {
          select: {
            name: true,
            location: true,
            sportType: true
          }
        }
      }
    });

    if (!season || !season.leagues.length) {
      logger.warn('Season not found or has no leagues', { seasonId });
      return;
    }

    const league = season.leagues[0]; // Use first league
    
    // Check if league data is valid
    if (!league || !league.location || !league.sportType) {
      logger.warn('League missing location or sportType', { seasonId, leagueId: league?.name });
      return;
    }
    
    const leagueName = `${league.location} ${league.sportType} League`;

    const notificationData = notificationTemplates.leagueLifecycle.registrationClosing3Days(
      season.name,
      leagueName
    );

    // Get all users to broadcast to everyone
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const userIds = allUsers.map(u => u.id);

    // Send to all users as this is a general announcement
    await notificationService.createNotification({
      ...notificationData,
      seasonId,
      userIds
    });

    logger.info('Registration closing 3 days notifications sent', { seasonId, seasonName: season.name });
  } catch (error) {
    logger.error('Failed to send registration closing 3 days notifications', { seasonId }, error as Error);
  }
}

/**
 * Send registration closing 24 hours notifications
 */
export async function sendRegistrationClosing24hNotifications(seasonId: string): Promise<void> {
  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        leagues: {
          select: {
            name: true,
            location: true,
            sportType: true
          }
        }
      }
    });

    if (!season || !season.leagues.length) {
      logger.warn('Season not found or has no leagues', { seasonId });
      return;
    }

    const league = season.leagues[0]; // Use first league
    
    // Check if league data is valid
    if (!league || !league.location || !league.sportType) {
      logger.warn('League missing location or sportType', { seasonId, leagueId: league?.name });
      return;
    }
    
    const leagueName = `${league.location} ${league.sportType} League`;

    const notificationData = notificationTemplates.leagueLifecycle.registrationClosing24Hours(
      season.name,
      leagueName
    );

    // Get all users to broadcast to everyone
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const userIds = allUsers.map(u => u.id);

    // Send to all users as this is a general announcement
    await notificationService.createNotification({
      ...notificationData,
      seasonId,
      userIds
    });

    logger.info('Registration closing 24h notifications sent', { seasonId, seasonName: season.name });
  } catch (error) {
    logger.error('Failed to send registration closing 24h notifications', { seasonId }, error as Error);
  }
}
