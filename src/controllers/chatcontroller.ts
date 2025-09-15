import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create a new thread (single or group)
export const createThread = async (req: Request, res: Response) => {
  try {
    const { name, isGroup, userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ error: "At least two users are required to create a thread." });
    }

    const thread = await prisma.thread.create({
      data: {
        name: isGroup ? name : null,
        isGroup,
        members: {
          create: userIds.map((userId: string, idx: number) => ({
            userId,
            role: isGroup && idx === 0 ? "admin" : null,
          })),
        },
      },
      include: { members: { include: { user: true } } },
    });

    return res.status(201).json(thread);
  } catch (error) {
    console.error("Error creating thread:", error);
    return res.status(500).json({ error: "Failed to create thread" });
  }
};

// Get all threads for a user
export const getThreads = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const threads = await prisma.thread.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: true },
        },
      },
    });

    return res.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
};

// Send a message in a thread
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { senderId, content } = req.body;

    if (!senderId || !content) {
      return res.status(400).json({ error: "Sender ID and content are required" });
    }

    const message = await prisma.message.create({
      data: { threadId, senderId, content },
      include: { sender: true },
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

// Get all messages in a thread
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      include: { sender: true, readBy: { include: { user: true } } },
    });

    return res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// Mark a message as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const readReceipt = await prisma.messageReadBy.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: {},
      create: { messageId, userId },
    });

    return res.json(readReceipt);
  } catch (error) {
    console.error("Error marking message as read:", error);
    return res.status(500).json({ error: "Failed to mark message as read" });
  }
};
