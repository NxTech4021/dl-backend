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

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(session.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    (req as any).user = session.user;
    next();
  };
}
