/**
 * Admin Inactivity Controller
 * Handles HTTP requests for inactivity threshold configuration
 */

import { Request, Response } from 'express';
import {
  getInactivitySettings,
  setInactivitySettings,
  deleteInactivitySettings,
  getAllInactivitySettings
} from '../services/admin/adminInactivityService';
import { getInactivityService } from '../services/inactivityService';
import { NotificationService } from '../services/notificationService';
import { sendSuccess, sendError } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Get inactivity settings
 * GET /api/admin/inactivity/settings
 */
export async function getSettings(req: Request, res: Response) {
  try {
    const { leagueId, seasonId } = req.query;

    const settings = await getInactivitySettings(
      leagueId as string | undefined,
      seasonId as string | undefined
    );

    if (!settings) {
      // Return defaults if no settings configured
      return sendSuccess(res, {
        inactivityThresholdDays: Number(process.env.INACTIVITY_THRESHOLD_DAYS) || 30,
        warningThresholdDays: Number(process.env.INACTIVITY_WARNING_DAYS) || 21,
        autoMarkInactive: true,
        excludeFromPairing: true,
        sendReminderEmail: true,
        reminderDaysBefore: 3,
        isDefault: true
      });
    }

    return sendSuccess(res, settings);
  } catch (error: any) {
    logger.error('Get inactivity settings error:', error);
    return sendError(res, error.message || 'Failed to get inactivity settings');
  }
}

/**
 * Get all inactivity settings
 * GET /api/admin/inactivity/settings/all
 */
export async function getAllSettings(req: Request, res: Response) {
  try {
    const settings = await getAllInactivitySettings();

    return sendSuccess(res, settings);
  } catch (error: any) {
    logger.error('Get all inactivity settings error:', error);
    return sendError(res, error.message || 'Failed to get all inactivity settings');
  }
}

/**
 * Set inactivity settings
 * PUT /api/admin/inactivity/settings
 */
export async function updateSettings(req: Request, res: Response) {
  try {
    // Use adminId (Admin table) not user.id (User table)
    const adminId = (req as any).user?.adminId;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated or no admin record found', 401);
    }

    const {
      leagueId,
      seasonId,
      inactivityThresholdDays,
      warningThresholdDays,
      autoMarkInactive,
      excludeFromPairing,
      sendReminderEmail,
      reminderDaysBefore
    } = req.body;

    // Validate required field
    if (!inactivityThresholdDays || typeof inactivityThresholdDays !== 'number') {
      return sendError(res, 'inactivityThresholdDays is required and must be a number', 400);
    }

    const settings = await setInactivitySettings({
      leagueId,
      seasonId,
      inactivityThresholdDays,
      warningThresholdDays,
      autoMarkInactive,
      excludeFromPairing,
      sendReminderEmail,
      reminderDaysBefore,
      adminId
    });

    return sendSuccess(res, settings, 'Inactivity settings updated successfully');
  } catch (error: any) {
    logger.error('Update inactivity settings error:', error);

    // Handle validation errors
    if (error.message.includes('must be') || error.message.includes('cannot')) {
      return sendError(res, error.message, 400);
    }

    return sendError(res, error.message || 'Failed to update inactivity settings');
  }
}

/**
 * Delete inactivity settings (revert to defaults)
 * DELETE /api/admin/inactivity/settings/:settingsId
 */
export async function removeSettings(req: Request, res: Response) {
  try {
    // Use adminId (Admin table) not user.id (User table)
    const adminId = (req as any).user?.adminId;
    const { settingsId } = req.params;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated or no admin record found', 401);
    }

    if (!settingsId) {
      return sendError(res, 'Settings ID is required', 400);
    }

    await deleteInactivitySettings(settingsId, adminId);

    return sendSuccess(res, null, 'Inactivity settings deleted, reverted to defaults');
  } catch (error: any) {
    logger.error('Delete inactivity settings error:', error);
    return sendError(res, error.message || 'Failed to delete inactivity settings');
  }
}

/**
 * Manually trigger inactivity check
 * POST /api/admin/inactivity/check
 */
export async function triggerInactivityCheck(req: Request, res: Response) {
  try {
    // Use adminId (Admin table) for logging, fall back to user.id if needed
    const adminId = (req as any).user?.adminId || (req as any).user?.id;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);

    const results = await inactivityService.checkAndUpdateInactivity();

    logger.info(`Manual inactivity check triggered by admin ${adminId}`, {
      total: results.total,
      warnings: results.warnings,
      markedInactive: results.markedInactive,
      errors: results.errors,
      duration: results.duration
    });

    return sendSuccess(res, results, 'Inactivity check completed');
  } catch (error: any) {
    logger.error('Trigger inactivity check error:', error);
    return sendError(res, error.message || 'Failed to run inactivity check');
  }
}

/**
 * Get inactivity statistics
 * GET /api/admin/inactivity/stats
 */
export async function getInactivityStats(req: Request, res: Response) {
  try {
    const { prisma } = await import('../lib/prisma');

    // Get counts by status
    const [activeCount, inactiveCount, atRiskCount] = await Promise.all([
      prisma.user.count({
        where: { status: 'ACTIVE', role: 'USER' }
      }),
      prisma.user.count({
        where: { status: 'INACTIVE', role: 'USER' }
      }),
      // At risk: active users who haven't played in warning threshold
      prisma.user.count({
        where: {
          status: 'ACTIVE',
          role: 'USER',
          lastActivityCheck: {
            lte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return sendSuccess(res, {
      active: activeCount,
      inactive: inactiveCount,
      atRisk: atRiskCount,
      total: activeCount + inactiveCount
    });
  } catch (error: any) {
    logger.error('Get inactivity stats error:', error);
    return sendError(res, error.message || 'Failed to get inactivity stats');
  }
}
