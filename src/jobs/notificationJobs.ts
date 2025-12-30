/**
 * Notification Scheduled Jobs
 * Handles time-based notifications using cron jobs
 */

import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import {
  sendMatchReminder24h,
  sendMatchReminder2h,
  sendScoreSubmissionReminder,
} from "../services/notification/matchNotificationService";
import {
  sendSeasonStartingSoonNotifications,
  sendSeasonStartsTomorrowNotifications,
  sendSeasonWelcomeNotifications,
  sendFinalWeekAlertNotifications,
  sendMidSeasonUpdateNotifications,
  sendRegistrationClosing3DaysNotifications,
  sendRegistrationClosing24hNotifications,
} from "../services/notification/leagueNotificationService";
import { leagueLifecycleNotifications, matchManagementNotifications, doublesNotifications } from '../helpers/notifications';
import {
  sendWeeklyRankingUpdates,
  sendMonthlyDMRRecap,
} from "../services/notification/standingsNotificationService";
import { checkAndSendProfileReminders } from "../services/notification/onboardingNotificationService";
import { notificationService } from "../services/notificationService";

/**
 * Check and send match reminders 24 hours before
 * Runs every hour
 */
export function scheduleMatch24hReminders(): void {
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running 24h match reminder job");

      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const matches = await prisma.match.findMany({
        where: {
          matchDate: {
            gte: in24Hours,
            lte: in25Hours,
          },
          status: "SCHEDULED",
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      for (const match of matches) {
        if (!match.participants || match.participants.length < 2) continue;
        
        const date = match.matchDate?.toLocaleDateString() || 'TBD';
        const time = match.matchDate?.toLocaleTimeString() || 'TBD';
        const venue = match.venue || match.location || 'TBD';
        
        for (const player of match.participants) {
          // Get opponents for this player
          const opponents = match.participants.filter(p => 
            p.userId !== player.userId && 
            (match.matchType === 'SINGLES' || p.team !== player.team)
          );
          
          const opponentNames = opponents.map(opp => opp.user?.name || 'Player').join(' & ');
          const opponentName = opponentNames || 'Opponent';
          
          const notif = matchManagementNotifications.matchReminder24h(
            opponentName,
            date,
            time,
            venue
          );
          
          await notificationService.createNotification({
            ...notif,
            userIds: player.userId,
            matchId: match.id,
          });
        }
      }

      logger.info("24h match reminders sent", { count: matches.length });
    } catch (error) {
      logger.error("Failed to send 24h match reminders", {}, error as Error);
    }
  });

  logger.info("24h match reminder job scheduled");
}

/**
 * Check and send match reminders 2 hours before
 * Runs every 15 minutes
 */
export function scheduleMatch2hReminders(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const in2Hours15Min = new Date(
        now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000
      );

      const matches = await prisma.match.findMany({
        where: {
          matchDate: {
            gte: in2Hours,
            lte: in2Hours15Min,
          },
          status: "SCHEDULED",
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          division: {
            select: {
              name: true,
            },
          },
          season: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      });

      console.log(
        `✅ Match reminder check complete: ${matches.length} matches checked, ${matches.length} reminders sent`
      );

      // Send notifications for each match
      for (const match of matches) {
        if (!match.participants || match.participants.length < 2) continue;
        
        const time = match.matchDate?.toLocaleTimeString() || 'TBD';
        const venue = match.venue || match.location || 'TBD';
        
        for (const player of match.participants) {
          // Get opponents for this player
          const opponents = match.participants.filter(p => 
            p.userId !== player.userId && 
            (match.matchType === 'SINGLES' || p.team !== player.team)
          );
          
          const opponentNames = opponents.map(opp => opp.user?.name || 'Player').join(' & ');
          const opponentName = opponentNames || 'Opponent';
          
          const notif = matchManagementNotifications.matchReminder2h(
            opponentName,
            time,
            venue
          );
          
          await notificationService.createNotification({
            ...notif,
            userIds: player.userId,
            matchId: match.id,
          });
        }
      }

      logger.info("2h match reminders sent", { count: matches.length });
    } catch (error) {
      logger.error("Failed to send 2h match reminders", {}, error as Error);
    }
  });

  logger.info("2h match reminder job scheduled");
}


