/* eslint-disable @typescript-eslint/no-misused-promises */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-nocheck
import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const activeUsers = new Map<string, string>();
const userSockets = new Map<string, string>();

export function socketHandler(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        "http://localhost:3030",
        "http://localhost:82",
        "http://localhost",
        "http://localhost:3001",
        "http://localhost:8081",
        "http://192.168.1.3:3001", // Added current IP from logs
        "http://192.168.1.7:3001",
        "http://192.168.100.53:8081", // Mobile app origin
        "exp://192.168.100.53:8081", // Expo development server
        "http://172.20.10.3:8081", // New mobile app origin
        "exp://172.20.10.3:8081", // New Expo development server
        "https://staging.appdevelopers.my",
        "167.71.207.135",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  console.log("🚀 Socket.IO server initialized");

  // Dual authentication middleware: Better Auth (web) OR x-user-id header (mobile)
  io.use(async (socket, next) => {
    try {
      console.log("🔐 Socket.IO: Authenticating connection...");

      // OPTION 1: Try Better Auth session first (for Next.js web app)
      try {
        const session = await auth.api.getSession({
          headers: socket.handshake.headers,
        });

        if (session && session.user && session.user.id) {
          console.log("🔐 Socket.IO: Better Auth session found");

          // Verify user exists in database
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              role: true,
              admin: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });

          if (user) {
            // Get admin ID if user has admin record and is active
            let adminId: string | undefined;
            if (user.admin && user.admin.status === "ACTIVE") {
              adminId = user.admin.id;
            }

            // Store user info in socket data
            socket.data.userId = session.user.id;
            socket.data.user = {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              username: session.user.username || undefined,
              role: user.role,
              adminId,
            };

            console.log(
              `✅ Socket.IO: Authenticated via Better Auth - ${session.user.id} (${user.role})`
            );
            return next();
          }
        }
      } catch (authError) {
        console.log(
          "⚠️ Socket.IO: Better Auth failed, trying x-user-id fallback..."
        );
      }

      // OPTION 2: Fallback to x-user-id header (for Expo mobile app)
      const headerUserId = socket.handshake.headers["x-user-id"];

      if (headerUserId && typeof headerUserId === "string") {
        console.log("🔐 Socket.IO: Using x-user-id header:", headerUserId);

        // Verify user exists in database
        const user = await prisma.user.findUnique({
          where: { id: headerUserId },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            admin: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!user) {
          console.error(
            `❌ Socket.IO: User ${headerUserId} not found in database`
          );
          return next(new Error("User not found"));
        }

        // Get admin ID if user has admin record and is active
        let adminId: string | undefined;
        if (user.admin && user.admin.status === "ACTIVE") {
          adminId = user.admin.id;
        }

        // Store user info in socket data
        socket.data.userId = user.id;
        socket.data.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username || undefined,
          role: user.role,
          adminId,
        };

        return next();
      }

      // No valid authentication found
      console.error(
        "❌ Socket.IO: No valid authentication (no session or x-user-id header)"
      );
      return next(new Error("Authentication required"));
    } catch (error) {
      console.error("❌ Socket.IO: Authentication error:", error);
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    const user = socket.data.user;

    console.log(
      `✅ User connected: ${socket.id} (userId: ${userId}, role: ${user.role})`
    );

    if (userId) {
      socket.join(userId);
      activeUsers.set(userId, socket.id);
      userSockets.set(userId, socket.id);
      io.emit("user_status_change", { userId, isOnline: true });

      if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
        socket.join("admin_room");
        console.log(`📋 Admin user ${userId} joined admin room`);
      }

      // Auto-join user's threads
      try {
        const userThreads = await prisma.userThread.findMany({
          where: { userId },
          select: {
            threadId: true,
            thread: { select: { name: true, isGroup: true } },
          },
        });

        userThreads.forEach((ut) => {
          socket.join(ut.threadId);
          const threadName =
            ut.thread.name || (ut.thread.isGroup ? "Group Chat" : "DM");
          // console.log(
          //   `  ✅ Joined thread room: ${ut.threadId} (${threadName})`
          // );
        });

        // console.log(
        //   `✅ User ${userId} successfully joined ${userThreads.length} thread rooms`
        // );

        // Send unread notification count
        const unreadCount = await prisma.userNotification.count({
          where: { userId, read: false },
        });

        socket.emit("unread_notifications_count", { count: unreadCount });
        console.log(
          `📧 Sent unread notification count (${unreadCount}) to user ${userId}`
        );
      } catch (error) {
        console.error("❌ Error auto-joining threads:", error);
      }
    }

    socket.on("disconnect", () => {
      if (userId) {
        activeUsers.delete(userId);
        userSockets.delete(userId);
        io.emit("user_status_change", { userId, isOnline: false });
        console.log(`❌ User disconnected: ${socket.id} (userId: ${userId})`);
      } else {
        console.log(`❌ User disconnected: ${socket.id}`);
      }
    });

    // 🆕 Mark notification as read
    socket.on(
      "mark_notification_read",
      async (data: { notificationId: string }) => {
        try {
          await prisma.userNotification.updateMany({
            where: { notificationId: data.notificationId, userId },
            data: { read: true, readAt: new Date() },
          });

          socket.emit("notification_marked_read", {
            notificationId: data.notificationId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error marking notification as read:", error);
        }
      }
    );

    socket.on("mark_all_notifications_read", async () => {
      try {
        await prisma.userNotification.updateMany({
          where: { userId, read: false },
          data: { read: true, readAt: new Date() },
        });

        socket.emit("all_notifications_marked_read", {
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
      }
    });

    socket.on("request_unread_count", async () => {
      try {
        const count = await prisma.userNotification.count({
          where: { userId, read: false },
        });
        socket.emit("unread_notifications_count", { count });
      } catch (error) {
        console.error("Error getting unread count:", error);
      }
    });

    // Typing indicators
    socket.on("typing_start", ({ threadId, senderId }) => {
      socket
        .to(threadId)
        .emit("typing_status", { threadId, senderId, isTyping: true });
    });

    socket.on("typing", (data) => {
      socket.to(data.threadId).emit("user_typing", data);
    });

    socket.on("typing_stop", ({ threadId, senderId }) => {
      socket
        .to(threadId)
        .emit("typing_status", { threadId, senderId, isTyping: false });
    });

    // Thread room management
    socket.on("join_thread", async (data: string | { threadId: string }) => {
      const threadId = typeof data === "string" ? data : data.threadId;
      if (!threadId) return;

      // Security check: Verify user is a member of this thread
      try {
        const membership = await prisma.userThread.findUnique({
          where: { threadId_userId: { threadId, userId } },
        });

        if (!membership) {
          console.log(
            `❌ Socket: User ${userId} denied access to thread ${threadId} - not a member`
          );
          socket.emit("thread_join_error", {
            threadId,
            error: "Access denied: You are not a member of this thread",
          });
          return;
        }

        socket.join(threadId);
        socket.emit("thread_joined", {
          threadId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("❌ Socket: Error checking thread membership:", error);
        socket.emit("thread_join_error", {
          threadId,
          error: "Failed to verify thread access",
        });
      }
    });

    socket.on("leave_thread", (data: string | { threadId: string }) => {
      const threadId = typeof data === "string" ? data : data.threadId;
      if (!threadId) return;

      socket.leave(threadId);
    });

    socket.on("join_notifications", () => {
      socket.emit("notifications_joined", { userId });
    });

    socket.on("join_admin_events", () => {
      if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
        socket.join("admin_events");
        socket.emit("admin_events_joined", { userId });
      } else {
        socket.emit("error", { message: "Admin access required" });
      }
    });

    // Match room management (for real-time match updates and comments)
    socket.on("join_match", (data: { matchId: string }) => {
      if (!data.matchId) return;

      const matchRoom = `match:${data.matchId}`;
      socket.join(matchRoom);
      console.log(`🎾 User ${userId} joined match room: ${matchRoom}`);
      socket.emit("match_joined", {
        matchId: data.matchId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("leave_match", (data: { matchId: string }) => {
      if (!data.matchId) return;

      const matchRoom = `match:${data.matchId}`;
      socket.leave(matchRoom);
      console.log(`🎾 User ${userId} left match room: ${matchRoom}`);
    });
  });

  return io;
}

// Export helper functions for getting active users
export const getActiveUsers = () => activeUsers;
export const getUserSocket = (userId: string) => userSockets.get(userId);
export const isUserOnline = (userId: string) => activeUsers.has(userId);
