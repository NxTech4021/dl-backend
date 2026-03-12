/**
 * L-12: When GOOGLE_IOS_CLIENT_ID and GOOGLE_ANDROID_CLIENT_ID env vars
 * are both missing/empty, VALID_GOOGLE_AUDIENCES is an empty array.
 * The service should warn at startup and reject tokens when no audiences are configured.
 */

describe("Google audience validation (L-12)", () => {
  const originalEnv = process.env;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  test("should warn when both Google client IDs are missing", async () => {
    // Clear both env vars
    delete process.env.GOOGLE_IOS_CLIENT_ID;
    delete process.env.GOOGLE_ANDROID_CLIENT_ID;

    // Re-import to trigger module initialization
    await import("../../../src/services/authService");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("GOOGLE"),
    );
  });

  test("should NOT warn when at least one Google client ID is set", async () => {
    process.env.GOOGLE_IOS_CLIENT_ID = "valid-ios-id";
    process.env.GOOGLE_ANDROID_CLIENT_ID = "";

    await import("../../../src/services/authService");

    // Should not warn about Google audiences
    const googleWarnings = consoleWarnSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("GOOGLE"),
    );
    expect(googleWarnings.length).toBe(0);
  });
});