/**
 * Check and send match day morning reminders
 * Runs daily at 8:00 AM
 */
export function scheduleMatchMorningReminders(): void {
  cron.schedule("0 8 * * *", async () => {
    try {
      logger.info("Running match day morning reminder job");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const matches = await prisma.match.findMany({
        where: {
          matchDate: {
            gte: today,
            lt: tomorrow,
          },
          status: "SCHEDULED",
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      for (const match of matches) {
        if (!match.participants || match.participants.length < 2) continue;
        
        const date = match.matchDate?.toLocaleDateString() || 'TBD';
        const time = match.matchDate?.toLocaleTimeString() || 'TBD';
        const venue = match.venue || match.location || 'TBD';
        
        for (const player of match.participants) {
          // Get opponents for this player
          const opponents = match.participants.filter(p => 
            p.userId !== player.userId && 
            (match.matchType === 'SINGLES' || p.team !== player.team)
          );
          
          const opponentNames = opponents.map(opp => opp.user?.name || 'Player').join(' & ');
          const opponentName = opponentNames || 'Opponent';
          
          const notif = matchManagementNotifications.matchMorningReminder(
            opponentName,
            date,
            time,
            venue
          );
          
          await notificationService.createNotification({
            ...notif,
            userIds: player.userId,
            matchId: match.id,
          });
        }
      }

      logger.info("Match day morning reminders sent", { count: matches.length });
    } catch (error) {
      logger.error("Failed to send match day morning reminders", {}, error as Error);
    }
  });

  logger.info("Match day morning reminder job scheduled");
}

/**
 * Check and send score submission reminders 15 minutes after match
 * Runs every 5 minutes
 */
export function scheduleScoreSubmissionReminders(): void {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

      const matches = await prisma.match.findMany({
        where: {
          matchDate: {
            gte: twentyMinutesAgo,
            lte: fifteenMinutesAgo,
          },
          status: "SCHEDULED", // Still no score submitted
        },
        select: { id: true },
      });

      for (const match of matches) {
        await sendScoreSubmissionReminder(match.id);
      }

      logger.info("Score submission reminders sent", { count: matches.length });
    } catch (error) {
      logger.error(
        "Failed to send score submission reminders",
        {},
        error as Error
      );
    }
  });

  logger.info("Score submission reminder job scheduled");
}

/**
 * Check and send Season Starting soon notifications (3 days before)
 * Runs daily at 10:00 AM
 */
export function scheduleSeasonStartingSoonNotifications(): void {
  // Production: 
  cron.schedule("0 10 * * *", async () => {
  
  // TESTING: every min
  // cron.schedule("* * * * *", async () => {
    try {
      logger.info("Running Season starting soon job");

      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

      const seasons = await prisma.season.findMany({
        where: {
          startDate: {
            gte: in3Days,
            lte: in4Days,
          },
          status: "UPCOMING",
        },
        select: { id: true },
      });

      for (const season of seasons) {
        await sendSeasonStartingSoonNotifications(season.id);
      }

      logger.info("Season starting soon notifications sent", {
        count: seasons.length,
      });
    } catch (error) {
      logger.error(
        "Failed to send league starting soon notifications",
        {},
        error as Error
      );
    }
  });

  logger.info("Season starting soon job scheduled");
}

/**
 * Check and send Season starts tomorrow notifications
 * Runs daily at 8:00 PM
 */
export function scheduleSeasonStartsTomorrowNotifications(): void {
  // Production: 
  cron.schedule("0 20 * * *", async () => {
  // TESTING: every 5 mins
  // cron.schedule("* * * * *", async () => {
    try {
      logger.info("Running Season starts tomorrow job");

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const seasons = await prisma.season.findMany({
        where: {
          startDate: {
            gte: tomorrow,
            lt: dayAfterTomorrow,
          },
          status: "UPCOMING",
        },
        select: { id: true },
      });

      for (const season of seasons) {
        await sendSeasonStartsTomorrowNotifications(season.id);
      }

      logger.info("League starts tomorrow notifications sent", {
        count: seasons.length,
      });
    } catch (error) {
      logger.error(
        "Failed to send league starts tomorrow notifications",
        {},
        error as Error
      );
    }
  });

  logger.info("League starts tomorrow job scheduled");
}

