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
import { NotificationService } from "./services/notificationService";
import { INACTIVITY_CONFIG } from "./config/inactivity.config";
import { getMatchReminderService } from "./services/notification/matchReminderService";
import { initializeNotificationJobs } from "./jobs/notificationJobs";
import { getMatchInvitationService } from "./services/match/matchInvitationService";
import { getMatchResultService } from "./services/match/matchResultService";
import pino from "pino";

// Create server logger
const log = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: true,
      },
    },
  }),
});

// Configure timezone for Malaysia (UTC+8)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Kuala_Lumpur");

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, "0.0.0.0", () => {
  log.info(
    {
      port: PORT,
      env: process.env.NODE_ENV || "development",
      dbConfigured: !!process.env.DATABASE_URL,
      time: dayjs().tz("Asia/Kuala_Lumpur").format("YYYY-MM-DD HH:mm:ss"),
    },
    "Server started"
  );
});

// ==========================================
// SCHEDULED TASKS (CRON JOBS)
// ==========================================

// Run daily at midnight to expire old invitations and pair requests
cron.schedule("0 0 * * *", async () => {
  try {
    const expiredInvitations = await expireOldSeasonInvitations();
    const expiredRequests = await expireOldRequests();
    log.info(
      { expiredInvitations, expiredRequests },
      "Cron: Expired old invitations"
    );
  } catch (error) {
    log.error({ err: error }, "Cron: Failed to expire invitations");
  }
});

// Run inactivity check at configured time (default: daily at 2:00 AM)
cron.schedule(INACTIVITY_CONFIG.CRON_SCHEDULE, async () => {
  try {
    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);
    const results = await inactivityService.checkAndUpdateInactivity();
    log.info(
      { markedInactive: results.markedInactive, warnings: results.warnings },
      "Cron: Inactivity check complete"
    );
  } catch (error) {
    log.error({ err: error }, "Cron: Failed inactivity check");
  }
});

// Run match reminder check every hour
cron.schedule("0 * * * *", async () => {
  try {
    const notificationService = new NotificationService();
    const matchReminderService = getMatchReminderService(notificationService);
    const results = await matchReminderService.sendUpcomingMatchReminders();
    if (results.remindersSent > 0) {
      log.info(
        {
          matchesChecked: results.matchesChecked,
          remindersSent: results.remindersSent,
        },
        "Cron: Match reminders sent"
      );
    }
  } catch (error) {
    log.error({ err: error }, "Cron: Failed match reminder check");
  }
});

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
      log.info(
        {
          invitationsExpired: expirationResults.invitationsExpired,
          matchesMovedToDraft:
            expirationResults.matchesMovedToDraft +
            declinedResults.matchesMovedToDraft,
        },
        "Cron: Match invitation cleanup"
      );
    }
  } catch (error) {
    log.error({ err: error }, "Cron: Failed match invitation check");
  }
});

// Run auto-approval check for match results every hour
cron.schedule("0 * * * *", async () => {
  try {
    const notificationService = new NotificationService();
    const matchResultService = getMatchResultService(notificationService);
    const results = await matchResultService.autoApproveResults();
    if (results.autoApprovedCount > 0) {
      log.info(
        {
          matchesChecked: results.matchesChecked,
          autoApproved: results.autoApprovedCount,
        },
        "Cron: Auto-approved match results"
      );
    }
  } catch (error) {
    log.error({ err: error }, "Cron: Failed auto-approval check");
  }
});

// Initialize all notification jobs
initializeNotificationJobs();

log.info(
  "Cron jobs scheduled: expiration(daily), inactivity(daily), reminders/invitations/auto-approve(hourly)"
);
