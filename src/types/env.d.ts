declare namespace NodeJS {
  interface ProcessEnv {
    PORT: number;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BASE_URL: string;
    JWT_SECRET: string;
    // Google OAuth (Web redirect flow)
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    // Google Native (Mobile token verification)
    GOOGLE_IOS_CLIENT_ID?: string;
    GOOGLE_ANDROID_CLIENT_ID?: string;
    // Apple Native (Mobile token verification)
    APPLE_BUNDLE_ID?: string;
    EMAIL_USER: string;
    EMAIL_PASS: string;
    BETTER_AUTH_BASE_PATH: string;
    API_PREFIX?: string; // Optional: API route prefix (defaults to "/api" in dev, "" in prod)
  }
}
