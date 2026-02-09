/**
 * Player Search Service Integration Tests
 *
 * Tests for player search, discovery, and filtering operations.
 *
 * Note: These tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so players created via prismaTest are not visible to the service.
 * Tests focus on: error handling, validation, empty results, and parameter edge cases.
 */

import { prismaTest } from '../../../setup/prismaTestClient';

// Mock the logger (used by playerTransformer utilities)
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
import {
  getAllPlayers,
  searchPlayers,
  getAvailablePlayersForSeason,
} from '../../../../src/services/player/searchService';

describe('PlayerSearchService', () => {
  describe('getAllPlayers', () => {
    it('should return data structure with pagination using default parameters', async () => {
      // Act
      const result = await getAllPlayers();

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });

    it('should return data structure with custom page and limit', async () => {
      // Act
      const result = await getAllPlayers(2, 5);

      // Assert
      expect(result).toBeDefined();
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });

    it('should cap limit at 100 items', async () => {
      // Act
      const result = await getAllPlayers(1, 500);

      // Assert
      expect(result.pagination.limit).toBe(100);
    });

    it('should return empty data array when page is beyond total pages', async () => {
      // Act - Request a very high page number
      const result = await getAllPlayers(9999, 20);

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.pagination.page).toBe(9999);
    });

    it('should calculate totalPages correctly', async () => {
      // Act
      const result = await getAllPlayers(1, 10);

      // Assert
      const expectedTotalPages = Math.ceil(result.pagination.total / 10);
      expect(result.pagination.totalPages).toBe(expectedTotalPages);
    });
  });

  describe('searchPlayers', () => {
    it('should return an array when called with no query', async () => {
      // Act
      const result = await searchPlayers();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return an array when called with empty string query', async () => {
      // Act
      const result = await searchPlayers('');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for query matching no players', async () => {
      // Act
      const result = await searchPlayers('zzz_no_player_matches_this_xyz_999');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept sport filter parameter', async () => {
      // Act - Search with a sport that no player plays
      const result = await searchPlayers(undefined, 'nonexistentsport999');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept excludeUserId parameter', async () => {
      // Act - Exclude a non-existent user (should not cause errors)
      const result = await searchPlayers(undefined, undefined, 'non-existent-user-id');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when query and sport both match nothing', async () => {
      // Act
      const result = await searchPlayers('zzz_nomatch_999', 'nonexistentsport');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getAvailablePlayersForSeason', () => {
    it('should throw "User not found" for non-existent currentUserId', async () => {
      // Act & Assert
      await expect(
        getAvailablePlayersForSeason('some-season-id', 'non-existent-user-id')
      ).rejects.toThrow('User not found');
    });

    it('should throw "User not found" for non-existent user with search query', async () => {
      // Act & Assert
      await expect(
        getAvailablePlayersForSeason('some-season-id', 'non-existent-user-id', 'search')
      ).rejects.toThrow('User not found');
    });
  });
});
