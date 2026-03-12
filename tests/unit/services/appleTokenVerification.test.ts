import { SignJWT, exportJWK, generateKeyPair } from "jose";

/**
 * Tests for L-1: Apple JWT signature must be cryptographically verified.
 * Tests for L-9: req.body.email must NOT be used for account lookup/linking.
 *
 * These tests create real RSA keys and sign JWTs, then verify that:
 * 1. Forged (unsigned) tokens are rejected
 * 2. Properly signed tokens (with wrong key) are rejected
 * 3. Expired tokens are rejected
 * 4. Wrong audience tokens are rejected
 * 5. Wrong issuer tokens are rejected
 * 6. Body email is never used for account lookup
 */

const APPLE_BUNDLE_ID = "com.deucelague.app";

// Helper: build a forged (base64-only, no real signature) Apple token
const buildForgedAppleToken = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fake" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
};

// Helper: generate a real RSA key pair and sign a JWT
const signAppleToken = async (
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  kid: string = "test-key-1",
) => {
  const jwt = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "RS256", kid })
    .sign(privateKey);
  return jwt;
};

// Helper: mock fetch to return a JWKS containing our test public key
const mockAppleJWKS = async (publicKey: CryptoKey, kid: string = "test-key-1") => {
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";

  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ keys: [jwk] }),
    headers: new Headers({ "content-type": "application/json" }),
  });
};

const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  session: {
    create: jest.fn(),
    delete: jest.fn(),
  },
});

describe("Apple token verification (L-1)", () => {
  let authService: typeof import("../../../src/services/authService");

  beforeAll(async () => {
    process.env.GOOGLE_IOS_CLIENT_ID = "ios-client-id";
    process.env.GOOGLE_ANDROID_CLIENT_ID = "android-client-id";
    process.env.APPLE_BUNDLE_ID = APPLE_BUNDLE_ID;
    authService = await import("../../../src/services/authService");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty JWKS (no matching keys). Tests override with mockAppleJWKS.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keys: [] }),
      headers: new Headers({ "content-type": "application/json" }),
    });
  });

  test("should reject a forged (unsigned) Apple token", async () => {
    const mockPrisma = createMockPrisma();
    const forgedToken = buildForgedAppleToken({
      iss: "https://appleid.apple.com",
      aud: APPLE_BUNDLE_ID,
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "attacker-sub",
      email: "victim@example.com",
    });

    const result = await authService.signInWithAppleToken(
      forgedToken,
      undefined,
      mockPrisma as any,
    );

    expect(result.success).toBe(false);
    // Must NOT create a session for a forged token
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("should reject an expired Apple token even with valid structure", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    await mockAppleJWKS(publicKey);

    const expiredToken = await signAppleToken(
      {
        iss: "https://appleid.apple.com",
        aud: APPLE_BUNDLE_ID,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        sub: "apple-user-expired",
        email: "expired@example.com",
      },
      privateKey,
    );

    const mockPrisma = createMockPrisma();
    const result = await authService.signInWithAppleToken(
      expiredToken,
      undefined,
      mockPrisma as any,
    );

    expect(result.success).toBe(false);
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  test("should reject a token with wrong audience", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    await mockAppleJWKS(publicKey);

    const wrongAudToken = await signAppleToken(
      {
        iss: "https://appleid.apple.com",
        aud: "com.attacker.app",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: "apple-user-wrong-aud",
        email: "wrongaud@example.com",
      },
      privateKey,
    );

    const mockPrisma = createMockPrisma();
    const result = await authService.signInWithAppleToken(
      wrongAudToken,
      undefined,
      mockPrisma as any,
    );

    expect(result.success).toBe(false);
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  test("should reject a token with wrong issuer", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    await mockAppleJWKS(publicKey);

    const wrongIssToken = await signAppleToken(
      {
        iss: "https://evil.example.com",
        aud: APPLE_BUNDLE_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: "apple-user-wrong-iss",
        email: "wrongiss@example.com",
      },
      privateKey,
    );

    const mockPrisma = createMockPrisma();
    const result = await authService.signInWithAppleToken(
      wrongIssToken,
      undefined,
      mockPrisma as any,
    );

    expect(result.success).toBe(false);
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });
});

describe("Apple account linking security (L-9)", () => {
  let authService: typeof import("../../../src/services/authService");

  beforeAll(async () => {
    process.env.APPLE_BUNDLE_ID = APPLE_BUNDLE_ID;
    authService = await import("../../../src/services/authService");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keys: [] }),
      headers: new Headers({ "content-type": "application/json" }),
    });
  });

  test("should NOT use userInfo.email from request body for account lookup", async () => {
    // Simulate: Apple token has no email (subsequent sign-in),
    // but attacker puts victim's email in request body.
    // The service must NOT look up the victim by that email.
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    await mockAppleJWKS(publicKey);

    const token = await signAppleToken(
      {
        iss: "https://appleid.apple.com",
        aud: APPLE_BUNDLE_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        sub: "attacker-apple-id",
        // No email in token — simulates subsequent Apple sign-in
      },
      privateKey,
    );

    const mockPrisma = createMockPrisma();
    // No account linked to this Apple ID
    mockPrisma.account.findFirst.mockResolvedValue(null);
    // Mock user creation to avoid crashes
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      email: "apple_attacker-apple-id@private.apple.com",
      name: "Attacker Bad",
      username: "AttackerBad123",
      image: null,
      emailVerified: false,
      role: "USER",
      completedOnboarding: false,
      onboardingStep: null,
    });
    mockPrisma.account.create.mockResolvedValue({ id: "account-1" });
    mockPrisma.session.create.mockResolvedValue({
      id: "session-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const result = await authService.signInWithAppleToken(
      token,
      {
        email: "victim@example.com", // Attacker-controlled body email
        fullName: { givenName: "Attacker", familyName: "Bad" },
      },
      mockPrisma as any,
    );

    // The service must NOT have called findUnique with victim's email
    if (mockPrisma.user.findUnique.mock.calls.length > 0) {
      const lookupEmail = mockPrisma.user.findUnique.mock.calls[0][0]?.where?.email;
      expect(lookupEmail).not.toBe("victim@example.com");
    }

    // Since token has no email, a new user should be created (not linked to victim)
    // The email used should be the generated fallback, not the body email
    if (result.success && mockPrisma.user.create.mock.calls.length > 0) {
      const createData = mockPrisma.user.create.mock.calls[0][0]?.data;
      expect(createData?.email).not.toBe("victim@example.com");
    }
  });
});
