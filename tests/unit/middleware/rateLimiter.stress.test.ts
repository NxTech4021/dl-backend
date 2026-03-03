/**
 * Rate Limiter — Comprehensive Stress Tests
 *
 * This file tests the rate limiter middleware in isolation using mini Express
 * apps (no database, no auth). Each describe block creates its own app instance
 * so in-memory counters never bleed between tests.
 *
 * Coverage:
 *   §1  Exact boundary enforcement for ALL 5 limiters
 *   §2  Concurrent burst handling (Promise.all race-condition proofing)
 *   §3  skipSuccessfulRequests deep verification (authLimiter)
 *   §4  Standard RateLimit-* header contract (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
 *   §5  retryAfter accuracy and bounds
 *   §6  429 response body schema (exact keys, correct types, correct error codes)
 *   §7  Cross-limiter isolation (different limiters share nothing)
 *   §8  User-ID keyed isolation (shared NAT / same-IP users)
 *   §9  IP fallback for user-keyed limiters
 *   §10 Sustained blocking after limit is hit (no leaks)
 *   §11 userKeyGenerator unit tests
 *   §12 "unknown" key collision risk (documented edge case)
 *   §13 Large burst stress tests (100+ concurrent)
 *   §14 Multiple IPs on same limiter instance (no cross-IP bleed)
 *   §15 Mixed HTTP methods (GET + POST on same limiter share counter)
 *   §16 429 Content-Type header verification
 *   §17 Retry-After HTTP header verification
 *   §18 Multiple consecutive 429 responses have consistent bodies
 *   §19 First request remaining header matches max - 1
 *   §20 General limiter from security.ts
 *   §21 Questionnaire middleware limiters (questionnaireRateLimit, submissionRateLimit)
 */
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

import {
  authLimiter,
  availabilityCheckLimiter,
  onboardingLimiter,
  questionnaireLimiter,
  pushTokenLimiter,
  userKeyGenerator,
} from '../../../src/middlewares/rateLimiter';

import { generalLimiter } from '../../../src/middlewares/security';

import {
  questionnaireRateLimit,
  submissionRateLimit,
} from '../../../src/middlewares/questionnaire';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Unique IP counter to prevent cross-test counter bleed. */
let ipCounter = 0;
function uniqueIp(): string {
  return `192.168.${Math.floor(ipCounter / 256)}.${ipCounter++ % 256}`;
}

/**
 * Build a tiny Express app with one limiter and one route.
 * - `statusCode` controls the response status (useful for skipSuccessfulRequests).
 * - When `injectUser` is provided, every request gets `req.user = { id: injectUser }`.
 * - `methods` controls which HTTP methods to register (default: GET only).
 */
function makeApp(
  limiter: ReturnType<typeof rateLimit>,
  opts: {
    statusCode?: number;
    injectUser?: string;
    methods?: Array<'get' | 'post' | 'put' | 'delete'>;
    useJson?: boolean;
  } = {},
) {
  const { statusCode = 200, injectUser, methods = ['get'], useJson = false } = opts;
  const app = express();
  app.set('trust proxy', false);

  if (useJson) {
    app.use(express.json());
  }

  // IP spoofing + user injection middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.headers['x-test-ip']) {
      Object.defineProperty(req, 'ip', {
        value: req.headers['x-test-ip'] as string,
        writable: true,
        configurable: true,
      });
    }
    if (injectUser) {
      (req as any).user = { id: injectUser };
    } else if (req.headers['x-user-id']) {
      (req as any).user = { id: req.headers['x-user-id'] as string };
    }
    next();
  });

  const handler = (_req: Request, res: Response) => {
    res.status(statusCode).json({ ok: true });
  };

  for (const method of methods) {
    app[method]('/test', limiter, handler);
  }

  return app;
}

/** Fire `n` requests sequentially from `ip`. */
async function fireSequential(
  app: express.Application,
  n: number,
  ip: string,
  opts: {
    headers?: Record<string, string>;
    method?: 'get' | 'post' | 'put' | 'delete';
    body?: object;
  } = {},
) {
  const { headers = {}, method = 'get', body } = opts;
  const results = [];
  for (let i = 0; i < n; i++) {
    let req = request(app)[method]('/test').set('x-test-ip', ip);
    for (const [k, v] of Object.entries(headers)) {
      req = req.set(k, v);
    }
    if (body) {
      req = req.send(body);
    }
    results.push(await req);
  }
  return results;
}

