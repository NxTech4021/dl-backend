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
import { verifyAuth } from '../middlewares/auth.middleware';

const notificationRouter = Router();

// TO DO ADD VERIFY AUTH

// User notification routes
notificationRouter.get('/',  verifyAuth, getUserNotifications);
notificationRouter.get('/unread-count', verifyAuth, getUnreadCount);
notificationRouter.get('/stats', verifyAuth, getNotificationStats);

// Individual notification actions
notificationRouter.put('/:id/read', verifyAuth, markNotificationAsRead);
notificationRouter.put('/mark-all-read', verifyAuth, markAllNotificationsAsRead);
notificationRouter.put('/:id/archive', verifyAuth, archiveNotification);

// Admin routes
notificationRouter.get('/by-type/:type', getNotificationsByType);
notificationRouter.post('/test', sendTestNotification);
notificationRouter.delete('/cleanup', deleteOldNotifications);

export default notificationRouter;