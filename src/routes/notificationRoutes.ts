import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  sendTestNotification,
  deleteNotification
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

notificationRouter.delete('/:id', verifyAuth, deleteNotification);


// routes for testing 
notificationRouter.post('/test', sendTestNotification);

export default notificationRouter;