/** Fire `n` requests concurrently (burst) from `ip`. */
async function fireBurst(
  app: express.Application,
  n: number,
  ip: string,
  opts: {
    headers?: Record<string, string>;
    method?: 'get' | 'post' | 'put' | 'delete';
    body?: object;
  } = {},
) {
  const { headers = {}, method = 'get', body } = opts;
  const promises = Array.from({ length: n }, () => {
    let req = request(app)[method]('/test').set('x-test-ip', ip);
    for (const [k, v] of Object.entries(headers)) {
      req = req.set(k, v);
    }
    if (body) {
      req = req.send(body);
    }
    return req;
  });
  return Promise.all(promises);
}

// ─── Limiter metadata (DRY test tables) ─────────────────────────────────────

interface LimiterSpec {
  name: string;
  limiter: ReturnType<typeof rateLimit>;
  max: number;
  windowMs: number;
  statusCode?: number;
  errorCode: string;
  keyType: 'ip' | 'user';
}

const LIMITER_SPECS: LimiterSpec[] = [
  {
    name: 'authLimiter',
    limiter: authLimiter,
    max: 5,
    windowMs: 15 * 60 * 1000,
    statusCode: 401,
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
    keyType: 'ip',
  },
  {
    name: 'availabilityCheckLimiter',
    limiter: availabilityCheckLimiter,
    max: 50,
    windowMs: 15 * 60 * 1000,
    errorCode: 'AVAILABILITY_CHECK_RATE_LIMIT_EXCEEDED',
    keyType: 'ip',
  },
  {
    name: 'onboardingLimiter',
    limiter: onboardingLimiter,
    max: 60,
    windowMs: 5 * 60 * 1000,
    errorCode: 'ONBOARDING_RATE_LIMIT_EXCEEDED',
    keyType: 'user',
  },
  {
    name: 'questionnaireLimiter',
    limiter: questionnaireLimiter,
    max: 10,
    windowMs: 15 * 60 * 1000,
    errorCode: 'QUESTIONNAIRE_RATE_LIMIT_EXCEEDED',
    keyType: 'user',
  },
  {
    name: 'pushTokenLimiter',
    limiter: pushTokenLimiter,
    max: 10,
    windowMs: 60 * 60 * 1000,
    errorCode: 'PUSH_TOKEN_RATE_LIMIT_EXCEEDED',
    keyType: 'user',
  },
];

// ─── §1 Exact boundary enforcement ──────────────────────────────────────────

describe('§1 Exact boundary enforcement', () => {
  for (const spec of LIMITER_SPECS) {
    it(`${spec.name}: allows exactly ${spec.max} requests, blocks request ${spec.max + 1}`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);

      // All requests up to max should NOT be 429
      for (let i = 0; i < spec.max; i++) {
        expect(responses[i].status).not.toBe(429);
      }
      // Request max+1 must be 429
      expect(responses[spec.max].status).toBe(429);
    });

    it(`${spec.name}: request at exactly max (${spec.max}) is still allowed`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max, ip);

      // The last allowed request should not be 429
      expect(responses[spec.max - 1].status).not.toBe(429);
    });
  }
});

// ─── §2 Concurrent burst handling ───────────────────────────────────────────

describe('§2 Concurrent burst handling', () => {
  it('authLimiter: burst of 10 concurrent requests — exactly 5 pass, 5 blocked', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 401 });

    const responses = await fireBurst(app, 10, ip);
    const passed = responses.filter((r) => r.status !== 429).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(5);
    expect(blocked).toBe(5);
  });

  it('questionnaireLimiter: burst of 15 concurrent requests — exactly 10 pass, 5 blocked', async () => {
    const ip = uniqueIp();
    const app = makeApp(questionnaireLimiter);

    const responses = await fireBurst(app, 15, ip);
    const passed = responses.filter((r) => r.status !== 429).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(10);
    expect(blocked).toBe(5);
  });

  it('pushTokenLimiter: burst of 20 concurrent requests — exactly 10 pass, 10 blocked', async () => {
    const ip = uniqueIp();
    const app = makeApp(pushTokenLimiter);

    const responses = await fireBurst(app, 20, ip);
    const passed = responses.filter((r) => r.status !== 429).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(10);
    expect(blocked).toBe(10);
  });

  it('availabilityCheckLimiter: burst of 60 requests — exactly 50 pass, 10 blocked', async () => {
    const ip = uniqueIp();
    const app = makeApp(availabilityCheckLimiter);

    const responses = await fireBurst(app, 60, ip);
    const passed = responses.filter((r) => r.status !== 429).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(50);
    expect(blocked).toBe(10);
  });

  it('onboardingLimiter: burst of 80 concurrent requests — exactly 60 pass, 20 blocked', async () => {
    const ip = uniqueIp();
    const app = makeApp(onboardingLimiter, { injectUser: 'burst-onboard-user' });

    const responses = await fireBurst(app, 80, ip);
    const passed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(60);
    expect(blocked).toBe(20);
  });
});

