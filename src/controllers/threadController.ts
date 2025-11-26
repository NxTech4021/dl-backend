import { Request, Response } from "express";
import { notificationTemplates } from '../helpers/notification';
import { prisma } from "../lib/prisma";
import { notificationService } from '../services/notificationService';

// Create a new thread (single or group)
export const createThread = async (req: Request, res: Response) => {
  try {
    const { name, isGroup, userIds, divisionId, seasonId } = req.body;
    console.log(
      `📝 Creating thread - Group: ${isGroup}, Users: ${userIds?.length}, Name: ${name}`
    );

    if (!Array.isArray(userIds) || userIds.length < 2) {
      console.log(`❌ Invalid userIds array: ${userIds}`);
      return res
        .status(400)
        .json({ error: "At least two users are required to create a thread." });
    }

    // Check if direct message already exists between these users
    if (!isGroup && userIds.length === 2) {
      const existingThread = await prisma.thread.findFirst({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: userIds }
            }
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  image: true
                }
              }
            }
          }
        }
      });

      if (existingThread && existingThread.members.length === 2) {
        console.log(`✅ DM already exists: ${existingThread.id}`);
        return res.status(200).json({
          success: true,
          data: existingThread,
          message: "Thread already exists",
          isExisting: true
        });
      }
    }

    const thread = await prisma.thread.create({
      data: {
        name: isGroup ? name : null,
        isGroup,
        divisionId: divisionId || null,
        members: {
          create: userIds.map((userId: string, idx: number) => ({
            userId,
            role: isGroup && idx === 0 ? "admin" : null,
            unreadCount: 0
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { 
              select: { 
                id: true, 
                name: true, 
                username: true,
                image: true,
                email: true
              } 
            },
          },
        },
        division: {
          select: {
            id: true,
            name: true,
            league: {
              select: {
                id: true,
                sportType: true
              }
            }
          }
        }
      },
    });

    console.log(`✅ Thread created: ${thread.id}`);

    // 💡 SOCKET INTEGRATION: Notify users about new thread
    if (req.io) {
      userIds.forEach((userId) => {
        req.io.to(userId).emit("thread_created", {
          ...thread,
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Sent thread_created event to user ${userId}`);
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        ...thread,
        sportType: thread.division?.league?.sportType || null
      },
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
      where: { 
        members: { 
          some: { userId } 
        } 
      },
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
              select: { 
                id: true, 
                name: true, 
                username: true,
                image: true
              },
            },
          },
        },
        division: {
          select: {
            id: true,
            name: true,
            league: {
              select: {
                id: true,
                sportType: true
              }
            }
          }
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get unread count for current user in each thread
    const threadsWithUnread = threads.map(thread => {
      const userThread = thread.members.find(m => m.userId === userId);
      return {
        ...thread,
        unreadCount: userThread?.unreadCount || 0,
        sportType: thread.division?.league?.sportType || null
      };
    });

    console.log(`✅ Found ${threads.length} threads for user ${userId}`);
    return res.json({
      success: true,
      data: threadsWithUnread,
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
    `💬 Sending message - Thread: ${threadId}, Sender: ${senderId}`
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

    // Create message and update unread counts in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const message = await tx.message.create({
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
          // readBy: true,
        },    
      });

      // Update thread's last activity
      await tx.thread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });

      // Increment unread count for all members EXCEPT the sender
      await tx.userThread.updateMany({
        where: {
          threadId: threadId,
          userId: { not: senderId }
        },
        data: {
          unreadCount: { increment: 1 }
        }
      });

      // Get updated unread counts
      const updatedUserThreads = await tx.userThread.findMany({
        where: {
          threadId: threadId,
          userId: { not: senderId }
        },
        select: {
          userId: true,
          unreadCount: true
        }
      });

      return { message, updatedUserThreads };
    });

    console.log(`✅ Message created: ${result.message.id} in thread ${threadId}`);

    // 💡 SOCKET INTEGRATION: Broadcast the new message
    if (req.io) {
      const messageData = {
        ...result.message,
        timestamp: new Date().toISOString(),
      };

      req.io.to(threadId).emit("new_message", messageData);
      console.log(`📤 Broadcasted new_message to thread ${threadId}`);

      // Emit unread count updates to affected users
      result.updatedUserThreads.forEach(userThread => {
        req.io.to(userThread.userId).emit('unread_count_update', {
          threadId: threadId,
          unreadCount: userThread.unreadCount
        });
        console.log(`📤 Sent unread count (${userThread.unreadCount}) to user ${userThread.userId}`);
      });

      // Confirm to sender
      req.io.to(senderId).emit("message_sent", {
        messageId: result.message.id,
        threadId,
        timestamp: new Date().toISOString(),
      });
    }

    // 🆕 Send notifications to other thread members
    try {
      const otherMembers = thread.members
        .filter(m => m.userId !== senderId)
        .map(m => m.userId);

      if (otherMembers.length > 0) {
        const messagePreview = content.length > 100 
          ? `${content.substring(0, 97)}...` 
          : content;

        const chatNotif = notificationTemplates.chat.newMessage(
          result.message.sender.name || 'Someone',
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
    }

    return res.status(201).json({
      success: true,
      data: result.message,
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
        where: { 
          threadId,
          isDeleted: false
        },
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
          // readBy: {
          //   include: {
          //     user: {
          //       select: { id: true, name: true },
          //     },
          //   },
          // },
        },
      }),
      prisma.message.count({ 
        where: { 
          threadId,
          isDeleted: false 
        } 
      }),
    ]);

    // Reverse to show oldest first
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

// 🆕 Mark entire thread as read (resets unread count to 0)
export const markThreadAsRead = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { userId } = req.body;

  console.log(`👁️ Marking thread ${threadId} as read by user ${userId}`);

  if (!threadId || !userId) {
    return res.status(400).json({ error: "Thread ID and User ID are required" });
  }

  try {
    // Verify user is a member of the thread
    const userThread = await prisma.userThread.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId
        }
      }
    });

    if (!userThread) {
      return res.status(404).json({ error: "User is not a member of this thread" });
    }

    // Only reset if there's actually unread messages
    if (userThread.unreadCount === 0) {
      return res.json({
        success: true,
        message: "Thread already marked as read",
        unreadCount: 0
      });
    }

    // Reset unread count to 0
    await prisma.userThread.update({
      where: {
        threadId_userId: {
          threadId,
          userId
        }
      },
      data: {
        unreadCount: 0
      }
    });

    // Get total unread count across all threads
    const allUserThreads = await prisma.userThread.findMany({
      where: { userId },
      select: { unreadCount: true }
    });
    const totalUnread = allUserThreads.reduce((sum, ut) => sum + ut.unreadCount, 0);

    console.log(`✅ Thread ${threadId} marked as read by user ${userId}`);

    // 💡 SOCKET: Emit 'thread_marked_read' event (matches frontend listener)
    if (req.io) {
      req.io.to(userId).emit('thread_marked_read', {
        threadId,
        unreadCount: 0,
        totalUnreadCount: totalUnread,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Sent thread_marked_read event to user ${userId}`);
    }

    return res.json({
      success: true,
      message: "Thread marked as read",
      unreadCount: 0,
      totalUnreadCount: totalUnread
    });
  } catch (error) {
    console.error("❌ Error marking thread as read:", error);
    return res.status(500).json({ error: "Failed to mark thread as read" });
  }
};


// 🆕 Get unread count for a specific thread
export const getThreadUnreadCount = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { userId } = req.query;

    if (!threadId || !userId) {
      return res.status(400).json({ error: "Thread ID and User ID are required" });
    }

    const userThread = await prisma.userThread.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId: userId as string
        }
      },
      select: {
        unreadCount: true
      }
    });

    if (!userThread) {
      return res.status(404).json({ error: "User is not a member of this thread" });
    }

    return res.json({
      success: true,
      threadId,
      unreadCount: userThread.unreadCount
    });
  } catch (error) {
    console.error("❌ Error getting unread count:", error);
    return res.status(500).json({ error: "Failed to get unread count" });
  }
};

