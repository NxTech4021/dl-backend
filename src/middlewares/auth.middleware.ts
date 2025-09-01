import { Request, Response, NextFunction } from "express";
import { auth } from "../auth";
import { ApiResponse } from "../utils/ApiResponse";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    username?: string;
  };
}

export const verifyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    // Attach user info to request
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      username: session.user.username,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(401)
      .json(new ApiResponse(false, 401, null, "Invalid authentication"));
  }
};