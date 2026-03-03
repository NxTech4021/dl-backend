/**
 * Rate Limiter — Integration Tests
 *
 * Tests rate limiters in the context of actual route middleware chains,
 * real HTTP methods (POST), and realistic request payloads. No database
 * or external services are required — controllers and auth middleware
 * are stubbed to isolate the rate limiting behavior.
 *
 * Coverage:
 *   §1  Auth route chain: authLimiter → controller (POST /verify-reset-otp)
 *   §2  Availability route chain: availabilityCheckLimiter → controller (POST /check-email, /check-username)
 *   §3  Notification route chain: verifyAuth → pushTokenLimiter → controller (POST /push-token)
 *   §4  Onboarding route chain: onboardingLimiter → verifyAuth → handler
 *   §5  Middleware ordering: rate limiter fires BEFORE expensive auth/db work
 *   §6  Rate limiter with express.json() body parsing
 *   §7  Rate limiter with malformed / missing request bodies
 *   §8  Full app stack: generalLimiter + route-specific limiters stacked
 *   §9  429 response does NOT leak server internals
 *   §10 Rate limiter preserves downstream response format
 */
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

import {
  authLimiter,
  availabilityCheckLimiter,
  onboardingLimiter,
  questionnaireLimiter,
  pushTokenLimiter,
} from '../../../src/middlewares/rateLimiter';

import { generalLimiter } from '../../../src/middlewares/security';

// ─── Helpers ────────────────────────────────────────────────────────────────

let ipCounter = 1000;
function uniqueIp(): string {
  return `10.${Math.floor(ipCounter / 65536)}.${Math.floor((ipCounter % 65536) / 256)}.${ipCounter++ % 256}`;
}

/** Middleware to spoof IP via x-test-ip header. */
function ipSpoofMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.headers['x-test-ip']) {
    Object.defineProperty(req, 'ip', {
      value: req.headers['x-test-ip'] as string,
      writable: true,
      configurable: true,
    });
  }
  next();
}

/**
 * Stub auth middleware that reads x-user-id header and sets req.user.
 * Mimics the real verifyAuth middleware's x-user-id fallback path
 * without touching the database or better-auth.
 */
function stubVerifyAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    return res.status(401).json({ success: false, data: null, message: 'Unauthorized' });
  }
  (req as any).user = {
    id: userId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
  };
  next();
}

/** Track how many times a handler was invoked (to verify rate limiter blocks BEFORE handler). */
function createCountingHandler() {
  let count = 0;
  const handler = (_req: Request, res: Response) => {
    count++;
    res.json({ success: true, data: { handled: true }, message: 'OK' });
  };
  return { handler, getCount: () => count };
}

/** Fire N sequential POST requests. */
async function firePost(
  app: express.Application,
  path: string,
  n: number,
  opts: { ip: string; body?: object; headers?: Record<string, string> },
) {
  const { ip, body = {}, headers = {} } = opts;
  const results = [];
  for (let i = 0; i < n; i++) {
    let req = request(app).post(path).set('x-test-ip', ip).send(body);
    for (const [k, v] of Object.entries(headers)) {
      req = req.set(k, v);
    }
    results.push(await req);
  }
  return results;
}

// ─── §1 Auth route chain ────────────────────────────────────────────────────

