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

// Thread management
chatRoutes.post("/threads/", createThread);
chatRoutes.get("/threads/:userId", getThreads);
chatRoutes.get("/threads/:threadId/members", getThreadMembers);
chatRoutes.get('/threads/users/available/:userId', getAvailableUsers);

chatRoutes.post('/:threadId/mark-read', markThreadAsRead);
chatRoutes.get('/:threadId/unread-count', getThreadUnreadCount);
chatRoutes.get('/user/:userId/total-unread', getTotalUnreadCount);
// Message management
chatRoutes.post("/threads/:threadId/messages", sendMessage);
chatRoutes.get("/threads/:threadId/messages", getMessages);
// chatRoutes.post("/messages/:messageId/read", markAsRead);
chatRoutes.delete("/threads/messages/:messageId", verifyAuth, deleteMessage);

export default chatRoutes;