/**
 * Check and send season started welcome notifications
 * Runs daily at 8:00 AM
 */
export function scheduleSeasonStartedNotifications(): void {
  // Production: 
  cron.schedule("0 8 * * *", async () => {
  // TESTING: every 5 mins
  // cron.schedule("* * * * *", async () => {
    try {
      logger.info("Running season started job");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const seasons = await prisma.season.findMany({
        where: {
          startDate: {
            gte: today,
            lt: tomorrow,
          },
          status: "ACTIVE",
        },
        select: { id: true },
      });

      for (const season of seasons) {
        await sendSeasonWelcomeNotifications(season.id);
      }

      logger.info("Season started notifications sent", {
        count: seasons.length,
      });
    } catch (error) {
      logger.error(
        "Failed to send Season started notifications",
        {},
        error as Error
      );
    }
  });

  logger.info("Season started job scheduled");
}

/**
 * Check and send final week alerts
 * Runs daily at 10:00 AM on Mondays
 */
export function scheduleFinalWeekAlerts(): void {
  cron.schedule("0 10 * * 1", async () => {
    try {
      logger.info("Running final week alert job");

      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in8Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

      const seasons = await prisma.season.findMany({
        where: {
          endDate: {
            gte: in7Days,
            lte: in8Days,
          },
          status: "ACTIVE",
        },
        select: { id: true },
      });

      for (const season of seasons) {
        await sendFinalWeekAlertNotifications(season.id);
      }

      logger.info("Final week alerts sent", { count: seasons.length });
    } catch (error) {
      logger.error("Failed to send final week alerts", {}, error as Error);
    }
  });

  logger.info("Final week alert job scheduled");
}

/**
 * Check and send last-match-deadline (48 hours before season end)
 * Runs daily at 10:00 AM
 */
export function scheduleLastMatchDeadline48h(): void {
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Running last-match-deadline 48h job');

      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const in49Hours = new Date(now.getTime() + 49 * 60 * 60 * 1000);

      const seasons = await prisma.season.findMany({
        where: {
          endDate: { gte: in48Hours, lte: in49Hours },
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
      });

      for (const season of seasons) {
        try {
          const members = await prisma.seasonMembership.findMany({
            where: { seasonId: season.id, status: 'ACTIVE' },
            select: { userId: true },
          });

          if (members.length === 0) continue;

          const userIds = members.map(m => m.userId);

          const notif = leagueLifecycleNotifications.lastMatchDeadline48h();

          await notificationService.createNotification({
            userIds,
            ...notif,
            seasonId: season.id,
          });

          logger.info('Last-match 48h notifications sent', { seasonId: season.id, count: userIds.length });
        } catch (innerErr) {
          logger.error('Failed sending last-match 48h for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run last-match-deadline 48h job', {}, error as Error);
    }
  });

  logger.info('Last-match-deadline 48h job scheduled');
}

/**
 * Check and send registration closing notifications (3 days before regiDeadline)
 * Runs daily at 10:00 AM
 */
export function scheduleRegistrationClosing3Days(): void {
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Running registration closing 3d job');

      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

      const seasons = await prisma.season.findMany({
        where: {
          regiDeadline: { gte: in3Days, lte: in4Days },
          status: 'UPCOMING',
        },
        select: { id: true, name: true },
      });

      for (const season of seasons) {
        try {
          await sendRegistrationClosing3DaysNotifications(season.id);
          logger.info('Registration closing 3d notifications processed', { seasonId: season.id });
        } catch (innerErr) {
          logger.error('Failed sending registration closing 3d for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run registration closing 3d job', {}, error as Error);
    }
  });

  logger.info('Registration closing 3d job scheduled');
}

/**
 * Check and send registration closing notifications (24 hours before regiDeadline)
 * Runs daily at 10:00 AM
 */
