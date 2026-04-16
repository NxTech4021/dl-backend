/**
 * Match Notification Service
 * Handles all notifications related to match lifecycle
 */

import { notificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notifications';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { formatMatchDate, formatMatchTime } from '../../utils/timezone';
import { MatchStatus } from '@prisma/client';
import { filterUsersByPreference } from './notificationPreferenceService';

/**
 * Send match scheduled notification to both players
 */
export async function sendMatchScheduledNotification(
  matchId: string,
  player1Id: string,
  player2Id: string
): Promise<void> {
  try {
    console.log('🎾 [MatchNotification] Sending match scheduled notification:', { matchId, player1Id, player2Id });
    
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        matchDate: true,
        venue: true,
        location: true,
      },
    });

    if (!match) {
      console.warn('⚠️  [MatchNotification] Match not found for scheduled notification');
      logger.warn('Match not found for scheduled notification', { matchId });
      return;
    }

    const date = match.matchDate ? formatMatchDate(match.matchDate) : 'TBD';
    const time = match.matchDate ? formatMatchTime(match.matchDate) : 'TBD';
    const venue = match.venue || match.location || 'TBD';

    // Get player names
    const [player1, player2] = await Promise.all([
      prisma.user.findUnique({ where: { id: player1Id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: player2Id }, select: { name: true } }),
    ]);

    console.log('📅 [MatchNotification] Match details:', { date, time, venue, player1: player1?.name, player2: player2?.name });

    // F-62: respect per-user matchReminders preference.
    const recipients = new Set(
      await filterUsersByPreference([player1Id, player2Id], 'matchReminders')
    );

    // Notify both players
    const scheduledNotifP1 = notificationTemplates.match.matchScheduled(
      player2?.name || 'Opponent',
      date,
      time,
      venue
    );
    const scheduledNotifP2 = notificationTemplates.match.matchScheduled(
      player1?.name || 'Opponent',
      date,
      time,
      venue
    );

    const sends: Promise<unknown>[] = [];
    if (recipients.has(player1Id)) {
      sends.push(notificationService.createNotification({
        ...scheduledNotifP1,
        userIds: player1Id,
        matchId,
      }));
    }
    if (recipients.has(player2Id)) {
      sends.push(notificationService.createNotification({
        ...scheduledNotifP2,
        userIds: player2Id,
        matchId,
      }));
    }
    await Promise.all(sends);

    console.log('✅ [MatchNotification] Match scheduled notifications sent successfully');
    logger.info('Match scheduled notifications sent', { matchId, player1Id, player2Id });
  } catch (error) {
    console.error('❌ [MatchNotification] Failed to send match scheduled notifications:', error);
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
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    if (!match || match.participants.length < 2) return;

    const date = match.matchDate ? formatMatchDate(match.matchDate) : 'TBD';
    const time = match.matchDate ? formatMatchTime(match.matchDate) : 'TBD';
    const venue = match.venue || match.location || 'TBD';

    const player1 = match.participants[0];
    const player2 = match.participants[1];

    // Skip if either participant's userId is null (deleted user — onDelete:SetNull
    // per Prisma schema). Previously only checked player existence, not userId.
    if (!player1?.userId || !player2?.userId) return;

    // F-62: respect per-user matchReminders preference.
    const recipients = new Set(
      await filterUsersByPreference([player1.userId, player2.userId], 'matchReminders')
    );

    const reminderP1 = notificationTemplates.match.matchReminder24h(
      player2.user?.name || 'Opponent',
      date,
      time,
      venue
    );
    const reminderP2 = notificationTemplates.match.matchReminder24h(
      player1.user?.name || 'Opponent',
      date,
      time,
      venue
    );

    const sends: Promise<unknown>[] = [];
    if (recipients.has(player1.userId)) {
      sends.push(notificationService.createNotification({
        ...reminderP1,
        userIds: player1.userId,
        matchId,
      }));
    }
    if (recipients.has(player2.userId)) {
      sends.push(notificationService.createNotification({
        ...reminderP2,
        userIds: player2.userId,
        matchId,
      }));
    }
    await Promise.all(sends);

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
        matchDate: true,
        venue: true,
        location: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    if (!match || match.participants.length < 2) return;

    const time = match.matchDate ? formatMatchTime(match.matchDate) : 'TBD';
    const venue = match.venue || match.location || 'TBD';
    const player1 = match.participants[0];
    const player2 = match.participants[1];

    // Skip if either participant's userId is null (deleted user — onDelete:SetNull).
    if (!player1?.userId || !player2?.userId) return;

    // F-62: respect per-user matchReminders preference.
    const recipients = new Set(
      await filterUsersByPreference([player1.userId, player2.userId], 'matchReminders')
    );

    const reminder2hP1 = notificationTemplates.match.matchReminder2h(
      player2.user?.name || 'Opponent',
      time,
      venue
    );
    const reminder2hP2 = notificationTemplates.match.matchReminder2h(
      player1.user?.name || 'Opponent',
      time,
      venue
    );

    const sends: Promise<unknown>[] = [];
    if (recipients.has(player1.userId)) {
      sends.push(notificationService.createNotification({
        ...reminder2hP1,
        userIds: player1.userId,
        matchId,
      }));
    }
    if (recipients.has(player2.userId)) {
      sends.push(notificationService.createNotification({
        ...reminder2hP2,
        userIds: player2.userId,
        matchId,
      }));
    }
    await Promise.all(sends);

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
        participants: {
          where: { invitationStatus: 'ACCEPTED' },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    // Only send if at least 2 accepted participants (singles) or 4 (doubles)
    if (!match || match.participants.length < 2) return;

    const acceptedUserIds = match.participants
      .map(p => p.userId)
      .filter((id): id is string => id !== null);

    if (acceptedUserIds.length < 2) return;

    // F-62: respect per-user matchReminders preference (score submission is a reminder).
    const allowed = new Set(
      await filterUsersByPreference(acceptedUserIds, 'matchReminders')
    );

    const reminderNotif = notificationTemplates.match.scoreSubmissionReminder;

    // Send to each accepted participant with opponent name context
    for (const participant of match.participants) {
      if (!participant.userId) continue;
      if (!allowed.has(participant.userId)) continue;

      // Find an opponent name for context
      const opponent = match.participants.find(p =>
        p.userId !== participant.userId && p.team !== participant.team
      );
      const opponentName = opponent?.user?.name || 'Opponent';

      await notificationService.createNotification({
        ...reminderNotif(opponentName),
        userIds: participant.userId,
        matchId,
        // One reminder per match per 24h max — the cron runs every 5 min over
        // a 5-min window slot, so within-same-instance dedup isn't strictly needed,
        // but this closes the multi-instance race (NS-16/NS-17).
        skipDuplicateWithinMs: 24 * 60 * 60 * 1000,
      });
    }

    logger.info('Score submission reminder sent', { matchId, participantCount: acceptedUserIds.length });
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

    // F-62: respect per-user matchResults preference.
    const allowed = await filterUsersByPreference([opponentId], 'matchResults');
    if (allowed.length === 0) return;

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

    // F-62: respect per-user disputeAlerts preference.
    const recipients = new Set(
      await filterUsersByPreference([player1Id, player2Id], 'disputeAlerts')
    );

    const disputeNotif = notificationTemplates.match.scoreDisputeAlert;

    const sends: Promise<unknown>[] = [];
    if (recipients.has(player1Id)) {
      sends.push(notificationService.createNotification({
        ...disputeNotif(player2?.name || 'Opponent'),
        userIds: player1Id,
        matchId,
      }));
    }
    if (recipients.has(player2Id)) {
      sends.push(notificationService.createNotification({
        ...disputeNotif(player1?.name || 'Opponent'),
        userIds: player2Id,
        matchId,
      }));
    }
    await Promise.all(sends);

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
    const canceller = await prisma.user.findUnique({
      where: { id: cancelledById },
      select: { name: true }
    });

    // F-62: respect per-user matchCancelled preference.
    const allowed = await filterUsersByPreference([opponentId], 'matchCancelled');
    if (allowed.length === 0) return;

    const cancelledNotif = notificationTemplates.match.matchCancelled(
      canceller?.name || 'Opponent'
    );

    await notificationService.createNotification({
      ...cancelledNotif,
      userIds: opponentId,
      matchId,
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
  newVenue?: string
): Promise<void> {
  try {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { name: true }
    });

    // F-62: respect per-user matchRescheduled preference.
    const allowed = await filterUsersByPreference([opponentId], 'matchRescheduled');
    if (allowed.length === 0) return;

    const date = formatMatchDate(newDate);
    const time = formatMatchTime(newDate);
    const venue = newVenue || 'TBD';

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
    // Get recent completed matches for this player
    const recentMatches = await prisma.match.findMany({
      where: {
        participants: {
          some: { userId }
        },
        status: MatchStatus.COMPLETED,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        team1Score: true,
        team2Score: true,
        participants: {
          where: { userId },
          select: { team: true }
        }
      },
    });

    // Count consecutive wins from most recent
    let streakCount = 0;
    for (const match of recentMatches) {
      const userParticipant = match.participants[0];
      if (!userParticipant) continue;

      const isTeam1 = userParticipant.team === 'team1';
      const won = isTeam1
        ? (match.team1Score ?? 0) > (match.team2Score ?? 0)
        : (match.team2Score ?? 0) > (match.team1Score ?? 0);

      if (won) {
        streakCount++;
      } else {
        break;
      }
    }

    // Send notification if streak is 2 or more
    if (streakCount >= 2) {
      // F-62: respect per-user matchResults preference (streak fires on completion).
      const allowed = await filterUsersByPreference([userId], 'matchResults');
      if (allowed.length === 0) return;

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
