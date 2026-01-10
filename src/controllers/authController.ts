import { Request, Response } from "express";
import { verifyResetOTP } from "../services/authService";
import { ApiResponse } from "../utils/ApiResponse";

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