export function scheduleRegistrationClosing24h(): void {
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Running registration closing 24h job');

      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const seasons = await prisma.season.findMany({
        where: {
          regiDeadline: { gte: in24Hours, lte: in25Hours },
          status: 'UPCOMING',
        },
        select: { id: true, name: true },
      });

      for (const season of seasons) {
        try {
          await sendRegistrationClosing24hNotifications(season.id);
          logger.info('Registration closing 24h notifications processed', { seasonId: season.id });
        } catch (innerErr) {
          logger.error('Failed sending registration closing 24h for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run registration closing 24h job', {}, error as Error);
    }
  });

  logger.info('Registration closing 24h job scheduled');
}

/**
 * Send mid-season updates
 * Runs weekly on Mondays at 10:00 AM
 */
export function scheduleMidSeasonUpdates(): void {
  cron.schedule("0 10 * * 1", async () => {
    try {
      logger.info("Running mid-season update job");

      const activeSeasons = await prisma.season.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          divisions: {
            select: { id: true },
          },
        },
      });

      for (const season of activeSeasons) {
        if (!season.startDate || !season.endDate) continue;

        const now = new Date();
        const totalDuration =
          season.endDate.getTime() - season.startDate.getTime();
        const elapsed = now.getTime() - season.startDate.getTime();
        const progress = elapsed / totalDuration;

        // Send mid-season update if we're around 50% (week 4 of 8)
        if (progress >= 0.45 && progress <= 0.55) {
          for (const division of season.divisions) {
            await sendMidSeasonUpdateNotifications(season.id, division.id);
          }
        }
      }

      logger.info("Mid-season updates sent");
    } catch (error) {
      logger.error("Failed to send mid-season updates", {}, error as Error);
    }
  });

  logger.info("Mid-season update job scheduled");
}

/**
 * Send weekly ranking updates
 * Runs every Monday at 8:00 AM
 */
export function scheduleWeeklyRankingUpdates(): void {
  cron.schedule("0 8 * * 1", async () => {
    try {
      logger.info("Running weekly ranking update job");

      const activeSeasons = await prisma.season.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          startDate: true,
          divisions: {
            select: { id: true },
          },
        },
      });

      for (const season of activeSeasons) {
        if (!season.startDate) continue;

        // Calculate week number
        const weekNumber =
          Math.floor(
            (Date.now() - season.startDate.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          ) + 1;

        for (const division of season.divisions) {
          await sendWeeklyRankingUpdates(season.id, division.id, weekNumber);
        }
      }

      logger.info("Weekly ranking updates sent");
    } catch (error) {
      logger.error("Failed to send weekly ranking updates", {}, error as Error);
    }
  });

  logger.info("Weekly ranking update job scheduled");
}

/**
 * Send monthly DMR recaps
 * Runs on the last day of each month at 8:00 PM
 */
export function scheduleMonthlyDMRRecaps(): void {
  cron.schedule("0 20 28-31 * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Only run on the last day of the month
      if (tomorrow.getMonth() !== today.getMonth()) {
        logger.info("Running monthly DMR recap job");

        const users = await prisma.user.findMany({
          where: {
            playerRatings: {
              some: {},
            },
          },
          select: { id: true },
        });

        for (const user of users) {
          await sendMonthlyDMRRecap(user.id);
        }

        logger.info("Monthly DMR recaps sent", { count: users.length });
      }
    } catch (error) {
      logger.error("Failed to send monthly DMR recaps", {}, error as Error);
    }
  });

  logger.info("Monthly DMR recap job scheduled");
}

/**
 * Check and send team registration reminders (2 hours before deadline)
 * Runs every 30 minutes
 */
