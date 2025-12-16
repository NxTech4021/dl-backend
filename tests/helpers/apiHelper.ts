import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../setup/testApp';

// Import the app or create a test app
let app: Express;

/**
 * Get or create the test Express app
 */
export function getTestApp(): Express {
  if (!app) {
    app = createTestApp();
  }
  return app;
}

/**
 * Reset the test app (useful for isolation between test files)
 */
export function resetTestApp(): void {
  app = createTestApp();
}

/**
 * Create an authenticated request with user ID header
 */
export function authenticatedRequest(userId: string) {
  return {
    get: (url: string) =>
      request(getTestApp())
        .get(url)
        .set('x-user-id', userId),

    post: (url: string) =>
      request(getTestApp())
        .post(url)
        .set('x-user-id', userId),

    put: (url: string) =>
      request(getTestApp())
        .put(url)
        .set('x-user-id', userId),

    patch: (url: string) =>
      request(getTestApp())
        .patch(url)
        .set('x-user-id', userId),

    delete: (url: string) =>
      request(getTestApp())
        .delete(url)
        .set('x-user-id', userId),
  };
}

/**
 * Create an unauthenticated request
 */
export function unauthenticatedRequest() {
  return request(getTestApp());
}

/**
 * Helper to parse JSON response body
 */
export function parseBody<T>(response: request.Response): T {
  return response.body as T;
}

/**
 * Helper to assert successful API response
 */
export function expectSuccess(response: request.Response) {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
}

/**
 * Helper to assert error API response
 */
export function expectError(response: request.Response, status: number) {
  expect(response.status).toBe(status);
}

/**
 * Helper to assert unauthorized response
 */
export function expectUnauthorized(response: request.Response) {
  expect(response.status).toBe(401);
}

/**
 * Helper to assert forbidden response
 */
export function expectForbidden(response: request.Response) {
  expect(response.status).toBe(403);
}

/**
 * Helper to assert not found response
 */
export function expectNotFound(response: request.Response) {
  expect(response.status).toBe(404);
}

/**
 * Helper to assert bad request response
 */
export function expectBadRequest(response: request.Response) {
  expect(response.status).toBe(400);
}
