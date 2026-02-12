/**
 * Feature Announcement Controller
 * Handles HTTP requests for feature announcements
 */

import { Request, Response } from 'express';
import { getFeatureAnnouncementService } from '../../services/featureAnnouncementService';
import { sendSuccess, sendError } from '../../utils/response';

const announcementService = getFeatureAnnouncementService();

/**
 * Create a new feature announcement
 * POST /api/admin/announcements
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const { title, description, featureDetails, releaseDate, targetAudience } = req.body;

    if (!title || !description) {
      return sendError(res, 'Title and description are required', 400);
    }

    const announcement = await announcementService.createAnnouncement({
      title,
      description,
      featureDetails,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      targetAudience: targetAudience || ['ALL']
    });

    sendSuccess(res, announcement, undefined, 201);
  } catch (error) {
    console.error('Create Announcement Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create announcement';
    sendError(res, message, 400);
  }
};

/**
 * Update feature announcement
 * PUT /api/admin/announcements/:id
 */
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, featureDetails, releaseDate, status, targetAudience } = req.body;

    const updateData: any = { id };

    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (featureDetails) updateData.featureDetails = featureDetails;
    if (status) updateData.status = status;
    if (targetAudience) updateData.targetAudience = targetAudience;

    if (releaseDate) {
      const date = new Date(releaseDate);
      if (!isNaN(date.getTime())) {
        updateData.releaseDate = date;
      }
    }

    const announcement = await announcementService.updateAnnouncement(updateData);
    sendSuccess(res, announcement);
  } catch (error) {
    console.error('Update Announcement Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update announcement';
    sendError(res, message, 400);
  }
};

/**
 * Publish announcement and send notifications
 * POST /api/admin/announcements/:id/publish
 */
export const publishAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Announcement ID is required', 400);
    }

    const announcement = await announcementService.publishAnnouncement(id);
    sendSuccess(res, announcement);
  } catch (error) {
    console.error('Publish Announcement Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to publish announcement';
    sendError(res, message, 400);
  }
};

/**
 * Send app update notification
 * POST /api/admin/announcements/app-update
 */
export const sendAppUpdateNotification = async (req: Request, res: Response) => {
  try {
    const { targetAudience } = req.body;

    await announcementService.sendAppUpdateNotification(targetAudience || ['ALL']);

    sendSuccess(res, null, 'App update notification sent successfully');
  } catch (error) {
    console.error('Send App Update Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send app update notification';
    sendError(res, message, 400);
  }
};

/**
 * Get published announcements
 * GET /api/admin/announcements/published
 */
export const getPublishedAnnouncements = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const announcements = await announcementService.getPublishedAnnouncements(limit);
    sendSuccess(res, announcements);
  } catch (error) {
    console.error('Get Announcements Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve announcements';
    sendError(res, message, 400);
  }
};

/**
 * Archive an announcement
 * POST /api/admin/announcements/:id/archive
 */
export const archiveAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Announcement ID is required', 400);
    }

    const announcement = await announcementService.archiveAnnouncement(id);
    sendSuccess(res, announcement);
  } catch (error) {
    console.error('Archive Announcement Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive announcement';
    sendError(res, message, 400);
  }
};
