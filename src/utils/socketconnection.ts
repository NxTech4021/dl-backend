import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id} at ${new Date().toISOString()}`);

    // 1. Online Presence: User reports their ID upon connection
    socket.on('set_user_id', (userId: string) => {
      activeUsers.set(userId, socket.id);
      socket.join(userId); // Join a room named after the user for direct pings
      // Broadcast presence change to all users (or only friends/contacts)
      io.emit('user_status_change', { userId, isOnline: true }); 
      
      // Update DB for lastActivityCheck here or on 'disconnect'
    });

    socket.on('disconnect', () => {
      // 1. Online Presence: Remove user and broadcast status change
      const userId = Array.from(activeUsers.entries()).find(([key, value]) => value === socket.id)?.[0];
      if (userId) {
        activeUsers.delete(userId);
        io.emit('user_status_change', { userId, isOnline: false });
      }
      console.log(`User disconnected: ${socket.id}`);
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