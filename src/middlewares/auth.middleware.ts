import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";

const prisma = new PrismaClient();

interface DecodedToken extends JwtPayload {
  userId: string;
  role?: string;
}

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
