import { Request, Response } from 'express';
import { getUserSettings, updateUserSettings, updateSportSkillLevels } from '../services/player/settingsService';
import { SkillLevel } from '@prisma/client';

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

/**
 * PUT /api/player/settings/skill-levels
 * Update user's sport skill levels (used during onboarding)
 */
export async function updateSkillLevels(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tennisSkillLevel, pickleballSkillLevel, padelSkillLevel } = req.body;

    // Validate skill levels if provided
    const validSkillLevels = Object.values(SkillLevel);

    if (tennisSkillLevel && !validSkillLevels.includes(tennisSkillLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tennis skill level. Must be one of: ${validSkillLevels.join(', ')}`,
      });
    }
    if (pickleballSkillLevel && !validSkillLevels.includes(pickleballSkillLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid pickleball skill level. Must be one of: ${validSkillLevels.join(', ')}`,
      });
    }
    if (padelSkillLevel && !validSkillLevels.includes(padelSkillLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid padel skill level. Must be one of: ${validSkillLevels.join(', ')}`,
      });
    }

    const updatedSettings = await updateSportSkillLevels(userId, {
      tennisSkillLevel,
      pickleballSkillLevel,
      padelSkillLevel,
    });

    return res.status(200).json({
      success: true,
      message: 'Sport skill levels updated successfully',
      data: updatedSettings,
    });
  } catch (error: any) {
    console.error('Error updating skill levels:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update skill levels',
    });
  }
}
