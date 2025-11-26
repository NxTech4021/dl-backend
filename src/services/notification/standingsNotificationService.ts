/**
 * Standings & Rating Notification Service
 * Handles all notifications related to standings changes and rating updates
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notification';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Check standings changes and send appropriate notifications
 * This should be called after leaderboard updates
 */
export async function checkAndSendStandingsNotifications(
  divisionId: string,
  seasonId: string
): Promise<void> {
  try {
    const [season, division, leaderboard] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.division.findUnique({
        where: { id: divisionId },
        select: { name: true },
      }),
      prisma.leaderboard.findMany({
        where: { divisionId },
        orderBy: { totalPoints: 'desc' },
        select: {
          id: true,
          totalPoints: true,
          registration: {
            select: {
              playerId: true,
              player: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    if (!season || !division || leaderboard.length === 0) return;

    // Check for each player's position
    for (let i = 0; i < leaderboard.length; i++) {
      const position = i + 1;
      const entry = leaderboard[i];
      const playerId = entry.registration.playerId;

      // Get previous position (would need to be stored/tracked)
      // For now, we'll check specific thresholds

      // Check if player is #1 (League Leader)
      if (position === 1) {
        const leaderNotif = notificationTemplates.rating.leagueLeader(
          season.name,
          division.name
        );

        await notificationService.createNotification({
          ...leaderNotif,
          userIds: playerId,
          seasonId,
          divisionId,
        });
      }

      // Check if player entered top 3
      if (position >= 2 && position <= 3) {
        const top3Notif = notificationTemplates.rating.enteredTop3(
          position,
          season.name,
          division.name
        );

        await notificationService.createNotification({
          ...top3Notif,
          userIds: playerId,
          seasonId,
          divisionId,
        });
      }

      // Check if player entered top 10 (actually top 5 based on template)
      if (position >= 4 && position <= 10) {
        const top10Notif = notificationTemplates.rating.enteredTop10(
          season.name,
          division.name
        );

        await notificationService.createNotification({
          ...top10Notif,
          userIds: playerId,
          seasonId,
          divisionId,
        });
      }
    }

    logger.info('Standings notifications checked and sent', { divisionId, seasonId });
  } catch (error) {
    logger.error('Failed to check/send standings notifications', { divisionId, seasonId }, error as Error);
  }
}

/**
 * Send DMR increased notification
 */
export async function sendDMRIncreasedNotification(
  userId: string,
  sport: string,
  newRating: number,
  oldRating: number
): Promise<void> {
  try {
    const change = newRating - oldRating;

    if (change <= 0) return; // Only send if rating increased

    const dmrNotif = notificationTemplates.rating.dmrIncreased(sport, newRating, change);

    await notificationService.createNotification({
      ...dmrNotif,
      userIds: userId,
    });

    // Check for personal best
    await checkPersonalBestRating(userId, sport, newRating);

    // Check for rating milestone
    await checkRatingMilestone(userId, sport, newRating);

    logger.info('DMR increased notification sent', { userId, sport, newRating, change });
  } catch (error) {
    logger.error('Failed to send DMR increased notification', { userId }, error as Error);
  }
}

/**
 * Check and send personal best rating notification
 */
async function checkPersonalBestRating(
  userId: string,
  sport: string,
  currentRating: number
): Promise<void> {
  try {
    // Get all rating history for this sport
    const ratingHistory = await prisma.playerRating.findMany({
      where: {
        playerId: userId,
        sportType: sport as any,
      },
      orderBy: { rating: 'desc' },
      take: 1,
    });

    // If this is the highest rating ever, send personal best notification
    if (ratingHistory.length > 0 && ratingHistory[0].rating === currentRating) {
      const personalBestNotif = notificationTemplates.rating.personalBestRating(
        sport,
        currentRating
      );

      await notificationService.createNotification({
        ...personalBestNotif,
        userIds: userId,
      });

      logger.info('Personal best rating notification sent', { userId, sport, currentRating });
    }
  } catch (error) {
    logger.error('Failed to check personal best rating', { userId }, error as Error);
  }
}

/**
 * Check and send rating milestone notification
 */
async function checkRatingMilestone(
  userId: string,
  sport: string,
  currentRating: number
): Promise<void> {
  try {
    // Milestone thresholds: 1500, 2000, 2500
    const milestones = [1500, 2000, 2500];

    // Check if current rating just crossed a milestone
    for (const milestone of milestones) {
      if (currentRating >= milestone && currentRating < milestone + 50) {
        // Crossed this milestone recently (within 50 points)
        const milestoneNotif = notificationTemplates.rating.ratingMilestone(
          milestone,
          sport
        );

        await notificationService.createNotification({
          ...milestoneNotif,
          userIds: userId,
        });

        logger.info('Rating milestone notification sent', { userId, sport, milestone });
        break; // Only send one milestone notification
      }
    }
  } catch (error) {
    logger.error('Failed to check rating milestone', { userId }, error as Error);
  }
}

/**
 * Send weekly ranking update (scheduled job would call this)
 */
export async function sendWeeklyRankingUpdates(
  seasonId: string,
  divisionId: string,
  weekNumber: number
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

      const weeklyNotif = notificationTemplates.rating.weeklyRankingUpdate(
        position,
        season.name,
        weekNumber
      );

      await notificationService.createNotification({
        ...weeklyNotif,
        userIds: playerId,
        seasonId,
        divisionId,
      });
    }

    logger.info('Weekly ranking updates sent', { seasonId, divisionId, weekNumber, playerCount: leaderboard.length });
  } catch (error) {
    logger.error('Failed to send weekly ranking updates', { seasonId, divisionId }, error as Error);
  }
}

/**
 * Send moved up in standings notification
 */
export async function sendMovedUpInStandingsNotification(
  userId: string,
  newPosition: number,
  seasonId: string,
  divisionId: string
): Promise<void> {
  try {
    const [season, division] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true },
      }),
      prisma.division.findUnique({
        where: { id: divisionId },
        select: { name: true },
      }),
    ]);

    if (!season || !division) return;

    const movedUpNotif = notificationTemplates.rating.movedUpInStandings(
      newPosition,
      season.name,
      division.name
    );

    await notificationService.createNotification({
      ...movedUpNotif,
      userIds: userId,
      seasonId,
      divisionId,
    });

    logger.info('Moved up in standings notification sent', { userId, newPosition });
  } catch (error) {
    logger.error('Failed to send moved up in standings notification', { userId }, error as Error);
  }
}

/**
 * Generate and send monthly DMR recap
 * This would be called by a scheduled job at the end of each month
 */
export async function sendMonthlyDMRRecap(userId: string): Promise<void> {
  try {
    // Get player ratings for all sports
    const ratings = await prisma.playerRating.findMany({
      where: { playerId: userId },
      select: {
        sportType: true,
        rating: true,
      },
    });

    if (ratings.length === 0) return;

    // Get match counts for this month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { player1Registration: { playerId: userId } },
          { player2Registration: { playerId: userId } },
        ],
        status: 'COMPLETED',
        completedAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    // Build summary message
    let summary = "Here's your DMR progress this month:\n";

    for (const rating of ratings) {
      const sportMatches = matches.length; // Would need to filter by sport in real implementation
      summary += `${rating.sportType}: ${rating.rating} DMR, ${sportMatches} matches\n`;
    }

    summary += 'Keep playing to improve your ratings next month!';

    const recapNotif = notificationTemplates.rating.monthlyDmrRecap(summary);

    await notificationService.createNotification({
      ...recapNotif,
      userIds: userId,
    });

    logger.info('Monthly DMR recap sent', { userId });
  } catch (error) {
    logger.error('Failed to send monthly DMR recap', { userId }, error as Error);
  }
}