describe('§1 Auth route: POST /auth-custom/verify-reset-otp with authLimiter', () => {
  function buildAuthApp(controllerStatus = 400) {
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    const { handler, getCount } = createCountingHandler();

    // Mirror the real route: authLimiter → controller
    // Controller returns 400 (bad OTP) to trigger skipSuccessfulRequests counting
    const controllerStub = (_req: Request, res: Response) => {
      handler(_req, res.status(controllerStatus) as any);
    };

    app.post('/auth-custom/verify-reset-otp', authLimiter, (req: Request, res: Response) => {
      getCount(); // track invocation
      res.status(controllerStatus).json({
        success: false,
        data: null,
        message: 'Invalid verification code',
      });
    });

    return { app, getCount };
  }

  it('blocks after 5 failed OTP attempts with real POST body', async () => {
    const ip = uniqueIp();
    const { app } = buildAuthApp(400);

    const responses = await firePost(app, '/auth-custom/verify-reset-otp', 6, {
      ip,
      body: { email: 'test@example.com', otp: '000000' },
    });

    for (let i = 0; i < 5; i++) {
      expect(responses[i].status).toBe(400);
    }
    expect(responses[5].status).toBe(429);
    expect(responses[5].body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  });

  it('successful OTP verifications (200) do NOT count toward the limit', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/auth-custom/verify-reset-otp', authLimiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true, data: { verified: true }, message: 'OTP verified' });
    });

    // 20 successful verifications — none should be blocked
    const responses = await firePost(app, '/auth-custom/verify-reset-otp', 20, {
      ip,
      body: { email: 'test@example.com', otp: '123456' },
    });

    const blocked = responses.filter((r) => r.status === 429).length;
    expect(blocked).toBe(0);
  });

  it('rate limiter blocks request BEFORE controller is invoked', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    let controllerCalls = 0;
    app.post('/auth-custom/verify-reset-otp', authLimiter, (_req: Request, res: Response) => {
      controllerCalls++;
      res.status(400).json({ success: false, data: null, message: 'Bad OTP' });
    });

    await firePost(app, '/auth-custom/verify-reset-otp', 8, {
      ip,
      body: { email: 'test@example.com', otp: '000000' },
    });

    // Only 5 should reach the controller; 3 blocked by rate limiter
    expect(controllerCalls).toBe(5);
  });
});

// ─── §2 Availability check route chain ──────────────────────────────────────

describe('§2 Availability routes: POST /check-email and /check-username', () => {
  function buildAvailabilityApp() {
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/auth-custom/check-email', availabilityCheckLimiter, (_req: Request, res: Response) => {
      res.json({ success: true, data: { available: true }, message: 'Email is available' });
    });

    app.post('/auth-custom/check-username', availabilityCheckLimiter, (_req: Request, res: Response) => {
      res.json({ success: true, data: { available: true }, message: 'Username is available' });
    });

    return app;
  }

  it('/check-email allows 50 requests with real email bodies', async () => {
    const ip = uniqueIp();
    const app = buildAvailabilityApp();

    const responses = await firePost(app, '/auth-custom/check-email', 51, {
      ip,
      body: { email: 'user@example.com' },
    });

    for (let i = 0; i < 50; i++) {
      expect(responses[i].status).toBe(200);
    }
    expect(responses[50].status).toBe(429);
  });

  it('/check-email and /check-username SHARE the same counter (same limiter instance)', async () => {
    const ip = uniqueIp();
    const app = buildAvailabilityApp();

    // 30 email checks
    await firePost(app, '/auth-custom/check-email', 30, {
      ip,
      body: { email: 'user@example.com' },
    });

    // 20 username checks (total = 50, should be at limit)
    await firePost(app, '/auth-custom/check-username', 20, {
      ip,
      body: { username: 'testuser' },
    });

    // 51st request (either route) should be blocked
    const blocked = await request(app)
      .post('/auth-custom/check-email')
      .set('x-test-ip', ip)
      .send({ email: 'another@example.com' });

    expect(blocked.status).toBe(429);
  });

  it('different IPs get independent counters on availability checks', async () => {
    const ip1 = uniqueIp();
    const ip2 = uniqueIp();
    const app = buildAvailabilityApp();

    // Exhaust ip1
    await firePost(app, '/auth-custom/check-email', 51, {
      ip: ip1,
      body: { email: 'user@example.com' },
    });

    // ip2 should be unaffected
    const res = await request(app)
      .post('/auth-custom/check-email')
      .set('x-test-ip', ip2)
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
  });
});

// ─── §3 Push token route chain ──────────────────────────────────────────────

