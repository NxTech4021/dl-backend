/**
 * Admin System Management Routes
 * Routes for system maintenance and feature announcements
 */

import { Router } from 'express';
import { verifyAuth } from '../../middlewares/auth.middleware';
import {
  createMaintenance,
  updateMaintenance,
  sendMaintenanceNotification,
  completeMaintenanceNotification,
  getUpcomingMaintenance,
  startMaintenance,
  cancelMaintenance
} from '../../controllers/admin/systemMaintenanceController';
import {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  sendAppUpdateNotification,
  getPublishedAnnouncements,
  archiveAnnouncement
} from '../../controllers/admin/featureAnnouncementController';

const adminSystemRoutes = Router();

// Apply authentication middleware to all routes
adminSystemRoutes.use(verifyAuth);

// TODO: Add admin role verification middleware

// System Maintenance Routes
adminSystemRoutes.post('/maintenance', createMaintenance);
adminSystemRoutes.put('/maintenance/:id', updateMaintenance);
adminSystemRoutes.get('/maintenance/upcoming', getUpcomingMaintenance);
adminSystemRoutes.post('/maintenance/:id/notify', sendMaintenanceNotification);
adminSystemRoutes.post('/maintenance/:id/start', startMaintenance);
adminSystemRoutes.post('/maintenance/:id/complete', completeMaintenanceNotification);
adminSystemRoutes.post('/maintenance/:id/cancel', cancelMaintenance);

// Feature Announcement Routes
adminSystemRoutes.post('/announcements', createAnnouncement);
adminSystemRoutes.put('/announcements/:id', updateAnnouncement);
adminSystemRoutes.get('/announcements/published', getPublishedAnnouncements);
adminSystemRoutes.post('/announcements/:id/publish', publishAnnouncement);
adminSystemRoutes.post('/announcements/:id/archive', archiveAnnouncement);
adminSystemRoutes.post('/announcements/app-update', sendAppUpdateNotification);

export default adminSystemRoutes;
