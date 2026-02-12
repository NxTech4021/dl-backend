/**
 * Best6 Algorithm Service Tests
 *
 * Tests for the Best 6 Results calculation system.
 *
 * IMPORTANT: Best6AlgorithmService uses the global `prisma` client, NOT dependency injection.
 * Data created via prismaTest is NOT visible to the service (transaction isolation).
 * Therefore these tests focus on:
 *   - Class instantiation
 *   - Empty/graceful handling with non-existent player/division/season IDs
 *   - Return type structure validation
 *   - Parameter edge cases
 */

// Mock the logger to prevent actual log output during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { Best6AlgorithmService } from '../../../src/services/match/best6/best6AlgorithmService';

// Non-existent IDs that will never match real database rows
const NON_EXISTENT_PLAYER_ID = 'non-existent-player-id-aaa111';
const NON_EXISTENT_DIVISION_ID = 'non-existent-division-id-bbb222';
const NON_EXISTENT_SEASON_ID = 'non-existent-season-id-ccc333';

describe('Best6AlgorithmService', () => {
  let service: Best6AlgorithmService;

  beforeAll(() => {
    service = new Best6AlgorithmService();
  });

  // ============================================================================
  // CLASS INSTANTIATION
  // ============================================================================
  describe('instantiation', () => {
    it('should create an instance of Best6AlgorithmService', () => {
      // Act
      const instance = new Best6AlgorithmService();

      // Assert
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(Best6AlgorithmService);
    });

    it('should have all expected methods', () => {
      // Assert
      expect(typeof service.calculateBest6).toBe('function');
      expect(typeof service.applyBest6ToDatabase).toBe('function');
      expect(typeof service.recalculateDivisionBest6).toBe('function');
      expect(typeof service.getBest6Composition).toBe('function');
      expect(typeof service.getPlayerStats).toBe('function');
    });
  });

  // ============================================================================
  // CALCULATE BEST 6
  // ============================================================================
  describe('calculateBest6', () => {
    it('should return empty array for non-existent player', async () => {
      // Act
      const result = await service.calculateBest6(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result).toEqual([]);
    });

    it('should return an array type', async () => {
      // Act
      const result = await service.calculateBest6(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return at most 6 results', async () => {
      // Act
      const result = await service.calculateBest6(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.length).toBeLessThanOrEqual(6);
    });
  });

  // ============================================================================
  // GET BEST 6 COMPOSITION
  // ============================================================================
  describe('getBest6Composition', () => {
    it('should return composition structure for non-existent IDs', async () => {
      // Act
      const result = await service.getBest6Composition(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('totalWins');
      expect(result).toHaveProperty('totalLosses');
      expect(result).toHaveProperty('countedWins');
      expect(result).toHaveProperty('countedLosses');
      expect(result).toHaveProperty('totalPoints');
      expect(result).toHaveProperty('results');
    });

    it('should return zero counts for non-existent player', async () => {
      // Act
      const result = await service.getBest6Composition(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.totalMatches).toBe(0);
      expect(result.totalWins).toBe(0);
      expect(result.totalLosses).toBe(0);
      expect(result.countedWins).toBe(0);
      expect(result.countedLosses).toBe(0);
      expect(result.totalPoints).toBe(0);
    });

    it('should return empty results array for non-existent player', async () => {
      // Act
      const result = await service.getBest6Composition(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.results).toEqual([]);
    });
  });

  // ============================================================================
  // GET PLAYER STATS
  // ============================================================================
  describe('getPlayerStats', () => {
    it('should return stats structure for non-existent IDs', async () => {
      // Act
      const result = await service.getPlayerStats(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result).toHaveProperty('record');
      expect(result).toHaveProperty('leaguePoints');
      expect(result).toHaveProperty('bestPossible');
      expect(result).toHaveProperty('resultsCounted');
    });

    it('should return 0W-0L record for non-existent player', async () => {
      // Act
      const result = await service.getPlayerStats(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.record).toBe('0W-0L');
    });

    it('should return 0 league points for non-existent player', async () => {
      // Act
      const result = await service.getPlayerStats(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.leaguePoints).toBe(0);
    });

    it('should return best possible based on max potential wins for non-existent player', async () => {
      // With 0 matches played and 0 wins counted:
      // matchesRemaining = 9 - 0 = 9
      // potentialWins = max(0, 6 - 0) = 6
      // bestPossible = 0 + (6 * 5) = 30
      const result = await service.getPlayerStats(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.bestPossible).toBe(30);
    });

    it('should return "0 wins" as results counted for non-existent player', async () => {
      // With 0 counted losses, the format is "{countedWins} wins"
      const result = await service.getPlayerStats(
        NON_EXISTENT_PLAYER_ID,
        NON_EXISTENT_DIVISION_ID,
        NON_EXISTENT_SEASON_ID
      );

      // Assert
      expect(result.resultsCounted).toBe('0 wins');
    });
  });

  // ============================================================================
  // APPLY BEST 6 TO DATABASE
  // ============================================================================
  describe('applyBest6ToDatabase', () => {
    it('should handle non-existent player gracefully (no results to update)', async () => {
      // Act & Assert - should not throw, just log and complete with no updates
      await expect(
        service.applyBest6ToDatabase(
          NON_EXISTENT_PLAYER_ID,
          NON_EXISTENT_DIVISION_ID,
          NON_EXISTENT_SEASON_ID
        )
      ).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // RECALCULATE DIVISION BEST 6
  // ============================================================================
  describe('recalculateDivisionBest6', () => {
    it('should handle non-existent division gracefully (no players to recalculate)', async () => {
      // Act & Assert - should not throw, just log and complete
      await expect(
        service.recalculateDivisionBest6(
          NON_EXISTENT_DIVISION_ID,
          NON_EXISTENT_SEASON_ID
        )
      ).resolves.toBeUndefined();
    });
  });
});
