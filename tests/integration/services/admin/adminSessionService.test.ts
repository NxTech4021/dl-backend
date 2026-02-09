/**
 * Admin Session Service Tests
 *
 * Tests for admin session management functions.
 * - toWebHeaders: PURE LOGIC function that converts Express headers to Web Headers
 * - getAdminSession: Error handling for invalid/missing session headers
 *
 * Note: getAdminSession depends on better-auth and global prisma.
 * We mock better-auth to test error paths without requiring a real session.
 */

import { prismaTest } from '../../../setup/prismaTestClient';

// Mock the logger
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock better-auth to control session responses
jest.mock('../../../../src/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

// Import after mocking
import { toWebHeaders, getAdminSession } from '../../../../src/services/admin/adminSessionService';
import { auth } from '../../../../src/lib/auth';

const mockGetSession = auth.api.getSession as jest.Mock;

describe('AdminSessionService', () => {
  // ============================================================================
  // toWebHeaders - PURE LOGIC (no DB, no auth)
  // ============================================================================
  describe('toWebHeaders', () => {
    it('should convert simple string headers', () => {
      const expressHeaders = {
        'content-type': 'application/json',
        'authorization': 'Bearer test-token',
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('content-type')).toBe('application/json');
      expect(webHeaders.get('authorization')).toBe('Bearer test-token');
    });

    it('should handle undefined header values by skipping them', () => {
      const expressHeaders: Record<string, string | string[] | undefined> = {
        'content-type': 'application/json',
        'x-custom': undefined,
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('content-type')).toBe('application/json');
      expect(webHeaders.get('x-custom')).toBeNull();
    });

    it('should join array header values with comma', () => {
      const expressHeaders: Record<string, string | string[] | undefined> = {
        'accept': ['text/html', 'application/json'],
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('accept')).toBe('text/html,application/json');
    });

    it('should handle empty headers object', () => {
      const expressHeaders = {};

      const webHeaders = toWebHeaders(expressHeaders);

      // Should return empty Headers object without throwing
      expect(webHeaders).toBeInstanceOf(Headers);
    });

    it('should convert non-string values to strings', () => {
      const expressHeaders: Record<string, any> = {
        'content-length': '1234',
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('content-length')).toBe('1234');
    });

    it('should handle multiple headers correctly', () => {
      const expressHeaders = {
        'host': 'localhost:3000',
        'accept': 'application/json',
        'user-agent': 'test-agent',
        'cookie': 'session=abc123',
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('host')).toBe('localhost:3000');
      expect(webHeaders.get('accept')).toBe('application/json');
      expect(webHeaders.get('user-agent')).toBe('test-agent');
      expect(webHeaders.get('cookie')).toBe('session=abc123');
    });

    it('should handle mixed header types', () => {
      const expressHeaders: Record<string, string | string[] | undefined> = {
        'content-type': 'text/html',
        'set-cookie': ['cookie1=val1', 'cookie2=val2'],
        'x-undefined': undefined,
        'x-empty-string': '',
      };

      const webHeaders = toWebHeaders(expressHeaders);

      expect(webHeaders.get('content-type')).toBe('text/html');
      expect(webHeaders.get('set-cookie')).toBe('cookie1=val1,cookie2=val2');
      expect(webHeaders.get('x-undefined')).toBeNull();
      expect(webHeaders.get('x-empty-string')).toBe('');
    });

    it('should return a Headers instance', () => {
      const expressHeaders = { 'test': 'value' };

      const result = toWebHeaders(expressHeaders);

      expect(result).toBeInstanceOf(Headers);
    });
  });

  // ============================================================================
  // getAdminSession - Error handling tests (mocked auth)
  // ============================================================================
  describe('getAdminSession', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw "No active session" when auth returns null', async () => {
      // Arrange: better-auth returns no session
      mockGetSession.mockResolvedValue(null);

      const headers = new Headers({
        'authorization': 'Bearer invalid-token',
      });

      // Act & Assert
      await expect(getAdminSession(headers)).rejects.toThrow('No active session');
    });

    it('should throw "No active session" when auth returns undefined', async () => {
      mockGetSession.mockResolvedValue(undefined);

      const headers = new Headers();

      await expect(getAdminSession(headers)).rejects.toThrow('No active session');
    });

    it('should call auth.api.getSession with provided headers', async () => {
      mockGetSession.mockResolvedValue(null);

      const headers = new Headers({
        'cookie': 'session=test-session',
      });

      try {
        await getAdminSession(headers);
      } catch {
        // Expected to throw
      }

      expect(mockGetSession).toHaveBeenCalledWith({ headers });
    });

    it('should throw "Not authorized" when user is not found in DB', async () => {
      // Arrange: auth returns a session but user does not exist in DB
      mockGetSession.mockResolvedValue({
        user: { id: 'non-existent-user-id' },
        session: { id: 'session-id' },
      });

      const headers = new Headers({
        'authorization': 'Bearer valid-token',
      });

      // Act & Assert: user lookup will return null -> "Not authorized"
      await expect(getAdminSession(headers)).rejects.toThrow('Not authorized');
    });
  });
});