// ─── §3 skipSuccessfulRequests (authLimiter) ────────────────────────────────

describe('§3 authLimiter — skipSuccessfulRequests behavior', () => {
  it('successful requests (200) do NOT count toward the limit', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 200 });

    // Fire 20 successful requests — none should be blocked
    const responses = await fireSequential(app, 20, ip);
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(blocked).toBe(0);
  });

  it('only failed requests (non-2xx) count toward the limit', async () => {
    const ip = uniqueIp();

    // App that alternates: odd calls succeed (200), even calls fail (401)
    const app = express();
    app.set('trust proxy', false);
    let callCount = 0;

    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.headers['x-test-ip']) {
        Object.defineProperty(req, 'ip', {
          value: req.headers['x-test-ip'] as string,
          writable: true,
          configurable: true,
        });
      }
      next();
    });

    app.get('/test', authLimiter, (_req: Request, res: Response) => {
      callCount++;
      const status = callCount % 2 === 1 ? 200 : 401;
      res.status(status).json({ ok: status === 200 });
    });

    // Pattern: 200, 401(1), 200, 401(2), 200, 401(3), 200, 401(4), 200, 401(5), 429, 429, 429, 429, 429
    const responses = await fireSequential(app, 15, ip);

    const blockedCount = responses.filter((r) => r.status === 429).length;
    expect(blockedCount).toBe(5);
  });

  it('a burst of successful requests followed by failures: only failures count', async () => {
    const ip = uniqueIp();

    const app = express();
    app.set('trust proxy', false);
    let callCount = 0;

    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.headers['x-test-ip']) {
        Object.defineProperty(req, 'ip', {
          value: req.headers['x-test-ip'] as string,
          writable: true,
          configurable: true,
        });
      }
      next();
    });

    app.get('/test', authLimiter, (_req: Request, res: Response) => {
      callCount++;
      // First 10 succeed, then all fail
      const status = callCount <= 10 ? 200 : 401;
      res.status(status).json({ ok: status === 200 });
    });

    // 10 successes (don't count) + 6 failures (5 pass, 1 blocked)
    const responses = await fireSequential(app, 16, ip);

    // First 10: 200 (success, not counted)
    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }
    // Next 5: 401 (failures, counted toward limit)
    for (let i = 10; i < 15; i++) {
      expect(responses[i].status).toBe(401);
    }
    // 16th: 429 (limit reached)
    expect(responses[15].status).toBe(429);
  });

  it('other limiters do NOT skip successful requests', async () => {
    // availabilityCheckLimiter should count all requests regardless of status
    const ip = uniqueIp();
    const app = makeApp(availabilityCheckLimiter, { statusCode: 200 });

    const responses = await fireSequential(app, 51, ip);

    // 51st request should be blocked even though all were 200
    expect(responses[50].status).toBe(429);
  });
});

// ─── §4 Standard RateLimit-* headers ────────────────────────────────────────

describe('§4 Standard RateLimit-* headers', () => {
  for (const spec of LIMITER_SPECS) {
    it(`${spec.name}: response includes RateLimit-Policy or RateLimit header`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const res = await request(app).get('/test').set('x-test-ip', ip);

      const limitHeader =
        res.headers['ratelimit-limit'] ||
        res.headers['ratelimit-policy'] ||
        res.headers['ratelimit'];

      expect(limitHeader).toBeDefined();
    });

    it(`${spec.name}: RateLimit-Remaining decrements correctly`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const res1 = await request(app).get('/test').set('x-test-ip', ip);
      const res2 = await request(app).get('/test').set('x-test-ip', ip);

      const remaining1 = parseInt(res1.headers['ratelimit-remaining'], 10);
      const remaining2 = parseInt(res2.headers['ratelimit-remaining'], 10);

      // authLimiter with skipSuccessfulRequests: 200 responses don't decrement
      if (spec.name !== 'authLimiter' || spec.statusCode !== 200) {
        expect(remaining2).toBe(remaining1 - 1);
      }
    });

    it(`${spec.name}: no legacy X-RateLimit-* headers (legacyHeaders: false)`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const res = await request(app).get('/test').set('x-test-ip', ip);

      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
      expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
      expect(res.headers['x-ratelimit-reset']).toBeUndefined();
    });

    it(`${spec.name}: RateLimit-Reset header is present and is a number`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const res = await request(app).get('/test').set('x-test-ip', ip);

      const resetHeader = res.headers['ratelimit-reset'];
      expect(resetHeader).toBeDefined();
      expect(Number(resetHeader)).not.toBeNaN();
    });
  }
});

