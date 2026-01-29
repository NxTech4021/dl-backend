import { prisma } from "../lib/prisma";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../config/nodemailer";

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
 * Generate a random 6-digit OTP
 */
const generateRandomOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create and send a new OTP, invalidating any previous PENDING codes
 * 
 * @param email - The email address to send the OTP to
 * @param type - The type of OTP (for email template)
 * @returns The created OTP (for testing purposes, remove in production)
 */
export const createAndSendOTP = async (
  email: string,
  type: "forget-password" | "email-verification" | "sign-in" = "forget-password",
  prismaClient: PrismaClient = prisma
): Promise<{ success: boolean; message: string }> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateRandomOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // 1. Invalidate any existing PENDING codes for this user
    // This prevents multiple valid codes floating around
    await prismaClient.verification.updateMany({
      where: {
        identifier: normalizedEmail,
        status: "PENDING",
      },
      data: {
        status: "INVALIDATED",
      },
    });

    // 2. Create the new OTP
    await prismaClient.verification.create({
      data: {
        identifier: normalizedEmail,
        value: otp,
        expiresAt: expiresAt,
        status: "PENDING",
      },
    });

    // 3. Send Email
    let subject = "";
    let html = "";

    if (type === "forget-password") {
      subject = "Your Password Reset Code";
      html = `<p>Your password reset code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
    } else if (type === "email-verification") {
      subject = "Verify Your Email Address";
      html = `<p>Your email verification code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
    } else if (type === "sign-in") {
      subject = "Your Sign-In Code";
      html = `<p>Your sign-in code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
    }

    await sendEmail(normalizedEmail, subject, html);

    return {
      success: true,
      message: "Verification code sent successfully.",
    };
  } catch (error) {
    console.error("Error creating and sending OTP:", error);
    return {
      success: false,
      message: "Failed to send verification code. Please try again.",
    };
  }
};

/**
 * Helper function to extract OTP code from better-auth format
 * Better-auth stores OTPs as "code:period" (e.g., "123456:0")
 */
const extractOtpCode = (value: string): string => {
  // If it contains a colon, split and take the first part
  if (value.includes(':')) {
    const parts = value.split(':');
    return parts[0] || value;
  }
  return value;
};

/**
 * Consume an OTP by marking it as USED.
 * This should be called ONLY after the password has been successfully changed.
 * 
 * @param email - The email address associated with the OTP
 * @param otp - The OTP code to consume
 * @returns VerifyOtpResult indicating success/failure
 */
export const consumeOTP = async (
  email: string,
  otp: string,
  prismaClient: PrismaClient = prisma
): Promise<VerifyOtpResult> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp.trim();

    console.log("🔒 [consumeOTP] Starting OTP consumption:");
    console.log("   📧 Email:", normalizedEmail);
    console.log("   🔢 OTP:", normalizedOtp);

    // Better-auth stores OTPs in format "code:period" (e.g., "123456:0")
    // We need to find by the identifier and check the code part
    const allVerifications = await prismaClient.verification.findMany({
      where: {
        identifier: {
          contains: normalizedEmail,
        },
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    console.log("   📋 Found", allVerifications.length, "pending verification(s)");

    // Find the verification where the OTP code matches
    const verification = allVerifications.find((v: { value: string }) => {
      const storedCode = extractOtpCode(v.value);
      return storedCode === normalizedOtp;
    });

    if (!verification) {
      console.log("   ❌ No matching verification found to consume");
      return {
        success: false,
        message: "Invalid or expired verification code.",
        code: "OTP_INVALID",
      };
    }

    console.log("   ✅ Found matching verification, marking as USED");
    console.log("      ID:", verification.id);

    // Mark it as USED so it can't be used again
    await prismaClient.verification.update({
      where: { id: verification.id },
      data: { status: "USED" },
    });

    console.log("   ✅ OTP successfully consumed and marked as USED");

    return {
      success: true,
      message: "Verification code consumed successfully.",
    };
  } catch (error) {
    console.error("❌ [consumeOTP] Error consuming OTP:", error);
    return {
      success: false,
      message: "System error during verification.",
      code: "INTERNAL_ERROR",
    };
  }
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
  otp: string,
  prismaClient: PrismaClient = prisma
): Promise<VerifyOtpResult> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp.trim();

    console.log("🔍 [verifyResetOTP] Starting verification:");
    console.log("   📧 Email:", normalizedEmail);
    console.log("   🔢 OTP entered:", normalizedOtp);

    // Check if locked out due to too many attempts
    const lockStatus = isLockedOut(normalizedEmail);
    if (lockStatus.locked) {
      console.log("   🚫 User is locked out due to too many attempts");
      const remainingMinutes = Math.ceil((lockStatus.remainingMs || 0) / 60000);
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        code: "TOO_MANY_ATTEMPTS",
      };
    }

    // Better-auth stores OTPs in format "code:period" (e.g., "123456:0")
    // The identifier can be:
    // - "email-verification-otp-{email}" for registration
    // - "forget-password-{email}" for password reset
    // - Just "{email}" for sign-in
    // We need to search for pending OTPs that match the email pattern
    const allVerifications = await prismaClient.verification.findMany({
      where: {
        identifier: {
          contains: normalizedEmail,
        },
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    console.log("   📋 Found", allVerifications.length, "pending verification(s) for this email");
    
    if (allVerifications.length > 0) {
      console.log("   📝 Verification records:");
      allVerifications.forEach((v: any, index: number) => {
        const storedCode = extractOtpCode(v.value);
        console.log(`      [${index + 1}] ID: ${v.id}`);
        console.log(`          Identifier: ${v.identifier}`);
        console.log(`          Stored value: ${v.value}`);
        console.log(`          Extracted code: ${storedCode}`);
        console.log(`          Status: ${v.status}`);
        console.log(`          Expires: ${v.expiresAt}`);
        console.log(`          Match: ${storedCode === normalizedOtp ? "✅ YES" : "❌ NO"}`);
      });
    }

    // Find the verification where the OTP code matches
    const verification = allVerifications.find((v: { value: string }) => {
      const storedCode = extractOtpCode(v.value);
      return storedCode === normalizedOtp;
    });

    console.log("   🎯 Matching verification found:", verification ? "✅ YES" : "❌ NO");

    if (!verification) {
      console.log("   ❌ No matching verification found. Checking for expired/used codes...");
      
      // Record failed attempt before returning error
      recordFailedAttempt(normalizedEmail);

      // Check if there's an expired OTP to give better feedback
      const expiredVerifications = await prismaClient.verification.findMany({
        where: {
          identifier: {
            contains: normalizedEmail,
          },
        },
      });

      console.log("   🔍 Checking all verifications (including expired/used):", expiredVerifications.length);
      
      if (expiredVerifications.length > 0) {
        console.log("   📝 All verification records:");
        expiredVerifications.forEach((v: any, index: number) => {
          const storedCode = extractOtpCode(v.value);
          console.log(`      [${index + 1}] Identifier: ${v.identifier}`);
          console.log(`          Stored value: ${v.value}`);
          console.log(`          Extracted code: ${storedCode}`);
          console.log(`          Status: ${v.status}`);
          console.log(`          Expires: ${v.expiresAt}`);
          console.log(`          Is expired: ${new Date() > new Date(v.expiresAt) ? "YES" : "NO"}`);
        });
      }

      const expiredVerification = expiredVerifications.find((v: { value: string; status: string }) => {
        const storedCode = extractOtpCode(v.value);
        return storedCode === normalizedOtp;
      });

      if (expiredVerification) {
        console.log("   ⚠️  Found matching code but it's not valid:");
        console.log("      Status:", expiredVerification.status);
        console.log("      Expired:", new Date() > new Date(expiredVerification.expiresAt) ? "YES" : "NO");
        
        if (expiredVerification.status !== "PENDING") {
          console.log("   ❌ Code already used");
          return {
            success: false,
            message: "This code has already been used. Please request a new one.",
            code: "OTP_ALREADY_USED",
          };
        }
        console.log("   ⏰ Code expired");
        return {
          success: false,
          message: "This code has expired. Please request a new one.",
          code: "OTP_EXPIRED",
        };
      }

      console.log("   ❌ Code not found in database at all");
      return {
        success: false,
        message: "Invalid verification code. Please check and try again.",
        code: "OTP_INVALID",
      };
    }

    // OTP is valid - DO NOT mark as USED yet
    // The actual password reset endpoint will mark it as USED after changing the password
    
    console.log("   ✅ Verification successful! OTP is valid.");
    
    // Clear attempt tracking and return success
    clearAttempts(normalizedEmail);

    return {
      success: true,
      message: "Verification code is valid.",
    };
  } catch (error) {
    console.error("❌ [verifyResetOTP] Error verifying OTP:", error);
    return {
      success: false,
      message: "An error occurred while verifying the code. Please try again.",
      code: "INTERNAL_ERROR",
    };
  }
};
