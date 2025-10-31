// import app from "./app";
import { httpServer } from "./app";
import dotenv from "dotenv";
import cron from "node-cron";
import { expireOldSeasonInvitations } from "./services/seasonInvitationService";
import { expireOldRequests } from "./services/pairingService";

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
cron.schedule('0 0 * * *', async () => {
  console.log('🕒 Running scheduled task: Expiring old invitations...');
  try {
    const expiredInvitations = await expireOldSeasonInvitations();
    const expiredRequests = await expireOldRequests();
    console.log(`✅ Expired ${expiredInvitations} season invitations and ${expiredRequests} pair requests`);
  } catch (error) {
    console.error('❌ Error expiring invitations:', error);
  }
});

console.log('⏰ Cron job scheduled: Daily expiration check at midnight');