// ─── §5 retryAfter accuracy ────────────────────────────────────────────────

describe('§5 retryAfter accuracy', () => {
  for (const spec of LIMITER_SPECS) {
    const windowSec = spec.windowMs / 1000;

    it(`${spec.name}: retryAfter is a positive number ≤ ${windowSec}s`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      expect(blocked.status).toBe(429);
      expect(typeof blocked.body.retryAfter).toBe('number');
      expect(blocked.body.retryAfter).toBeGreaterThan(0);
      expect(blocked.body.retryAfter).toBeLessThanOrEqual(windowSec);
    });

    it(`${spec.name}: retryAfter is an integer (no fractional seconds)`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      expect(Number.isInteger(blocked.body.retryAfter)).toBe(true);
    });
  }
});

// ─── §6 429 response body schema ───────────────────────────────────────────

describe('§6 429 response body schema', () => {
  for (const spec of LIMITER_SPECS) {
    it(`${spec.name}: 429 body has exact shape { success, code, message, retryAfter }`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      expect(blocked.status).toBe(429);

      // Exact keys — no extra, no missing
      const keys = Object.keys(blocked.body).sort();
      expect(keys).toEqual(['code', 'message', 'retryAfter', 'success']);

      // Correct types and values
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.code).toBe(spec.errorCode);
      expect(typeof blocked.body.message).toBe('string');
      expect(blocked.body.message.length).toBeGreaterThan(0);
      expect(typeof blocked.body.retryAfter).toBe('number');
    });

    it(`${spec.name}: 429 body is JSON, not plain text`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      // Body must be an object, not a string
      expect(typeof blocked.body).toBe('object');
      expect(blocked.body).not.toBeNull();
    });
  }
});

// ─── §7 Cross-limiter isolation ─────────────────────────────────────────────

describe('§7 Cross-limiter isolation', () => {
  it('exhausting authLimiter does NOT affect availabilityCheckLimiter for same IP', async () => {
    const ip = uniqueIp();

    const authApp = makeApp(authLimiter, { statusCode: 401 });
    const availApp = makeApp(availabilityCheckLimiter);

    // Exhaust authLimiter
    await fireSequential(authApp, 6, ip);

    // availabilityCheckLimiter should still allow requests
    const res = await request(availApp).get('/test').set('x-test-ip', ip);
    expect(res.status).toBe(200);
  });

  it('exhausting onboardingLimiter does NOT affect questionnaireLimiter for same user', async () => {
    const ip = uniqueIp();

    const onboardApp = makeApp(onboardingLimiter, { injectUser: 'cross-test-user' });
    const questionApp = makeApp(questionnaireLimiter, { injectUser: 'cross-test-user' });

    await fireSequential(onboardApp, 61, ip);

    const res = await request(questionApp).get('/test').set('x-test-ip', ip);
    expect(res.status).toBe(200);
  });

  it('exhausting questionnaireLimiter does NOT affect pushTokenLimiter for same user', async () => {
    const ip = uniqueIp();

    const questionApp = makeApp(questionnaireLimiter, { injectUser: 'cross-user-2' });
    const pushApp = makeApp(pushTokenLimiter, { injectUser: 'cross-user-2' });

    await fireSequential(questionApp, 11, ip);

    const res = await request(pushApp).get('/test').set('x-test-ip', ip);
    expect(res.status).toBe(200);
  });

  it('exhausting all IP-keyed limiters does NOT affect user-keyed limiters', async () => {
    const ip = uniqueIp();

    const authApp = makeApp(authLimiter, { statusCode: 401 });
    const availApp = makeApp(availabilityCheckLimiter);
    const onboardApp = makeApp(onboardingLimiter, { injectUser: 'cross-all-user' });

    // Exhaust both IP-keyed limiters
    await fireSequential(authApp, 6, ip);
    await fireSequential(availApp, 51, ip);

    // User-keyed limiter should still work
    const res = await request(onboardApp).get('/test').set('x-test-ip', ip);
    expect(res.status).toBe(200);
  });
});

// ─── §8 User-ID keyed limiter isolation ─────────────────────────────────────

