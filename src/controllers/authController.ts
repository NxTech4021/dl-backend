import { Request, Response } from "express";
import { verifyResetOTP } from "../services/authService";
import { ApiResponse } from "../utils/ApiResponse";
import { prisma } from "../lib/prisma";

/**
 * POST /api/auth/verify-reset-otp
 * Verify a password reset OTP before allowing user to proceed to password entry.
 *
 * Request body:
 * - email: string (required)
 * - otp: string (required)
 *
 * Response:
 * - 200: OTP is valid
 * - 400: Missing required fields or invalid OTP
 * - 500: Internal server error
 */
export const verifyResetOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || typeof email !== "string") {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Email is required")
      );
    }

    if (!otp || typeof otp !== "string") {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Verification code is required")
      );
    }

    // Email length validation (prevent DoS via long strings)
    const MAX_EMAIL_LENGTH = 255;
    if (email.length > MAX_EMAIL_LENGTH) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Email address is too long")
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid email format")
      );
    }

    // OTP should be 6 digits
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otp.trim())) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid verification code format")
      );
    }

    // Verify the OTP
    const result = await verifyResetOTP(email.trim(), otp.trim());

    if (result.success) {
      return res.status(200).json(
        new ApiResponse(true, 200, { verified: true }, result.message)
      );
    }

    // Return appropriate error based on the code
    const statusCode = result.code === "INTERNAL_ERROR" ? 500 : 400;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, { code: result.code }, result.message)
    );
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Something went wrong. Please try again.")
    );
  }
};

/**
 * POST /api/auth/check-email
 * Check if an email is already registered.
 *
 * Request body:
 * - email: string (required)
 *
 * Response:
 * - 200: { available: boolean, message: string }
 * - 400: Invalid email format
 * - 500: Internal server error
 */
export const checkEmailAvailability = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== "string") {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Email is required")
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Email length validation
    const MAX_EMAIL_LENGTH = 255;
    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Email address is too long")
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid email format")
      );
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true },
    });

    const available = !existingUser;

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { available },
        available ? "Email is available" : "This email is already registered"
      )
    );
  } catch (error) {
    console.error("Check email availability error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Something went wrong. Please try again.")
    );
  }
};

/**
 * POST /api/auth/check-username
 * Check if a username is already taken.
 *
 * Request body:
 * - username: string (required)
 *
 * Response:
 * - 200: { available: boolean, message: string }
 * - 400: Invalid username format
 * - 500: Internal server error
 */
export const checkUsernameAvailability = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    // Validate username
    if (!username || typeof username !== "string") {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Username is required")
      );
    }

    const trimmedUsername = username.trim();

    // Username length validation
    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 30;
    if (trimmedUsername.length < MIN_USERNAME_LENGTH) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Username must be at least ${MIN_USERNAME_LENGTH} characters`
        )
      );
    }
    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Username must be less than ${MAX_USERNAME_LENGTH} characters`
        )
      );
    }

    // Username format validation (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          "Username can only contain letters, numbers, and underscores"
        )
      );
    }

    // Check if username exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: trimmedUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    const available = !existingUser;

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { available },
        available ? "Username is available" : "This username is already taken"
      )
    );
  } catch (error) {
    console.error("Check username availability error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Something went wrong. Please try again.")
    );
  }
};
