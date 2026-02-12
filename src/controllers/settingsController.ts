import { Request, Response } from 'express';
import { getUserSettings, updateUserSettings, updateSportSkillLevels } from '../services/player/settingsService';
import { SkillLevel } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response';

/**
 * GET /api/player/settings
 * Get current user's settings
 */
export async function getSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const settings = await getUserSettings(userId);

    return sendSuccess(res, settings);
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return sendError(res, error.message || 'Failed to fetch settings', 500);
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
      return sendError(res, 'Unauthorized', 401);
    }

    const { notifications, matchReminders, locationServices, hapticFeedback } = req.body;

    const updatedSettings = await updateUserSettings(userId, {
      notifications,
      matchReminders,
      locationServices,
      hapticFeedback,
    });

    return sendSuccess(res, updatedSettings, 'Settings updated successfully');
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return sendError(res, error.message || 'Failed to update settings', 500);
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
      return sendError(res, 'Unauthorized', 401);
    }

    const { tennisSkillLevel, pickleballSkillLevel, padelSkillLevel } = req.body;

    // Validate skill levels if provided
    const validSkillLevels = Object.values(SkillLevel);

    if (tennisSkillLevel && !validSkillLevels.includes(tennisSkillLevel)) {
      return sendError(res, `Invalid tennis skill level. Must be one of: ${validSkillLevels.join(', ')}`, 400);
    }
    if (pickleballSkillLevel && !validSkillLevels.includes(pickleballSkillLevel)) {
      return sendError(res, `Invalid pickleball skill level. Must be one of: ${validSkillLevels.join(', ')}`, 400);
    }
    if (padelSkillLevel && !validSkillLevels.includes(padelSkillLevel)) {
      return sendError(res, `Invalid padel skill level. Must be one of: ${validSkillLevels.join(', ')}`, 400);
    }

    const updatedSettings = await updateSportSkillLevels(userId, {
      tennisSkillLevel,
      pickleballSkillLevel,
      padelSkillLevel,
    });

    return sendSuccess(res, updatedSettings, 'Sport skill levels updated successfully');
  } catch (error: any) {
    console.error('Error updating skill levels:', error);
    return sendError(res, error.message || 'Failed to update skill levels', 500);
  }
}