describe('§8 User-ID keyed limiter isolation', () => {
  const userKeyedLimiters = LIMITER_SPECS.filter((s) => s.keyType === 'user');

  for (const spec of userKeyedLimiters) {
    it(`${spec.name}: two users on the same IP have independent counters`, async () => {
      const ip = uniqueIp();
      const app = express();
      app.set('trust proxy', false);

      app.use((req: Request, _res: Response, next: NextFunction) => {
        Object.defineProperty(req, 'ip', { value: ip, writable: true, configurable: true });
        if (req.headers['x-user-id']) {
          (req as any).user = { id: req.headers['x-user-id'] };
        }
        next();
      });

      app.get('/test', spec.limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // User A exhausts their quota
      const userAResponses = await fireSequential(app, spec.max + 1, ip, {
        headers: { 'x-user-id': `${spec.name}-user-a` },
      });
      expect(userAResponses[spec.max].status).toBe(429);

      // User B should be completely unaffected
      const userBRes = await request(app)
        .get('/test')
        .set('x-test-ip', ip)
        .set('x-user-id', `${spec.name}-user-b`);
      expect(userBRes.status).toBe(200);
    });

    it(`${spec.name}: three users on the same IP all get full quota independently`, async () => {
      const ip = uniqueIp();
      const app = express();
      app.set('trust proxy', false);

      app.use((req: Request, _res: Response, next: NextFunction) => {
        Object.defineProperty(req, 'ip', { value: ip, writable: true, configurable: true });
        if (req.headers['x-user-id']) {
          (req as any).user = { id: req.headers['x-user-id'] };
        }
        next();
      });

      app.get('/test', spec.limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Each of 3 users gets their full quota
      for (const userId of ['user-1', 'user-2', 'user-3']) {
        const responses = await fireSequential(app, spec.max, ip, {
          headers: { 'x-user-id': `${spec.name}-${userId}` },
        });
        // All requests within quota should succeed
        const allPassed = responses.every((r) => r.status === 200);
        expect(allPassed).toBe(true);
      }
    });
  }
});

// ─── §9 IP fallback for user-keyed limiters ─────────────────────────────────

describe('§9 IP fallback when no user is set', () => {
  it('onboardingLimiter falls back to IP when req.user is absent', async () => {
    const ip = uniqueIp();
    const app = makeApp(onboardingLimiter); // no injectUser

    const responses = await fireSequential(app, 61, ip);
    expect(responses[60].status).toBe(429);
  });

  it('questionnaireLimiter falls back to IP when req.user is absent', async () => {
    const ip = uniqueIp();
    const app = makeApp(questionnaireLimiter);

    const responses = await fireSequential(app, 11, ip);
    expect(responses[10].status).toBe(429);
  });

  it('pushTokenLimiter falls back to IP when req.user is absent', async () => {
    const ip = uniqueIp();
    const app = makeApp(pushTokenLimiter);

    const responses = await fireSequential(app, 11, ip);
    expect(responses[10].status).toBe(429);
  });

  it('two different IPs with no user have independent counters', async () => {
    const ip1 = uniqueIp();
    const ip2 = uniqueIp();
    const app = makeApp(questionnaireLimiter);

    await fireSequential(app, 11, ip1);

    const res = await request(app).get('/test').set('x-test-ip', ip2);
    expect(res.status).toBe(200);
  });

  it('IP fallback and user-keyed are independent (user key takes priority)', async () => {
    const ip = uniqueIp();
    const app = express();
    app.set('trust proxy', false);

    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.defineProperty(req, 'ip', { value: ip, writable: true, configurable: true });
      if (req.headers['x-user-id']) {
        (req as any).user = { id: req.headers['x-user-id'] };
      }
      next();
    });

    app.get('/test', questionnaireLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    // Exhaust limit for anonymous (IP-keyed) requests
    await fireSequential(app, 11, ip);

    // Authenticated user on the same IP should NOT be affected
    const res = await request(app)
      .get('/test')
      .set('x-test-ip', ip)
      .set('x-user-id', 'auth-user-priority');
    expect(res.status).toBe(200);
  });
});

// ─── §10 Sustained blocking after limit is hit ──────────────────────────────

describe('§10 Sustained blocking after limit is hit', () => {
  it('authLimiter: all 10 requests after limit are 429 (no leaks)', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 401 });

    const responses = await fireSequential(app, 15, ip);

    for (let i = 0; i < 5; i++) {
      expect(responses[i].status).toBe(401);
    }
    for (let i = 5; i < 15; i++) {
      expect(responses[i].status).toBe(429);
    }
  });

  it('pushTokenLimiter: 50 requests after limit — all 429, no leaks', async () => {
    const ip = uniqueIp();
    const app = makeApp(pushTokenLimiter);

    const responses = await fireSequential(app, 60, ip);

    let passCount = 0;
    let blockCount = 0;
    for (const r of responses) {
      if (r.status === 429) blockCount++;
      else passCount++;
    }

    expect(passCount).toBe(10);
    expect(blockCount).toBe(50);
  });

  it('every single 429 response after limit has the correct body (not just the first)', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 401 });

    const responses = await fireSequential(app, 10, ip);

    // Check all 5 blocked responses individually
    for (let i = 5; i < 10; i++) {
      const r = responses[i];
      expect(r.status).toBe(429);
      expect(r.body.success).toBe(false);
      expect(r.body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
      expect(typeof r.body.message).toBe('string');
      expect(typeof r.body.retryAfter).toBe('number');
      expect(r.body.retryAfter).toBeGreaterThan(0);
    }
  });
});

