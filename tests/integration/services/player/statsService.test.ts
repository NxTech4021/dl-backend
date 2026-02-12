/**
 * Player Statistics Service Integration Tests
 *
 * Tests for player stats aggregation and individual player queries.
 *
 * Note: These tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so players created via prismaTest are not visible to the service.
 * Tests focus on: return structure validation, non-existent ID handling, and edge cases.
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

// Import after mocking
import { getPlayerStats, getPlayerById } from '../../../../src/services/player/statsService';

describe('PlayerStatsService', () => {
  describe('getPlayerStats', () => {
    it('should return stats structure with all expected fields', async () => {
      // Act
      const result = await getPlayerStats();

      // Assert
      expect(result).toBeDefined();
      // Frontend-friendly fields
      expect(typeof result.total).toBe('number');
      expect(typeof result.active).toBe('number');
      expect(typeof result.inactive).toBe('number');
      expect(typeof result.verified).toBe('number');
      // Legacy fields
      expect(typeof result.totalPlayers).toBe('number');
      expect(typeof result.activePlayers).toBe('number');
      expect(typeof result.inactivePlayers).toBe('number');
      expect(typeof result.suspendedPlayers).toBe('number');
      expect(typeof result.totalAdmins).toBe('number');
      expect(typeof result.totalStaff).toBe('number');
    });

    it('should return non-negative numbers for all stats', async () => {
      // Act
      const result = await getPlayerStats();

      // Assert
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.active).toBeGreaterThanOrEqual(0);
      expect(result.inactive).toBeGreaterThanOrEqual(0);
      expect(result.verified).toBeGreaterThanOrEqual(0);
      expect(result.totalPlayers).toBeGreaterThanOrEqual(0);
      expect(result.activePlayers).toBeGreaterThanOrEqual(0);
      expect(result.inactivePlayers).toBeGreaterThanOrEqual(0);
      expect(result.suspendedPlayers).toBeGreaterThanOrEqual(0);
      expect(result.totalAdmins).toBeGreaterThanOrEqual(0);
    });

    it('should have total equal to totalPlayers (consistency check)', async () => {
      // Act
      const result = await getPlayerStats();

      // Assert - total and totalPlayers should be the same value
      expect(result.total).toBe(result.totalPlayers);
      expect(result.active).toBe(result.activePlayers);
      expect(result.inactive).toBe(result.inactivePlayers);
    });

    it('should always return totalStaff as 0', async () => {
      // Act
      const result = await getPlayerStats();

      // Assert - totalStaff is hardcoded to 0 (not available in current Role enum)
      expect(result.totalStaff).toBe(0);
    });
  });

  describe('getPlayerById', () => {
    it('should return null for non-existent player ID', async () => {
      // Act
      const result = await getPlayerById('non-existent-player-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for empty string player ID', async () => {
      // Act
      const result = await getPlayerById('');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for random UUID that does not exist', async () => {
      // Act
      const result = await getPlayerById('00000000-0000-0000-0000-000000000000');

      // Assert
      expect(result).toBeNull();
    });
  });
});
