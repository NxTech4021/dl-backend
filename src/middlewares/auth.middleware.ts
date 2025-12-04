//@ts-nocheck
import { prisma } from "../lib/prisma";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { auth } from "../lib/auth";
import { ApiResponse } from "../utils/ApiResponse";
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
    let user;

    // --- Web support ---
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      user = await prisma.user.findUnique({
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
    }

    // --- Mobile support ---
    if (!user) {
      const mobileUserId =
        (req.headers["x-user-id"] as string) || (req.query.userId as string);
      if (mobileUserId) {
        user = await prisma.user.findUnique({
          where: { id: mobileUserId },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            admin: { select: { id: true, status: true } },
          },
        });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
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

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(401)
      .json({ success: false, message: "Invalid authentication" });
  }
};

// Optional auth middleware - populates req.user if logged in, but allows anonymous access
export const optionalAuth: RequestHandler = async (req, res, next) => {
  try {
    let user;

    // --- Web support ---
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      user = await prisma.user.findUnique({
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
    }

    // --- Mobile support ---
    if (!user) {
      const mobileUserId =
        (req.headers["x-user-id"] as string) || (req.query.userId as string);
      if (mobileUserId) {
        user = await prisma.user.findUnique({
          where: { id: mobileUserId },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            admin: { select: { id: true, status: true } },
          },
        });
      }
    }

    // If user found, populate req.user (otherwise leave undefined for anonymous)
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
    return res
      .status(401)
      .json(new ApiResponse(false, 401, null, "Authentication required"));
  }

  if (req.user.role === "USER") {
    return res
      .status(403)
      .json(new ApiResponse(false, 403, null, "Admin access required"));
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
    return res
      .status(401)
      .json(new ApiResponse(false, 401, null, "Authentication required"));
  }

  if (req.user.role !== "SUPERADMIN") {
    return res
      .status(403)
      .json(new ApiResponse(false, 403, null, "Super admin access required"));
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