describe('§3 Notification route: POST /push-token with auth + pushTokenLimiter', () => {
  function buildPushTokenApp() {
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    // Mirror real route: verifyAuth → pushTokenLimiter → handler
    app.post('/api/notifications/push-token', stubVerifyAuth, pushTokenLimiter, (_req: Request, res: Response) => {
      res.json({ success: true, data: { registered: true }, message: 'Push token registered' });
    });

    return app;
  }

  it('unauthenticated requests get 401, not 429', async () => {
    const ip = uniqueIp();
    const app = buildPushTokenApp();

    const res = await request(app)
      .post('/api/notifications/push-token')
      .set('x-test-ip', ip)
      .send({ token: 'ExponentPushToken[xxx]' });

    expect(res.status).toBe(401);
  });

  it('authenticated user gets rate limited after 10 requests', async () => {
    const ip = uniqueIp();
    const app = buildPushTokenApp();

    const responses = await firePost(app, '/api/notifications/push-token', 11, {
      ip,
      body: { token: 'ExponentPushToken[xxx]' },
      headers: { 'x-user-id': 'push-test-user' },
    });

    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.code).toBe('PUSH_TOKEN_RATE_LIMIT_EXCEEDED');
  });

  it('two authenticated users on same IP get independent push token limits', async () => {
    const ip = uniqueIp();
    const app = buildPushTokenApp();

    // User A exhausts their limit
    await firePost(app, '/api/notifications/push-token', 11, {
      ip,
      body: { token: 'ExponentPushToken[aaa]' },
      headers: { 'x-user-id': 'push-user-a' },
    });

    // User B should still be able to register
    const res = await request(app)
      .post('/api/notifications/push-token')
      .set('x-test-ip', ip)
      .set('x-user-id', 'push-user-b')
      .send({ token: 'ExponentPushToken[bbb]' });

    expect(res.status).toBe(200);
  });

  it('auth middleware runs BEFORE rate limiter (401 does not consume rate limit)', async () => {
    const ip = uniqueIp();
    const app = buildPushTokenApp();

    // Fire 20 unauthenticated requests — all should be 401
    const unauthResponses = await firePost(app, '/api/notifications/push-token', 20, {
      ip,
      body: { token: 'ExponentPushToken[xxx]' },
    });

    for (const r of unauthResponses) {
      expect(r.status).toBe(401);
    }

    // Now authenticate — should still have full quota
    const authRes = await request(app)
      .post('/api/notifications/push-token')
      .set('x-test-ip', ip)
      .set('x-user-id', 'fresh-auth-user')
      .send({ token: 'ExponentPushToken[yyy]' });

    expect(authRes.status).toBe(200);
  });
});

// ─── §4 Onboarding route chain ──────────────────────────────────────────────

describe('§4 Onboarding route chain: onboardingLimiter → verifyAuth → handler', () => {
  function buildOnboardingApp() {
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    let handlerCalls = 0;

    // Mirror real route: onboardingLimiter → verifyAuth → handler
    app.put('/api/onboarding/step/:userId', onboardingLimiter, stubVerifyAuth, (req: Request, res: Response) => {
      handlerCalls++;
      res.json({ success: true, data: { step: 2 }, message: 'Step updated' });
    });

    app.post('/api/onboarding/:sport/submit', questionnaireLimiter, stubVerifyAuth, (req: Request, res: Response) => {
      res.json({ success: true, data: { submitted: true }, message: 'Submitted' });
    });

    return { app, getHandlerCalls: () => handlerCalls };
  }

  it('onboarding step update blocks after 60 requests per user', async () => {
    const ip = uniqueIp();
    const { app } = buildOnboardingApp();

    const responses = [];
    for (let i = 0; i < 61; i++) {
      const res = await request(app)
        .put('/api/onboarding/step/user-123')
        .set('x-test-ip', ip)
        .set('x-user-id', 'onboard-user-1')
        .send({ step: 2 });
      responses.push(res);
    }

    for (let i = 0; i < 60; i++) {
      expect(responses[i].status).toBe(200);
    }
    expect(responses[60].status).toBe(429);
    expect(responses[60].body.code).toBe('ONBOARDING_RATE_LIMIT_EXCEEDED');
  });

  it('questionnaire submit blocks after 10 requests per user', async () => {
    const ip = uniqueIp();
    const { app } = buildOnboardingApp();

    const responses = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/onboarding/tennis/submit')
        .set('x-test-ip', ip)
        .set('x-user-id', 'submit-user-1')
        .send({ answers: [1, 2, 3] });
      responses.push(res);
    }

    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.code).toBe('QUESTIONNAIRE_RATE_LIMIT_EXCEEDED');
  });

  it('onboarding and questionnaire limiters are independent for the same user', async () => {
    const ip = uniqueIp();
    const { app } = buildOnboardingApp();

    // Exhaust questionnaire limiter (10 submissions)
    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/api/onboarding/tennis/submit')
        .set('x-test-ip', ip)
        .set('x-user-id', 'combo-user')
        .send({ answers: [1, 2, 3] });
    }

    // Onboarding step should still work (different limiter)
    const stepRes = await request(app)
      .put('/api/onboarding/step/combo-user')
      .set('x-test-ip', ip)
      .set('x-user-id', 'combo-user')
      .send({ step: 3 });

    expect(stepRes.status).toBe(200);
  });
});

