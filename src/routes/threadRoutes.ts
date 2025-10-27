import { Router } from "express";
import {
  createThread,
  getThreads,
  sendMessage,
  getMessages,
  markAsRead,
  getThreadMembers,
  getAvailableUsers
} from "../controllers/threadController";

const chatRoutes = Router();

// Thread management
chatRoutes.post("/threads/", createThread);
chatRoutes.get("/threads/:userId", getThreads);
chatRoutes.get("/threads/:threadId/members", getThreadMembers);
chatRoutes.get('/threads/users/available/:userId', getAvailableUsers);

// Message management
chatRoutes.post("/threads/:threadId/messages", sendMessage);
chatRoutes.get("/threads/:threadId/messages", getMessages);
chatRoutes.post("/messages/:messageId/read", markAsRead);

export default chatRoutes;
