import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    username?: string;
    role?: string;
  };
}

interface DecodedToken extends JwtPayload {
  userId: string;
  role?: string;
}

// Better Auth middleware for mobile authentication
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

// JWT middleware for admin website authentication
export const verifyJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Unauthorized request"));
    }

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;

    if (!decodedToken?.userId) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Invalid token payload"));
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true, // keep role so you can check admin in controller
      },
    });

    if (!user) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Invalid Access Token"));
    }

    // Attach user to req object
    (req as any).user = user;

    next();
  } catch (error: any) {
    if (error?.message === "jwt expired") {
      return res.status(403).json(new ApiResponse(false, 403, null, "JWT Expired"));
    }

    return res
      .status(401)
      .json(
        new ApiResponse(
          false,
          401,
          null,
          error.message || "Invalid access token"
        )
      );
  }
};
