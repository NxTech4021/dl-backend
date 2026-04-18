/**
 * Notification Scheduled Jobs
 * Handles time-based notifications using cron jobs
 */

import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

dayjs.extend(utc);
dayjs.extend(tz);

const MYT = "Asia/Kuala_Lumpur";
const CRON_TZ = { timezone: MYT };

/** Wrapper that applies Malaysia timezone to every cron schedule */
function scheduleCron(expression: string, fn: () => void): void {
  cron.schedule(expression, fn, CRON_TZ);
}
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
import { accountNotifications } from "../helpers/notifications/accountNotifications";
import { MALAYSIA_TIMEZONE } from "../utils/timezone";

/**
 * Check and send match reminders 24 hours before
 * Runs every hour
 */
export function scheduleMatch24hReminders(): void {
  scheduleCron("0 * * * *", async () => {
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
          // Audit-D: query the FULL roster so opponent-name construction
          // stays complete for doubles matches where some invitees are still
          // PENDING. Delivery is gated to ACCEPTED-only in the loop below.
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

        // F-5: re-check status — the match may have been cancelled or completed
        // between the initial findMany and this iteration.
        // TODO(111-audit-F1): this is N+1 — batch with findMany on collected
        // ids at the top of the cron handler for O(1) extra queries.
        const fresh = await prisma.match.findUnique({
          where: { id: match.id },
          select: { status: true },
        });
        if (fresh?.status !== "SCHEDULED") continue;

        const date = match.matchDate ? dayjs(match.matchDate).tz(MYT).format('D MMM YYYY') : 'TBD';
        const time = match.matchDate ? dayjs(match.matchDate).tz(MYT).format('h:mm A') : 'TBD';
        const venue = match.venue || match.location || 'TBD';

        for (const player of match.participants) {
          // Audit-D: only notify ACCEPTED participants; the full roster above
          // is kept so opponent-name computation reflects the intended lineup.
          if (player.invitationStatus !== 'ACCEPTED') continue;

          // Get opponents for this player
          const opponents = match.participants.filter(p =>
            p.userId !== player.userId &&
            (match.matchType === 'SINGLES' || p.team !== player.team)
          );

          const opponentNames = opponents.map(opp => opp.user?.name || 'Player').join(' & ');
          const opponentName = opponentNames || 'Opponent';

          const notif = matchManagementNotifications.matchReminder24h(
            opponentName,
            time,
            venue
          );
          
          if (player.userId) {
            await notificationService.createNotification({
              ...notif,
              userIds: player.userId,
              matchId: match.id,
              skipDuplicateWithinMs: 25 * 60 * 60 * 1000,
            });
          }
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
  scheduleCron("*/15 * * * *", async () => {
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
          // Audit-D: full roster for opponent-name construction; delivery
          // gated to ACCEPTED-only in the loop below.
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

      logger.info("2h match reminder check complete", { matchesChecked: matches.length });

      // Send notifications for each match
      for (const match of matches) {
        if (!match.participants || match.participants.length < 2) continue;

        // F-5: re-check status — the match may have been cancelled or completed
        // between the initial findMany and this iteration.
        // TODO(111-audit-F1): this is N+1 — batch with findMany on collected
        // ids at the top of the cron handler for O(1) extra queries.
        const fresh = await prisma.match.findUnique({
          where: { id: match.id },
          select: { status: true },
        });
        if (fresh?.status !== "SCHEDULED") continue;

        const time = match.matchDate ? dayjs(match.matchDate).tz(MYT).format('h:mm A') : 'TBD';
        const venue = match.venue || match.location || 'TBD';

        for (const player of match.participants) {
          // Audit-D: only notify ACCEPTED participants.
          if (player.invitationStatus !== 'ACCEPTED') continue;

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
          
          if (player.userId) {
            await notificationService.createNotification({
              ...notif,
              userIds: player.userId,
              matchId: match.id,
              skipDuplicateWithinMs: 3 * 60 * 60 * 1000,
            });
          }
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
  scheduleCron("0 8 * * *", async () => {
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
          // Audit-D: full roster for opponent-name construction; delivery
          // gated to ACCEPTED-only in the loop below.
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

        // F-5: re-check status — the match may have been cancelled or completed
        // between the initial findMany and this iteration.
        // TODO(111-audit-F1): this is N+1 — batch with findMany on collected
        // ids at the top of the cron handler for O(1) extra queries.
        const fresh = await prisma.match.findUnique({
          where: { id: match.id },
          select: { status: true },
        });
        if (fresh?.status !== "SCHEDULED") continue;

        const date = match.matchDate ? dayjs(match.matchDate).tz(MYT).format('D MMM YYYY') : 'TBD';
        const time = match.matchDate ? dayjs(match.matchDate).tz(MYT).format('h:mm A') : 'TBD';
        const venue = match.venue || match.location || 'TBD';

        for (const player of match.participants) {
          // Audit-D: only notify ACCEPTED participants.
          if (player.invitationStatus !== 'ACCEPTED') continue;

          // Get opponents for this player
          const opponents = match.participants.filter(p =>
            p.userId !== player.userId &&
            (match.matchType === 'SINGLES' || p.team !== player.team)
          );

          const opponentNames = opponents.map(opp => opp.user?.name || 'Player').join(' & ');
          const opponentName = opponentNames || 'Opponent';

          const notif = matchManagementNotifications.matchMorningReminder(
            opponentName,
            time,
            venue
          );
          
          if (player.userId) {
            await notificationService.createNotification({
              ...notif,
              userIds: player.userId,
              matchId: match.id,
              skipDuplicateWithinMs: 24 * 60 * 60 * 1000,
            });
          }
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
  scheduleCron("*/5 * * * *", async () => {
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
        // F-7: re-check status — the match may have been cancelled or completed
        // between the initial findMany and this iteration.
        // TODO(111-audit-F2): double-query — this findUnique + another one
        // inside sendScoreSubmissionReminder. Collapse by passing status to
        // the service or folding the status check in there.
        // See docs/issues/backlog/match-post-ship-audit-2026-04-16.md#issue-f
        const fresh = await prisma.match.findUnique({
          where: { id: match.id },
          select: { status: true },
        });
        if (fresh?.status !== "SCHEDULED") continue;

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
 * NOTIF-098/099: Send pending score submission/confirmation reminders
 * Runs hourly — checks for matches ~20h after they ended that still need action
 */
export function schedulePendingScoreNotifications(): void {
  scheduleCron("0 * * * *", async () => {
    try {
      const now = new Date();
      const twentyOneHoursAgo = new Date(now.getTime() - 21 * 60 * 60 * 1000);
      const nineteenHoursAgo = new Date(now.getTime() - 19 * 60 * 60 * 1000);

      // NOTIF-098: SCHEDULED matches (no score submitted) ending ~20h ago
      const unsubmittedMatches = await prisma.match.findMany({
        where: {
          matchDate: { gte: twentyOneHoursAgo, lte: nineteenHoursAgo },
          status: "SCHEDULED",
          isFriendly: false,
        },
        include: {
          participants: {
            where: { invitationStatus: "ACCEPTED" },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

      for (const match of unsubmittedMatches) {
        const participants = match.participants.filter((p: any) => p.userId);
        for (const participant of participants) {
          const others = participants.filter((p: any) => p.userId !== participant.userId);
          const opponentName = others[0]?.user?.name || "Opponent";
          await notificationService.createNotification({
            ...matchManagementNotifications.pendingScoreSubmission(opponentName),
            userIds: [participant.userId],
            matchId: match.id,
          });
        }
      }

      if (unsubmittedMatches.length > 0) {
        logger.info("NOTIF-098: Pending score submission reminders sent", { count: unsubmittedMatches.length });
      }

      // NOTIF-099: ONGOING matches (one submitted, other hasn't confirmed) ending ~20h ago
      const unconfirmedMatches = await prisma.match.findMany({
        where: {
          matchDate: { gte: twentyOneHoursAgo, lte: nineteenHoursAgo },
          status: "ONGOING",
          isFriendly: false,
        },
        include: {
          participants: {
            where: { invitationStatus: "ACCEPTED" },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

      for (const match of unconfirmedMatches) {
        const participants = match.participants.filter((p: any) => p.userId);
        for (const participant of participants) {
          const others = participants.filter((p: any) => p.userId !== participant.userId);
          const opponentName = others[0]?.user?.name || "Opponent";
          await notificationService.createNotification({
            ...matchManagementNotifications.pendingScoreConfirmation(opponentName),
            userIds: [participant.userId],
            matchId: match.id,
          });
        }
      }

      if (unconfirmedMatches.length > 0) {
        logger.info("NOTIF-099: Pending score confirmation reminders sent", { count: unconfirmedMatches.length });
      }
    } catch (error) {
      logger.error("Failed to send pending score notifications", {}, error as Error);
    }
  });

  logger.info("Pending score notification job scheduled (hourly)");
}

/**
 * Runs daily at 10:00 AM
 */
export function scheduleSeasonStartingSoonNotifications(): void {
  scheduleCron("0 10 * * *", async () => {
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
  scheduleCron("0 20 * * *", async () => {
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
  scheduleCron("0 8 * * *", async () => {
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
  scheduleCron("0 10 * * 1", async () => {
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
  scheduleCron('0 10 * * *', async () => {
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
        include: { leagues: { select: { name: true } } },
      });

      for (const season of seasons) {
        try {
          const members = await prisma.seasonMembership.findMany({
            where: { seasonId: season.id, status: 'ACTIVE' },
            select: { userId: true },
          });

          if (members.length === 0) continue;

          const userIds = members.map(m => m.userId);

          const leagueName48h = season.leagues?.[0]?.name ?? '';
          const notif = leagueLifecycleNotifications.lastMatchDeadline48h(season.name, leagueName48h);

          await notificationService.createNotification({
            userIds,
            ...notif,
            seasonId: season.id,
            skipDuplicateWithinMs: 25 * 60 * 60 * 1000,
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
  scheduleCron('0 10 * * *', async () => {
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
  scheduleCron('0 10 * * *', async () => {
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
  scheduleCron("0 10 * * 1", async () => {
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
  scheduleCron("0 8 * * 1", async () => {
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
  scheduleCron("0 20 28-31 * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Guard: cron fires on days 28-31, but only execute on the ACTUAL last day.
      // If tomorrow is a different month, today must be the last day of this month.
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
  scheduleCron('*/30 * * * *', async () => {
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

              // teamRegistrationReminder2h removed — not used
              // const notif = doublesNotifications.teamRegistrationReminder2h(season.name || 'this league', partnerName);
              // await notificationService.createNotification({ userIds: partnership.captainId, ... });
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
/**
 * NOTIF-027: Complete Team Registration Reminder - 24 Hours (Captain)
 * Fires exactly 24 hours after team (partnership) was confirmed, if captain hasn't registered.
 * Runs every 30 minutes to catch partnerships that crossed the 24h mark.
 */
export function scheduleTeamRegistrationReminder24h(): void {
  scheduleCron('*/30 * * * *', async () => {
    try {
      logger.info('Running team registration 24h reminder job (NOTIF-027)');

      const now = new Date();
      const from23hAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const to23hAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

      // Find partnerships confirmed ~24h ago (within a 2h window) that are still ACTIVE
      const partnerships = await prisma.partnership.findMany({
        where: {
          createdAt: {
            gte: from23hAgo,
            lte: to23hAgo,
          },
          status: 'ACTIVE',
          partnerId: { not: null },
        },
        include: {
          captain: {
            select: { id: true, name: true, username: true },
          },
          season: {
            select: { id: true, name: true, status: true, regiDeadline: true },
          },
        },
      });

      for (const partnership of partnerships) {
        try {
          // Only notify for upcoming seasons with an open registration window
          if (partnership.season.status !== 'UPCOMING') continue;
          if (partnership.season.regiDeadline && partnership.season.regiDeadline < now) continue;

          // Check if captain has already registered
          const captainMembership = await prisma.seasonMembership.findFirst({
            where: {
              userId: partnership.captainId,
              seasonId: partnership.seasonId,
              status: 'ACTIVE',
            },
          });

          if (!captainMembership) {
            const notif = doublesNotifications.teamRegistrationReminder24h(
              partnership.season.name || 'this league'
            );

            await notificationService.createNotification({
              userIds: partnership.captainId,
              ...notif,
              seasonId: partnership.seasonId,
              partnershipId: partnership.id,
              skipDuplicateWithinMs: 23 * 60 * 60 * 1000,
            });
          }
        } catch (innerErr) {
          logger.error('Failed sending NOTIF-027 for partnership', { partnershipId: partnership.id }, innerErr as Error);
        }
      }

      logger.info('NOTIF-027 job complete', { checked: partnerships.length });
    } catch (error) {
      logger.error('Failed to run team registration 24h reminder job', {}, error as Error);
    }
  });

  logger.info('Team registration 24h reminder job scheduled (NOTIF-027)');
}

/**
 * NOTIF-029: Waiting for Captain to Register - Partner
 * Fires exactly 24 hours after team (partnership) was confirmed, if captain hasn't registered.
 * Notifies the PARTNER (not the captain).
 * Runs every 30 minutes alongside NOTIF-027.
 */
export function scheduleWaitingForCaptain(): void {
  scheduleCron('*/30 * * * *', async () => {
    try {
      logger.info('Running waiting-for-captain reminder job (NOTIF-029)');

      const now = new Date();
      const from23hAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const to23hAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

      const partnerships = await prisma.partnership.findMany({
        where: {
          createdAt: {
            gte: from23hAgo,
            lte: to23hAgo,
          },
          status: 'ACTIVE',
          partnerId: { not: null },
        },
        include: {
          captain: {
            select: { id: true, name: true, username: true },
          },
          partner: {
            select: { id: true, name: true, username: true },
          },
          season: {
            select: { id: true, name: true, status: true, regiDeadline: true },
          },
        },
      });

      for (const partnership of partnerships) {
        try {
          if (!partnership.partnerId || !partnership.partner) continue;
          if (partnership.season.status !== 'UPCOMING') continue;
          if (partnership.season.regiDeadline && partnership.season.regiDeadline < now) continue;

          // Only send if captain hasn't registered
          const captainMembership = await prisma.seasonMembership.findFirst({
            where: {
              userId: partnership.captainId,
              seasonId: partnership.seasonId,
              status: 'ACTIVE',
            },
          });

          if (!captainMembership) {
            const captainName = partnership.captain.name || partnership.captain.username || 'Your captain';
            const notif = doublesNotifications.waitingForCaptain(
              captainName,
              partnership.season.name || 'this league'
            );

            await notificationService.createNotification({
              userIds: partnership.partnerId,
              ...notif,
              seasonId: partnership.seasonId,
              partnershipId: partnership.id,
              skipDuplicateWithinMs: 23 * 60 * 60 * 1000,
            });
          }
        } catch (innerErr) {
          logger.error('Failed sending NOTIF-029 for partnership', { partnershipId: partnership.id }, innerErr as Error);
        }
      }

      logger.info('NOTIF-029 job complete', { checked: partnerships.length });
    } catch (error) {
      logger.error('Failed to run waiting-for-captain reminder job', {}, error as Error);
    }
  });

  logger.info('Waiting-for-captain reminder job scheduled (NOTIF-029)');
}

/**
 * NOTIF-030: Registration Deadline Approaching - Partner
 * Fires 24 hours before registration closes, if captain hasn't registered.
 * Notifies the PARTNER (not the captain).
 * Runs daily at 8:00 PM alongside NOTIF-028.
 */
export function scheduleRegistrationDeadlinePartner(): void {
  scheduleCron('0 20 * * *', async () => {
    try {
      logger.info('Running registration deadline partner reminder job (NOTIF-030)');

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
        select: { id: true, name: true },
      });

      for (const season of seasons) {
        try {
          const partnerships = await prisma.partnership.findMany({
            where: {
              seasonId: season.id,
              status: 'ACTIVE',
              partnerId: { not: null },
            },
            include: {
              captain: {
                select: { id: true, name: true, username: true },
              },
              partner: {
                select: { id: true, name: true, username: true },
              },
            },
          });

          for (const partnership of partnerships) {
            if (!partnership.partnerId || !partnership.partner) continue;

            // Only send if captain hasn't registered
            const captainMembership = await prisma.seasonMembership.findFirst({
              where: {
                userId: partnership.captainId,
                seasonId: season.id,
                status: 'ACTIVE',
              },
            });

            if (!captainMembership) {
              const captainName = partnership.captain.name || partnership.captain.username || 'your captain';
              const notif = doublesNotifications.registrationDeadlinePartner(
                season.name || 'this league',
                captainName
              );

              await notificationService.createNotification({
                userIds: partnership.partnerId,
                ...notif,
                seasonId: season.id,
                partnershipId: partnership.id,
                skipDuplicateWithinMs: 25 * 60 * 60 * 1000,
              });
            }
          }

          logger.info('NOTIF-030 partner deadline reminders sent', { seasonId: season.id });
        } catch (innerErr) {
          logger.error('Failed sending NOTIF-030 for season', { seasonId: season.id }, innerErr as Error);
        }
      }
    } catch (error) {
      logger.error('Failed to run registration deadline partner job', {}, error as Error);
    }
  });

  logger.info('Registration deadline partner job scheduled (NOTIF-030)');
}

/**
 * Check and send registration deadline notifications to captains
 * Runs daily at 8:00 PM (evening before deadline day)
 */
export function scheduleRegistrationDeadlineCaptain(): void {
  scheduleCron('0 20 * * *', async () => {
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
                skipDuplicateWithinMs: 25 * 60 * 60 * 1000,
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
  scheduleCron("0 18 * * *", async () => {
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
  scheduleCron('0 3 * * *', async () => {
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
 * Weekly match streak re-evaluation.
 * Runs every Monday at 00:05 UTC — catches streaks that broke from inactivity
 * (no match played in the previous week).
 */
export function scheduleMatchStreakReEvaluation(): void {
  scheduleCron('5 0 * * 1', async () => {
    try {
      logger.info('Running weekly match streak re-evaluation');

      // Find all users who have completed revocable achievements
      const usersWithRevocable = await prisma.userAchievement.findMany({
        where: {
          isCompleted: true,
          achievement: { isRevocable: true, isActive: true },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      if (usersWithRevocable.length === 0) {
        logger.info('No users with revocable achievements to re-evaluate');
        return;
      }

      // Lazy import to avoid circular dependency
      const { evaluateMatchAchievementsSafe } = await import('../services/achievement/achievementEvaluationService');

      const BATCH_SIZE = 10;
      let processed = 0;

      for (let i = 0; i < usersWithRevocable.length; i += BATCH_SIZE) {
        const batch = usersWithRevocable.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(({ userId }) =>
            evaluateMatchAchievementsSafe(userId, { userId })
          )
        );
        processed += batch.length;
      }

      logger.info(`Match streak re-evaluation complete: ${processed} users processed`);
    } catch (error) {
      logger.error('Failed to run match streak re-evaluation', {}, error as Error);
    }
  });

  logger.info('Match streak re-evaluation job scheduled (Mon 00:05 UTC)');
}

/**
 * Auto-finish seasons whose endDate has passed but status is still ACTIVE or UPCOMING.
 * Runs daily at midnight (MYT). Daily cadence is sufficient because downstream
 * lifecycle decisions key off `endDate` directly rather than `status`. Switch
 * to '0 * * * *' if product ever wants hourly status flips.
 */
export function scheduleSeasonAutoFinish(): void {
  scheduleCron('0 0 * * *', async () => {
    try {
      const now = new Date();

      const expiredSeasons = await prisma.season.findMany({
        where: {
          endDate: { lt: now },
          status: { in: ['ACTIVE', 'UPCOMING'] },
        },
        select: { id: true, name: true, status: true },
      });

      if (expiredSeasons.length === 0) return;

      const ids = expiredSeasons.map(s => s.id);

      await prisma.season.updateMany({
        where: { id: { in: ids } },
        data: { status: 'FINISHED', isActive: false },
      });

      logger.info(`Season auto-finish: marked ${expiredSeasons.length} season(s) as FINISHED`, {
        seasons: expiredSeasons.map(s => ({ id: s.id, name: s.name, previousStatus: s.status })),
      });
    } catch (error) {
      logger.error('Season auto-finish job failed', {}, error instanceof Error ? error : new Error(String(error)));
    }
  });

  logger.info('Season auto-finish job scheduled (every hour)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Nudge Jobs (7 new jobs — per-user inactivity during active season)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SCHEDULE_MATCH_SOON: Season started 7 days ago; user has 0 completed matches.
 * Runs daily at 10:00 AM.
 */
export function scheduleMatchSoonNudges(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running scheduleMatchSoon nudge job');
      const now = dayjs().tz(MYT);
      const from = now.subtract(8, 'day').toDate();
      const to = now.subtract(6, 'day').toDate();

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE', startDate: { gte: from, lte: to } },
        include: { divisions: { select: { id: true } } },
      });

      for (const season of activeSeasons) {
        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const played = await prisma.match.count({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
            });
            if (played === 0) {
              const notif = leagueLifecycleNotifications.scheduleMatchSoon();
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('scheduleMatchSoon nudges complete');
    } catch (error) {
      logger.error('Failed to run scheduleMatchSoon nudge job', {}, error as Error);
    }
  });
  logger.info('scheduleMatchSoon nudge job scheduled');
}

/**
 * EARLY_SEASON_NUDGE: Season started 14 days ago; user has 0 completed matches.
 * Runs daily at 10:00 AM.
 */
export function scheduleEarlySeasonNudges(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running earlySeasonNudge job');
      const now = dayjs().tz(MYT);
      const from = now.subtract(15, 'day').toDate();
      const to = now.subtract(13, 'day').toDate();

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE', startDate: { gte: from, lte: to } },
        include: { divisions: { select: { id: true } } },
      });

      for (const season of activeSeasons) {
        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const played = await prisma.match.count({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
            });
            if (played === 0) {
              const notif = leagueLifecycleNotifications.earlySeasonNudge();
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('earlySeasonNudge job complete');
    } catch (error) {
      logger.error('Failed to run earlySeasonNudge job', {}, error as Error);
    }
  });
  logger.info('earlySeasonNudge job scheduled');
}

/**
 * LATE_SEASON_NUDGE: Season ends in 14 days; sent to all division members.
 * Runs daily at 10:00 AM.
 */
export function scheduleLateSeasonNudges(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running lateSeasonNudge job');
      const now = dayjs().tz(MYT);
      const from = now.add(13, 'day').toDate();
      const to = now.add(15, 'day').toDate();

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE', endDate: { gte: from, lte: to } },
        include: { divisions: { select: { id: true } } },
      });

      for (const season of activeSeasons) {
        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          const userIds = members.map((m) => m.userId);
          if (userIds.length === 0) continue;
          const notif = leagueLifecycleNotifications.lateSeasonNudge();
          await notificationService.createNotification({
            ...notif,
            userIds,
            divisionId: division.id,
            seasonId: season.id,
            skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
          });
        }
      }
      logger.info('lateSeasonNudge job complete');
    } catch (error) {
      logger.error('Failed to run lateSeasonNudge job', {}, error as Error);
    }
  });
  logger.info('lateSeasonNudge job scheduled');
}

/**
 * INACTIVE_PLAYER_WARNING_7_DAYS: User's last COMPLETED match in division > 7 days ago.
 * Runs daily at 10:00 AM.
 */
export function scheduleInactivePlayer7dWarnings(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running inactivePlayerWarning7d job');
      const now = dayjs().tz(MYT);
      const threshold = now.subtract(7, 'day').toDate();

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE' },
        include: { divisions: { select: { id: true } } },
      });

      for (const season of activeSeasons) {
        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const lastMatch = await prisma.match.findFirst({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
              orderBy: { matchDate: 'desc' },
              select: { matchDate: true },
            });
            if (lastMatch?.matchDate && lastMatch.matchDate < threshold) {
              const notif = leagueLifecycleNotifications.inactivePlayerWarning7Days();
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('inactivePlayerWarning7d job complete');
    } catch (error) {
      logger.error('Failed to run inactivePlayerWarning7d job', {}, error as Error);
    }
  });
  logger.info('inactivePlayerWarning7d job scheduled');
}

/**
 * INACTIVITY_DURING_LEAGUE_SEASON_2_WEEKS: User has ≥1 match played AND last was > 14 days ago.
 * Runs daily at 10:00 AM.
 */
export function scheduleInactivity2WeeksWarnings(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running inactivity2Weeks job');
      const now = dayjs().tz(MYT);
      const threshold = now.subtract(14, 'day').toDate();

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE' },
        include: { divisions: { select: { id: true } } },
      });

      for (const season of activeSeasons) {
        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const lastMatch = await prisma.match.findFirst({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
              orderBy: { matchDate: 'desc' },
              select: { matchDate: true },
            });
            // Must have at least one match but last one is over 14 days ago
            if (lastMatch?.matchDate && lastMatch.matchDate < threshold) {
              const notif = leagueLifecycleNotifications.inactivityDuringLeagueSeason2Weeks();
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('inactivity2Weeks job complete');
    } catch (error) {
      logger.error('Failed to run inactivity2Weeks job', {}, error as Error);
    }
  });
  logger.info('inactivity2Weeks job scheduled');
}

/**
 * INACTIVITY_DEADLINE_7_DAYS: User has 0 matches played AND the season midpoint is 7 days away.
 * Runs daily at 10:00 AM.
 */
export function scheduleInactivityDeadline7d(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running inactivityDeadline7d job');
      const now = dayjs().tz(MYT);

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE', startDate: { not: null }, endDate: { not: null } },
        include: {
          divisions: { select: { id: true } },
          leagues: { select: { name: true } },
        },
      });

      for (const season of activeSeasons) {
        if (!season.startDate || !season.endDate) continue;
        const midpoint = dayjs(season.startDate).add(
          (season.endDate.getTime() - season.startDate.getTime()) / 2,
          'millisecond'
        );
        const daysUntilMidpoint = midpoint.diff(now, 'day');
        if (daysUntilMidpoint < 6 || daysUntilMidpoint > 8) continue;

        const midpointDateStr = midpoint.format('D MMM YYYY');

        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const played = await prisma.match.count({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
            });
            if (played === 0) {
              const notif = leagueLifecycleNotifications.inactivityDeadline7Days(midpointDateStr);
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 6 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('inactivityDeadline7d job complete');
    } catch (error) {
      logger.error('Failed to run inactivityDeadline7d job', {}, error as Error);
    }
  });
  logger.info('inactivityDeadline7d job scheduled');
}

/**
 * INACTIVITY_DEADLINE_3_DAYS: User has 0 matches played AND the season midpoint is 3 days away.
 * Runs daily at 10:00 AM.
 */
export function scheduleInactivityDeadline3d(): void {
  scheduleCron('0 10 * * *', async () => {
    try {
      logger.info('Running inactivityDeadline3d job');
      const now = dayjs().tz(MYT);

      const activeSeasons = await prisma.season.findMany({
        where: { status: 'ACTIVE', startDate: { not: null }, endDate: { not: null } },
        include: {
          divisions: { select: { id: true } },
          leagues: { select: { name: true } },
        },
      });

      for (const season of activeSeasons) {
        if (!season.startDate || !season.endDate) continue;
        const midpoint = dayjs(season.startDate).add(
          (season.endDate.getTime() - season.startDate.getTime()) / 2,
          'millisecond'
        );
        const daysUntilMidpoint = midpoint.diff(now, 'day');
        if (daysUntilMidpoint < 2 || daysUntilMidpoint > 4) continue;

        const midpointDateStr = midpoint.format('D MMM YYYY');
        const leagueName = season.leagues?.[0]?.name ?? season.name ?? 'the league';

        for (const division of season.divisions) {
          const members = await prisma.divisionAssignment.findMany({
            where: { divisionId: division.id },
            select: { userId: true },
          });
          for (const member of members) {
            const played = await prisma.match.count({
              where: {
                status: 'COMPLETED',
                participants: { some: { userId: member.userId } },
                divisionId: division.id,
              },
            });
            if (played === 0) {
              const notif = leagueLifecycleNotifications.inactivityDeadline3Days(midpointDateStr, leagueName);
              await notificationService.createNotification({
                ...notif,
                userIds: member.userId,
                divisionId: division.id,
                seasonId: season.id,
                skipDuplicateWithinMs: 2 * 24 * 60 * 60 * 1000,
              });
            }
          }
        }
      }
      logger.info('inactivityDeadline3d job complete');
    } catch (error) {
      logger.error('Failed to run inactivityDeadline3d job', {}, error as Error);
    }
  });
  logger.info('inactivityDeadline3d job scheduled');
}

/**
 * NOTIF-051: Season Complete Banner
 * Runs daily at 8:00 PM (Malaysia time). Finds seasons whose endDate was
 * yesterday and sends the "Season Results" banner to all active members.
 */
export function scheduleLeagueCompleteBannerNotifications(): void {
  scheduleCron('0 20 * * *', async () => {
    try {
      logger.info('Running season complete banner job');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      const seasons = await prisma.season.findMany({
        where: {
          endDate: { gte: yesterday, lte: endOfYesterday },
          status: { in: ['FINISHED', 'ACTIVE'] },
        },
        include: { leagues: { select: { id: true, name: true } } },
      });

      for (const season of seasons) {
        try {
          const members = await prisma.seasonMembership.findMany({
            where: { seasonId: season.id, status: 'ACTIVE' },
            select: { userId: true },
          });
          if (members.length === 0) continue;

          const leagueName = season.leagues?.[0]?.name ?? '';
          const leagueId = season.leagues?.[0]?.id;
          const notif = leagueLifecycleNotifications.leagueCompleteBanner(leagueName, season.name);

          await notificationService.createNotification({
            userIds: members.map(m => m.userId),
            ...notif,
            seasonId: season.id,
            metadata: { ...notif.metadata, seasonId: season.id, ...(leagueId ? { leagueId } : {}) },
            skipDuplicateWithinMs: 25 * 60 * 60 * 1000,
          });

          logger.info('Season complete banner sent', { seasonId: season.id, seasonName: season.name, count: members.length });
        } catch (innerErr) {
          logger.error('Failed sending season complete banner', { seasonId: season.id }, innerErr as Error);
        }
      }

      logger.info('Season complete banner job done', { seasons: seasons.length });
    } catch (error) {
      logger.error('Failed to run season complete banner job', {}, error as Error);
    }
  });
  logger.info('Season complete banner job scheduled');
}

/**
 * NOTIF-013: Streak At Risk — push notification sent when a player has an
 * active weekly match streak but hasn't played in 6 days.
 *
 * Logic:
 *  1. Find all users whose most-recent completed match was between 6 and 7
 *     days ago (the critical "play today or lose your streak" window).
 *  2. For each user, verify they have no completed match within the last 6
 *     days (confirming 6 days ago is genuinely their most recent).
 *  3. Check they played the week before that match — i.e. streak ≥ 2 — so
 *     we only nudge players who actually have an ongoing streak.
 *  4. Send a push notification with a 7-day dedup window.
 *
 * Runs daily at 9:00 AM Malaysia time.
 */
export function scheduleStreakAtRiskNotifications(): void {
  scheduleCron('0 9 * * *', async () => {
    try {
      logger.info('Running NOTIF-013: streak-at-risk job');

      const now = dayjs().tz(MALAYSIA_TIMEZONE);
      const sixDaysAgo  = now.subtract(6, 'day').startOf('day').toDate();
      const sevenDaysAgo = now.subtract(7, 'day').startOf('day').toDate();

      // Collect userIds from matches completed in the 6-7 day window
      const candidates = await prisma.matchParticipant.findMany({
        where: {
          match: {
            status: 'COMPLETED',
            matchDate: { gte: sevenDaysAgo, lt: sixDaysAgo },
          },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      if (candidates.length === 0) return;

      // Deadline label for the notification message (end of current week, Sunday)
      const daysUntilSunday = (7 - now.day()) % 7 || 7; // 0=Sun, so today=Sun → 7
      const deadline = now.add(daysUntilSunday, 'day').format('dddd, D MMM');

      let sent = 0;
      for (const { userId } of candidates) {
        if (!userId) continue;

        try {
          // Guard: make sure they truly haven't played in the last 6 days
          const recentMatch = await prisma.match.findFirst({
            where: {
              participants: { some: { userId } },
              status: 'COMPLETED',
              matchDate: { gte: sixDaysAgo },
            },
            select: { id: true },
          });
          if (recentMatch) continue; // played more recently — not at risk

          // Guard: verify they have a streak ≥ 2 (played in the week before last match)
          const weekBeforeWindow = now.subtract(14, 'day').startOf('day').toDate();
          const matchInPriorWeek = await prisma.match.findFirst({
            where: {
              participants: { some: { userId } },
              status: 'COMPLETED',
              matchDate: { gte: weekBeforeWindow, lt: sevenDaysAgo },
            },
            select: { id: true },
          });
          if (!matchInPriorWeek) continue; // no prior-week match → no streak to protect

          await notificationService.createNotification({
            ...accountNotifications.streakAtRisk(2, deadline),
            userIds: userId,
            skipDuplicateWithinMs: 7 * 24 * 60 * 60 * 1000,
          });
          sent++;
        } catch (innerErr) {
          logger.error('NOTIF-013: Failed for user', { userId }, innerErr as Error);
        }
      }

      logger.info('NOTIF-013: Streak-at-risk notifications sent', { sent, checked: candidates.length });
    } catch (error) {
      logger.error('NOTIF-013: Failed to run streak-at-risk job', {}, error as Error);
    }
  });

  logger.info('NOTIF-013: Streak-at-risk job scheduled (daily 9am MYT)');
}

/**
 * Initialize core notification jobs (Tier 1 + Tier 2).
 * These are safe, well-tested, and essential for user experience.
 *
 * NOTE: schedulePushTokenCleanup() and scheduleMatchStreakReEvaluation()
 * are registered separately in server.ts — NOT included here to avoid duplicates.
 */
export function initializeCoreNotificationJobs(): void {
  logger.info("Initializing core notification jobs...");

  // ── Tier 1: Match reminders (directly satisfy testing requirements) ──
  scheduleMatch24hReminders();           // Hourly — 24h before match
  scheduleMatch2hReminders();            // Every 15min — 2h before match
  scheduleMatchMorningReminders();       // Daily 8am — match day reminder
  scheduleScoreSubmissionReminders();    // Every 5min — nudge 15min after match
  schedulePendingScoreNotifications();   // Hourly — NOTIF-098/099: 20h after match, no score/confirm

  // ── Tier 1: Season lifecycle (directly satisfy testing requirements) ──
  scheduleSeasonStartingSoonNotifications();  // Daily 10am — 3 days before start
  scheduleSeasonStartsTomorrowNotifications(); // Daily 8pm — 1 day before start
  scheduleSeasonStartedNotifications();       // Daily 8am — season start day
  scheduleLeagueCompleteBannerNotifications(); // Daily 8pm — day after season ends (NOTIF-051: Season Complete Banner)

  // ── Tier 1: Registration deadline reminders ──
  scheduleRegistrationClosing3Days();    // Daily 10am — 3 days before deadline
  scheduleRegistrationClosing24h();      // Daily 10am — 24h before deadline

  // ── Tier 2: Secondary but useful ──
  scheduleFinalWeekAlerts();             // Mon 10am — last week of season
  scheduleLastMatchDeadline48h();        // Daily 10am — 48h before season end
  scheduleTeamRegistrationReminder2h();      // Every 30min — doubles team deadline (legacy)
  scheduleTeamRegistrationReminder24h();     // Every 30min — NOTIF-027: captain 24h after team confirmed
  scheduleWaitingForCaptain();               // Every 30min — NOTIF-029: partner 24h after team confirmed
  scheduleRegistrationDeadlineCaptain();     // Daily 8pm  — NOTIF-028: captain 24h before deadline
  scheduleRegistrationDeadlinePartner();     // Daily 8pm  — NOTIF-030: partner 24h before deadline

  // ── Tier 2: Activity nudge jobs ──
  scheduleMatchSoonNudges();              // Daily 10am — 7d into season, no matches
  scheduleEarlySeasonNudges();            // Daily 10am — 14d into season, no matches
  scheduleLateSeasonNudges();             // Daily 10am — 14d before season end
  scheduleInactivePlayer7dWarnings();     // Daily 10am — last match > 7d ago
  scheduleInactivity2WeeksWarnings();     // Daily 10am — last match > 14d ago
  scheduleInactivityDeadline7d();         // Daily 10am — 0 matches, midpoint 7d away
  scheduleInactivityDeadline3d();         // Daily 10am — 0 matches, midpoint 3d away

  // ── Tier 2: Streak gamification ──
  scheduleStreakAtRiskNotifications();    // Daily 9am — NOTIF-013: streak at risk after 6d inactivity

  // This helper registers 14 crons. server.ts also wires 4 infrastructure crons
  // (schedulePushTokenCleanup, scheduleMatchStreakReEvaluation, scheduleSeasonAutoFinish,
  // scheduleSessionCleanup) plus 3 inline cron.schedule() business-logic jobs
  // (expire invitations, match invitation expiration, auto-approval/walkover) —
  // 21 crons total in production.
  logger.info("Core notification jobs initialized (27 here, 21 total in prod)");
}

/**
 * Initialize ALL notification jobs including analytics and engagement crons.
 * Call this instead of initializeCoreNotificationJobs() when ready for production scale.
 *
 * TODO(production): Enable these when ready:
 *   - scheduleMidSeasonUpdates()     — Mon 10am, queries all active season divisions. Test DB load first.
 *   - scheduleWeeklyRankingUpdates() — Mon 8am, sends per-division ranking updates. Same scale concern.
 *   - scheduleMonthlyDMRRecaps()     — Last day of month 8pm, sends to ALL users with ratings. Batch carefully.
 *   - scheduleProfileReminders()     — Daily 6pm, checks new users' profiles. Could spam if many incomplete.
 *
 * Before enabling Tier 3:
 *   1. Verify DB query performance with production data volume
 *   2. Test deduplication windows work correctly under load
 *   3. Add rate limiting per user per notification type
 *   4. Monitor push delivery success rates for 1-2 weeks with Tier 1+2
 */
export function initializeAllNotificationJobs(): void {
  logger.info("Initializing ALL notification jobs...");

  // Core jobs (Tier 1 + Tier 2)
  initializeCoreNotificationJobs();

  // Tier 3: Analytics & engagement (heavier queries, enable when production-ready)
  scheduleMidSeasonUpdates();
  scheduleWeeklyRankingUpdates();
  scheduleMonthlyDMRRecaps();
  scheduleProfileReminders();

  logger.info("✅ All notification jobs initialized (18 crons active)");
}
