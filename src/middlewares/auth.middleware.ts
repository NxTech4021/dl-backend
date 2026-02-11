//@ts-nocheck
import { prisma } from "../lib/prisma";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { auth } from "../lib/auth";
import { sendError } from "../utils/response";
import { Role } from "@prisma/client";

// Extend the Express Request interface instead of creating a new one
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        username?: string;
        role: Role;
        adminId?: string;
      };
    }
  }
}

// Use Express Request directly
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    role: Role;
    adminId?: string;
  };
}

// Better Auth middleware for authentication
export const verifyAuth: RequestHandler = async (req, res, next) => {
  try {
    // Debug logging
    console.log('🔐 verifyAuth: Headers received:', {
      cookie: req.headers.cookie ? 'Cookie present' : 'No cookie',
      authorization: req.headers.authorization ? 'Auth header present' : 'No auth header',
      'x-user-id': req.headers['x-user-id'] || 'No x-user-id'
    });
    
    let userId: string | undefined;
    let authMethod = 'none';

    try {
      // First try: Authenticate via better-auth session cookie
      const session = await auth.api.getSession({ headers: req.headers });
      console.log('🔐 verifyAuth: Session result:', session ? 'Valid session found' : 'No session found');
      
      if (session?.user?.id) {
        userId = session.user.id;
        authMethod = 'cookie';
        console.log('🔐 verifyAuth: Valid session for user:', session.user.id);
      }
    } catch (sessionError) {
      console.log('🔐 verifyAuth: Session validation failed:', sessionError.message);
    }

    // Fallback: If no valid session from cookie, try x-user-id header (temporary compatibility)
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;
      authMethod = 'x-user-id';
      console.log('🔐 verifyAuth: Falling back to x-user-id:', userId);
    }

    if (!userId) {
      console.log('🔐 verifyAuth: No valid authentication method found');
      return sendError(res, "Unauthorized", 401);
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        admin: { select: { id: true, status: true } },
      },
    });

    if (!user) {
      console.log('🔐 verifyAuth: User not found in database:', userId);
      return sendError(res, "Unauthorized", 401);
    }

    let adminId: string | undefined;
    if (user.admin?.status === "ACTIVE") {
      adminId = user.admin.id;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || undefined,
      role: user.role,
      adminId,
    };

    console.log(`🔐 verifyAuth: Authentication successful via ${authMethod} for user: ${user.id}`);
    next();
  } catch (error) {
    console.error("🔐 verifyAuth: Authentication error:", error);
    return sendError(res, "Invalid authentication", 401);
  }
};

// Optional auth middleware - populates req.user if logged in, but allows anonymous access
export const optionalAuth: RequestHandler = async (req, res, next) => {
  try {
    // Authenticate via secure session token only
    const session = await auth.api.getSession({ headers: req.headers });

    // If user found via valid session, populate req.user (otherwise leave undefined for anonymous)
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          admin: { select: { id: true, status: true } },
        },
      });

      if (user) {
        let adminId: string | undefined;
        if (user.admin?.status === "ACTIVE") {
          adminId = user.admin.id;
        }

        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username || undefined,
          role: user.role,
          adminId,
        };
      }
    }

    // Always continue - anonymous access allowed
    next();
  } catch (error) {
    // Log error but continue - don't block anonymous access
    console.warn("Optional auth check failed:", error);
    next();
  }
};

// Middleware to require admin role (ADMIN or SUPERADMIN)
export const requireAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return sendError(res, "Authentication required", 401);
  }

  if (req.user.role === "USER") {
    return sendError(res, "Admin access required", 403);
  }

  next();
};

// Middleware to require super admin role
export const requireSuperAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return sendError(res, "Authentication required", 401);
  }

  if (req.user.role !== "SUPERADMIN") {
    return sendError(res, "Super admin access required", 403);
  }

  next();
};

// Helper functions
export const isAdmin = (user: Request["user"]): boolean => {
  return user?.role === "ADMIN" || user?.role === "SUPERADMIN";
};

export const isSuperAdmin = (user: Request["user"]): boolean => {
  return user?.role === "SUPERADMIN";
};

export const isUser = (user: Request["user"]): boolean => {
  return user?.role === "USER";
};

// Check if user has admin record (for operations that require admin table ID)
export const hasAdminRecord = (user: Request["user"]): boolean => {
  return !!user?.adminId;
};