export function scheduleTeamRegistrationReminder2h(): void {
  cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('Running team registration 2h reminder job');

      const now = new Date();
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const in2Hours15Min = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000);

      // Find partnerships that have been accepted but not yet registered
      // and the season registration deadline is in ~2 hours
      const seasons = await prisma.season.findMany({
        where: {
          regiDeadline: {
            gte: in2Hours,
            lte: in2Hours15Min,
          },
          status: 'UPCOMING',
        },
        select: {
          id: true,
          name: true,
          regiDeadline: true,
        },
      });

      for (const season of seasons) {
        try {
          // Find partnerships for this season that don't have active memberships
          const partnerships = await prisma.partnership.findMany({
            where: {
              seasonId: season.id,
              status: 'ACTIVE',
            },
            include: {
              captain: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
              partner: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
            },
          });

          for (const partnership of partnerships) {
            // Check if captain has already registered
            const captainMembership = await prisma.seasonMembership.findFirst({
              where: {
                userId: partnership.captainId,
                seasonId: season.id,
                status: 'ACTIVE',
              },
            });

            // Only send reminder if not registered
            if (!captainMembership) {
              const partnerName = partnership.partner?.name || partnership.partner?.username || 'your partner';

              const notif = doublesNotifications.teamRegistrationReminder2h(
                season.name || 'this league',
                partnerName
              );

              await notificationService.createNotification({
                userIds: partnership.captainId,
                ...notif,
                seasonId: season.id,
                partnershipId: partnership.id,
              });
            }
          }

          logger.info('Team registration 2h reminders sent', { seasonId: season.id, count: partnerships.length });
        } catch (innerErr) {
          logger.error('Failed sending team registration 2h reminders for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run team registration 2h reminder job', {}, error as Error);
    }
  });

  logger.info('Team registration 2h reminder job scheduled');
}

/**
 * Check and send team registration reminders (24 hours before deadline)
 * Runs daily at 10:00 AM
 */
export function scheduleTeamRegistrationReminder24h(): void {
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Running team registration 24h reminder job');

      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      // Find seasons with registration deadline in ~24 hours
      const seasons = await prisma.season.findMany({
        where: {
          regiDeadline: {
            gte: in24Hours,
            lte: in25Hours,
          },
          status: 'UPCOMING',
        },
        select: {
          id: true,
          name: true,
          regiDeadline: true,
        },
      });

      for (const season of seasons) {
        try {
          // Find partnerships for this season
          const partnerships = await prisma.partnership.findMany({
            where: {
              seasonId: season.id,
              status: 'ACTIVE',
            },
            include: {
              captain: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
            },
          });

          for (const partnership of partnerships) {
            // Check if captain has already registered
            const captainMembership = await prisma.seasonMembership.findFirst({
              where: {
                userId: partnership.captainId,
                seasonId: season.id,
                status: 'ACTIVE',
              },
            });

            // Only send reminder if not registered
            if (!captainMembership) {
              const notif = doublesNotifications.teamRegistrationReminder24h(
                season.name || 'this league'
              );

              await notificationService.createNotification({
                userIds: partnership.captainId,
                ...notif,
                seasonId: season.id,
                partnershipId: partnership.id,
              });
            }
          }

          logger.info('Team registration 24h reminders sent', { seasonId: season.id, count: partnerships.length });
        } catch (innerErr) {
          logger.error('Failed sending team registration 24h reminders for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run team registration 24h reminder job', {}, error as Error);
    }
  });

  logger.info('Team registration 24h reminder job scheduled');
}

/**
 * Check and send registration deadline notifications to captains
 * Runs daily at 8:00 PM (evening before deadline day)
 */