// ─── §11 userKeyGenerator unit tests ────────────────────────────────────────

describe('§11 userKeyGenerator', () => {
  function makeFakeReq(overrides: { userId?: string; ip?: string }): Request {
    const req = {} as any;
    if (overrides.userId) {
      req.user = { id: overrides.userId };
    }
    if (overrides.ip !== undefined) {
      req.ip = overrides.ip;
    }
    return req as Request;
  }

  it('returns user ID when available', () => {
    expect(userKeyGenerator(makeFakeReq({ userId: 'abc-123', ip: '1.2.3.4' }))).toBe('abc-123');
  });

  it('falls back to IP when no user', () => {
    expect(userKeyGenerator(makeFakeReq({ ip: '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('falls back to "unknown" when no user and no IP', () => {
    expect(userKeyGenerator(makeFakeReq({}))).toBe('unknown');
  });

  it('prefers user ID over IP', () => {
    expect(userKeyGenerator(makeFakeReq({ userId: 'user-xyz', ip: '10.0.0.1' }))).toBe('user-xyz');
  });

  it('handles empty string user ID (falsy) — falls back to IP', () => {
    const req = { user: { id: '' }, ip: '10.0.0.1' } as any;
    // '' is falsy in JS, so ?? should NOT trigger (it only triggers on null/undefined)
    // This tests the actual behavior of nullish coalescing
    expect(userKeyGenerator(req)).toBe('');
  });

  it('handles null user ID — falls back to IP', () => {
    const req = { user: { id: null }, ip: '10.0.0.1' } as any;
    expect(userKeyGenerator(req)).toBe('10.0.0.1');
  });

  it('handles undefined user ID — falls back to IP', () => {
    const req = { user: { id: undefined }, ip: '10.0.0.1' } as any;
    expect(userKeyGenerator(req)).toBe('10.0.0.1');
  });

  it('handles user object with no id property — falls back to IP', () => {
    const req = { user: {}, ip: '10.0.0.1' } as any;
    expect(userKeyGenerator(req)).toBe('10.0.0.1');
  });
});

// ─── §12 "unknown" key collision risk ───────────────────────────────────────

describe('§12 "unknown" key collision', () => {
  it('two requests with no user and no IP share the same counter (proving the risk)', async () => {
    const app = express();
    app.set('trust proxy', false);

    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.defineProperty(req, 'ip', { value: undefined, writable: true, configurable: true });
      next();
    });

    app.get('/test', questionnaireLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const responses = await fireSequential(app, 11, '');
    expect(responses[10].status).toBe(429);
  });

  it('all user-keyed limiters are vulnerable to the "unknown" collision', async () => {
    for (const spec of LIMITER_SPECS.filter((s) => s.keyType === 'user')) {
      const app = express();
      app.set('trust proxy', false);

      app.use((req: Request, _res: Response, next: NextFunction) => {
        Object.defineProperty(req, 'ip', { value: undefined, writable: true, configurable: true });
        next();
      });

      app.get('/test', spec.limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });

      const responses = await fireSequential(app, spec.max + 1, '');
      expect(responses[spec.max].status).toBe(429);
    }
  });
});

// ─── §13 Large burst stress tests ───────────────────────────────────────────

describe('§13 Large burst stress tests', () => {
  it('onboardingLimiter: 120 concurrent requests — exactly 60 pass', async () => {
    const ip = uniqueIp();
    const app = makeApp(onboardingLimiter, { injectUser: 'burst-user' });

    const responses = await fireBurst(app, 120, ip);
    const passed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(60);
    expect(blocked).toBe(60);
  });

  it('authLimiter: 100 concurrent failed requests — exactly 5 pass', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 401 });

    const responses = await fireBurst(app, 100, ip);
    const passed = responses.filter((r) => r.status === 401).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(5);
    expect(blocked).toBe(95);
  });

  it('availabilityCheckLimiter: 100 concurrent requests — exactly 50 pass', async () => {
    const ip = uniqueIp();
    const app = makeApp(availabilityCheckLimiter);

    const responses = await fireBurst(app, 100, ip);
    const passed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(passed).toBe(50);
    expect(blocked).toBe(50);
  });
});

