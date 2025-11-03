import { prisma } from "../lib/prisma";
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { PrismaClient } from "@prisma/client";

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

  // Authentication middleware - verify session token before connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token || !token.user || !token.user.id) {
        console.error('❌ Socket.IO: No valid session token provided');
        return next(new Error('Authentication required'));
      }

      // Store verified userId in socket data
      socket.data.userId = token.user.id;
      socket.data.userRole = token.user.role;

      console.log(`✅ Socket.IO: Authenticated user ${token.user.id}`);
      next();
    } catch (error) {
      console.error('❌ Socket.IO: Authentication error:', error);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId; // Use verified userId from middleware
    console.log(`✅ User connected: ${socket.id} (userId: ${userId}) at ${new Date().toISOString()}`);

    // Automatically join user to their personal room using VERIFIED userId
    if (userId) {
      socket.join(userId);
      activeUsers.set(userId, socket.id);
      userSockets.set(userId, socket.id);
      io.emit('user_status_change', { userId, isOnline: true });
    }

    // 1. DEPRECATED: Remove set_user_id - userId is now verified during auth
    // Users can no longer claim arbitrary userIds
    socket.on('set_user_id', (claimedUserId: string) => {
      console.warn(`⚠️  set_user_id is deprecated and ignored. User ${userId} tried to claim ${claimedUserId}`);
      // Ignore this event - userId is set during authentication
    });

    socket.on('disconnect', () => {
      // Clean up user from active maps
      if (userId) {
        activeUsers.delete(userId);
        userSockets.delete(userId);
        io.emit('user_status_change', { userId, isOnline: false });
        console.log(`❌ User disconnected: ${socket.id} (userId: ${userId})`);
      } else {
        console.log(`❌ User disconnected: ${socket.id}`);
      }
      // Socket.IO automatically cleans up rooms on disconnect
    });
    
    // 2. Typing Indicators
    socket.on('typing_start', ({ threadId, senderId }) => {
      // Broadcast to all other members in the thread room
      socket.to(threadId).emit('typing_status', { threadId, senderId, isTyping: true });
    });

    socket.on('typing', (data) => {
    console.log('Received typing event:', data);
    // Broadcast to everyone in the thread EXCEPT the sender
    socket.to(data.threadId).emit('user_typing', data);
  });

    socket.on('typing_stop', ({ threadId, senderId }) => {
      // Broadcast to all other members in the thread room
      socket.to(threadId).emit('typing_status', { threadId, senderId, isTyping: false });
    });
    
    // 3. Thread Rooms: Crucial for targeted messaging
    socket.on('join_thread', (threadId: string) => {
      socket.join(threadId);
      console.log(`Socket ${socket.id} joined thread ${threadId}`);
    });

    socket.on('leave_thread', (threadId: string) => {
      socket.leave(threadId);
    });
    
    // ... other socket handlers for chat features ...
  });
  
  return io;
}