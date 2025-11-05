import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      name: string;
      email: string;
      username?: string;
      role?: string;
    };
    rateLimit?: {
      limit?: number;
      current?: number;
      remaining?: number;
      resetTime?: Date;
    };
    session?: {
      csrfToken?: string;
      [key: string]: any;
    };
  }
}
