/**
 * Rate Limiter Middleware Tests
 *
 * Tests isolated express mini-apps — no database, no auth.
 * Each describe block creates its own app instance so in-memory
 * counters don't bleed between tests.
 */
import express, { Request, Response } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a tiny Express app with one limiter and one route.
 * The x-test-ip header overrides the IP so each test can use a unique IP
 * and avoid counter bleed between tests.
 */
function makeApp(limiter: ReturnType<typeof rateLimit>) {
  const app = express();
  app.set('trust proxy', false);

  // Allow tests to spoof IP via header
  app.use((req: Request, _res: Response, next) => {
    if (req.headers['x-test-ip']) {
      (req as any).ip = req.headers['x-test-ip'] as string;
    }
    next();
  });

  app.get('/test', limiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

/**
 * Fire `n` requests to `app` GET /test from `ip`, return all responses.
 */
async function fireRequests(app: express.Application, n: number, ip: string) {
  const results = [];
  for (let i = 0; i < n; i++) {
    const res = await request(app)
      .get('/test')
      .set('x-test-ip', ip);
    results.push(res);
  }
  return results;
}

// ─── Import the limiters under test ─────────────────────────────────────────
import {
  authLimiter,
  availabilityCheckLimiter,
  onboardingLimiter,
  questionnaireLimiter,
  pushTokenLimiter,
} from '../../../src/middlewares/rateLimiter';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Rate Limiter — 429 response shape', () => {
  /**
   * EVERY 429 response across ALL limiters must have:
   *   { success: false, code: string, message: string, retryAfter: number }
   * No limiter should return a plain string body.
   */

  const limitersToTest = [
    { name: 'authLimiter', limiter: authLimiter, max: 5, ip: '10.0.0.1' },
    { name: 'questionnaireLimiter', limiter: questionnaireLimiter, max: 10, ip: '10.0.0.2' },
    { name: 'onboardingLimiter', limiter: onboardingLimiter, max: 60, ip: '10.0.0.3' },
    { name: 'pushTokenLimiter', limiter: pushTokenLimiter, max: 10, ip: '10.0.0.4' },
  ];

  for (const { name, limiter, max, ip } of limitersToTest) {
    it(`${name}: 429 body has success=false, code, message, retryAfter as number`, async () => {
      const app = makeApp(limiter);
      const responses = await fireRequests(app, max + 1, ip);
      const blocked = responses[responses.length - 1];

      expect(blocked.status).toBe(429);

      // Must be JSON, not a plain string
      expect(typeof blocked.body).toBe('object');
      expect(blocked.body.success).toBe(false);
      expect(typeof blocked.body.code).toBe('string');
      expect(blocked.body.code.length).toBeGreaterThan(0);
      expect(typeof blocked.body.message).toBe('string');

      // retryAfter must be a NUMBER (seconds), not a Date string or object
      expect(typeof blocked.body.retryAfter).toBe('number');
      expect(blocked.body.retryAfter).toBeGreaterThan(0);
    });
  }
});

describe('Rate Limiter — availability check limiter', () => {
  /**
   * availabilityCheckLimiter must exist and allow at least 30 requests.
   * It is used on /check-email and /check-username which the signup form
   * calls in real-time as the user types — 5/15 min kills the UX.
   */

  it('allows 30 consecutive requests without blocking', async () => {
    const app = makeApp(availabilityCheckLimiter);
    const responses = await fireRequests(app, 30, '10.1.0.1');
    const statuses = responses.map((r) => r.status);

    // All 30 should succeed
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('authLimiter still blocks at 5 (brute-force protection stays)', async () => {
    const app = makeApp(authLimiter);
    const responses = await fireRequests(app, 6, '10.1.0.2');

    // First 5 should pass
    for (let i = 0; i < 5; i++) {
      expect(responses[i].status).toBe(200);
    }
    // 6th should be blocked
    expect(responses[5].status).toBe(429);
  });
});

describe('Rate Limiter — onboarding limiter keys by user ID', () => {
  /**
   * onboardingLimiter is applied to authenticated routes.
   * Two different user IDs from the same IP must have independent counters.
   * If keyed by IP, user B is affected by user A's requests.
   */

  it('two different user IDs from the same IP have independent counters', async () => {
    const app = express();
    app.set('trust proxy', false);

    app.use((req: Request, _res: Response, next) => {
      // Simulate verifyAuth setting req.user
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        (req as any).user = { id: userId };
      }
      // Fix IP to same value for both users
      (req as any).ip = '10.2.0.1';
      next();
    });

    app.get('/test', onboardingLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    // User A exhausts their quota — send 61 requests (max is 60)
    const userARequests = Array.from({ length: 61 }, () =>
      request(app).get('/test').set('x-user-id', 'user-a-id')
    );
    const userAResponses = await Promise.all(userARequests);
    const userABlocked = userAResponses.some((r) => r.status === 429);
    expect(userABlocked).toBe(true);

    // User B (same IP, different user ID) should NOT be blocked
    const userBResponse = await request(app)
      .get('/test')
      .set('x-user-id', 'user-b-id');

    expect(userBResponse.status).toBe(200);
  });
});
