/**
 * Match Notification Service
 * Handles all notifications related to match lifecycle
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notification';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Send match scheduled notification to both players
 */
export async function sendMatchScheduledNotification(
  matchId: string,
  player1Id: string,
  player2Id: string
): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        scheduledAt: true,
        courtId: true,
        court: {
          select: { name: true },
        },
      },
    });

    if (!match) {
      logger.warn('Match not found for scheduled notification', { matchId });
      return;
    }

    const date = match.scheduledAt?.toLocaleDateString() || 'TBD';
    const time = match.scheduledAt?.toLocaleTimeString() || 'TBD';
    const venue = match.court?.name || 'TBD';

    // Get player names
    const [player1, player2] = await Promise.all([
      prisma.user.findUnique({ where: { id: player1Id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: player2Id }, select: { name: true } }),
    ]);

    // Notify both players
    await Promise.all([
      notificationService.createNotification({
        type: 'MATCH_SCHEDULED',
        category: 'MATCH',
        title: 'Match Confirmed!',
        message: `You are playing ${player2?.name} on ${date} at ${time} at ${venue}`,
        userIds: player1Id,
        matchId,
        metadata: { opponentName: player2?.name, date, time, venue },
      }),
      notificationService.createNotification({
        type: 'MATCH_SCHEDULED',
        category: 'MATCH',
        title: 'Match Confirmed!',
        message: `You are playing ${player1?.name} on ${date} at ${time} at ${venue}`,
        userIds: player2Id,
        matchId,
        metadata: { opponentName: player1?.name, date, time, venue },
      }),
    ]);

    logger.info('Match scheduled notifications sent', { matchId, player1Id, player2Id });
  } catch (error) {
    logger.error('Failed to send match scheduled notifications', { matchId }, error as Error);
  }
}

/**
 * Send match reminder notification (24 hours before)
 */
export async function sendMatchReminder24h(matchId: string): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        scheduledAt: true,
        court: { select: { name: true } },
        player1Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
        player2Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
      },
    });

    if (!match) return;

    const time = match.scheduledAt?.toLocaleTimeString() || 'TBD';
    const venue = match.court?.name || 'TBD';

    const player1Id = match.player1Registration.playerId;
    const player2Id = match.player2Registration.playerId;
    const player1Name = match.player1Registration.player.name;
    const player2Name = match.player2Registration.player.name;

    await Promise.all([
      notificationService.createNotification({
        type: 'MATCH_REMINDER',
        category: 'MATCH',
        title: 'Match Tomorrow',
        message: `You are playing ${player2Name} tomorrow at ${time} at ${venue}`,
        userIds: player1Id,
        matchId,
        metadata: { opponentName: player2Name, time, venue },
      }),
      notificationService.createNotification({
        type: 'MATCH_REMINDER',
        category: 'MATCH',
        title: 'Match Tomorrow',
        message: `You are playing ${player1Name} tomorrow at ${time} at ${venue}`,
        userIds: player2Id,
        matchId,
        metadata: { opponentName: player1Name, time, venue },
      }),
    ]);

    logger.info('24h match reminder sent', { matchId });
  } catch (error) {
    logger.error('Failed to send 24h match reminder', { matchId }, error as Error);
  }
}

/**
 * Send match reminder notification (2 hours before)
 */
export async function sendMatchReminder2h(matchId: string): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        court: { select: { name: true } },
        player1Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
        player2Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
      },
    });

    if (!match) return;

    const venue = match.court?.name || 'TBD';
    const player1Id = match.player1Registration.playerId;
    const player2Id = match.player2Registration.playerId;
    const player1Name = match.player1Registration.player.name;
    const player2Name = match.player2Registration.player.name;

    await Promise.all([
      notificationService.createNotification({
        type: 'MATCH_REMINDER',
        category: 'MATCH',
        title: 'Match Starting Soon',
        message: `Get ready! You are playing ${player2Name} in 2 hours at ${venue}`,
        userIds: player1Id,
        matchId,
        metadata: { opponentName: player2Name, venue },
      }),
      notificationService.createNotification({
        type: 'MATCH_REMINDER',
        category: 'MATCH',
        title: 'Match Starting Soon',
        message: `Get ready! You are playing ${player1Name} in 2 hours at ${venue}`,
        userIds: player2Id,
        matchId,
        metadata: { opponentName: player1Name, venue },
      }),
    ]);

    logger.info('2h match reminder sent', { matchId });
  } catch (error) {
    logger.error('Failed to send 2h match reminder', { matchId }, error as Error);
  }
}

/**
 * Send score submission reminder (15 minutes after match)
 */
export async function sendScoreSubmissionReminder(matchId: string): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        player1Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
        player2Registration: {
          select: { playerId: true, player: { select: { name: true } } },
        },
      },
    });

    if (!match) return;

    const player1Id = match.player1Registration.playerId;
    const player2Id = match.player2Registration.playerId;
    const player1Name = match.player1Registration.player.name;
    const player2Name = match.player2Registration.player.name;

    const reminderNotif = notificationTemplates.match.scoreSubmissionReminder;

    await Promise.all([
      notificationService.createNotification({
        ...reminderNotif(player2Name || ''),
        userIds: player1Id,
        matchId,
      }),
      notificationService.createNotification({
        ...reminderNotif(player1Name || ''),
        userIds: player2Id,
        matchId,
      }),
    ]);

    logger.info('Score submission reminder sent', { matchId });
  } catch (error) {
    logger.error('Failed to send score submission reminder', { matchId }, error as Error);
  }
}

