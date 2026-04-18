//@ts-nocheck
import { prisma } from "../lib/prisma";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { auth } from "../lib/auth";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";
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
  // Idempotency guard: if a parent router already ran verifyAuth and attached
  // req.user, skip the expensive session+DB lookup. Safe because req.user is
  // only populated by this middleware (not client-controllable). Enables
  // belt-and-suspenders re-mounting of verifyAuth on admin sub-routers without
  // doubling session checks + DB fetches per request.
  if (req.user) {
    return next();
  }

  try {
    let userId: string | undefined;
    let authMethod = 'none';

    try {
      // Authenticate via better-auth session cookie
      const session = await auth.api.getSession({ headers: req.headers });

      if (session?.user?.id) {
        userId = session.user.id;
        authMethod = 'cookie';
      }
    } catch (sessionError: any) {
      logger.debug('verifyAuth: Session validation failed', { error: sessionError.message });
    }

    if (!userId) {
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
      logger.warn('verifyAuth: User not found in database', { userId });
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

    logger.debug(`verifyAuth: Authenticated via ${authMethod}`, { userId: user.id });
    next();
  } catch (error) {
    logger.error("verifyAuth: Authentication error", { error: error instanceof Error ? error.message : String(error) });
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
    logger.warn("optionalAuth: Session check failed", { error: error instanceof Error ? error.message : String(error) });
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
