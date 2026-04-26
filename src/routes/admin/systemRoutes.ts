/**
 * Admin System Management Routes
 * Routes for system maintenance and feature announcements
 */

import { Router } from 'express';
// Auth middleware is already applied by parent adminRoutes.ts (verifyAuth + requireAdmin)
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
  archiveAnnouncement,
  notifyTosUpdated
} from '../../controllers/admin/featureAnnouncementController';

const adminSystemRoutes = Router();

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

// TOS Routes
// TODO (2026-04-22, docs/issues/backlog/notification-cron-timing-audit-round-7-2026-04-22.md A1):
// This endpoint works end-to-end (template → service → controller → route)
// but DLAdmin/src has no UI button to invoke it — grep confirms zero references.
// Spec marks NOTIF-018 as ✅ but it's only half-shipped (backend yes, admin UI no).
// Add a button in the admin System/Announcements screen that POSTs here.
adminSystemRoutes.post('/tos/notify', notifyTosUpdated);

export default adminSystemRoutes;