/**
 * Send score submitted notification to opponent
 */
export async function sendOpponentSubmittedScoreNotification(
  matchId: string,
  submitterId: string,
  opponentId: string
): Promise<void> {
  try {
    const submitter = await prisma.user.findUnique({
      where: { id: submitterId },
      select: { name: true },
    });

    const notif = notificationTemplates.match.opponentSubmittedScore(submitter?.name || 'Opponent');

    await notificationService.createNotification({
      ...notif,
      userIds: opponentId,
      matchId,
    });

    logger.info('Opponent submitted score notification sent', { matchId, opponentId });
  } catch (error) {
    logger.error('Failed to send opponent submitted score notification', { matchId }, error as Error);
  }
}

/**
 * Send score dispute alert
 */
export async function sendScoreDisputeAlert(
  matchId: string,
  player1Id: string,
  player2Id: string
): Promise<void> {
  try {
    const [player1, player2] = await Promise.all([
      prisma.user.findUnique({ where: { id: player1Id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: player2Id }, select: { name: true } }),
    ]);

    const disputeNotif = notificationTemplates.match.scoreDisputeAlert;

    await Promise.all([
      notificationService.createNotification({
        ...disputeNotif(player2?.name || 'Opponent'),
        userIds: player1Id,
        matchId,
      }),
      notificationService.createNotification({
        ...disputeNotif(player1?.name || 'Opponent'),
        userIds: player2Id,
        matchId,
      }),
    ]);

    logger.info('Score dispute alert sent', { matchId });
  } catch (error) {
    logger.error('Failed to send score dispute alert', { matchId }, error as Error);
  }
}

/**
 * Send match cancelled notification
 */
export async function sendMatchCancelledNotification(
  matchId: string,
  cancelledById: string,
  opponentId: string
): Promise<void> {
  try {
    const [canceller, match] = await Promise.all([
      prisma.user.findUnique({ where: { id: cancelledById }, select: { name: true } }),
      prisma.match.findUnique({
        where: { id: matchId },
        select: { scheduledAt: true },
      }),
    ]);

    const date = match?.scheduledAt?.toLocaleDateString() || 'TBD';

    await notificationService.createNotification({
      type: 'MATCH_CANCELLED',
      category: 'MATCH',
      title: 'Match Cancelled',
      message: `${canceller?.name} cancelled your league match on ${date}`,
      userIds: opponentId,
      matchId,
      metadata: { cancellerName: canceller?.name, date },
    });

    logger.info('Match cancelled notification sent', { matchId, opponentId });
  } catch (error) {
    logger.error('Failed to send match cancelled notification', { matchId }, error as Error);
  }
}

/**
 * Send match reschedule request notification
 */
export async function sendMatchRescheduleRequest(
  matchId: string,
  requesterId: string,
  opponentId: string,
  newDate: Date,
  newCourtId?: string
): Promise<void> {
  try {
    const [requester, court] = await Promise.all([
      prisma.user.findUnique({ where: { id: requesterId }, select: { name: true } }),
      newCourtId ? prisma.court.findUnique({ where: { id: newCourtId }, select: { name: true } }) : null,
    ]);

    const date = newDate.toLocaleDateString();
    const time = newDate.toLocaleTimeString();
    const venue = court?.name || 'TBD';

    const rescheduleNotif = notificationTemplates.match.matchRescheduleRequest(
      requester?.name || 'Opponent',
      date,
      time,
      venue
    );

    await notificationService.createNotification({
      ...rescheduleNotif,
      userIds: opponentId,
      matchId,
    });

    logger.info('Match reschedule request sent', { matchId, opponentId });
  } catch (error) {
    logger.error('Failed to send match reschedule request', { matchId }, error as Error);
  }
}

/**
 * Send winning streak notification
 */
export async function checkAndSendWinningStreakNotification(
  userId: string,
  matchId: string
): Promise<void> {
  try {
    // Get recent matches for this player
    const recentMatches = await prisma.match.findMany({
      where: {
        OR: [
          { player1Registration: { playerId: userId } },
          { player2Registration: { playerId: userId } },
        ],
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        winnerId: true,
      },
    });

    // Count consecutive wins from most recent
    let streakCount = 0;
    for (const match of recentMatches) {
      if (match.winnerId === userId) {
        streakCount++;
      } else {
        break;
      }
    }

    // Send notification if streak is 2 or more
    if (streakCount >= 2) {
      const streakNotif = notificationTemplates.match.winningStreak(streakCount);

      await notificationService.createNotification({
        ...streakNotif,
        userIds: userId,
        matchId,
      });

      logger.info('Winning streak notification sent', { userId, streakCount });
    }
  } catch (error) {
    logger.error('Failed to check/send winning streak notification', { userId }, error as Error);
  }
}