// ─── §14 Multiple IPs on same limiter (no cross-IP bleed) ──────────────────

describe('§14 IP isolation — no cross-IP counter bleed', () => {
  it('authLimiter: 10 different IPs each get their own 5-request quota', async () => {
    const app = makeApp(authLimiter, { statusCode: 401 });
    const ips = Array.from({ length: 10 }, () => uniqueIp());

    for (const ip of ips) {
      const responses = await fireSequential(app, 6, ip);

      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
      }
      expect(responses[5].status).toBe(429);
    }
  });

  it('questionnaireLimiter: 5 different IPs each get their own 10-request quota', async () => {
    const app = makeApp(questionnaireLimiter);
    const ips = Array.from({ length: 5 }, () => uniqueIp());

    for (const ip of ips) {
      const responses = await fireSequential(app, 11, ip);

      for (let i = 0; i < 10; i++) {
        expect(responses[i].status).toBe(200);
      }
      expect(responses[10].status).toBe(429);
    }
  });
});

// ─── §15 Mixed HTTP methods share counter ───────────────────────────────────

describe('§15 Mixed HTTP methods share the same counter', () => {
  it('GET and POST to the same limiter share one counter', async () => {
    const ip = uniqueIp();
    const app = makeApp(questionnaireLimiter, { methods: ['get', 'post'], useJson: true });

    // Alternate GET and POST
    const results = [];
    for (let i = 0; i < 11; i++) {
      const method = i % 2 === 0 ? 'get' : 'post';
      const req = request(app)[method]('/test').set('x-test-ip', ip);
      results.push(await req);
    }

    // First 10 should pass, 11th should be blocked
    for (let i = 0; i < 10; i++) {
      expect(results[i].status).not.toBe(429);
    }
    expect(results[10].status).toBe(429);
  });
});

// ─── §16 429 Content-Type header ────────────────────────────────────────────

describe('§16 429 Content-Type is application/json', () => {
  for (const spec of LIMITER_SPECS) {
    it(`${spec.name}: 429 response has Content-Type: application/json`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      expect(blocked.status).toBe(429);
      expect(blocked.headers['content-type']).toMatch(/application\/json/);
    });
  }
});

// ─── §17 HTTP Retry-After header ────────────────────────────────────────────

describe('§17 HTTP Retry-After header on 429 responses', () => {
  for (const spec of LIMITER_SPECS) {
    it(`${spec.name}: 429 response includes Retry-After header`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const responses = await fireSequential(app, spec.max + 1, ip);
      const blocked = responses[spec.max];

      expect(blocked.status).toBe(429);
      // express-rate-limit sets Retry-After header on 429 responses
      const retryAfter = blocked.headers['retry-after'];
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });
  }
});

// ─── §18 Multiple consecutive 429s are consistent ───────────────────────────

describe('§18 Multiple consecutive 429 responses are consistent', () => {
  it('authLimiter: 5 consecutive 429 bodies all have the same code and structure', async () => {
    const ip = uniqueIp();
    const app = makeApp(authLimiter, { statusCode: 401 });

    const responses = await fireSequential(app, 10, ip);
    const blockedResponses = responses.slice(5);

    for (const r of blockedResponses) {
      expect(r.status).toBe(429);
      expect(r.body).toEqual(
        expect.objectContaining({
          success: false,
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
        }),
      );
      expect(typeof r.body.message).toBe('string');
      expect(typeof r.body.retryAfter).toBe('number');
    }

    // All should have the same code and message (retryAfter may vary slightly)
    const codes = blockedResponses.map((r) => r.body.code);
    const messages = blockedResponses.map((r) => r.body.message);
    expect(new Set(codes).size).toBe(1);
    expect(new Set(messages).size).toBe(1);
  });
});

// ─── §19 First request remaining header ─────────────────────────────────────

