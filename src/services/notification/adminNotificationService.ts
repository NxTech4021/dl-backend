/**
 * Admin Notification Service
 * Handles sending notifications to admin users
 */

import { NotificationService } from '../notificationService';
import { notificationTemplates } from '../../helpers/notifications';
import {
  getAdminsWithPreference,
  NotificationPreferenceKey
} from './notificationPreferenceService';
import { CreateNotificationData } from '../../types/notificationTypes';
import { logger } from '../../utils/logger';

/**
 * Send notification to all admins who have the preference enabled
 */
export async function notifyAdmins(
  notificationService: NotificationService,
  notification: Omit<CreateNotificationData, 'userIds'>,
  preferenceKey: NotificationPreferenceKey
): Promise<void> {
  try {
    const adminIds = await getAdminsWithPreference(preferenceKey);

    if (adminIds.length === 0) {
      logger.debug('No admins to notify or all have preference disabled', {
        preferenceKey
      });
      return;
    }

    await notificationService.createNotification({
      ...notification,
      userIds: adminIds
    });

    logger.info('Admin notification sent', {
      type: notification.type,
      adminCount: adminIds.length,
      preferenceKey
    });
  } catch (error) {
    logger.error('Failed to send admin notification', {
      type: notification.type
    }, error as Error);
  }
}

/**
 * Notify admins about a new withdrawal request
 */
export async function notifyAdminsWithdrawalRequest(
  notificationService: NotificationService,
  data: {
    playerName: string;
    seasonName: string;
    reason: string;
    seasonId: string;
    withdrawalRequestId: string;
  }
): Promise<void> {
  const notification = notificationTemplates.admin.withdrawalRequest(
    data.playerName,
    data.seasonName,
    data.reason
  );

  await notifyAdmins(
    notificationService,
    {
      ...notification,
      seasonId: data.seasonId,
      withdrawalRequestId: data.withdrawalRequestId
    },
    'withdrawalRequests'
  );
}

/**
 * Notify admins about a new dispute
 */
export async function notifyAdminsDispute(
  notificationService: NotificationService,
  data: {
    disputerName: string;
    matchId: string;
    reason?: string;
  }
): Promise<void> {
  const notification = notificationTemplates.admin.matchDispute(
    data.disputerName,
    data.reason || 'No reason provided'
  );

  await notifyAdmins(
    notificationService,
    {
      ...notification,
      matchId: data.matchId
    },
    'disputeAlerts'
  );
}

/**
 * Notify admins about a team change request
 */
export async function notifyAdminsTeamChange(
  notificationService: NotificationService,
  data: {
    playerName: string;
    currentTeam: string;
    requestedTeam: string;
    seasonId?: string;
    requestId?: string;
  }
): Promise<void> {
  await notifyAdmins(
    notificationService,
    {
      type: 'ADMIN_TEAM_CHANGE_REQUEST',
      category: 'ADMIN',
      title: 'Team Change Request',
      message: `${data.playerName} has requested to change from ${data.currentTeam} to ${data.requestedTeam}.`,
      seasonId: data.seasonId
    },
    'teamChangeRequests'
  );
}

/**
 * Notify admins about a season join request
 */
export async function notifyAdminsSeasonJoinRequest(
  notificationService: NotificationService,
  data: {
    playerName: string;
    seasonName: string;
    seasonId: string;
  }
): Promise<void> {
  await notifyAdmins(
    notificationService,
    {
      type: 'ADMIN_SEASON_JOIN_REQUEST',
      category: 'ADMIN',
      title: 'Season Join Request',
      message: `${data.playerName} has requested to join ${data.seasonName}.`,
      seasonId: data.seasonId
    },
    'seasonJoinRequests'
  );
}

/**
 * Notify admins about a player report
 */
export async function notifyAdminsPlayerReport(
  notificationService: NotificationService,
  data: {
    reporterName: string;
    reportedPlayerName: string;
    reason: string;
    matchId?: string;
  }
): Promise<void> {
  const notification = notificationTemplates.admin.playerReported(
    data.reporterName,
    data.reportedPlayerName,
    data.reason
  );

  await notifyAdmins(
    notificationService,
    {
      ...notification,
      matchId: data.matchId
    },
    'playerReports'
  );
}
