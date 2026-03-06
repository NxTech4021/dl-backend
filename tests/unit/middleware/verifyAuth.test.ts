// Must use jest.mock at module level — auth.api.getSession is NOT spyable
jest.mock('../../../src/lib/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock('../../../src/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import express from 'express';
import request from 'supertest';
import { auth } from '../../../src/lib/auth';
import { prisma } from '../../../src/lib/prisma';
import { verifyAuth } from '../../../src/middlewares/auth.middleware';

const mockGetSession = auth.api.getSession as jest.Mock;
const mockFindUnique = (prisma.user.findUnique as jest.Mock);

describe('verifyAuth security', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/test', verifyAuth, (_req, res) => res.json({ ok: true }));
    mockGetSession.mockReset();
    mockFindUnique.mockReset();
  });

  test('authenticates via session cookie when present', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1' },
      session: { id: 'session-1' },
    });
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
      admin: null,
    });

    const response = await request(app)
      .get('/test')
      .set('Cookie', 'better-auth.session_token=valid');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  test('rejects request with no authentication', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await request(app).get('/test');

    expect(response.status).toBe(401);
  });

  test('rejects x-user-id header when no session cookie exists', async () => {
    mockGetSession.mockResolvedValue(null);

    // Mock a real user existing in the DB — proves the attacker can impersonate
    mockFindUnique.mockResolvedValue({
      id: 'victim-user-id',
      name: 'Victim User',
      email: 'victim@example.com',
      username: 'victim',
      role: 'USER',
      admin: null,
    });

    const response = await request(app)
      .get('/test')
      .set('x-user-id', 'victim-user-id');

    // After fix: should be 401 (x-user-id not trusted)
    // Before fix: would be 200 (vulnerability — attacker impersonates victim)
    expect(response.status).toBe(401);
  });
});
