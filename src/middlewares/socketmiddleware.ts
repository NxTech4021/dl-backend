import { Request, Response, NextFunction } from "express";
import { Server as SocketIOServer } from "socket.io";

// Extend the Request object to include the 'io' property
declare global {
  namespace Express {
    interface Request {
      io: SocketIOServer;
    }
  }
}

export const socketMiddleware = (io: SocketIOServer) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Attach the Socket.io server instance to the request object
    req.io = io;
    next();
  };
};