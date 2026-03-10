import { Request, Response } from "express";
import { serializeSignedCookie } from "better-call";
import { verifyResetOTP, signInWithGoogleToken, signInWithAppleToken, isAdminBlockedOnMobile } from "../services/authService";
import { sendSuccess, sendError } from "../utils/response";
import { prisma } from "../lib/prisma";
import { auth } from "../lib/auth";

const buildSignedSessionCookieHeader = async (sessionToken: string) => {
  const authContext = await auth.$context;
  const { name, options } = authContext.authCookies.sessionToken;

  return serializeSignedCookie(
    name,
    sessionToken,
    authContext.secret,
    options,
  );
};

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

/**
 * POST /api/auth/google/native
 * Authenticate user with Google ID token from native SDK.
 *
 * Request body:
 * - idToken: string (required) - The ID token from Google Sign-In
 *
 * Response:
 * - 200: { user: User, session: Session, isNewUser: boolean }
 * - 400: Invalid or missing token
 * - 500: Internal server error
 */
export const googleNativeSignIn = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== "string") {
      return sendError(res, "ID token is required", 400);
    }

    const result = await signInWithGoogleToken(idToken);

    if (!result.success) {
      return sendError(res, result.error || "Authentication failed", 400);
    }

    // Check if admin/superadmin trying to login from mobile
    const clientType = req.headers['x-client-type'] as string | undefined;
    if (isAdminBlockedOnMobile(result.user?.role, clientType)) {
      return sendError(
        res,
        "Admin accounts cannot sign in via the mobile app. Please use the web dashboard.",
        403
      );
    }

    const sessionCookieHeader = result.sessionToken
      ? await buildSignedSessionCookieHeader(result.sessionToken)
      : null;

    if (sessionCookieHeader) {
      res.append("Set-Cookie", sessionCookieHeader);
    }

    return sendSuccess(
      res,
      {
        user: result.user,
        session: result.session,
        sessionToken: result.sessionToken, // Include for mobile SecureStore
        sessionCookieHeader,
        isNewUser: result.isNewUser,
      },
      result.isNewUser ? "Account created successfully" : "Signed in successfully"
    );
  } catch (error) {
    console.error("Google native sign-in error:", error);
    return sendError(res, "Something went wrong. Please try again.", 500);
  }
};

/**
 * POST /api/auth/apple/native
 * Authenticate user with Apple identity token from native SDK.
 *
 * Request body:
 * - identityToken: string (required) - The identity token from Apple Sign-In
 * - fullName: { givenName?: string, familyName?: string } (optional) - User's name (only provided on first sign-in)
 * - email: string (optional) - User's email (only provided on first sign-in)
 *
 * Response:
 * - 200: { user: User, session: Session, isNewUser: boolean }
 * - 400: Invalid or missing token
 * - 500: Internal server error
 */
export const appleNativeSignIn = async (req: Request, res: Response) => {
  try {
    const { identityToken, fullName, email } = req.body;

    if (!identityToken || typeof identityToken !== "string") {
      return sendError(res, "Identity token is required", 400);
    }

    const result = await signInWithAppleToken(identityToken, { fullName, email });

    if (!result.success) {
      return sendError(res, result.error || "Authentication failed", 400);
    }

    // Check if admin/superadmin trying to login from mobile
    const clientType = req.headers['x-client-type'] as string | undefined;
    if (isAdminBlockedOnMobile(result.user?.role, clientType)) {
      return sendError(
        res,
        "Admin accounts cannot sign in via the mobile app. Please use the web dashboard.",
        403
      );
    }

    const sessionCookieHeader = result.sessionToken
      ? await buildSignedSessionCookieHeader(result.sessionToken)
      : null;

    if (sessionCookieHeader) {
      res.append("Set-Cookie", sessionCookieHeader);
    }

    return sendSuccess(
      res,
      {
        user: result.user,
        session: result.session,
        sessionToken: result.sessionToken,
        sessionCookieHeader,
        isNewUser: result.isNewUser,
      },
      result.isNewUser ? "Account created successfully" : "Signed in successfully"
    );
  } catch (error) {
    console.error("Apple native sign-in error:", error);
    return sendError(res, "Something went wrong. Please try again.", 500);
  }
};
