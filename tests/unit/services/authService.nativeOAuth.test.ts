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
  },
});

const buildAppleIdentityToken = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${header}.${body}.signature`;
};

describe("authService native OAuth", () => {
  let authService: typeof import("../../../src/services/authService");

  beforeAll(async () => {
    process.env.GOOGLE_IOS_CLIENT_ID = "ios-client-id";
    process.env.GOOGLE_ANDROID_CLIENT_ID = "android-client-id";
    process.env.APPLE_BUNDLE_ID = "com.deucelague.app";
    authService = await import("../../../src/services/authService");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("signInWithGoogleToken retries username collisions and returns onboarding fields", async () => {
    const mockPrisma = createMockPrisma();
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: "ios-client-id",
        sub: "google-sub-1",
        email: "new-user@example.com",
        email_verified: true,
        name: "New User",
        picture: "https://example.com/avatar.png",
      }),
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create
      .mockRejectedValueOnce({
        code: "P2002",
        meta: { target: ["username"] },
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: "new-user@example.com",
        name: "New User",
        username: "LuckyPanda123",
        image: "https://example.com/avatar.png",
        emailVerified: true,
        role: "USER",
        completedOnboarding: false,
        onboardingStep: null,
      });
    mockPrisma.account.create.mockResolvedValue({ id: "account-1" });
    mockPrisma.session.create.mockResolvedValue({
      id: "session-1",
      expiresAt,
    });

    const result = await authService.signInWithGoogleToken("google-id-token", mockPrisma as any);

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(2);
    expect(result.user).toMatchObject({
      id: "user-1",
      username: "LuckyPanda123",
      completedOnboarding: false,
      onboardingStep: null,
    });
    expect(result.session).toEqual({
      id: "session-1",
      expiresAt,
    });
  });

  test("signInWithGoogleToken links an existing email to Google without recreating the user", async () => {
    const mockPrisma = createMockPrisma();
    const existingUser = {
      id: "user-existing",
      email: "existing@example.com",
      name: "Existing User",
      username: "ExistingUser888",
      image: null,
      emailVerified: true,
      role: "USER",
      completedOnboarding: true,
      onboardingStep: "PROFILE_PICTURE",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: "android-client-id",
        sub: "google-sub-2",
        email: "existing@example.com",
        email_verified: true,
        name: "Existing User",
      }),
    });

    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    mockPrisma.account.findFirst.mockResolvedValue(null);
    mockPrisma.account.create.mockResolvedValue({ id: "account-2" });
    mockPrisma.session.create.mockResolvedValue({
      id: "session-2",
      expiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });

    const result = await authService.signInWithGoogleToken("google-id-token", mockPrisma as any);

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(false);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.account.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-existing",
        accountId: "google-sub-2",
        providerId: "google",
      }),
    });
    expect(result.user).toMatchObject({
      id: "user-existing",
      completedOnboarding: true,
      onboardingStep: "PROFILE_PICTURE",
    });
  });

  test("signInWithAppleToken creates a new user from first sign-in details", async () => {
    const mockPrisma = createMockPrisma();
    const identityToken = buildAppleIdentityToken({
      iss: "https://appleid.apple.com",
      aud: "com.deucelague.app",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      sub: "apple-user-1",
      email: "apple-user@example.com",
    });

    mockPrisma.account.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "apple-user-id",
      email: "apple-user@example.com",
      name: "Apple User",
      username: "SwiftOtter456",
      image: null,
      emailVerified: true,
      role: "USER",
      completedOnboarding: false,
      onboardingStep: null,
    });
    mockPrisma.account.create.mockResolvedValue({ id: "apple-account-1" });
    mockPrisma.session.create.mockResolvedValue({
      id: "apple-session-1",
      expiresAt: new Date("2030-03-01T00:00:00.000Z"),
    });

    const result = await authService.signInWithAppleToken(
      identityToken,
      {
        email: "apple-user@example.com",
        fullName: {
          givenName: "Apple",
          familyName: "User",
        },
      },
      mockPrisma as any,
    );

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(result.user).toMatchObject({
      id: "apple-user-id",
      username: "SwiftOtter456",
      completedOnboarding: false,
    });
  });

  test("signInWithAppleToken signs in returning Apple users even when Apple omits email", async () => {
    const mockPrisma = createMockPrisma();
    const identityToken = buildAppleIdentityToken({
      iss: "https://appleid.apple.com",
      aud: "com.deucelague.app",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      sub: "apple-user-2",
    });
    const existingUser = {
      id: "apple-existing-user",
      email: "private@appleid.example",
      name: "Existing Apple User",
      username: "CosmicLynx321",
      image: null,
      emailVerified: true,
      role: "USER",
      completedOnboarding: true,
      onboardingStep: "PROFILE_PICTURE",
    };

    mockPrisma.account.findFirst.mockResolvedValue({
      id: "apple-account-2",
      user: existingUser,
    });
    mockPrisma.session.create.mockResolvedValue({
      id: "apple-session-2",
      expiresAt: new Date("2030-04-01T00:00:00.000Z"),
    });

    const result = await authService.signInWithAppleToken(identityToken, undefined, mockPrisma as any);

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(false);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(result.user).toMatchObject({
      id: "apple-existing-user",
      completedOnboarding: true,
      onboardingStep: "PROFILE_PICTURE",
    });
  });

  test("isAdminBlockedOnMobile blocks admin and superadmin mobile sign-ins only", async () => {
    expect(authService.isAdminBlockedOnMobile("ADMIN", "mobile")).toBe(true);
    expect(authService.isAdminBlockedOnMobile("SUPERADMIN", "mobile")).toBe(true);
    expect(authService.isAdminBlockedOnMobile("USER", "mobile")).toBe(false);
    expect(authService.isAdminBlockedOnMobile("ADMIN", "web")).toBe(false);
  });
});
