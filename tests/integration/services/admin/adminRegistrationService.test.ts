/**
 * Admin Registration Service Tests
 *
 * Tests for admin registration from invite token.
 * Only tests error handling paths that do NOT require creating data in the DB
 * and expecting the service to see it (service uses global prisma, not prismaTest).
 *
 * Tested error cases:
 * - Invalid/non-existent token -> "Invalid or already used token"
 * - These naturally fail at the first DB lookup step
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

// Mock better-auth (registerAdminFromInvite uses auth.api.signUpEmail)
jest.mock('../../../../src/lib/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
    },
  },
}));

// Import after mocking
import { registerAdminFromInvite } from '../../../../src/services/admin/adminRegistrationService';

describe('AdminRegistrationService', () => {
  // ============================================================================
  // registerAdminFromInvite - Error handling (token validation)
  // ============================================================================
  describe('registerAdminFromInvite', () => {
    describe('Invalid token handling', () => {
      it('should throw "Invalid or already used token" for non-existent token', async () => {
        // Arrange: token does not exist in DB
        const data = {
          token: 'non-existent-token-abc123',
          name: 'Test Admin',
          username: 'testadmin',
          password: 'SecurePassword123!',
        };

        // Act & Assert
        // The service queries prisma.adminInviteToken.findUnique({ where: { token } })
        // which returns null for a non-existent token -> throws error
        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });

      it('should throw "Invalid or already used token" for empty token string', async () => {
        const data = {
          token: '',
          name: 'Test Admin',
          username: 'testadmin',
          password: 'SecurePassword123!',
        };

        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });

      it('should throw "Invalid or already used token" for random UUID token', async () => {
        const data = {
          token: '550e8400-e29b-41d4-a716-446655440000',
          name: 'New Admin',
          username: 'newadmin',
          password: 'StrongPass456!',
        };

        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });

      it('should throw for token with special characters', async () => {
        const data = {
          token: 'invalid-token-!@#$%^&*()',
          name: 'Admin',
          username: 'admin',
          password: 'Password123!',
        };

        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });
    });

    describe('Input validation (all fail at token step)', () => {
      it('should throw for valid-looking data but non-existent token', async () => {
        // Even with valid name/username/password, a bad token fails first
        const data = {
          token: 'looks-valid-but-does-not-exist',
          name: 'Valid Name',
          username: 'validusername',
          password: 'ValidPassword123!',
        };

        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });

      it('should throw even with empty name/username if token is invalid', async () => {
        // Token validation happens before name/username validation
        const data = {
          token: 'invalid-token',
          name: '',
          username: '',
          password: '',
        };

        await expect(registerAdminFromInvite(data)).rejects.toThrow(
          'Invalid or already used token'
        );
      });
    });
  });
});