// ─── §5 Middleware ordering: rate limiter blocks before expensive operations ─

describe('§5 Middleware ordering — rate limiter blocks BEFORE expensive operations', () => {
  it('authLimiter blocks before any controller logic runs', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    let controllerInvocations = 0;
    app.post('/verify-otp', authLimiter, (_req: Request, res: Response) => {
      controllerInvocations++;
      res.status(400).json({ success: false });
    });

    // Fire 10 requests — only first 5 should reach controller
    await firePost(app, '/verify-otp', 10, { ip, body: { email: 'x@y.com', otp: '000000' } });

    expect(controllerInvocations).toBe(5);
  });

  it('onboardingLimiter blocks before auth middleware runs (saving DB lookups)', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    let authMiddlewareCalls = 0;
    const trackingAuth = (req: Request, res: Response, next: NextFunction) => {
      authMiddlewareCalls++;
      // Simulate auth setting user
      (req as any).user = { id: req.headers['x-user-id'] || 'anon' };
      next();
    };

    app.put('/onboarding/step/:userId', onboardingLimiter, trackingAuth, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    // Fire 65 requests — only 60 should pass through to auth middleware
    for (let i = 0; i < 65; i++) {
      await request(app)
        .put('/onboarding/step/user-1')
        .set('x-test-ip', ip)
        .set('x-user-id', 'order-test-user')
        .send({ step: 1 });
    }

    expect(authMiddlewareCalls).toBe(60);
  });
});

// ─── §6 Rate limiter with express.json() body parsing ───────────────────────

describe('§6 Rate limiter works correctly with JSON body parsing', () => {
  it('rate limiter counts requests regardless of body content', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/test', authLimiter, (_req: Request, res: Response) => {
      res.status(400).json({ ok: false });
    });

    const bodies = [
      { email: 'a@b.com', otp: '111111' },
      { email: 'c@d.com', otp: '222222' },
      { email: 'e@f.com', otp: '333333' },
      { email: 'g@h.com', otp: '444444' },
      { email: 'i@j.com', otp: '555555' },
      { email: 'k@l.com', otp: '666666' }, // This should be blocked
    ];

    const responses = [];
    for (const body of bodies) {
      const res = await request(app)
        .post('/test')
        .set('x-test-ip', ip)
        .send(body);
      responses.push(res);
    }

    for (let i = 0; i < 5; i++) {
      expect(responses[i].status).toBe(400);
    }
    expect(responses[5].status).toBe(429);
  });

  it('large JSON payloads still get rate limited correctly', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json({ limit: '1mb' }));

    app.post('/test', pushTokenLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const largeBody = { data: 'x'.repeat(10000), token: 'ExponentPushToken[xxx]' };

    const responses = await firePost(app, '/test', 11, { ip, body: largeBody });

    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }
    expect(responses[10].status).toBe(429);
  });
});

// ─── §7 Rate limiter with malformed / missing request bodies ────────────────

describe('§7 Rate limiter with malformed/missing request bodies', () => {
  it('empty body still counts toward the limit', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/test', authLimiter, (_req: Request, res: Response) => {
      res.status(400).json({ success: false, message: 'Missing fields' });
    });

    // 6 requests with empty body
    const responses = await firePost(app, '/test', 6, { ip, body: {} });

    for (let i = 0; i < 5; i++) {
      expect(responses[i].status).toBe(400);
    }
    expect(responses[5].status).toBe(429);
  });

  it('requests with no Content-Type still get rate limited', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);

    app.post('/test', questionnaireLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const responses = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/test')
        .set('x-test-ip', ip);
      responses.push(res);
    }

    expect(responses[10].status).toBe(429);
  });
});

// ─── §8 Stacked limiters: general + route-specific ──────────────────────────

