import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
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

// Push token management routes (with rate limiting)
// IMPORTANT: Specific routes MUST come BEFORE generic /:id routes
notificationRouter.post('/push-token', verifyAuth, pushTokenLimiter, registerPushToken);
notificationRouter.delete('/push-token', verifyAuth, unregisterPushToken);
notificationRouter.get('/push-tokens', verifyAuth, getUserPushTokens);

notificationRouter.delete('/:id', verifyAuth, deleteNotification);


// Testing routes - separate endpoints for different notification types                          
notificationRouter.post('/test/local', verifyAuth, sendTestLocalNotification);    
notificationRouter.post('/test/push', verifyAuth, sendTestPushNotification);  

export default notificationRouter;