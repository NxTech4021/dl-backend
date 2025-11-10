import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { notificationService } from '../services/notificationService';
import { notificationTemplates } from '../helpers/notification';

// Create a new thread (single or group)
export const createThread = async (req: Request, res: Response) => {
  try {
    const { name, isGroup, userIds } = req.body;
    console.log(
      `📝 Creating thread - Group: ${isGroup}, Users: ${userIds?.length}, Name: ${name}`
    );

    if (!Array.isArray(userIds) || userIds.length < 2) {
      console.log(`❌ Invalid userIds array: ${userIds}`);
      return res
        .status(400)
        .json({ error: "At least two users are required to create a thread." });
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
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    console.log(`✅ Thread created: ${thread.id}`);

    // 💡 SOCKET INTEGRATION: Notify users about new thread
    if (req.io) {
      userIds.forEach((userId) => {
        req.io.to(userId).emit("new_thread", {
          thread,
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Sent new_thread event to user ${userId}`);
      });
    } else {
      console.log(`⚠️ Socket.IO not available in request object`);
    }

    return res.status(201).json({
      success: true,
      data: thread,
      message: "Thread created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating thread:", error);
    return res.status(500).json({ error: "Failed to create thread" });
  }
};

// Get all threads for a user
export const getThreads = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`📋 Fetching threads for user: ${userId}`);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const threads = await prisma.thread.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                username: true,
                email: true,
                phoneNumber: true,
                image: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log(`✅ Found ${threads.length} threads for user ${userId}`);
    return res.json({
      success: true,
      data: threads,
      count: threads.length,
    });
  } catch (error) {
    console.error("❌ Error fetching threads:", error);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
};

// Send a message in a thread
export const sendMessage = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { senderId, content, repliesToId } = req.body;

  console.log(
    `💬 Sending message - Thread: ${threadId}, Sender: ${senderId} reply ${repliesToId}`
  );

  if (!senderId || !content) {
    console.log(
      `❌ Missing required fields - SenderId: ${senderId}, Content: ${!!content}`
    );
    return res
      .status(400)
      .json({ error: "Sender ID and content are required" });
  }

  try {
    if (!threadId) {
      console.log(`❌ Thread ID is required`);
      return res.status(400).json({ error: "Thread ID is required" });
    }

    // Verify thread exists and user is a member
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        division: {
          select: { id: true, name: true }
        }
      }
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const threadUser = await prisma.userThread.findFirst({
      where: { threadId, userId: senderId },
    });

    if (!threadUser) {
      console.log(`❌ User ${senderId} is not a member of thread ${threadId}`);
      return res
        .status(403)
        .json({ error: "User is not a member of this thread" });
    }

    const message = await prisma.message.create({
      data: {
        threadId,
        senderId,
        content,
        repliesToId: repliesToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            email: true,
            phoneNumber: true,
          },
        },
        repliesTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
              },
            },
          },
        },
        readBy: true,
      },    
    });

    // Update thread's last activity
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    console.log(`✅ Message created: ${message.id} in thread ${threadId}`);

    // 💡 SOCKET INTEGRATION: Broadcast the new message
    if (req.io) {
      const messageData = {
        ...message,
        timestamp: new Date().toISOString(),
      };

      req.io.to(threadId).emit("new_message", messageData);
      console.log(`📤 Broadcasted new_message to thread ${threadId}`);

      // Also emit to sender's personal room for confirmation
      req.io.to(senderId).emit("message_sent", {
        messageId: message.id,
        threadId,
        timestamp: new Date().toISOString(),
      });
    }

    // 🆕 Send notifications to other thread members (not the sender)
    try {
      const otherMembers = thread.members
        .filter(m => m.userId !== senderId)
        .map(m => m.userId);

      if (otherMembers.length > 0) {
        // Create message preview (truncate if too long)
        const messagePreview = content.length > 100 
          ? `${content.substring(0, 97)}...` 
          : content;

        const chatNotif = notificationTemplates.chat.newMessage(
          message.sender.name || 'Someone',
          thread.name || (thread.division?.name ? `${thread.division.name} Chat` : 'Group Chat'),
          messagePreview
        );

        await notificationService.createNotification({
          userIds: otherMembers,
          ...chatNotif,
          threadId: threadId,
          divisionId: thread.divisionId || undefined,
        });

        console.log(`📧 Sent chat notifications to ${otherMembers.length} members`);
      }
    } catch (notifError) {
      console.error('Failed to send chat notifications:', notifError);
      // Don't fail the request if notification fails
    }

    return res.status(201).json({
      success: true,
      data: message,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

// Get all messages in a thread
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log(
      `📖 Fetching messages for thread: ${threadId}, Page: ${page}, Limit: ${limit}`
    );

    if (!threadId) {
      return res.status(400).json({ error: "Thread ID is required" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
        include: {
          sender: {
            select: { id: true, name: true, username: true, image: true },
          },
          repliesTo: {
            include: {
              sender: {
                select: { id: true, name: true, username: true, image: true },
              },
            },
          },
          readBy: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.message.count({ where: { threadId } }),
    ]);

    // Reverse to show oldest first (descending → ascending)
    const sortedMessages = messages.reverse();

    console.log(
      `✅ Retrieved ${sortedMessages.length} messages from thread ${threadId}`
    );

    return res.json({
      success: true,
      data: sortedMessages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// Mark a message as read
export const markAsRead = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { userId: readerId } = req.body;

  console.log(`👁️ Marking message ${messageId} as read by user ${readerId}`);

  if (!messageId) {
    return res.status(400).json({ error: "Message ID is required" });
  }

  if (!readerId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find the message and thread info
    const messageInfo = await prisma.message.findUnique({
      where: { id: messageId },
      select: { threadId: true, senderId: true },
    });

    if (!messageInfo) {
      console.log(`❌ Message ${messageId} not found`);
      return res.status(404).json({ error: "Message not found" });
    }

    // Don't mark own messages as read
    if (messageInfo.senderId === readerId) {
      console.log(`⏭️ Skipping read receipt for own message`);
      return res.json({
        success: true,
        message: "Own message, no read receipt needed",
      });
    }

    await prisma.messageReadBy.upsert({
      where: { messageId_userId: { messageId, userId: readerId } },
      update: { readAt: new Date() },
      create: { messageId, userId: readerId },
    });

    // Get the user data separately for the socket broadcast
    const readerUser = await prisma.user.findUnique({
      where: { id: readerId },
      select: { id: true, name: true },
    });

    console.log(`✅ Message ${messageId} marked as read by ${readerId}`);

    // 💡 SOCKET INTEGRATION: Broadcast read receipt
    if (req.io) {
      const readData = {
        messageId,
        threadId: messageInfo.threadId,
        readerName: readerUser?.name || "Unknown User",
        timestamp: new Date().toISOString(),
      };

      req.io.to(messageInfo.threadId).emit("message_read", readData);
      console.log(
        `📤 Broadcasted message_read to thread ${messageInfo.threadId}`
      );
    }

    return res.json({
      success: true,
      // data: readReceipt,
      message: "Message marked as read",
    });
  } catch (error) {
    console.error("❌ Error marking message as read:", error);
    return res.status(500).json({ error: "Failed to mark message as read" });
  }
};

// Get thread members
export const getThreadMembers = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    console.log(`👥 Fetching members for thread: ${threadId}`);

    if (!threadId) {
      return res.status(400).json({ error: "Thread ID is required" });
    }

    const members = await prisma.userThread.findMany({
      where: { threadId },
      include: {
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    console.log(`✅ Found ${members.length} members in thread ${threadId}`);
    return res.json({
      success: true,
      data: members,
      count: members.length,
    });
  } catch (error) {
    console.error("❌ Error fetching thread members:", error);
    return res.status(500).json({ error: "Failed to fetch thread members" });
  }
};

export const getAvailableUsers = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`📋 Fetching available users for: ${userId}`);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Step 1: Get user IDs that already have single chats with current user
    const existingChatUsers = await prisma.userThread.findMany({
      where: {
        thread: {
          isGroup: false,
          members: {
            some: { userId },
          },
        },
        userId: { not: userId },
      },
      select: {
        userId: true,
      },
    });

    const existingUserIds = existingChatUsers.map((ut: any) => ut.userId);

    // Step 2: Get all users except current user and those with existing chats
    const availableUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: [userId, ...existingUserIds],
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        email: true,
      },
    });

    console.log(
      `✅ Found ${availableUsers.length} available users (excluded ${existingUserIds.length} with existing chats)`
    );

    return res.json({
      success: true,
      data: availableUsers,
      count: availableUsers.length,
      excludedCount: existingUserIds.length,
    });
  } catch (error) {
    console.error("❌ Error fetching available users:", error);
    return res.status(500).json({ error: "Failed to fetch available users" });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // ✅ Only sender can delete their message
    if (message.senderId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own messages" });
    }

    // ✅ Soft delete instead of hard delete
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: "This message has been deleted",
      },
    });

    return res.status(200).json({
      message: "Message deleted successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
