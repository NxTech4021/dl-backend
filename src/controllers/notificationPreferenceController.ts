/**
 * Notification Preference Controller
 * Handles HTTP requests for user notification preferences
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  getUserPreferences,
  updateUserPreferences,
  NotificationPreferenceInput
} from '../services/notification/notificationPreferenceService';
import { logger } from '../utils/logger';

/**
 * Get current user's notification preferences
 */
export async function getPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences = await getUserPreferences(userId);

    return res.status(200).json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('Error getting notification preferences', {}, error as Error);
    return res.status(500).json({ error: 'Failed to get notification preferences' });
  }
}

/**
 * Update current user's notification preferences
 */
export async function updatePreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences: NotificationPreferenceInput = req.body;

    // Validate that all values are booleans
    const validKeys = [
      'matchReminders', 'matchRescheduled', 'matchCancelled', 'matchResults',
      'partnerChange', 'opponentChange', 'ratingChange', 'inactivityAlerts',
      'chatNotifications', 'invitations', 'seasonRegistration', 'seasonUpdates',
      'disputeAlerts', 'teamChangeRequests', 'withdrawalRequests', 'playerReports',
      'seasonJoinRequests', 'pushEnabled', 'emailEnabled'
    ];

    for (const [key, value] of Object.entries(preferences)) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ error: `Invalid preference key: ${key}` });
      }
      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: `Preference ${key} must be a boolean` });
      }
    }

    const updated = await updateUserPreferences(userId, preferences);

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      data: updated
    });
  } catch (error) {
    logger.error('Error updating notification preferences', {}, error as Error);
    return res.status(500).json({ error: 'Failed to update notification preferences' });
  }
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update all to defaults
    const defaultPreferences: NotificationPreferenceInput = {
      matchReminders: true,
      matchRescheduled: true,
      matchCancelled: true,
      matchResults: true,
      partnerChange: true,
      opponentChange: true,
      ratingChange: true,
      inactivityAlerts: true,
      chatNotifications: true,
      invitations: true,
      seasonRegistration: true,
      seasonUpdates: true,
      disputeAlerts: true,
      teamChangeRequests: true,
      withdrawalRequests: true,
      playerReports: true,
      seasonJoinRequests: true,
      pushEnabled: true,
      emailEnabled: false
    };

    const updated = await updateUserPreferences(userId, defaultPreferences);

    return res.status(200).json({
      success: true,
      message: 'Notification preferences reset to defaults',
      data: updated
    });
  } catch (error) {
    logger.error('Error resetting notification preferences', {}, error as Error);
    return res.status(500).json({ error: 'Failed to reset notification preferences' });
  }
}
