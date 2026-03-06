/**
 * Admin Achievement Controller — Enum Validation Tests
 *
 * BUG 4: category, tier, scope are cast with `as` without validation.
 * Invalid enum values pass through to Prisma, which throws a
 * PrismaClientValidationError, resulting in a generic 500 instead
 * of a descriptive 400.
 *
 * These tests verify that invalid enum values are caught early and
 * return 400 with a helpful message listing valid values.
 */

// ============================================================
// Mock setup (must be before imports)
// ============================================================

jest.mock('../../../src/services/achievement/achievementCrudService', () => ({
  createAchievement: jest.fn(),
  updateAchievement: jest.fn(),
  grantAchievement: jest.fn(),
  getAchievementsAdmin: jest.fn(),
  getAchievementById: jest.fn(),
  deleteAchievement: jest.fn(),
}));

jest.mock('../../../src/services/achievement/achievementDefinitions', () => ({
  getEvaluatorKeys: jest.fn(() => ['total_matches', 'total_wins', 'win_streak']),
}));

jest.mock('../../../src/services/achievement/achievementEvaluationService', () => ({
  finalizeSeasonAchievements: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================
// Import AFTER mocks
// ============================================================

import { createAchievementHandler, updateAchievementHandler } from '../../../src/controllers/admin/adminAchievementController';
import { createAchievement, updateAchievement } from '../../../src/services/achievement/achievementCrudService';
import { Request, Response } from 'express';

// ============================================================
// Helpers
// ============================================================

function mockReq(body: Record<string, any>, params: Record<string, string> = {}): Partial<Request> {
  return { body, params } as Partial<Request>;
}

function mockRes(): Partial<Response> & { _status: number; _json: any } {
  const res: any = {
    _status: 0,
    _json: null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: any) {
      res._json = data;
      return res;
    },
  };
  return res;
}

const validBody = {
  title: 'Test Achievement',
  description: 'A test',
  icon: 'trophy',
  category: 'WINNING',
  evaluatorKey: 'total_wins',
  tier: 'BRONZE',
  scope: 'MATCH',
};

// ============================================================
// Tests
// ============================================================

describe('Admin Achievement Controller — Enum Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- CREATE: invalid category ----

  test('create rejects invalid category with 400 and lists valid values', async () => {
    const req = mockReq({ ...validBody, category: 'INVALID_CAT' });
    const res = mockRes();

    await createAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('WINNING');
    expect(res._json.message).toContain('MATCH_COUNTER');
  });

  // ---- CREATE: invalid tier ----

  test('create rejects invalid tier with 400 and lists valid values', async () => {
    const req = mockReq({ ...validBody, tier: 'DIAMOND' });
    const res = mockRes();

    await createAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('BRONZE');
    expect(res._json.message).toContain('GOLD');
  });

  // ---- CREATE: invalid scope ----

  test('create rejects invalid scope with 400 and lists valid values', async () => {
    const req = mockReq({ ...validBody, scope: 'WEEKLY' });
    const res = mockRes();

    await createAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('MATCH');
    expect(res._json.message).toContain('SEASON');
  });

  // ---- CREATE: valid enums pass through ----

  test('create accepts valid enum values and calls service', async () => {
    const mockCreated = { id: 'ach-1', ...validBody };
    (createAchievement as jest.Mock).mockResolvedValue(mockCreated);

    const req = mockReq(validBody);
    const res = mockRes();

    await createAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(201);
    expect(createAchievement).toHaveBeenCalled();
  });

  // ---- UPDATE: invalid category ----

  test('update rejects invalid category with 400', async () => {
    const req = mockReq({ category: 'BOGUS' }, { id: 'ach-1' });
    const res = mockRes();

    await updateAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('category');
  });

  // ---- UPDATE: invalid tier ----

  test('update rejects invalid tier with 400', async () => {
    const req = mockReq({ tier: 'DIAMOND' }, { id: 'ach-1' });
    const res = mockRes();

    await updateAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('tier');
  });

  // ---- UPDATE: invalid scope ----

  test('update rejects invalid scope with 400', async () => {
    const req = mockReq({ scope: 'WEEKLY' }, { id: 'ach-1' });
    const res = mockRes();

    await updateAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.message).toContain('scope');
  });

  // ---- UPDATE: valid enums pass through ----

  test('update accepts valid enum values and calls service', async () => {
    const mockUpdated = { id: 'ach-1', ...validBody };
    (updateAchievement as jest.Mock).mockResolvedValue(mockUpdated);

    const req = mockReq({ category: 'WINNING', tier: 'GOLD' }, { id: 'ach-1' });
    const res = mockRes();

    await updateAchievementHandler(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(updateAchievement).toHaveBeenCalled();
  });
});
