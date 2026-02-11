/**
 * System Maintenance Controller
 * Handles HTTP requests for system maintenance management
 */

import { Request, Response } from 'express';
import { getMaintenanceService } from '../../services/systemMaintenanceService';
import { sendSuccess, sendError } from '../../utils/response';

const maintenanceService = getMaintenanceService();

/**
 * Create a new maintenance schedule
 * POST /api/admin/maintenance
 */
export const createMaintenance = async (req: Request, res: Response) => {
  try {
    const { title, description, startDateTime, endDateTime, affectedServices } = req.body;

    if (!title || !startDateTime || !endDateTime) {
      return sendError(res, 'Title, start date/time, and end date/time are required', 400);
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendError(res, 'Invalid date/time format', 400);
    }

    if (end <= start) {
      return sendError(res, 'End date/time must be after start date/time', 400);
    }

    const maintenance = await maintenanceService.createMaintenance({
      title,
      description,
      startDateTime: start,
      endDateTime: end,
      affectedServices: affectedServices || []
    });

    sendSuccess(res, maintenance, undefined, 201);
  } catch (error) {
    console.error('Create Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create maintenance schedule';
    sendError(res, message, 400);
  }
};

/**
 * Update maintenance schedule
 * PUT /api/admin/maintenance/:id
 */
export const updateMaintenance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, startDateTime, endDateTime, status, affectedServices } = req.body;

    const updateData: any = { id };

    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (status) updateData.status = status;
    if (affectedServices) updateData.affectedServices = affectedServices;

    if (startDateTime) {
      const start = new Date(startDateTime);
      if (isNaN(start.getTime())) {
        return sendError(res, 'Invalid start date/time format', 400);
      }
      updateData.startDateTime = start;
    }

    if (endDateTime) {
      const end = new Date(endDateTime);
      if (isNaN(end.getTime())) {
        return sendError(res, 'Invalid end date/time format', 400);
      }
      updateData.endDateTime = end;
    }

    const maintenance = await maintenanceService.updateMaintenance(updateData);
    sendSuccess(res, maintenance);
  } catch (error) {
    console.error('Update Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update maintenance schedule';
    sendError(res, message, 400);
  }
};

/**
 * Send maintenance notification to all users
 * POST /api/admin/maintenance/:id/notify
 */
export const sendMaintenanceNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Maintenance ID is required', 400);
    }

    await maintenanceService.sendMaintenanceNotification(id);

    sendSuccess(res, null, 'Maintenance notification sent successfully');
  } catch (error) {
    console.error('Send Maintenance Notification Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send maintenance notification';
    sendError(res, message, 400);
  }
};

/**
 * Send maintenance completion notification
 * POST /api/admin/maintenance/:id/complete
 */
export const completeMaintenanceNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Maintenance ID is required', 400);
    }

    await maintenanceService.sendMaintenanceCompleteNotification(id);

    sendSuccess(res, null, 'Maintenance completion notification sent successfully');
  } catch (error) {
    console.error('Send Completion Notification Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send completion notification';
    sendError(res, message, 400);
  }
};

/**
 * Get upcoming maintenance schedules
 * GET /api/admin/maintenance/upcoming
 */
export const getUpcomingMaintenance = async (req: Request, res: Response) => {
  try {
    const maintenances = await maintenanceService.getUpcomingMaintenance();
    sendSuccess(res, maintenances);
  } catch (error) {
    console.error('Get Upcoming Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve maintenance schedules';
    sendError(res, message, 400);
  }
};

/**
 * Start maintenance (mark as in progress)
 * POST /api/admin/maintenance/:id/start
 */
export const startMaintenance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

      if (!id) {
      return sendError(res, 'Maintenance ID is required', 400);
    }

    const maintenance = await maintenanceService.startMaintenance(id);
    sendSuccess(res, maintenance);
  } catch (error) {
    console.error('Start Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start maintenance';
    sendError(res, message, 400);
  }
};

/**
 * Cancel maintenance
 * POST /api/admin/maintenance/:id/cancel
 */
export const cancelMaintenance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

      if (!id) {
      return sendError(res, 'Maintenance ID is required', 400);
    }

    const maintenance = await maintenanceService.cancelMaintenance(id, reason);
    sendSuccess(res, maintenance);
  } catch (error) {
    console.error('Cancel Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel maintenance';
    sendError(res, message, 400);
  }
};
