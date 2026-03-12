import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Shared handler factory — ensures all 429s have the same JSON shape
// and retryAfter is always seconds remaining (a number), not a Date.
function makeHandler(code: string, message: string) {
  return (req: Request, res: Response) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
      : 60; // fallback if resetTime is absent; 60s is a safe conservative default

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
// 5 requests per 15 minutes per IP.
// Only failed attempts count — a successful OTP verification should not
// burn one of the 5 allowed attempts.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Too many authentication attempts. Please try again later.'
  ),
});

// ── Availability check limiter — real-time form validation ──────────────────
// Applied to: POST /auth/check-email, POST /auth/check-username
// The signup form calls these as the user types. 5/15 min is too low.
// 50/15 min gives ~3 checks per minute comfortably.
// Intentionally IP-keyed: these endpoints are pre-authentication so no user ID is available.
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
// NOTE: Must be placed AFTER verifyAuth in the middleware chain so
// userKeyGenerator can read req.user.id instead of falling back to IP.
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

// ── Match join limiter — prevent rapid duplicate/concurrent joins ────────────
// Applied to: POST /api/match/:id/join, POST /api/friendly/:id/join
// 10 joins per 5 minutes per user is generous for normal usage.
// Prevents abuse and reduces race condition risk on concurrent joins.
export const matchJoinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: makeHandler(
    'MATCH_JOIN_RATE_LIMIT_EXCEEDED',
    'Too many join attempts. Please try again in a few minutes.'
  ),
});

// ── Score submission limiter — prevent rapid-fire result/confirm/walkover ────
// Applied to: POST /:id/result, POST /:id/confirm, POST /:id/walkover (both league and friendly)
// 10 submissions per 5 minutes per user. Score submission is infrequent —
// a legitimate user submits once, confirms once. This stops automated abuse
// and reduces the window for race condition exploitation.
export const scoreSubmissionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: makeHandler(
    'SCORE_SUBMISSION_RATE_LIMIT_EXCEEDED',
    'Too many score submission attempts. Please try again in a few minutes.'
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
  keyGenerator: userKeyGenerator,
  handler: makeHandler(
    'PUSH_TOKEN_RATE_LIMIT_EXCEEDED',
    'Too many push token registrations. Please try again later.'
  ),
});
