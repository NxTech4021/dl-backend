import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  sendTestNotification,
//   sendBulkNotification,
//   getNotificationTypes,
  deleteOldNotifications,
} from '../controllers/notificationController';
import { verifyAuth } from '../middlewares/auth.middleware';

const notificationRouter = Router();

// User notification routes
notificationRouter.get('/',  verifyAuth, getUserNotifications);
notificationRouter.get('/unread-count', verifyAuth, getUnreadCount);

// Individual notification actions
notificationRouter.put('/:id/read', verifyAuth, markNotificationAsRead);
notificationRouter.put('/mark-all-read', verifyAuth, markAllNotificationsAsRead);
// notificationRouter.put('/:id/archive', verifyAuth, archiveNotification);


notificationRouter.delete('/cleanup', deleteOldNotifications);

// routes for testing 
notificationRouter.post('/test', sendTestNotification);

export default notificationRouter;