describe('§8 Stacked limiters — general limiter + route-specific limiter', () => {
  it('route-specific limiter (stricter) kicks in before general limiter', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    // Apply general limiter globally (300/min in test), then authLimiter (5/15min) on route
    app.use(generalLimiter);
    app.post('/verify-otp', authLimiter, (_req: Request, res: Response) => {
      res.status(400).json({ success: false });
    });

    const responses = await firePost(app, '/verify-otp', 6, {
      ip,
      body: { email: 'x@y.com', otp: '000000' },
    });

    // authLimiter (5 max) should trigger before generalLimiter (300 max)
    expect(responses[5].status).toBe(429);
    expect(responses[5].body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  });

  it('general limiter applies to routes without route-specific limiter', async () => {
    const ip = uniqueIp();
    const expectedMax = process.env.NODE_ENV === 'production' ? 100 : 300;

    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(generalLimiter);

    app.get('/unprotected', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const results = [];
    for (let i = 0; i < expectedMax + 1; i++) {
      const res = await request(app).get('/unprotected').set('x-test-ip', ip);
      results.push(res);
    }

    expect(results[expectedMax].status).toBe(429);
  });
});

// ─── §9 429 response does NOT leak server internals ─────────────────────────

describe('§9 429 response does NOT leak server internals', () => {
  it('429 body does not contain stack traces, file paths, or error objects', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);

    app.get('/test', authLimiter, (_req: Request, res: Response) => {
      res.status(401).json({ ok: false });
    });

    const responses = [];
    for (let i = 0; i < 6; i++) {
      responses.push(await request(app).get('/test').set('x-test-ip', ip));
    }

    const blocked = responses[5];
    expect(blocked.status).toBe(429);

    const bodyStr = JSON.stringify(blocked.body);

    // Should NOT contain any of these
    expect(bodyStr).not.toMatch(/node_modules/);
    expect(bodyStr).not.toMatch(/at\s+\w+\s+\(/); // stack trace pattern
    expect(bodyStr).not.toMatch(/\.ts:/);
    expect(bodyStr).not.toMatch(/\.js:/);
    expect(bodyStr).not.toMatch(/Error:/i);
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/secret/i);
    expect(bodyStr).not.toMatch(/token/i);

    // Should only have expected keys
    const keys = Object.keys(blocked.body).sort();
    expect(keys).toEqual(['code', 'message', 'retryAfter', 'success']);
  });
});

// ─── §10 Rate limiter preserves downstream response format ──────────────────

describe('§10 Rate limiter preserves downstream response format when NOT blocked', () => {
  it('non-blocked requests pass through with correct controller response', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/check-email', availabilityCheckLimiter, (_req: Request, res: Response) => {
      res.json({
        success: true,
        data: { available: true },
        message: 'Email is available',
      });
    });

    const res = await request(app)
      .post('/check-email')
      .set('x-test-ip', ip)
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { available: true },
      message: 'Email is available',
    });
  });

  it('controller error responses pass through correctly (not confused with 429)', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/check-email', availabilityCheckLimiter, (_req: Request, res: Response) => {
      res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid email format',
      });
    });

    const res = await request(app)
      .post('/check-email')
      .set('x-test-ip', ip)
      .send({ email: 'not-an-email' });

    // Should be 400 from controller, not 429
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email format');
  });

  it('rate limiter 429 format is distinct from controller error format', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);
    app.use(ipSpoofMiddleware);
    app.use(express.json());

    app.post('/check-email', availabilityCheckLimiter, (_req: Request, res: Response) => {
      // Controller uses sendError format: { success, data, message }
      res.status(400).json({ success: false, data: null, message: 'Bad request' });
    });

    // First 50 requests
    for (let i = 0; i < 50; i++) {
      await request(app)
        .post('/check-email')
        .set('x-test-ip', ip)
        .send({ email: 'x@y.com' });
    }

    // 51st is rate limited
    const blocked = await request(app)
      .post('/check-email')
      .set('x-test-ip', ip)
      .send({ email: 'x@y.com' });

    expect(blocked.status).toBe(429);

    // Rate limiter format: { success, code, message, retryAfter }
    // Controller format:   { success, data, message }
    // They are intentionally different (rate limiter has 'code' + 'retryAfter', controller has 'data')
    expect(blocked.body).toHaveProperty('code');
    expect(blocked.body).toHaveProperty('retryAfter');
    expect(blocked.body).not.toHaveProperty('data');
  });
});
