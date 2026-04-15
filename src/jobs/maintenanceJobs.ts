/**
 * Database maintenance crons. Kept separate from notificationJobs.ts because
 * these are pure DB hygiene - no notification side effects.
 */

import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { notificationService } from "../services/notificationService";

const CRON_TZ = { timezone: "Asia/Kuala_Lumpur" };

/**
 * Session cleanup - better-auth creates a Session row per login with 30-day
 * expiry. Expired sessions are checked at auth time but never purged. Over
 * months/years the table grows unbounded. Weekly cleanup keeps it lean.
 *
 * Runs Sundays 3am MYT - low-traffic window.
 */
export function scheduleSessionCleanup(): void {
  cron.schedule('0 3 * * 0', async () => {
    try {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info('Session cleanup: deleted expired sessions', { deleted: result.count });
      }
    } catch (error) {
      logger.error('Session cleanup failed', {}, error instanceof Error ? error : new Error(String(error)));
    }
  }, CRON_TZ);

  logger.info('Session cleanup cron scheduled (Sun 3am MYT)');
}

/**
 * Notification cleanup — deletes UserNotifications and Notifications older than
 * 90 days. The service method already exists (notificationService.deleteOldNotifications);
 * this cron simply wires it up. Without it, the table grows unbounded as the
 * app ages — at projected volumes, 100k+ rows/year for a modest user base.
 *
 * Runs Sundays 4am MYT — one hour after session cleanup to avoid contention.
 */
export function scheduleNotificationCleanup(): void {
  cron.schedule('0 4 * * 0', async () => {
    try {
      const result = await notificationService.deleteOldNotifications(90);
      if (result.count > 0) {
        logger.info('Notification cleanup: deleted old notifications', { deleted: result.count });
      }
    } catch (error) {
      logger.error('Notification cleanup failed', {}, error instanceof Error ? error : new Error(String(error)));
    }
  }, CRON_TZ);

  logger.info('Notification cleanup cron scheduled (Sun 4am MYT)');
}
