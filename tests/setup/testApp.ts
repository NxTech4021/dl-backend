/**
 * Test App Setup
 *
 * Creates an Express app instance for API testing
 * without starting the HTTP server or Socket.io
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import router from '../../src/routes/index';

/**
 * Create a test-specific Express app
 * Stripped down version without:
 * - Socket.io
 * - Better-auth (we'll mock auth)
 * - Rate limiters
 * - Security middlewares (for test simplicity)
 */
export function createTestApp() {
  const app = express();

  // Essential middleware
  app.use(express.json());
  app.use(cookieParser());

  // Mount routes at /api prefix (matching production)
  app.use('/api', router);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Test server is running' });
  });

  return app;
}

export default createTestApp;
