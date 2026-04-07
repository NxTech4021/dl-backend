// import app from "./app";
import dotenv from "dotenv";
dotenv.config();

import { httpServer } from "./app";

import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { expireOldSeasonInvitations } from "./services/seasonInvitationService";
import { expireOldRequests } from "./services/pairingService";
import { getInactivityService } from "./services/inactivityService";
import { notificationService } from "./services/notificationService";
import { getAdminUserIds } from "./services/notification/notificationPreferenceService";
import { INACTIVITY_CONFIG } from "./config/inactivity.config";
import { initializeCoreNotificationJobs, schedulePushTokenCleanup, scheduleMatchStreakReEvaluation, scheduleSeasonAutoFinish } from "./jobs/notificationJobs";
import { getMatchInvitationService } from "./services/match/matchInvitationService";
import { getMatchResultService } from "./services/match/matchResultService";
import { logger } from "./utils/logger";
// import pino from "pino";

// // Create server logger
// const log = pino({
//   level: process.env.LOG_LEVEL || "info",
//   ...(process.env.NODE_ENV === "development" && {
//     transport: {
//       target: "pino-pretty",
//       options: {
//         colorize: true,
//         translateTime: "HH:MM:ss",
//         ignore: "pid,hostname",
//         singleLine: true,
//       },
//     },
//   }),
// });

// Configure timezone for Malaysia (UTC+8)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Kuala_Lumpur");

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log("Server started on port", PORT);
  // log.info(
  //   {
  //     port: PORT,
  //     env: process.env.NODE_ENV || "development",
  //     dbConfigured: !!process.env.DATABASE_URL,
  //     time: dayjs().tz("Asia/Kuala_Lumpur").format("YYYY-MM-DD HH:mm:ss"),
  //   },
  //   "Server started"
  // );
});

// ==========================================
// SCHEDULED TASKS (CRON JOBS)
// ==========================================

const CRON_TZ = { timezone: "Asia/Kuala_Lumpur" };

// // Run daily at midnight to expire old invitations and pair requests
// cron.schedule("0 0 * * *", async () => {
//   try {
//     const expiredInvitations = await expireOldSeasonInvitations();
//     const expiredRequests = await expireOldRequests();
//     logger.info("Cron: Expired old invitations", { expiredInvitations, expiredRequests });
//   } catch (error) {
//     logger.error("Cron: Failed to expire invitations", {}, error instanceof Error ? error : new Error(String(error)));
//   }
// }, CRON_TZ);

// // Run inactivity check at configured time (default: daily at 2:00 AM)
// cron.schedule(INACTIVITY_CONFIG.CRON_SCHEDULE, async () => {
//   try {
//     const notificationService = new NotificationService();
//     const inactivityService = getInactivityService(notificationService);
//     const results = await inactivityService.checkAndUpdateInactivity();
//     logger.info("Cron: Inactivity check complete", { markedInactive: results.markedInactive, warnings: results.warnings });
//   } catch (error) {
//     logger.error("Cron: Failed inactivity check", {}, error instanceof Error ? error : new Error(String(error)));
//   }
// }, CRON_TZ);

// Legacy match reminder deleted — superseded by notificationJobs.ts
// (scheduleMatch24hReminders, scheduleMatch2hReminders, scheduleMatchMorningReminders)

// Run match invitation expiration check every hour
cron.schedule("0 * * * *", async () => {
  try {
    const matchInvitationService = getMatchInvitationService();
    const expirationResults =
      await matchInvitationService.checkExpiredInvitations();
    const declinedResults =
      await matchInvitationService.handleFullyDeclinedMatches();

    const totalExpired =
      expirationResults.invitationsExpired +
      expirationResults.matchesMovedToDraft +
      declinedResults.matchesMovedToDraft;
    if (totalExpired > 0) {
      logger.info("Cron: Match invitation cleanup", {
        invitationsExpired: expirationResults.invitationsExpired,
        matchesMovedToDraft:
          expirationResults.matchesMovedToDraft +
          declinedResults.matchesMovedToDraft,
      });
    }
  } catch (error) {
    logger.error("Cron: Failed match invitation check", {}, error instanceof Error ? error : new Error(String(error)));
  }
}, CRON_TZ);

// Run auto-approval check for match results every hour
cron.schedule("0 * * * *", async () => {
  try {
    const matchResultService = getMatchResultService(notificationService);

    // Auto-approve regular score submissions after 24h
    const results = await matchResultService.autoApproveResults();
    if (results.autoApprovedCount > 0) {
      logger.info("Cron: Auto-approved match results", {
        matchesChecked: results.matchesChecked,
        autoApproved: results.autoApprovedCount,
      });
    }

    // Auto-complete undisputed walkovers after 24h
    const walkoverResults = await matchResultService.autoCompleteWalkovers();
    if (walkoverResults.walkoversCompleted > 0) {
      logger.info("Cron: Auto-completed walkovers", {
        walkoversChecked: walkoverResults.walkoversChecked,
        walkoversCompleted: walkoverResults.walkoversCompleted,
      });

      // Notify admins about auto-completed walkovers
      try {
        const adminIds = await getAdminUserIds();
        if (adminIds.length > 0) {
          await notificationService.createNotification({
            type: 'ADMIN_MESSAGE',
            category: 'ADMIN',
            title: 'Walkovers Auto-Completed',
            message: `${walkoverResults.walkoversCompleted} walkover(s) auto-completed after 24h dispute window expired.`,
            userIds: adminIds,
          });
        }
      } catch (notifError) {
        logger.warn('Failed to notify admins about auto-completed walkovers', { error: notifError });
      }
    }
  } catch (error) {
    logger.error("Cron: Failed auto-approval/walkover check", {}, error instanceof Error ? error : new Error(String(error)));
  }
}, CRON_TZ);

// Infrastructure crons (DB maintenance, no user-facing notifications)
schedulePushTokenCleanup();
scheduleMatchStreakReEvaluation();
scheduleSeasonAutoFinish();

// Core notification crons (match reminders, season lifecycle, registration deadlines)
// Tier 1+2: 14 crons — safe, dedup-protected, essential for user experience
initializeCoreNotificationJobs();

// TODO(production): When ready for full analytics notifications, replace with:
//   import { initializeAllNotificationJobs } from "./jobs/notificationJobs";
//   initializeAllNotificationJobs();
// This adds Tier 3: mid-season updates, weekly rankings, monthly DMR recaps, profile reminders.
// See notificationJobs.ts for prerequisites before enabling.
