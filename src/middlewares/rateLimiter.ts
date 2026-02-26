import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Shared handler factory — ensures all 429s have the same JSON shape
// and retryAfter is always seconds remaining (a number), not a Date.
function makeHandler(code: string, message: string) {
  return (req: Request, res: Response) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
      : 60;

    res.status(429).json({
      success: false,
      code,
      message,
      retryAfter,
    });
  };
}

// Key generator for authenticated routes.
// Uses the logged-in user's ID when available so that two users sharing
// a NAT IP do not eat into each other's quota.
// Falls back to IP for unauthenticated requests.
export function userKeyGenerator(req: Request): string {
  return (req as any).user?.id ?? req.ip ?? 'unknown';
}

// ── Strict auth limiter — brute force protection ────────────────────────────
// Applied to: POST /auth/verify-reset-otp
// 5 failed attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Too many failed authentication attempts. Please try again later.'
  ),
});

// ── Availability check limiter — real-time form validation ──────────────────
// Applied to: POST /auth/check-email, POST /auth/check-username
// The signup form calls these as the user types. 5/15 min is too low.
// 50/15 min gives ~3 checks per minute comfortably.
export const availabilityCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    'AVAILABILITY_CHECK_RATE_LIMIT_EXCEEDED',
    'Too many availability checks. Please slow down.'
  ),
});

// ── Onboarding limiter — authenticated, user-ID keyed ──────────────────────
// Applied to: 11 routes in /api/onboarding/* (all behind verifyAuth)
// Keyed by user ID so users on shared IPs don't block each other.
// 60 requests per 5 minutes is generous for multi-step onboarding flows.
export const onboardingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: makeHandler(
    'ONBOARDING_RATE_LIMIT_EXCEEDED',
    'Too many requests during onboarding. Please slow down.'
  ),
});

// ── Questionnaire submission limiter ───────────────────────────────────────
// Applied to: POST /api/onboarding/:sport/submit (final submit only)
// 10 submissions per 15 minutes is fine for a one-time final submit.
export const questionnaireLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: makeHandler(
    'QUESTIONNAIRE_RATE_LIMIT_EXCEEDED',
    'Too many questionnaire submissions. Please try again later.'
  ),
});

// ── Push token limiter ──────────────────────────────────────────────────────
// Applied to: POST /api/notifications/push-token
// 10 registrations per hour is plenty — tokens only change on reinstall.
export const pushTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    'PUSH_TOKEN_RATE_LIMIT_EXCEEDED',
    'Too many push token registrations. Please try again later.'
  ),
});
