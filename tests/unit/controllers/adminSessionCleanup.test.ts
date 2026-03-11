/**
 * L-10: When admin/superadmin is blocked from mobile sign-in,
 * the session created during OAuth flow must be deleted.
 * Otherwise an orphaned session accumulates in the database.
 */

// Mock prisma before importing anything that uses it
jest.mock("../../../src/lib/prisma", () => ({
  prisma: {
    session: {
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock auth for buildSignedSessionCookieHeader
jest.mock("../../../src/lib/auth", () => ({
  auth: {
    $context: Promise.resolve({
      secret: "test-secret",
      authCookies: {
        sessionToken: {
          name: "session_token",
          options: {},
        },
      },
    }),
  },
}));

// Mock better-call
jest.mock("better-call", () => ({
  serializeSignedCookie: jest.fn().mockReturnValue("mocked-cookie"),
}));

// Mock authService
jest.mock("../../../src/services/authService", () => ({
  signInWithGoogleToken: jest.fn(),
  signInWithAppleToken: jest.fn(),
  isAdminBlockedOnMobile: jest.fn(),
}));

import { Request, Response } from "express";
import { prisma } from "../../../src/lib/prisma";
import {
  signInWithGoogleToken,
  signInWithAppleToken,
  isAdminBlockedOnMobile,
} from "../../../src/services/authService";

const createMockRes = () => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

const createMockReq = (body: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
  return {
    body,
    headers,
  } as unknown as Request;
};

describe("Admin session cleanup on mobile block (L-10)", () => {
  let authController: typeof import("../../../src/controllers/authController");

  beforeAll(async () => {
    authController = await import("../../../src/controllers/authController");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("googleNativeSignIn should delete session when admin is blocked on mobile", async () => {
    const oauthResult = {
      success: true,
      user: { id: "admin-1", role: "ADMIN", email: "admin@test.com" },
      session: { id: "session-to-delete", expiresAt: new Date() },
      sessionToken: "token-123",
      isNewUser: false,
    };

    (signInWithGoogleToken as jest.Mock).mockResolvedValue(oauthResult);
    (isAdminBlockedOnMobile as jest.Mock).mockReturnValue(true);

    const req = createMockReq(
      { idToken: "valid-google-token" },
      { "x-client-type": "mobile" },
    );
    const res = createMockRes();

    await authController.googleNativeSignIn(req, res);

    // Session must be cleaned up
    expect(prisma.session.delete).toHaveBeenCalledWith({
      where: { id: "session-to-delete" },
    });

    // Should return 403
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("appleNativeSignIn should delete session when admin is blocked on mobile", async () => {
    const oauthResult = {
      success: true,
      user: { id: "admin-2", role: "SUPERADMIN", email: "super@test.com" },
      session: { id: "apple-session-to-delete", expiresAt: new Date() },
      sessionToken: "apple-token-456",
      isNewUser: false,
    };

    (signInWithAppleToken as jest.Mock).mockResolvedValue(oauthResult);
    (isAdminBlockedOnMobile as jest.Mock).mockReturnValue(true);

    const req = createMockReq(
      { identityToken: "valid-apple-token" },
      { "x-client-type": "mobile" },
    );
    const res = createMockRes();

    await authController.appleNativeSignIn(req, res);

    // Session must be cleaned up
    expect(prisma.session.delete).toHaveBeenCalledWith({
      where: { id: "apple-session-to-delete" },
    });

    // Should return 403
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("googleNativeSignIn should NOT delete session for normal users", async () => {
    const oauthResult = {
      success: true,
      user: { id: "user-1", role: "USER", email: "user@test.com" },
      session: { id: "user-session", expiresAt: new Date() },
      sessionToken: "user-token",
      isNewUser: false,
    };

    (signInWithGoogleToken as jest.Mock).mockResolvedValue(oauthResult);
    (isAdminBlockedOnMobile as jest.Mock).mockReturnValue(false);

    const req = createMockReq(
      { idToken: "valid-google-token" },
      { "x-client-type": "mobile" },
    );
    const res = createMockRes();

    await authController.googleNativeSignIn(req, res);

    // Session should NOT be deleted for normal users
    expect(prisma.session.delete).not.toHaveBeenCalled();

    // Should return 200
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
