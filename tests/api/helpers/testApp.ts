/**
 * Test App Helper for API Contract Tests
 *
 * Provides a supertest agent configured with the Express app
 * for testing HTTP endpoints directly.
 */

import request from 'supertest';
import app from '../../../src/app';
import { prismaTest } from '../../setup/prismaTestClient';

/**
 * Create a supertest agent for API testing
 */
export const testApp = request(app);

/**
 * Create an authenticated test request
 * Uses a mock session for testing authenticated endpoints
 */
export const createAuthenticatedRequest = async (userId: string) => {
  // For now, we'll use a simple approach where tests mock the auth middleware
  // In production tests, you might want to create actual sessions
  return testApp;
};

/**
 * Re-export prismaTest for convenience
 */
export { prismaTest };

/**
 * Re-export factory functions
 */
export * from '../../helpers/factories';

/**
 * API Test Configuration
 */
export const API_PREFIX = process.env.NODE_ENV === 'test' ? '/api' : '';

/**
 * Helper to build API URLs with the correct prefix
 */
export const apiUrl = (path: string) => `${API_PREFIX}${path}`;

/**
 * Helper to clean up test data after tests
 */
export const cleanupTestData = async () => {
  // Order matters due to foreign key constraints
  const tablesToClean = [
    'RatingHistory',
    'PlayerRating',
    'MatchWalkover',
    'MatchSet',
    'MatchParticipant',
    'Match',
    'DivisionRebalanceLog',
    'SeasonMembership',
    'Division',
    'Season',
    'League',
    'UserNotification',
    'Notification',
    'User',
  ];

  for (const table of tablesToClean) {
    try {
      await (prismaTest as any)[table].deleteMany();
    } catch (error) {
      // Silently ignore if table doesn't exist or is already empty
    }
  }
};

/**
 * Common response assertions
 */
export const expectSuccess = (res: request.Response) => {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
};

export const expectError = (res: request.Response, status: number) => {
  expect(res.status).toBe(status);
};

export const expect404 = (res: request.Response) => expectError(res, 404);
export const expect401 = (res: request.Response) => expectError(res, 401);
export const expect400 = (res: request.Response) => expectError(res, 400);
export const expect403 = (res: request.Response) => expectError(res, 403);
