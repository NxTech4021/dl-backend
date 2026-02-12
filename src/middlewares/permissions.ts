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
import { prisma } from "../lib/prisma";
import { toWebHeaders } from "../services/admin/adminSessionService";
import { sendError } from "../utils/response";
import type { Request, Response, NextFunction } from "express";

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: toWebHeaders(req.headers) });

    if (!session?.user) {
      return sendError(res, "Unauthorized", 401);
    }

    // Fetch user from database to get role (Better Auth session doesn't include role)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) {
      return sendError(res, "User not found", 401);
    }

    if (!roles.includes(user.role)) {
      return sendError(res, "Forbidden", 403);
    }

    (req as any).user = session.user;
    next();
  };
}
