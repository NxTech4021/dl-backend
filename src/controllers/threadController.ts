import { Request, Response } from "express";
import { notificationTemplates } from '../helpers/notifications';
import { prisma } from "../lib/prisma";
import { notificationService } from '../services/notificationService';
import { getRecentSportContextsBatch } from '../services/userSportContextService';
import { sendSuccess, sendPaginated, sendError } from "../utils/response";

// Create a new thread (single or group)
export const createThread = async (req: Request, res: Response) => {
  try {
    const { name, isGroup, userIds, divisionId, seasonId } = req.body;
    console.log(
      `📝 Creating thread - Group: ${isGroup}, Users: ${userIds?.length}, Name: ${name}`
    );

    if (!Array.isArray(userIds) || userIds.length < 2) {
      console.log(`❌ Invalid userIds array: ${userIds}`);
      return sendError(res, "At least two users are required to create a thread.", 400);
    }

    // For DM threads, use transaction to prevent race condition (duplicate DMs)
    if (!isGroup && userIds.length === 2) {
      const result = await prisma.$transaction(async (tx) => {
        // Check if DM already exists INSIDE transaction
        const existingThread = await tx.thread.findFirst({
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
          return { thread: existingThread, isExisting: true };
        }

        // Create new DM thread
        const newThread = await tx.thread.create({
          data: {
            name: null,
            isGroup: false,
            divisionId: divisionId || null,
            members: {
              create: userIds.map((userId: string) => ({
                userId,
                role: null,
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

        return { thread: newThread, isExisting: false };
      });

      if (result.isExisting) {
        console.log(`✅ DM already exists: ${result.thread.id}`);
        return sendSuccess(res, {
          ...result.thread,
          messages: [],
          _count: { messages: 0 },
          isExisting: true
        }, "Thread already exists");
      }

      console.log(`✅ DM thread created: ${result.thread.id}`);

      // Prepare complete thread data with all required fields
      const completeThreadData = {
        ...result.thread,
        messages: [],
        _count: { messages: 0 },
      };

      // Socket notification for DM
      if (req.io) {
        userIds.forEach((userId) => {
          req.io.to(userId).emit('thread_created', { thread: completeThreadData });
        });
      }

      return sendSuccess(res, completeThreadData, "Thread created successfully", 201);
    }

    // For group threads (no race condition concern)
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

    // Prepare complete thread data with all required fields
    const completeGroupThreadData = {
      ...thread,
      messages: [],
      _count: { messages: 0 },
      sportType: thread.division?.league?.sportType || null
    };

    // 💡 SOCKET INTEGRATION: Notify users about new thread
    if (req.io) {
      userIds.forEach((userId) => {
        req.io.to(userId).emit("thread_created", {
          ...completeGroupThreadData,
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Sent thread_created event to user ${userId}`);
      });
    }

    return sendSuccess(res, completeGroupThreadData, "Thread created successfully", 201);
  } catch (error) {
    console.error("❌ Error creating thread:", error);
    return sendError(res, "Failed to create thread", 500);
  }
};

// Get all threads for a user
export const getThreads = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`📋 Fetching threads for user: ${userId}`);

    if (!userId) {
      return sendError(res, "User ID is required", 400);
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
            gameType: true,
            genderCategory: true,
            league: {
              select: {
                id: true,
                name: true,
                sportType: true
              }
            },
            season: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true
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

    // Extract other participant IDs from direct chat threads for batch sport context query
    const directChatThreads = threads.filter(t => !t.isGroup);
    const otherUserIds = directChatThreads
      .map(thread => {
        const otherMember = thread.members.find(m => m.userId !== userId);
        return otherMember?.userId;
      })
      .filter((id): id is string => Boolean(id));

    // Batch query sport contexts for all direct chat participants
    const sportContextsByPair = otherUserIds.length > 0
      ? await getRecentSportContextsBatch(userId, otherUserIds)
      : new Map<string, any>();

    // Get unread count for current user in each thread and format division data
    const threadsWithUnread = threads.map(thread => {
      const userThread = thread.members.find(m => m.userId === userId);

      // Format division data with full information
      const divisionData = thread.division ? {
        id: thread.division.id,
        name: thread.division.name,
        gameType: thread.division.gameType,
        genderCategory: thread.division.genderCategory,
        league: thread.division.league,
        season: thread.division.season
      } : null;

      // Get recent sport context for direct chats
      let recentSportContext = null;
      if (!thread.isGroup) {
        const otherMember = thread.members.find(m => m.userId !== userId);
        if (otherMember) {
          const key = `${userId}-${otherMember.userId}`;
          const context = sportContextsByPair.get(key);
          if (context) {
            recentSportContext = {
              sportType: context.sportType,
              lastInteractionAt: context.lastInteractionAt,
              isValid: context.isValid
            };
          }
        }
      }

      // Parse matchData in last message if it's a JSON string
      const lastMessage = thread.messages?.[0];
      if (lastMessage && lastMessage.matchData && typeof lastMessage.matchData === 'string') {
        try {
          lastMessage.matchData = JSON.parse(lastMessage.matchData);
        } catch (e) {
          console.warn(`  ⚠️ Failed to parse matchData for last message in thread ${thread.id}`);
          lastMessage.matchData = null;
        }
      }

      return {
        ...thread,
        unreadCount: userThread?.unreadCount || 0,
        sportType: thread.division?.league?.sportType || null,
        recentSportContext,
        division: divisionData,
        metadata: {
          divisionId: thread.division?.id,
          seasonId: thread.division?.season?.id,
          leagueId: thread.division?.league?.id,
          leagueName: thread.division?.league?.name,
          seasonName: thread.division?.season?.name,
          divisionName: thread.division?.name,
          gameType: thread.division?.gameType,
          genderCategory: thread.division?.genderCategory
        }
      };
    });

    console.log(`✅ Found ${threads.length} threads for user ${userId}`);
    return sendSuccess(res, threadsWithUnread);
  } catch (error) {
    console.error("❌ Error fetching threads:", error);
    return sendError(res, "Failed to fetch threads", 500);
  }
};

// Get a single thread by ID
export const getThread = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const userId = (req as any).user?.id;

    console.log(`📋 Fetching thread: ${threadId} for user: ${userId}`);

    if (!threadId) {
      return sendError(res, "Thread ID is required", 400);
    }

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
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
            gameType: true,
            genderCategory: true,
            league: {
              select: {
                id: true,
                name: true,
                sportType: true
              }
            },
            season: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true
              }
            }
          }
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!thread) {
      return sendError(res, "Thread not found", 404);
    }

    // Check if user is a member of this thread
    const isMember = thread.members.some(m => m.userId === userId);
    if (!isMember) {
      return sendError(res, "You are not a member of this thread", 403);
    }

    // Get unread count for current user
    const userThread = thread.members.find(m => m.userId === userId);

    // Format division data
    const divisionData = thread.division ? {
      id: thread.division.id,
      name: thread.division.name,
      gameType: thread.division.gameType,
      genderCategory: thread.division.genderCategory,
      league: thread.division.league,
      season: thread.division.season
    } : null;

    // Parse matchData in last message if it's a JSON string
    const lastMessage = thread.messages?.[0];
    if (lastMessage && lastMessage.matchData && typeof lastMessage.matchData === 'string') {
      try {
        lastMessage.matchData = JSON.parse(lastMessage.matchData);
      } catch (e) {
        console.warn(`  ⚠️ Failed to parse matchData for last message in thread ${thread.id}`);
        lastMessage.matchData = null;
      }
    }

    const threadWithData = {
      ...thread,
      unreadCount: userThread?.unreadCount || 0,
      sportType: thread.division?.league?.sportType || null,
      division: divisionData,
      metadata: {
        divisionId: thread.division?.id,
        seasonId: thread.division?.season?.id,
        leagueId: thread.division?.league?.id,
        leagueName: thread.division?.league?.name,
        seasonName: thread.division?.season?.name,
        divisionName: thread.division?.name,
        gameType: thread.division?.gameType,
        genderCategory: thread.division?.genderCategory
      }
    };

    console.log(`✅ Found thread ${threadId}`);
    return sendSuccess(res, threadWithData);
  } catch (error) {
    console.error("❌ Error fetching thread:", error);
    return sendError(res, "Failed to fetch thread", 500);
  }
};

// Send a message in a thread
export const sendMessage = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { content, repliesToId, messageType, matchId, matchData } = req.body;

  // SECURITY: Use authenticated user ID, not the one from request body
  // This prevents users from sending messages as other users
  const authenticatedUserId = (req as any).user?.id;
  const senderId = authenticatedUserId;

  console.log(
    `💬 Sending message - Thread: ${threadId}, Sender: ${senderId}, Type: ${messageType || 'TEXT'}`
  );

  if (!senderId) {
    console.log(`❌ Authentication required - no authenticated user`);
    return sendError(res, "Authentication required", 401);
  }

  if (!content) {
    console.log(`❌ Missing content`);
    return sendError(res, "Content is required", 400);
  }

  try {
    if (!threadId) {
      console.log(`❌ Thread ID is required`);
      return sendError(res, "Thread ID is required", 400);
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
      return sendError(res, "Thread not found", 404);
    }

    const threadUser = await prisma.userThread.findFirst({
      where: { threadId, userId: senderId },
    });

    if (!threadUser) {
      console.log(`❌ User ${senderId} is not a member of thread ${threadId}`);
      return sendError(res, "User is not a member of this thread", 403);
    }

    // Create message and update unread counts in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Prepare message data
      const messageData: any = {
        threadId,
        senderId,
        content,
        repliesToId: repliesToId || null,
      };

      // Add match-specific fields
      if (messageType === 'MATCH') {
        messageData.messageType = messageType;
        if (matchId) messageData.matchId = matchId;
        if (matchData) messageData.matchData = matchData;
      }

      // Create the message
      const includeOptions: any = {
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
      };

      if (matchId) {
        includeOptions.match = true;
      }

      const message = await tx.message.create({
        data: messageData,
        include: includeOptions,
      }) as any;

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
      console.log('🔔 [ThreadController] Starting notification process for thread:', threadId);
      const otherMembers = thread.members
        .filter(m => m.userId !== senderId)
        .map(m => m.userId);

      console.log('🔔 [ThreadController] Other members in thread:', { count: otherMembers.length, memberIds: otherMembers });

      if (otherMembers.length > 0) {
        const messagePreview = content.length > 100
          ? `${content.substring(0, 97)}...`
          : content;

        // Determine if this is a group chat (more than 2 members) or single chat
        const totalMembers = thread.members.length;
        const isGroupChat = totalMembers > 2;

        let chatDisplayName: string;
        let pushTitle: string;
        const senderName = result.message.sender.name || 'Someone';

        if (isGroupChat) {
          // Group chat: show group name
          chatDisplayName = thread.name || (thread.division?.name ? `${thread.division.name} Chat` : 'Group Chat');
          pushTitle = `${senderName} in ${chatDisplayName}`;
        } else {
          // Single chat: show sender name only
          chatDisplayName = senderName;
          pushTitle = senderName;
        }

        console.log('🔔 [ThreadController] Creating notifications:', {
          sender: senderName,
          isGroupChat,
          totalMembers,
          chatDisplayName,
          pushTitle,
          messagePreview
        });

        // Send PUSH notification with message preview (NEW_MESSAGE type)
        const pushNotif = {
          type: 'NEW_MESSAGE' as const,
          category: 'CHAT' as const,
          title: pushTitle,
          message: messagePreview,
          metadata: {
            senderName,
            chatName: chatDisplayName,
            messagePreview,
            isGroupChat,
          }
        };

        // console.log('🔔 [ThreadController] Push notification:', pushNotif);

        await notificationService.createNotification({
          userIds: otherMembers,
          ...pushNotif,
          threadId: threadId,
          divisionId: thread.divisionId || undefined,
        });

        // TODO(NS-41, dissection #110): This per-user loop is wasteful and the
        // UNREAD_MESSAGES in-app notification is largely redundant - the unread
        // count is already delivered via socket (`unread_notifications_count` in
        // socketconnection.ts:154) and shown on the tab badge. Each iteration runs
        // a full createNotification (dedup query + user validation + DB writes +
        // socket emit) - ~50-100ms per call. For a 5-person group chat this adds
        // 250-500ms blocking per message and creates duplicate in-app entries
        // (NEW_MESSAGE + UNREAD_MESSAGES per message). Consider dropping this
        // loop entirely OR batching into one createNotification call with a
        // per-user metadata payload. Also: neither this nor the NEW_MESSAGE call
        // above checks the chatNotifications preference (NS-6 instance).
      } else {
        console.log('⚠️  [ThreadController] No other members to notify (only sender in thread)');
      }
    } catch (notifError) {
      console.error('❌ [ThreadController] Failed to send chat notifications:', notifError);
    }

    return sendSuccess(res, result.message, "Message sent successfully", 201);
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return sendError(res, "Failed to send message", 500);
  }
};

// Get all messages in a thread
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    console.log(
      `📖 Fetching messages for thread: ${threadId}, Page: ${page}, Limit: ${limit}`
    );

    if (!threadId) {
      return sendError(res, "Thread ID is required", 400);
    }

    // Security check: Verify the requesting user is a member of this thread
    if (userId) {
      const membership = await prisma.userThread.findUnique({
        where: {
          threadId_userId: { threadId, userId }
        }
      });

      if (!membership) {
        console.log(`❌ Access denied: User ${userId} is not a member of thread ${threadId}`);
        return sendError(res, "You are not a member of this thread", 403);
      }
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

    // Enrich match messages with current participants
    const enrichedMessages = await Promise.all(
      sortedMessages.map(async (msg: any) => {
        // Parse matchData if it's a JSON string (applies to all messages, not just MATCH type)
        if (msg.matchData && typeof msg.matchData === 'string') {
          try {
            msg.matchData = JSON.parse(msg.matchData);
          } catch (e) {
            console.warn(`  ⚠️ Failed to parse matchData for message ${msg.id}`);
            msg.matchData = null;
          }
        }

        if (msg.messageType === 'MATCH' && msg.matchId) {
          try {
            // Fetch current match data to get latest participants and request status
            const match = await prisma.match.findUnique({
              where: { id: msg.matchId },
              include: {
                participants: {
                  select: {
                    id: true,
                    userId: true,
                    role: true,
                    team: true,
                    invitationStatus: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                      }
                    }
                  }
                }
              }
            });

            if (match) {
              // Update matchData with current participants and request status
              // Parse matchData if it's a string (from database)
              let matchData = msg.matchData;
              if (typeof matchData === 'string') {
                try {
                  matchData = JSON.parse(matchData);
                } catch (e) {
                  console.warn(`  ⚠️ Failed to parse matchData for message ${msg.id}`);
                  matchData = {};
                }
              }
              matchData = matchData || {};

              const matchAny = match as any;

              // Flatten user data into participants for easier frontend access
              const enrichedParticipants = (matchAny.participants || []).map((p: any) => ({
                id: p.id,
                odId: p.userId,
                userId: p.userId,
                role: p.role,
                team: p.team,
                invitationStatus: p.invitationStatus,
                // Flatten user data
                name: p.user?.name || p.user?.username || null,
                username: p.user?.username || null,
                image: p.user?.image || null,
              }));

              msg.matchData = {
                ...matchData,
                participants: enrichedParticipants,
                // Always sync live match status so frontend reflects cancellations / completions after reload
                status: match.status,
                // Always sync friendly request status from the actual Match record
                requestStatus: matchAny.requestStatus || matchData.requestStatus,
                isFriendlyRequest: matchAny.isFriendlyRequest ?? matchData.isFriendlyRequest,
                isFriendly: matchAny.isFriendly ?? matchData.isFriendly ?? matchAny.isFriendlyRequest ?? matchData.isFriendlyRequest,
                requestExpiresAt: matchAny.requestExpiresAt?.toISOString() || matchData.requestExpiresAt,
              };
              console.log(`  ✅ Enriched match ${msg.matchId} with ${enrichedParticipants.length} participants, requestStatus: ${matchAny.requestStatus}`);
            }
          } catch (err) {
            console.warn(`  ⚠️ Could not enrich match data for message ${msg.id}:`, err);
          }
        }
        return msg;
      })
    );

    // Log match messages for debugging
    const matchMessages = enrichedMessages.filter((m: any) => m.messageType === 'MATCH');
    if (matchMessages.length > 0) {
      console.log(`🎾 Found ${matchMessages.length} match messages`);
      matchMessages.forEach((m: any) => {
        const participantCount = m.matchData?.participants?.length || 0;
        console.log(`  - Message ${m.id}: Type=${m.messageType}, MatchId=${m.matchId}, Participants=${participantCount}`);
      });
    }

    return sendPaginated(res, enrichedMessages, {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    return sendError(res, "Failed to fetch messages", 500);
  }
};

// 🆕 Mark entire thread as read (resets unread count to 0)
export const markThreadAsRead = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  // SECURITY: Use authenticated user ID instead of body to prevent users marking others' threads as read
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, "Authentication required", 401);
  }

  console.log(`👁️ Marking thread ${threadId} as read by user ${userId}`);

  if (!threadId) {
    return sendError(res, "Thread ID is required", 400);
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
      return sendError(res, "User is not a member of this thread", 404);
    }

    // Only reset if there's actually unread messages
    if (userThread.unreadCount === 0) {
      return sendSuccess(res, { unreadCount: 0 }, "Thread already marked as read");
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

    return sendSuccess(res, { unreadCount: 0, totalUnreadCount: totalUnread }, "Thread marked as read");
  } catch (error) {
    console.error("❌ Error marking thread as read:", error);
    return sendError(res, "Failed to mark thread as read", 500);
  }
};


// 🆕 Get unread count for a specific thread
export const getThreadUnreadCount = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    // SECURITY: Use authenticated user ID
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    if (!threadId) {
      return sendError(res, "Thread ID is required", 400);
    }

    const userThread = await prisma.userThread.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId
        }
      },
      select: {
        unreadCount: true
      }
    });

    if (!userThread) {
      return sendError(res, "User is not a member of this thread", 404);
    }

    return sendSuccess(res, { threadId, unreadCount: userThread.unreadCount });
  } catch (error) {
    console.error("❌ Error getting unread count:", error);
    return sendError(res, "Failed to get unread count", 500);
  }
};

// 🆕 Get total unread count across all threads for a user
export const getTotalUnreadCount = async (req: Request, res: Response) => {
  try {
    // SECURITY: Use authenticated user ID
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const userThreads = await prisma.userThread.findMany({
      where: { userId },
      select: { unreadCount: true }
    });

    const totalUnread = userThreads.reduce((sum, ut) => sum + ut.unreadCount, 0);

    return sendSuccess(res, { userId, totalUnreadCount: totalUnread });
  } catch (error) {
    console.error("❌ Error getting total unread count:", error);
    return sendError(res, "Failed to get total unread count", 500);
  }
};

// Get thread members
export const getThreadMembers = async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    console.log(`👥 Fetching members for thread: ${threadId}`);

    if (!threadId) {
      return sendError(res, "Thread ID is required", 400);
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
    return sendSuccess(res, { members, count: members.length });
  } catch (error) {
    console.error("❌ Error fetching thread members:", error);
    return sendError(res, "Failed to fetch thread members", 500);
  }
};

export const getAvailableUsers = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`📋 Fetching available users for: ${userId}`);

    if (!userId) {
      return sendError(res, "User ID is required", 400);
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

    // Get all regular users except current user and those with existing DMs
    // Exclude ADMIN and SUPERADMIN accounts
    const availableUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: [userId, ...existingUserIds],
        },
        role: "USER",
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
    });

    console.log(
      `✅ Found ${availableUsers.length} available users (excluded ${existingUserIds.length} with existing chats)`
    );

    return sendSuccess(res, { users: availableUsers, count: availableUsers.length, excludedCount: existingUserIds.length });
  } catch (error) {
    console.error("❌ Error fetching available users:", error);
    return sendError(res, "Failed to fetch available users", 500);
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, "Unauthorized", 401);
  }

  if (!messageId) {
    return sendError(res, "Message ID is required", 400);
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
      return sendError(res, "Message not found", 404);
    }

    if (message.isDeleted) {
      return sendError(res, "Message already deleted", 400);
    }

    // Sender can always delete their own message. Admins can delete any message (moderation).
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
    if (message.senderId !== userId && !isAdmin) {
      return sendError(res, "You can only delete your own messages", 403);
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: "This message has been deleted",
      },
    });

    // 💡 SOCKET INTEGRATION: Broadcast deletion
    if (req.io) {
      req.io.to(message.threadId).emit('message_deleted', {
        messageId,
        threadId: message.threadId,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Broadcasted message_deleted to thread ${message.threadId}`);
    }

    return sendSuccess(res, updated, "Message deleted successfully");
  } catch (err) {
    console.error("Delete message error:", err);
    return sendError(res, "Internal server error", 500);
  }
};
