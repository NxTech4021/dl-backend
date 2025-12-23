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
  sendTestLocalNotification,
  sendTestPushNotification,
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
notificationRouter.post('/push-token',  pushTokenLimiter, registerPushToken);
notificationRouter.delete('/push-token', verifyAuth, unregisterPushToken);
notificationRouter.get('/push-tokens', getUserPushTokens);

// routes for testing

// Testing routes - separate endpoints for different notification types                          
notificationRouter.post('/test/local', verifyAuth, sendTestLocalNotification);    
notificationRouter.post('/test/push', verifyAuth, sendTestPushNotification);  

export default notificationRouter;