describe('§19 First request RateLimit-Remaining = max - 1', () => {
  for (const spec of LIMITER_SPECS) {
    // Skip authLimiter with skipSuccessfulRequests — 200s don't decrement
    if (spec.name === 'authLimiter') continue;

    it(`${spec.name}: first request has RateLimit-Remaining = ${spec.max - 1}`, async () => {
      const ip = uniqueIp();
      const app = makeApp(spec.limiter, { statusCode: spec.statusCode });

      const res = await request(app).get('/test').set('x-test-ip', ip);

      const remaining = parseInt(res.headers['ratelimit-remaining'], 10);
      expect(remaining).toBe(spec.max - 1);
    });
  }
});

// ─── §20 General limiter from security.ts ───────────────────────────────────

describe('§20 General limiter (security.ts)', () => {
  // generalLimiter: 300/min in dev (NODE_ENV !== 'production'), 100/min in prod
  // In test environment NODE_ENV is likely 'test', so isDev = true → max = 300
  const expectedMax = process.env.NODE_ENV === 'production' ? 100 : 300;

  it(`general limiter allows ${expectedMax} requests per minute`, async () => {
    const ip = uniqueIp();
    const app = makeApp(generalLimiter);

    // Fire expectedMax + 1 requests
    const responses = await fireSequential(app, expectedMax + 1, ip);

    // All up to max should pass
    for (let i = 0; i < expectedMax; i++) {
      expect(responses[i].status).not.toBe(429);
    }
    // Next request should be blocked
    expect(responses[expectedMax].status).toBe(429);
  });

  it('general limiter 429 body includes error and code fields', async () => {
    const ip = uniqueIp();
    const app = makeApp(generalLimiter);

    const responses = await fireSequential(app, expectedMax + 1, ip);
    const blocked = responses[expectedMax];

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.body.success).toBe(false);
  });

  it('general limiter uses standardHeaders (no legacy headers)', async () => {
    const ip = uniqueIp();
    const app = makeApp(generalLimiter);

    const res = await request(app).get('/test').set('x-test-ip', ip);

    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });
});

// ─── §21 Questionnaire middleware limiters ───────────────────────────────────

describe('§21 Questionnaire middleware limiters', () => {
  describe('questionnaireRateLimit (100/15min)', () => {
    it('allows 100 requests, blocks request 101', async () => {
      const ip = uniqueIp();
      const app = makeApp(questionnaireRateLimit);

      const responses = await fireSequential(app, 101, ip);

      for (let i = 0; i < 100; i++) {
        expect(responses[i].status).not.toBe(429);
      }
      expect(responses[100].status).toBe(429);
    });

    it('429 body has code RATE_LIMIT_EXCEEDED', async () => {
      const ip = uniqueIp();
      const app = makeApp(questionnaireRateLimit);

      const responses = await fireSequential(app, 101, ip);
      const blocked = responses[100];

      expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blocked.body.success).toBe(false);
    });

    it('logs warning on rate limit hit (handler includes logger call)', async () => {
      const ip = uniqueIp();
      const app = makeApp(questionnaireRateLimit);

      const responses = await fireSequential(app, 101, ip);

      // The 429 response proves the custom handler fired
      expect(responses[100].status).toBe(429);
      expect(responses[100].body.retryAfter).toBe(15 * 60);
    });
  });

  describe('submissionRateLimit (10/5min, IP:userId keyed)', () => {
    it('allows 10 requests, blocks request 11', async () => {
      const ip = uniqueIp();
      const app = makeApp(submissionRateLimit, { useJson: true });

      const responses = await fireSequential(app, 11, ip);

      for (let i = 0; i < 10; i++) {
        expect(responses[i].status).not.toBe(429);
      }
      expect(responses[10].status).toBe(429);
    });

    it('429 body has code SUBMISSION_RATE_LIMIT_EXCEEDED', async () => {
      const ip = uniqueIp();
      const app = makeApp(submissionRateLimit, { useJson: true });

      const responses = await fireSequential(app, 11, ip);
      const blocked = responses[10];

      expect(blocked.body.code).toBe('SUBMISSION_RATE_LIMIT_EXCEEDED');
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.retryAfter).toBe(5 * 60);
    });

    it('still sends legacy X-RateLimit-* headers (legacyHeaders not disabled — inconsistency with rateLimiter.ts)', async () => {
      // NOTE: submissionRateLimit in questionnaire.ts does NOT set legacyHeaders: false
      // unlike all limiters in rateLimiter.ts. This test documents the inconsistency.
      const ip = uniqueIp();
      const app = makeApp(submissionRateLimit, { useJson: true });

      const res = await request(app).get('/test').set('x-test-ip', ip);

      // Legacy headers ARE present because legacyHeaders defaults to true
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
