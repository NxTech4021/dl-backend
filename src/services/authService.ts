import { prisma } from "../lib/prisma";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../config/nodemailer";
import { randomUUID } from "crypto";

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

// Google OAuth configuration
const GOOGLE_IOS_CLIENT_ID = "1049126820486-s6dpimmdmcgkcar6ju3c1turdlr05hpt.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT_ID = "1049126820486-5amoljjhl97lodkul5jhp669k40jl6av.apps.googleusercontent.com"; // Used by Android

// Valid audiences for Google token verification
const VALID_GOOGLE_AUDIENCES = [GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID];

interface GoogleTokenPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number;
  exp: number;
}

export interface GoogleSignInResult {
  success: boolean;
  user?: any;
  session?: any;
  sessionToken?: string;
  isNewUser?: boolean;
  error?: string;
}

/**
 * Verify Google ID token and sign in or create user
 *
 * @param idToken - The ID token from Google Sign-In SDK
 * @returns GoogleSignInResult with user and session data
 */
export const signInWithGoogleToken = async (
  idToken: string,
  prismaClient: PrismaClient = prisma
): Promise<GoogleSignInResult> => {
  try {
    console.log("🔐 [signInWithGoogleToken] Verifying Google ID token...");

    // Verify the token with Google's tokeninfo endpoint
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!response.ok) {
      console.error("❌ Google token verification failed:", response.status);
      return {
        success: false,
        error: "Invalid Google token",
      };
    }

    const payload: GoogleTokenPayload = await response.json();

    // Verify the token is for our app (iOS or Android)
    if (!VALID_GOOGLE_AUDIENCES.includes(payload.aud)) {
      console.error("❌ Token audience mismatch");
      console.error("   Expected one of:", VALID_GOOGLE_AUDIENCES);
      console.error("   Got:", payload.aud);
      return {
        success: false,
        error: "Token not issued for this application",
      };
    }

    // Verify email is verified
    if (!payload.email_verified) {
      return {
        success: false,
        error: "Email not verified with Google",
      };
    }

    console.log("✅ Google token verified for:", payload.email);

    // Check if user exists
    let user = await prismaClient.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      console.log("📝 Creating new user for:", payload.email);
      isNewUser = true;

      user = await prismaClient.user.create({
        data: {
          id: randomUUID(),
          email: payload.email.toLowerCase(),
          name: payload.name || payload.given_name || "User",
          image: payload.picture || null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create account link for Google provider
      await prismaClient.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: payload.sub,
          providerId: "google",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("✅ New user created:", user.id);
    } else {
      console.log("👤 Existing user found:", user.id);

      // Check if Google account is linked
      const existingAccount = await prismaClient.account.findFirst({
        where: {
          userId: user.id,
          providerId: "google",
        },
      });

      if (!existingAccount) {
        // Link Google account to existing user
        await prismaClient.account.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            accountId: payload.sub,
            providerId: "google",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log("🔗 Google account linked to existing user");
      }
    }

    // Create session
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prismaClient.session.create({
      data: {
        id: randomUUID(),
        token: sessionToken,
        userId: user.id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("✅ Session created for user:", user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        role: user.role,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      sessionToken,
      isNewUser,
    };
  } catch (error) {
    console.error("❌ [signInWithGoogleToken] Error:", error);
    return {
      success: false,
      error: "Failed to authenticate with Google",
    };
  }
};

// Apple Sign-In configuration
// Bundle ID is used as the audience for Apple tokens
const APPLE_BUNDLE_ID = "com.deucelague.app";

interface AppleTokenPayload {
  iss: string; // https://appleid.apple.com
  aud: string; // Your bundle ID
  exp: number;
  iat: number;
  sub: string; // User's unique Apple ID
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce_supported?: boolean;
}

export interface AppleSignInResult {
  success: boolean;
  user?: any;
  session?: any;
  sessionToken?: string;
  isNewUser?: boolean;
  error?: string;
}

interface AppleUserInfo {
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
  email?: string | null;
}

/**
 * Decode Apple identity token (JWT) without verification
 * Apple tokens are JWTs signed with RS256
 */
const decodeAppleToken = (token: string): AppleTokenPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

/**
 * Verify Apple ID token and sign in or create user
 *
 * @param identityToken - The identity token from Apple Sign-In SDK
 * @param userInfo - Optional user info (name, email) provided on first sign-in
 * @returns AppleSignInResult with user and session data
 */
export const signInWithAppleToken = async (
  identityToken: string,
  userInfo?: AppleUserInfo,
  prismaClient: PrismaClient = prisma
): Promise<AppleSignInResult> => {
  try {
    console.log("🍎 [signInWithAppleToken] Verifying Apple identity token...");

    // Decode the token to get claims
    const payload = decodeAppleToken(identityToken);

    if (!payload) {
      console.error("❌ Failed to decode Apple token");
      return {
        success: false,
        error: "Invalid Apple token",
      };
    }

    // Verify issuer
    if (payload.iss !== "https://appleid.apple.com") {
      console.error("❌ Invalid token issuer:", payload.iss);
      return {
        success: false,
        error: "Invalid token issuer",
      };
    }

    // Verify audience (bundle ID)
    if (payload.aud !== APPLE_BUNDLE_ID) {
      console.error("❌ Token audience mismatch");
      console.error("   Expected:", APPLE_BUNDLE_ID);
      console.error("   Got:", payload.aud);
      return {
        success: false,
        error: "Token not issued for this application",
      };
    }

    // Verify expiration
    if (payload.exp * 1000 < Date.now()) {
      console.error("❌ Token has expired");
      return {
        success: false,
        error: "Token has expired",
      };
    }

    const appleUserId = payload.sub;
    // Apple may or may not provide email - it's only given on first sign-in
    // and user can choose to hide it
    const email = payload.email || userInfo?.email;

    console.log("✅ Apple token verified for user:", appleUserId);
    console.log("   Email:", email || "(not provided)");

    // First, check if we have an account linked with this Apple ID
    let account = await prismaClient.account.findFirst({
      where: {
        providerId: "apple",
        accountId: appleUserId,
      },
      include: { user: true },
    });

    let user = account?.user;
    let isNewUser = false;

    if (!user && email) {
      // No Apple account linked, check if user exists by email
      user = await prismaClient.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    }

    if (!user) {
      // Create new user
      console.log("📝 Creating new user for Apple ID:", appleUserId);
      isNewUser = true;

      // Build user name from provided info
      const givenName = userInfo?.fullName?.givenName || "";
      const familyName = userInfo?.fullName?.familyName || "";
      const name = [givenName, familyName].filter(Boolean).join(" ") || "User";

      user = await prismaClient.user.create({
        data: {
          id: randomUUID(),
          email: email?.toLowerCase() || `apple_${appleUserId}@private.apple.com`,
          name,
          emailVerified: true, // Apple verifies emails
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create account link for Apple provider
      await prismaClient.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: appleUserId,
          providerId: "apple",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("✅ New user created:", user.id);
    } else if (!account) {
      // User exists but Apple account not linked - link it
      console.log("🔗 Linking Apple account to existing user:", user.id);
      await prismaClient.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: appleUserId,
          providerId: "apple",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      console.log("👤 Existing user found:", user.id);
    }

    // Create session
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prismaClient.session.create({
      data: {
        id: randomUUID(),
        token: sessionToken,
        userId: user.id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("✅ Session created for user:", user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        role: user.role,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      sessionToken,
      isNewUser,
    };
  } catch (error) {
    console.error("❌ [signInWithAppleToken] Error:", error);
    return {
      success: false,
      error: "Failed to authenticate with Apple",
    };
  }
};

/**
 * Check if an admin/superadmin user should be blocked from mobile login
 *
 * @param role - User's role (USER, ADMIN, SUPERADMIN)
 * @param clientType - Client type header value (e.g., 'mobile', 'web', undefined)
 * @returns true if user should be blocked, false otherwise
 */
export const isAdminBlockedOnMobile = (
  role: string | undefined,
  clientType: string | undefined
): boolean => {
  if (clientType !== 'mobile') return false;
  return role === 'ADMIN' || role === 'SUPERADMIN';
};
