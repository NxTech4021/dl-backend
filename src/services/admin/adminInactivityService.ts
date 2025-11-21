/**
 * Admin Inactivity Service
 * Handles admin configuration of inactivity thresholds
 */

import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

// Types
export interface InactivitySettingsInput {
  leagueId?: string;
  seasonId?: string;
  inactivityThresholdDays: number;
  warningThresholdDays?: number;
  autoMarkInactive?: boolean;
  excludeFromPairing?: boolean;
  sendReminderEmail?: boolean;
  reminderDaysBefore?: number;
  adminId: string;
}

export interface InactivitySettingsResponse {
  id: string;
  leagueId: string | null;
  seasonId: string | null;
  inactivityThresholdDays: number;
  warningThresholdDays: number | null;
  autoMarkInactive: boolean;
  excludeFromPairing: boolean;
  sendReminderEmail: boolean;
  reminderDaysBefore: number | null;
  updatedByAdminId: string;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Get current inactivity settings
 * Returns global settings or specific league/season settings
 */
export async function getInactivitySettings(
  leagueId?: string,
  seasonId?: string
): Promise<InactivitySettingsResponse | null> {
  // Try to find specific settings first
  if (seasonId) {
    const seasonSettings = await prisma.inactivitySettings.findUnique({
      where: { seasonId }
    });
    if (seasonSettings) return seasonSettings;
  }

  if (leagueId) {
    const leagueSettings = await prisma.inactivitySettings.findUnique({
      where: { leagueId }
    });
    if (leagueSettings) return leagueSettings;
  }

  // Return global settings (no leagueId or seasonId)
  const globalSettings = await prisma.inactivitySettings.findFirst({
    where: {
      leagueId: null,
      seasonId: null
    }
  });

  return globalSettings;
}

/**
 * Get effective threshold for inactivity checks
 * Used by inactivityService
 */
export async function getEffectiveThreshold(
  seasonId?: string
): Promise<{ inactivityDays: number; warningDays: number }> {
  // Default values from config
  const defaults = {
    inactivityDays: 30,
    warningDays: 21
  };

  // Try to get settings from database
  const settings = await getInactivitySettings(undefined, seasonId);

  if (settings) {
    return {
      inactivityDays: settings.inactivityThresholdDays,
      warningDays: settings.warningThresholdDays || Math.floor(settings.inactivityThresholdDays * 0.7)
    };
  }

  // Fall back to environment variables or defaults
  return {
    inactivityDays: Number(process.env.INACTIVITY_THRESHOLD_DAYS) || defaults.inactivityDays,
    warningDays: Number(process.env.INACTIVITY_WARNING_DAYS) || defaults.warningDays
  };
}

/**
 * Set inactivity settings
 */
export async function setInactivitySettings(
  input: InactivitySettingsInput
): Promise<InactivitySettingsResponse> {
  const {
    leagueId,
    seasonId,
    inactivityThresholdDays,
    warningThresholdDays,
    autoMarkInactive,
    excludeFromPairing,
    sendReminderEmail,
    reminderDaysBefore,
    adminId
  } = input;

  // Validation
  if (inactivityThresholdDays < 1) {
    throw new Error('Inactivity threshold must be at least 1 day');
  }

  if (inactivityThresholdDays > 365) {
    throw new Error('Inactivity threshold cannot exceed 365 days');
  }

  if (warningThresholdDays !== undefined) {
    if (warningThresholdDays < 1) {
      throw new Error('Warning threshold must be at least 1 day');
    }
    if (warningThresholdDays >= inactivityThresholdDays) {
      throw new Error('Warning threshold must be less than inactivity threshold');
    }
  }

  if (reminderDaysBefore !== undefined && reminderDaysBefore < 1) {
    throw new Error('Reminder days must be at least 1');
  }

  // Determine unique key for upsert
  let whereClause: any = {};
  let createData: any = {
    inactivityThresholdDays,
    warningThresholdDays: warningThresholdDays ?? Math.floor(inactivityThresholdDays * 0.7),
    autoMarkInactive: autoMarkInactive ?? true,
    excludeFromPairing: excludeFromPairing ?? true,
    sendReminderEmail: sendReminderEmail ?? true,
    reminderDaysBefore: reminderDaysBefore ?? 3,
    updatedByAdminId: adminId
  };

  if (seasonId) {
    whereClause = { seasonId };
    createData.seasonId = seasonId;
  } else if (leagueId) {
    whereClause = { leagueId };
    createData.leagueId = leagueId;
  } else {
    // Global settings - find existing or create new
    const existing = await prisma.inactivitySettings.findFirst({
      where: { leagueId: null, seasonId: null }
    });

    if (existing) {
      const updated = await prisma.inactivitySettings.update({
        where: { id: existing.id },
        data: {
          inactivityThresholdDays,
          warningThresholdDays: warningThresholdDays ?? Math.floor(inactivityThresholdDays * 0.7),
          autoMarkInactive: autoMarkInactive ?? existing.autoMarkInactive,
          excludeFromPairing: excludeFromPairing ?? existing.excludeFromPairing,
          sendReminderEmail: sendReminderEmail ?? existing.sendReminderEmail,
          reminderDaysBefore: reminderDaysBefore ?? existing.reminderDaysBefore,
          updatedByAdminId: adminId
        }
      });

      logger.info(`Updated global inactivity settings by admin ${adminId}`, {
        inactivityThresholdDays,
        warningThresholdDays
      });

      return updated;
    }

    // Create new global settings
    const created = await prisma.inactivitySettings.create({
      data: createData
    });

    logger.info(`Created global inactivity settings by admin ${adminId}`, {
      inactivityThresholdDays,
      warningThresholdDays
    });

    return created;
  }

  // Upsert for league or season specific settings
  const result = await prisma.inactivitySettings.upsert({
    where: whereClause,
    update: {
      inactivityThresholdDays,
      warningThresholdDays: warningThresholdDays ?? Math.floor(inactivityThresholdDays * 0.7),
      autoMarkInactive: autoMarkInactive ?? true,
      excludeFromPairing: excludeFromPairing ?? true,
      sendReminderEmail: sendReminderEmail ?? true,
      reminderDaysBefore: reminderDaysBefore ?? 3,
      updatedByAdminId: adminId
    },
    create: createData
  });

  const logContext: any = { inactivityThresholdDays };
  if (leagueId) logContext.leagueId = leagueId;
  if (seasonId) logContext.seasonId = seasonId;
  if (warningThresholdDays) logContext.warningThresholdDays = warningThresholdDays;
  logger.info(`Updated inactivity settings by admin ${adminId}`, logContext);

  return result;
}

/**
 * Delete inactivity settings (revert to defaults)
 */
export async function deleteInactivitySettings(
  settingsId: string,
  adminId: string
): Promise<void> {
  const settings = await prisma.inactivitySettings.findUnique({
    where: { id: settingsId }
  });

  if (!settings) {
    throw new Error('Settings not found');
  }

  await prisma.inactivitySettings.delete({
    where: { id: settingsId }
  });

  logger.info(`Deleted inactivity settings ${settingsId} by admin ${adminId}`);
}

/**
 * Get all inactivity settings (for admin dashboard)
 */
export async function getAllInactivitySettings(): Promise<InactivitySettingsResponse[]> {
  return prisma.inactivitySettings.findMany({
    orderBy: [
      { seasonId: 'asc' },
      { leagueId: 'asc' },
      { createdAt: 'desc' }
    ]
  });
}

// Singleton pattern
let adminInactivityServiceInstance: typeof adminInactivityService | null = null;

const adminInactivityService = {
  getInactivitySettings,
  getEffectiveThreshold,
  setInactivitySettings,
  deleteInactivitySettings,
  getAllInactivitySettings
};

export function getAdminInactivityService() {
  if (!adminInactivityServiceInstance) {
    adminInactivityServiceInstance = adminInactivityService;
  }
  return adminInactivityServiceInstance;
}

export default adminInactivityService;
