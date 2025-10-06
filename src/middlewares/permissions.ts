// import { Request, Response, NextFunction } from "express";

// export function permissions(
//   roles: Array<"USER" | "ADMIN" | "SUPERADMIN">
// ) {
//   return (req: Request, res: Response, next: NextFunction) => {
//     const user = req.auth?.user;

//     if (!user || !roles.includes(user.role as any)) {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     next();
//   };
// }

import { auth } from "../lib/auth"; // your Better Auth instance
import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/ApiResponse";

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers as any });

      if (!session?.user) {
        return res.status(401).json(
          new ApiResponse(false, 401, null, "Authentication required")
        );
      }

      if (!roles.includes((session.user as any).role)) {
        return res.status(403).json(
          new ApiResponse(false, 403, null, "Insufficient permissions")
        );
      }

      (req as any).user = session.user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json(
        new ApiResponse(false, 500, null, "Authentication error")
      );
    }
  };
}

// Specific middleware for admin operations
export const requireAdmin = requireRole(["ADMIN", "SUPERADMIN"]);

// Specific middleware for super admin operations
export const requireSuperAdmin = requireRole(["SUPERADMIN"]);

// Middleware for league management operations
export const requireLeagueAdmin = requireRole(["ADMIN", "SUPERADMIN"]);

// Optional authentication middleware (doesn't require login but adds user info if available)
export function optionalAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers as any });
      if (session?.user) {
        (req as any).user = session.user;
      }
      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  };
}

// Middleware to validate admin ID and attach to request
export function validateAdminId() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(
          new ApiResponse(false, 401, null, "Authentication required")
        );
      }

      // Check if user has admin record
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      const admin = await prisma.admin.findUnique({
        where: { userId: user.id },
      });

      if (!admin) {
        return res.status(403).json(
          new ApiResponse(false, 403, null, "Admin access required")
        );
      }

      (req as any).adminId = admin.id;
      next();
    } catch (error) {
      console.error("Admin validation error:", error);
      return res.status(500).json(
        new ApiResponse(false, 500, null, "Admin validation error")
      );
    }
  };
}
