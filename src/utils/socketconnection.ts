import { prisma } from "../lib/prisma";
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { auth } from "../lib/auth";

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
    ],
      methods: ["GET", "POST"],
      credentials: true
    },
     transports: ['websocket', 'polling']
  });

  console.log("🚀 Socket.IO server initialized");

  // Updated authentication middleware to match your auth system
  io.use(async (socket, next) => {
    try {
      // Get session using the same method as your HTTP middleware
      const session = await auth.api.getSession({ headers: socket.handshake.headers });
      
      if (!session || !session.user || !session.user.id) {
        console.error('❌ Socket.IO: No valid session found');
        return next(new Error('Authentication required'));
      }

      // Verify user exists in database and get role info (same as HTTP middleware)
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
            }
          }
        }
      });

      if (!user) {
        console.error(`❌ Socket.IO: User ${session.user.id} not found in database`);
        return next(new Error('User not found'));
      }

      // Get admin ID if user has admin record and is active
      let adminId: string | undefined;
      if (user.admin && user.admin.status === 'ACTIVE') {
        adminId = user.admin.id;
      }

      // Store user info in socket data (same structure as req.user)
      socket.data.userId = session.user.id;
      socket.data.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        username: session.user.username || undefined,
        role: user.role,
        adminId,
      };

      console.log(`✅ Socket.IO: Authenticated user ${session.user.id} (${user.role})`);
      next();
    } catch (error) {
      console.error('❌ Socket.IO: Authentication error:', error);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const user = socket.data.user;
    
    console.log(`✅ User connected: ${socket.id} (userId: ${userId}, role: ${user.role}) at ${new Date().toISOString()}`);

    // Automatically join user to their personal room using VERIFIED userId
    if (userId) {
      socket.join(userId);
      activeUsers.set(userId, socket.id);
      userSockets.set(userId, socket.id);
      io.emit('user_status_change', { userId, isOnline: true });
      
      // Also join admin users to admin room if they have admin privileges
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        socket.join('admin_room');
        console.log(`📋 Admin user ${userId} joined admin room`);
      }
    }

    // Remove the deprecated set_user_id handler or keep the warning
    socket.on('set_user_id', (claimedUserId: string) => {
      console.warn(`⚠️  set_user_id is deprecated and ignored. User ${userId} tried to claim ${claimedUserId}`);
    });

    socket.on('disconnect', () => {
      if (userId) {
        activeUsers.delete(userId);
        userSockets.delete(userId);
        io.emit('user_status_change', { userId, isOnline: false });
        console.log(`❌ User disconnected: ${socket.id} (userId: ${userId})`);
      } else {
        console.log(`❌ User disconnected: ${socket.id}`);
      }
    });
    
    // Typing Indicators
    socket.on('typing_start', ({ threadId, senderId }) => {
      socket.to(threadId).emit('typing_status', { threadId, senderId, isTyping: true });
    });

    socket.on('typing', (data) => {
      console.log('Received typing event:', data);
      socket.to(data.threadId).emit('user_typing', data);
    });

    socket.on('typing_stop', ({ threadId, senderId }) => {
      socket.to(threadId).emit('typing_status', { threadId, senderId, isTyping: false });
    });
    
    // Thread Rooms
    socket.on('join_thread', (threadId: string) => {
      socket.join(threadId);
      console.log(`Socket ${socket.id} joined thread ${threadId}`);
    });

    socket.on('leave_thread', (threadId: string) => {
      socket.leave(threadId);
      console.log(`Socket ${socket.id} left thread ${threadId}`);
    });

    // Notification-specific events
    socket.on('join_notifications', () => {
      // Users are automatically in their personal room (userId), but this can be used for confirmation
      socket.emit('notifications_joined', { userId });
    });
    
    // Admin-specific events
    socket.on('join_admin_events', () => {
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        socket.join('admin_events');
        socket.emit('admin_events_joined', { userId });
      } else {
        socket.emit('error', { message: 'Admin access required' });
      }
    });
  });
  
  return io;
}

// Export helper functions for getting active users
export const getActiveUsers = () => activeUsers;
export const getUserSocket = (userId: string) => userSockets.get(userId);
export const isUserOnline = (userId: string) => activeUsers.has(userId);