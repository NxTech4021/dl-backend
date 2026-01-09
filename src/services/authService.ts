import { prisma } from "../lib/prisma";

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  code?: string;
}

// OTP attempt tracking configuration
const MAX_OTP_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Simple in-memory attempt tracker (can be replaced with Redis for production clusters)
interface AttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const otpAttempts = new Map<string, AttemptRecord>();

// Clean up old attempt records periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpAttempts.entries()) {
    if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      otpAttempts.delete(email);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if email is locked out due to too many attempts
 */
const isLockedOut = (email: string): { locked: boolean; remainingMs?: number } => {
  const key = email.toLowerCase().trim();
  const record = otpAttempts.get(key);

  if (!record) return { locked: false };

  const now = Date.now();

  // Check if locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return { locked: true, remainingMs: record.lockedUntil - now };
  }

  // Check if window has expired and reset
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    otpAttempts.delete(key);
    return { locked: false };
  }

  // Check if too many attempts
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    // Lock for the remainder of the window
    record.lockedUntil = record.firstAttemptAt + ATTEMPT_WINDOW_MS;
    return { locked: true, remainingMs: record.lockedUntil - now };
  }

  return { locked: false };
};

/**
 * Record a failed OTP attempt
 */
const recordFailedAttempt = (email: string): void => {
  const key = email.toLowerCase().trim();
  const record = otpAttempts.get(key);
  const now = Date.now();

  if (record) {
    // Check if window expired, reset if so
    if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      otpAttempts.set(key, { attempts: 1, firstAttemptAt: now });
    } else {
      record.attempts++;
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        record.lockedUntil = record.firstAttemptAt + ATTEMPT_WINDOW_MS;
      }
    }
  } else {
    otpAttempts.set(key, { attempts: 1, firstAttemptAt: now });
  }
};

/**
 * Clear attempt record on successful verification
 */
const clearAttempts = (email: string): void => {
  otpAttempts.delete(email.toLowerCase().trim());
};

/**
 * Verify a password reset OTP without invalidating it.
 * This provides early validation for better UX while letting the
 * resetPassword endpoint do the final validation and password update.
 *
 * @param email - The email address associated with the OTP
 * @param otp - The OTP code to verify
 * @returns VerifyOtpResult indicating success/failure
 */
export const verifyResetOTP = async (
  email: string,
  otp: string
): Promise<VerifyOtpResult> => {
  try {
    // Check if locked out due to too many attempts
    const lockStatus = isLockedOut(email);
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil((lockStatus.remainingMs || 0) / 60000);
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        code: "TOO_MANY_ATTEMPTS",
      };
    }

    // Find verification record matching email and OTP
    // Better-auth stores email as the identifier for emailOTP
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: email.toLowerCase().trim(),
        value: otp,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!verification) {
      // Record failed attempt before returning error
      recordFailedAttempt(email);

      // Check if there's an expired OTP to give better feedback
      const expiredVerification = await prisma.verification.findFirst({
        where: {
          identifier: email.toLowerCase().trim(),
          value: otp,
        },
      });

      if (expiredVerification) {
        if (expiredVerification.status !== "PENDING") {
          return {
            success: false,
            message: "This code has already been used. Please request a new one.",
            code: "OTP_ALREADY_USED",
          };
        }
        return {
          success: false,
          message: "This code has expired. Please request a new one.",
          code: "OTP_EXPIRED",
        };
      }

      return {
        success: false,
        message: "Invalid verification code. Please check and try again.",
        code: "OTP_INVALID",
      };
    }

    // OTP is valid - clear attempt tracking and return success
    clearAttempts(email);

    return {
      success: true,
      message: "Verification code is valid.",
    };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return {
      success: false,
      message: "An error occurred while verifying the code. Please try again.",
      code: "INTERNAL_ERROR",
    };
  }
};
