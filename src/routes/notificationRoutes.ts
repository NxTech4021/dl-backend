import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  sendTestNotification,
  deleteNotification,
  registerPushToken,
  unregisterPushToken,
  getUserPushTokens,
} from '../controllers/notificationController';
import { verifyAuth } from '../middlewares/auth.middleware';
import { pushTokenLimiter } from '../middlewares/rateLimiter';

const notificationRouter = Router();

// User notification routes
notificationRouter.get('/',  verifyAuth, getUserNotifications);
notificationRouter.get('/unread-count', verifyAuth, getUnreadCount);

// Individual notification actions
notificationRouter.put('/:id/read', verifyAuth, markNotificationAsRead);
notificationRouter.put('/mark-all-read', verifyAuth, markAllNotificationsAsRead);
// notificationRouter.put('/:id/archive', verifyAuth, archiveNotification);

notificationRouter.delete('/:id', verifyAuth, deleteNotification);

// Push token management routes (with rate limiting)
notificationRouter.post('/push-token', verifyAuth, pushTokenLimiter, registerPushToken);
notificationRouter.delete('/push-token', verifyAuth, unregisterPushToken);
notificationRouter.get('/push-tokens', verifyAuth, getUserPushTokens);

// routes for testing
notificationRouter.post('/test', sendTestNotification);

export default notificationRouter;