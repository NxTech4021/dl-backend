import { prisma } from '../../lib/prisma';
import { SkillLevel } from '@prisma/client';

export interface UserSettingsData {
  notifications?: boolean;
  matchReminders?: boolean;
  locationServices?: boolean;
  hapticFeedback?: boolean;
}

export interface SportSkillLevelsData {
  tennisSkillLevel?: SkillLevel | null;
  pickleballSkillLevel?: SkillLevel | null;
  padelSkillLevel?: SkillLevel | null;
}

/**
 * Get user settings by user ID
 * Creates default settings if none exist
 */
export async function getUserSettings(userId: string) {
  let settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      id: true,
      notifications: true,
      matchReminders: true,
      locationServices: true,
      hapticFeedback: true,
      tennisSkillLevel: true,
      pickleballSkillLevel: true,
      padelSkillLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId,
        notifications: true,
        matchReminders: true,
        locationServices: false,
        hapticFeedback: true,
      },
      select: {
        id: true,
        notifications: true,
        matchReminders: true,
        locationServices: true,
        hapticFeedback: true,
        tennisSkillLevel: true,
        pickleballSkillLevel: true,
        padelSkillLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return settings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(userId: string, data: UserSettingsData) {
  const { notifications, matchReminders, locationServices, hapticFeedback } = data;

  // Ensure settings exist first
  await getUserSettings(userId);

  const updateData: UserSettingsData & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (notifications !== undefined) {
    updateData.notifications = notifications;
  }
  if (matchReminders !== undefined) {
    updateData.matchReminders = matchReminders;
  }
  if (locationServices !== undefined) {
    updateData.locationServices = locationServices;
  }
  if (hapticFeedback !== undefined) {
    updateData.hapticFeedback = hapticFeedback;
  }

  const updatedSettings = await prisma.userSettings.update({
    where: { userId },
    data: updateData,
    select: {
      id: true,
      notifications: true,
      matchReminders: true,
      locationServices: true,
      hapticFeedback: true,
      tennisSkillLevel: true,
      pickleballSkillLevel: true,
      padelSkillLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedSettings;
}

/**
 * Update user sport skill levels
 * Used during onboarding to save self-assessed skill levels
 */
export async function updateSportSkillLevels(userId: string, data: SportSkillLevelsData) {
  // Ensure settings exist first
  await getUserSettings(userId);

  const updateData: Partial<SportSkillLevelsData> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.tennisSkillLevel !== undefined) {
    updateData.tennisSkillLevel = data.tennisSkillLevel;
  }
  if (data.pickleballSkillLevel !== undefined) {
    updateData.pickleballSkillLevel = data.pickleballSkillLevel;
  }
  if (data.padelSkillLevel !== undefined) {
    updateData.padelSkillLevel = data.padelSkillLevel;
  }

  const updatedSettings = await prisma.userSettings.update({
    where: { userId },
    data: updateData,
    select: {
      id: true,
      tennisSkillLevel: true,
      pickleballSkillLevel: true,
      padelSkillLevel: true,
      updatedAt: true,
    },
  });

  return updatedSettings;
}
