import { Router } from "express";
import {
  createThread,
  getThreads,
  sendMessage,
  getMessages,
  getThreadMembers,
  getAvailableUsers,
  deleteMessage,
  markThreadAsRead,
  getThreadUnreadCount,
  getTotalUnreadCount
} from "../controllers/threadController";
import { verifyAuth } from "../middlewares/auth.middleware";

const chatRoutes = Router();

// Thread management - all routes require authentication
chatRoutes.post("/threads/", verifyAuth, createThread);
chatRoutes.get("/threads/:userId", verifyAuth, getThreads);
chatRoutes.get("/threads/:threadId/members", verifyAuth, getThreadMembers);
chatRoutes.get('/threads/users/available/:userId', verifyAuth, getAvailableUsers);

chatRoutes.post('/:threadId/mark-read', verifyAuth, markThreadAsRead);
chatRoutes.get('/:threadId/unread-count', verifyAuth, getThreadUnreadCount);
chatRoutes.get('/user/:userId/total-unread', verifyAuth, getTotalUnreadCount);

// Message management - all routes require authentication
chatRoutes.post("/threads/:threadId/messages", verifyAuth, sendMessage);
chatRoutes.get("/threads/:threadId/messages", verifyAuth, getMessages);
// chatRoutes.post("/messages/:messageId/read", markAsRead);
chatRoutes.delete("/threads/messages/:messageId", verifyAuth, deleteMessage);

export default chatRoutes;
