/**
 * Match Reminder Service
 * Sends 24-hour reminders for upcoming matches
 */

import { prisma } from '../../lib/prisma';
import { NotificationService } from '../notificationService';
import { filterUsersByPreference } from './notificationPreferenceService';
import { logger } from '../../utils/logger';

export class MatchReminderService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Send reminders for matches scheduled in the next 24 hours
   * Should be called by cron job every hour
   */
  async sendUpcomingMatchReminders(): Promise<{
    matchesChecked: number;
    remindersSent: number;
  }> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    // Find matches scheduled between 23-24 hours from now
    // This ensures we only send one reminder per match
    const upcomingMatches = await prisma.match.findMany({
      where: {
        scheduledTime: {
          gte: in23Hours,
          lt: in24Hours
        },
        status: 'SCHEDULED'
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        division: {
          select: { name: true }
        }
      }
    });

    let remindersSent = 0;

    for (const match of upcomingMatches) {
      try {
        await this.sendReminderForMatch(match);
        remindersSent++;
      } catch (error) {
        logger.error('Failed to send reminder for match', {
          matchId: match.id
        }, error as Error);
      }
    }

    logger.info('Match reminder check completed', {
      matchesChecked: upcomingMatches.length,
      remindersSent
    });

    return {
      matchesChecked: upcomingMatches.length,
      remindersSent
    };
  }

  /**
   * Send reminder notification for a specific match
   */
  private async sendReminderForMatch(match: any): Promise<void> {
    const participantIds = match.participants.map((p: any) => p.user.id);

    // Filter by user preferences
    const recipientIds = await filterUsersByPreference(
      participantIds,
      'matchReminders'
    );

    if (recipientIds.length === 0) {
      logger.debug('No recipients for match reminder', { matchId: match.id });
      return;
    }

    // Format match time
    const matchTime = new Date(match.scheduledTime);
    const timeStr = matchTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const dateStr = matchTime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    // Get opponent name for each participant
    for (const recipientId of recipientIds) {
      const opponents = match.participants
        .filter((p: any) => p.user.id !== recipientId)
        .map((p: any) => p.user.name)
        .join(' & ');

      const locationInfo = match.venue || match.location
        ? `at ${match.venue || match.location}`
        : 'Location TBD';

      await this.notificationService.createNotification({
        userIds: recipientId,
        type: 'MATCH_REMINDER',
        category: 'MATCH',
        title: 'Match Reminder - 24 Hours',
        message: `Your match vs ${opponents} is tomorrow ${dateStr} at ${timeStr} ${locationInfo}.`,
        matchId: match.id
      });
    }

    logger.debug('Match reminder sent', {
      matchId: match.id,
      recipientCount: recipientIds.length
    });
  }

  /**
   * Manually send reminder for a specific match (for testing/admin use)
   */
  async sendManualReminder(matchId: string): Promise<boolean> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        division: {
          select: { name: true }
        }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    await this.sendReminderForMatch(match);
    return true;
  }
}

// Factory function
let matchReminderService: MatchReminderService | null = null;

export function getMatchReminderService(
  notificationService?: NotificationService
): MatchReminderService {
  if (!matchReminderService) {
    matchReminderService = new MatchReminderService(notificationService);
  }
  return matchReminderService;
}
