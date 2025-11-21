// import app from "./app";
import { httpServer } from "./app";
import dotenv from "dotenv";
import cron from "node-cron";
import { expireOldSeasonInvitations } from "./services/seasonInvitationService";
import { expireOldRequests } from "./services/pairingService";
import { getInactivityService } from "./services/inactivityService";
import { NotificationService } from "./services/notificationService";
import { INACTIVITY_CONFIG } from "./config/inactivity.config";
import { getMatchReminderService } from "./services/notification/matchReminderService";

dotenv.config();

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Database URL configured: ${process.env.DATABASE_URL ? "Yes" : "No"}`
  );
});

// ==========================================
// SCHEDULED TASKS (CRON JOBS)
// ==========================================

// Run daily at midnight to expire old invitations and pair requests
cron.schedule("0 0 * * *", async () => {
  console.log("🕒 Running scheduled task: Expiring old invitations...");
  try {
    const expiredInvitations = await expireOldSeasonInvitations();
    const expiredRequests = await expireOldRequests();
    console.log(
      `✅ Expired ${expiredInvitations} season invitations and ${expiredRequests} pair requests`
    );
  } catch (error) {
    console.error("❌ Error expiring invitations:", error);
  }
});

// Run inactivity check at configured time (default: daily at 2:00 AM)
cron.schedule(INACTIVITY_CONFIG.CRON_SCHEDULE, async () => {
  console.log("🕒 Running scheduled task: Checking player inactivity...");
  try {
    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);
    const results = await inactivityService.checkAndUpdateInactivity();
    console.log(
      `✅ Inactivity check complete: ${results.markedInactive} marked inactive, ${results.warnings} warnings sent`
    );
  } catch (error) {
    console.error("❌ Error during inactivity check:", error);
  }
});

// Run match reminder check every hour
cron.schedule("0 * * * *", async () => {
  console.log("🕒 Running scheduled task: Checking for match reminders...");
  try {
    const notificationService = new NotificationService();
    const matchReminderService = getMatchReminderService(notificationService);
    const results = await matchReminderService.sendUpcomingMatchReminders();
    console.log(
      `✅ Match reminder check complete: ${results.matchesChecked} matches checked, ${results.remindersSent} reminders sent`
    );
  } catch (error) {
    console.error("❌ Error during match reminder check:", error);
  }
});

console.log("⏰ Cron jobs scheduled:");
console.log("   - Daily expiration check at midnight");
console.log(`   - Inactivity check at ${INACTIVITY_CONFIG.CRON_SCHEDULE}`);
console.log("   - Match reminder check every hour");
