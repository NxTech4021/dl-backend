/// <reference path="../types/express.d.ts" />
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "same-origin" },
  xssFilter: true,
});

// Rate limiting configuration
// General rate limiter: higher limit in development (single developer shares one IP)
const isDev = process.env.NODE_ENV !== 'production';
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 300 : 100, // 300/min in dev, 100/min in production
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    success: false
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use IP address for rate limiting
    return req.ip || 'unknown';
  },
});

// Log security events
export const logSecurityEvent = (eventType: string, details: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${eventType}:`, details);
  // In production, send this to a security monitoring service
};
