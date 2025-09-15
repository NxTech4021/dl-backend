import { Router } from "express";
import { 
    createThread, 
    getMessages, 
    getThreads, 
    markAsRead, 
    sendMessage 
} from "../controllers/chatcontroller";



const router = Router();

router.post("/threads", createThread);
router.get("/threads/:userId", getThreads);
router.post("/threads/:threadId/messages", sendMessage);
router.get("/threads/:threadId/messages", getMessages);
router.post("/messages/:messageId/read", markAsRead);

export default router;
