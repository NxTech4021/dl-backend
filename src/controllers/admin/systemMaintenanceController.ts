/**
 * System Maintenance Controller
 * Handles HTTP requests for system maintenance management
 */

import { Request, Response } from 'express';
import { getMaintenanceService } from '../../services/systemMaintenanceService';

const maintenanceService = getMaintenanceService();

/**
 * Create a new maintenance schedule
 * POST /api/admin/maintenance
 */
export const createMaintenance = async (req: Request, res: Response) => {
  try {
    const { title, description, startDateTime, endDateTime, affectedServices } = req.body;

    if (!title || !startDateTime || !endDateTime) {
      return res.status(400).json({
        error: 'Title, start date/time, and end date/time are required'
      });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date/time format' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'End date/time must be after start date/time' });
    }

    const maintenance = await maintenanceService.createMaintenance({
      title,
      description,
      startDateTime: start,
      endDateTime: end,
      affectedServices: affectedServices || []
    });

    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Create Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create maintenance schedule';
    res.status(400).json({ error: message });
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
        return res.status(400).json({ error: 'Invalid start date/time format' });
      }
      updateData.startDateTime = start;
    }

    if (endDateTime) {
      const end = new Date(endDateTime);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid end date/time format' });
      }
      updateData.endDateTime = end;
    }

    const maintenance = await maintenanceService.updateMaintenance(updateData);
    res.json(maintenance);
  } catch (error) {
    console.error('Update Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update maintenance schedule';
    res.status(400).json({ error: message });
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
      return res.status(400).json({ error: 'Maintenance ID is required' });
    }

    await maintenanceService.sendMaintenanceNotification(id);

    res.json({ message: 'Maintenance notification sent successfully' });
  } catch (error) {
    console.error('Send Maintenance Notification Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send maintenance notification';
    res.status(400).json({ error: message });
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
      return res.status(400).json({ error: 'Maintenance ID is required' });
    }

    await maintenanceService.sendMaintenanceCompleteNotification(id);

    
    res.json({ message: 'Maintenance completion notification sent successfully' });
  } catch (error) {
    console.error('Send Completion Notification Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send completion notification';
    res.status(400).json({ error: message });
  }
};

/**
 * Get upcoming maintenance schedules
 * GET /api/admin/maintenance/upcoming
 */
export const getUpcomingMaintenance = async (req: Request, res: Response) => {
  try {
    const maintenances = await maintenanceService.getUpcomingMaintenance();
    res.json(maintenances);
  } catch (error) {
    console.error('Get Upcoming Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve maintenance schedules';
    res.status(400).json({ error: message });
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
      return res.status(400).json({ error: 'Maintenance ID is required' });
    }

    const maintenance = await maintenanceService.startMaintenance(id);
    res.json(maintenance);
  } catch (error) {
    console.error('Start Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start maintenance';
    res.status(400).json({ error: message });
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
      return res.status(400).json({ error: 'Maintenance ID is required' });
    }

    const maintenance = await maintenanceService.cancelMaintenance(id, reason);
    res.json(maintenance);
  } catch (error) {
    console.error('Cancel Maintenance Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel maintenance';
    res.status(400).json({ error: message });
  }
};