// 🆕 Get total unread count across all threads for a user
export const getTotalUnreadCount = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const userThreads = await prisma.userThread.findMany({
      where: { userId },
      select: { unreadCount: true }
    });

    const totalUnread = userThreads.reduce((sum, ut) => sum + ut.unreadCount, 0);

    return res.json({
      success: true,
      userId,
      totalUnreadCount: totalUnread
    });
  } catch (error) {
    console.error("❌ Error getting total unread count:", error);
    return res.status(500).json({ error: "Failed to get total unread count" });
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
          select: { 
            id: true, 
            name: true, 
            username: true,
            image: true,
            email: true
          },
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

    // Get user IDs that already have DMs with current user
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

    // Get all users except current user and those with existing DMs
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

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!messageId) {
    return res.status(400).json({ error: "Message ID is required" });
  }

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        threadId: true,
        isDeleted: true
      }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: "Message already deleted" });
    }

    // Only sender can delete their message
    if (message.senderId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own messages" });
    }
    
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: "This message has been deleted",
      },
    });

    console.log(`✅ Message ${messageId} deleted by user ${userId}`);

    // 💡 SOCKET INTEGRATION: Broadcast deletion
    if (req.io) {
      req.io.to(message.threadId).emit('message_deleted', {
        messageId,
        threadId: message.threadId,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Broadcasted message_deleted to thread ${message.threadId}`);
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
