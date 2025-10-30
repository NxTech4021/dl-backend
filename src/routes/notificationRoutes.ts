import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
  getUnreadCount,
  getNotificationStats,
  getNotificationsByType,
  sendTestNotification,
//   sendBulkNotification,
//   getNotificationTypes,
  deleteOldNotifications,
} from '../controllers/notificationController';
// import { authenticateToken } from '../middleware/auth';
// import { requireAdmin } from '../middleware/adminAuth';

const notificationRouter = Router();

// TO DO ADD VERIFY AUTH

// User notification routes
notificationRouter.get('/', getUserNotifications);
notificationRouter.get('/unread-count', getUnreadCount);
notificationRouter.get('/stats', getNotificationStats);

// Individual notification actions
notificationRouter.put('/:id/read', markNotificationAsRead);
notificationRouter.put('/read-all', markAllNotificationsAsRead);
notificationRouter.put('/:id/archive', archiveNotification);

// Admin routes
notificationRouter.get('/by-type/:type', getNotificationsByType);
notificationRouter.post('/test', sendTestNotification);
notificationRouter.delete('/cleanup', deleteOldNotifications);

export default notificationRouter;