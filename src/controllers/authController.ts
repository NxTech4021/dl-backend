import { Request, Response } from "express";
import { verifyResetOTP } from "../services/authService";
import { sendSuccess, sendError } from "../utils/response";
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
      return sendError(res, "Email is required", 400);
    }

    if (!otp || typeof otp !== "string") {
      return sendError(res, "Verification code is required", 400);
    }

    // Email length validation (prevent DoS via long strings)
    const MAX_EMAIL_LENGTH = 255;
    if (email.length > MAX_EMAIL_LENGTH) {
      return sendError(res, "Email address is too long", 400);
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return sendError(res, "Invalid email format", 400);
    }

    // OTP should be 6 digits
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otp.trim())) {
      return sendError(res, "Invalid verification code format", 400);
    }

    // Verify the OTP
    const result = await verifyResetOTP(email.trim(), otp.trim());

    if (result.success) {
      return sendSuccess(res, { verified: true }, result.message);
    }

    // Return appropriate error based on the code
    const statusCode = result.code === "INTERNAL_ERROR" ? 500 : 400;
    return sendError(res, result.message, statusCode);
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return sendError(res, "Something went wrong. Please try again.", 500);
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
      return sendError(res, "Email is required", 400);
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Email length validation
    const MAX_EMAIL_LENGTH = 255;
    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      return sendError(res, "Email address is too long", 400);
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return sendError(res, "Invalid email format", 400);
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true },
    });

    const available = !existingUser;

    return sendSuccess(
      res,
      { available },
      available ? "Email is available" : "This email is already registered"
    );
  } catch (error) {
    console.error("Check email availability error:", error);
    return sendError(res, "Something went wrong. Please try again.", 500);
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
      return sendError(res, "Username is required", 400);
    }

    const trimmedUsername = username.trim();

    // Username length validation
    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 30;
    if (trimmedUsername.length < MIN_USERNAME_LENGTH) {
      return sendError(
        res,
        `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
        400
      );
    }
    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      return sendError(
        res,
        `Username must be less than ${MAX_USERNAME_LENGTH} characters`,
        400
      );
    }

    // Username format validation (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return sendError(
        res,
        "Username can only contain letters, numbers, and underscores",
        400
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

    return sendSuccess(
      res,
      { available },
      available ? "Username is available" : "This username is already taken"
    );
  } catch (error) {
    console.error("Check username availability error:", error);
    return sendError(res, "Something went wrong. Please try again.", 500);
  }
};
