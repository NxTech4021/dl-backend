import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse.ts";

const prisma = new PrismaClient();

export const verifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Unauthorized request"));
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (!decodedToken?.userId) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Invalid token payload"));
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Invalid Access Token"));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error?.message === "jwt expired") {
      // res.clearCookie("accessToken", {
      //   httpOnly: true,
      //   secure: false, // Set to true if using HTTPS in production
      //   sameSite: "lax",
      // });

      return res.status(403).json({ message: "JWT Expired" });
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
