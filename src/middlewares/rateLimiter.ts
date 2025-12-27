import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General rate limiter for all API endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'You have exceeded the request limit. Please try again later.',
      retryAfter: req.rateLimit?.resetTime,
      success: false
    });
  }
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfter: req.rateLimit?.resetTime,
      success: false
    });
  }
});

// Rate limiter for sign-up endpoints
export const signUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 sign-ups per hour
  message: 'Too many accounts created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many sign-up attempts',
      code: 'SIGNUP_RATE_LIMIT_EXCEEDED',
      message: 'Too many accounts created. Please try again later.',
      retryAfter: req.rateLimit?.resetTime,
      success: false
    });
  }
});

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 reset requests per windowMs
  message: 'Too many password reset requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for onboarding endpoints
export const onboardingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for questionnaire submission
export const questionnaireLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per windowMs
  message: 'Too many questionnaire submissions, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for push token registration
// More lenient since tokens refresh occasionally
export const pushTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 token registrations per hour
  message: 'Too many push token registrations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many push token registrations',
      code: 'PUSH_TOKEN_RATE_LIMIT_EXCEEDED',
      message: 'Too many push token registrations. Please try again later.',
      retryAfter: req.rateLimit?.resetTime,
      success: false
    });
  }
});