export function scheduleRegistrationDeadlineCaptain(): void {
  cron.schedule('0 20 * * *', async () => {
    try {
      logger.info('Running registration deadline captain reminder job');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Find seasons with registration deadline tomorrow
      const seasons = await prisma.season.findMany({
        where: {
          regiDeadline: {
            gte: tomorrow,
            lt: dayAfterTomorrow,
          },
          status: 'UPCOMING',
        },
        select: {
          id: true,
          name: true,
        },
      });

      for (const season of seasons) {
        try {
          // Find partnerships for this season
          const partnerships = await prisma.partnership.findMany({
            where: {
              seasonId: season.id,
              status: 'ACTIVE',
            },
            include: {
              captain: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
              partner: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
            },
          });

          for (const partnership of partnerships) {
            // Check if captain has already registered
            const captainMembership = await prisma.seasonMembership.findFirst({
              where: {
                userId: partnership.captainId,
                seasonId: season.id,
                status: 'ACTIVE',
              },
            });

            // Only send reminder if not registered
            if (!captainMembership) {
              const partnerName = partnership.partner?.name || partnership.partner?.username || 'your partner';

              const notif = doublesNotifications.registrationDeadlineCaptain(
                season.name || 'this league',
                partnerName
              );

              await notificationService.createNotification({
                userIds: partnership.captainId,
                ...notif,
                seasonId: season.id,
                partnershipId: partnership.id,
              });
            }
          }

          logger.info('Registration deadline captain reminders sent', { seasonId: season.id, count: partnerships.length });
        } catch (innerErr) {
          logger.error('Failed sending registration deadline captain reminders for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run registration deadline captain reminder job', {}, error as Error);
    }
  });

  logger.info('Registration deadline captain reminder job scheduled');
}

/**
 * Check incomplete profiles and send reminders
 * Runs daily at 6:00 PM for users created today
 */
export function scheduleProfileReminders(): void {
  cron.schedule("0 18 * * *", async () => {
    try {
      logger.info("Running profile reminder job");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const newUsers = await prisma.user.findMany({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: { id: true },
      });

      for (const user of newUsers) {
        await checkAndSendProfileReminders(user.id);
      }

      logger.info("Profile reminders sent", { count: newUsers.length });
    } catch (error) {
      logger.error("Failed to send profile reminders", {}, error as Error);
    }
  });

  logger.info("Profile reminder job scheduled");
}

/**
 * Cleanup stale and failed push tokens
 * Runs daily at 3:00 AM
 * - Deactivates tokens with high failure count (>= 5)
 * - Removes tokens not used for 90+ days
 */
export function schedulePushTokenCleanup(): void {
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Running push token cleanup job');

      const FAILURE_THRESHOLD = 5;
      const STALE_DAYS = 90;

      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - STALE_DAYS);

      // Deactivate tokens with high failure count
      const failedTokensResult = await prisma.userPushToken.updateMany({
        where: {
          isActive: true,
          failureCount: {
            gte: FAILURE_THRESHOLD,
          },
        },
        data: {
          isActive: false,
        },
      });

      // Deactivate stale tokens (not used in 90+ days)
      const staleTokensResult = await prisma.userPushToken.updateMany({
        where: {
          isActive: true,
          OR: [
            { lastUsedAt: { lt: staleDate } },
            { lastUsedAt: null, createdAt: { lt: staleDate } },
          ],
        },
        data: {
          isActive: false,
        },
      });

      // Delete very old inactive tokens (180+ days) for cleanup
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() - 180);

      const deletedTokensResult = await prisma.userPushToken.deleteMany({
        where: {
          isActive: false,
          updatedAt: { lt: deleteDate },
        },
      });

      logger.info('Push token cleanup complete', {
        deactivatedFailed: failedTokensResult.count,
        deactivatedStale: staleTokensResult.count,
        deletedOld: deletedTokensResult.count,
      });
    } catch (error) {
      logger.error('Failed to cleanup push tokens', {}, error as Error);
    }
  });

  logger.info('Push token cleanup job scheduled');
}

/**
 * Initialize all notification jobs
 */
export function initializeNotificationJobs(): void {
  logger.info("Initializing notification jobs...");

  scheduleMatch24hReminders();
  scheduleMatch2hReminders();
  scheduleMatchMorningReminders();
  scheduleScoreSubmissionReminders();
  scheduleSeasonStartingSoonNotifications();
  scheduleSeasonStartsTomorrowNotifications();
  scheduleSeasonStartedNotifications();

  scheduleFinalWeekAlerts();
  scheduleMidSeasonUpdates();
  scheduleWeeklyRankingUpdates();
  scheduleMonthlyDMRRecaps();
  scheduleProfileReminders();
  scheduleRegistrationClosing3Days();
  scheduleRegistrationClosing24h();
  scheduleLastMatchDeadline48h();
  schedulePushTokenCleanup();
  
  // Doubles team registration reminders
  scheduleTeamRegistrationReminder2h();
  scheduleTeamRegistrationReminder24h();
  scheduleRegistrationDeadlineCaptain();

  logger.info("✅ All notification jobs initialized successfully");
}
