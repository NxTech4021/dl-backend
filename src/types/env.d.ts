declare namespace NodeJS {
  interface ProcessEnv {
    PORT: number;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BASE_URL: string;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    EMAIL_USER: string;
    EMAIL_PASS: string;
    BETTER_AUTH_BASE_PATH: string;
    API_PREFIX?: string; // Optional: API route prefix (defaults to "/api" in dev, "" in prod)
  }
}
