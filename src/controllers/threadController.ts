import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create a new thread (single or group)
export const createThread = async (req: Request, res: Response) => {
  try {
    const { name, isGroup, userIds } = req.body;
    console.log(`📝 Creating thread - Group: ${isGroup}, Users: ${userIds?.length}, Name: ${name}`);

    if (!Array.isArray(userIds) || userIds.length < 2) {
      console.log(`❌ Invalid userIds array: ${userIds}`);
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
      include: { 
        members: { 
          include: { user: { select: { id: true, name: true, username: true } } } 
        } 
      },
    });

    console.log(`✅ Thread created: ${thread.id}`);

    // 💡 SOCKET INTEGRATION: Notify users about new thread
    if (req.io) {
      userIds.forEach(userId => {
        req.io.to(userId).emit('new_thread', {
          thread,
          timestamp: new Date().toISOString()
        });
        console.log(`📤 Sent new_thread event to user ${userId}`);
      });
    } else {
      console.log(`⚠️ Socket.IO not available in request object`);
    }

    return res.status(201).json({ 
      success: true, 
      data: thread,
      message: "Thread created successfully"
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
              select: { id: true, name: true, username: true, image: true } 
            } 
          } 
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { 
            sender: { 
              select: { id: true, name: true, username: true } 
            } 
          },
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    console.log(`✅ Found ${threads.length} threads for user ${userId}`);
    return res.json({ 
      success: true, 
      data: threads,
      count: threads.length 
    });
  } catch (error) {
    console.error("❌ Error fetching threads:", error);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
};

// Send a message in a thread
export const sendMessage = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { senderId, content, messageType = 'text' } = req.body;

  console.log(`💬 Sending message - Thread: ${threadId}, Sender: ${senderId}, Type: ${messageType}`);

  if (!senderId || !content) {
    console.log(`❌ Missing required fields - SenderId: ${senderId}, Content: ${!!content}`);
    return res.status(400).json({ error: "Sender ID and content are required" });
  }

  try {
    // Verify thread exists and user is a member
    const threadMember = await prisma.threadMember.findFirst({
      where: { threadId, userId: senderId }
    });

    if (!threadMember) {
      console.log(`❌ User ${senderId} is not a member of thread ${threadId}`);
      return res.status(403).json({ error: "User is not a member of this thread" });
    }

    const message = await prisma.message.create({
      data: { 
        threadId, 
        senderId, 
        content,
        messageType 
      },
      include: { 
        sender: { 
          select: { id: true, name: true, username: true, image: true } 
        } 
      },
    });

    // Update thread's last activity
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });

    console.log(`✅ Message created: ${message.id} in thread ${threadId}`);

    // 💡 SOCKET INTEGRATION: Broadcast the new message
    if (req.io) {
      const messageData = {
        ...message,
        timestamp: new Date().toISOString()
      };
      
      req.io.to(threadId).emit('new_message', messageData);
      console.log(`📤 Broadcasted new_message to thread ${threadId}`);
      
      // Also emit to sender's personal room for confirmation
      req.io.to(senderId).emit('message_sent', {
        messageId: message.id,
        threadId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`⚠️ Socket.IO not available for message broadcast`);
    }

    return res.status(201).json({ 
      success: true, 
      data: message,
      message: "Message sent successfully" 
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
    
    console.log(`📖 Fetching messages for thread: ${threadId}, Page: ${page}, Limit: ${limit}`);

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
            select: { id: true, name: true, username: true, image: true } 
          },
          readBy: { 
            include: { 
              user: { 
                select: { id: true, name: true } 
              } 
            } 
          } 
        },
      }),
      prisma.message.count({ where: { threadId } })
    ]);

    // Reverse to show oldest first
    const sortedMessages = messages.reverse();

    console.log(`✅ Retrieved ${sortedMessages.length} messages from thread ${threadId}`);
    
    return res.json({ 
      success: true,
      data: sortedMessages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      }
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

  if (!readerId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find the message and thread info
    const messageInfo = await prisma.message.findUnique({
      where: { id: messageId },
      select: { threadId: true, senderId: true }
    });

    if (!messageInfo) {
      console.log(`❌ Message ${messageId} not found`);
      return res.status(404).json({ error: "Message not found" });
    }

    // Don't mark own messages as read
    if (messageInfo.senderId === readerId) {
      console.log(`⏭️ Skipping read receipt for own message`);
      return res.json({ success: true, message: "Own message, no read receipt needed" });
    }

    // Upsert the read receipt
    const readReceipt = await prisma.messageReadBy.upsert({
      where: { messageId_userId: { messageId, userId: readerId } },
      update: { readAt: new Date() },
      create: { messageId, userId: readerId },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    console.log(`✅ Message ${messageId} marked as read by ${readerId}`);

    // 💡 SOCKET INTEGRATION: Broadcast read receipt
    if (req.io) {
      const readData = {
        messageId,
        threadId: messageInfo.threadId,
        readerId,
        readerName: readReceipt.user.name,
        timestamp: new Date().toISOString()
      };
      
      req.io.to(messageInfo.threadId).emit('message_read', readData);
      console.log(`📤 Broadcasted message_read to thread ${messageInfo.threadId}`);
    }

    return res.json({ 
      success: true, 
      data: readReceipt,
      message: "Message marked as read" 
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

    const members = await prisma.threadMember.findMany({
      where: { threadId },
      include: {
        user: {
          select: { id: true, name: true, username: true, image: true }
        }
      }
    });

    console.log(`✅ Found ${members.length} members in thread ${threadId}`);
    return res.json({ 
      success: true, 
      data: members,
      count: members.length 
    });
  } catch (error) {
    console.error("❌ Error fetching thread members:", error);
    return res.status(500).json({ error: "Failed to fetch thread members" });
  }
};