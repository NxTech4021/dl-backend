import { Request, Response } from 'express';
import { getUserSettings, updateUserSettings } from '../services/player/settingsService';

/**
 * GET /api/player/settings
 * Get current user's settings
 */
export async function getSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await getUserSettings(userId);

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch settings',
    });
  }
}

/**
 * PUT /api/player/settings
 * Update current user's settings
 */
export async function updateSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notifications, matchReminders, locationServices, hapticFeedback } = req.body;

    const updatedSettings = await updateUserSettings(userId, {
      notifications,
      matchReminders,
      locationServices,
      hapticFeedback,
    });

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update settings',
    });
  }
}
