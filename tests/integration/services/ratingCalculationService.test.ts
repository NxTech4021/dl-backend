/**
 * Rating Calculation Service Tests
 *
 * Tests for ELO rating calculation pure logic functions.
 * These tests focus on:
 * - calculateExpectedScore (pure math, no DB)
 * - getRatingConfig with no seasonId (returns defaults, no DB query)
 * - Mathematical properties of the ELO system
 *
 * Note: DB-dependent functions (calculateMatchRatings, applyMatchRatings, reverseMatchRatings)
 * are NOT tested here because they use global prisma, not prismaTest.
 */

import { prismaTest } from '../../setup/prismaTestClient';

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
import {
  calculateExpectedScore,
  getRatingConfig,
  RatingConfig,
} from '../../../src/services/rating/ratingCalculationService';

describe('RatingCalculationService', () => {
  // ============================================================================
  // calculateExpectedScore - PURE LOGIC (no DB access)
  // ============================================================================
  describe('calculateExpectedScore', () => {
    describe('Equal ratings', () => {
      it('should return 0.5 for equal ratings', () => {
        const result = calculateExpectedScore(1500, 1500);
        expect(result).toBeCloseTo(0.5, 10);
      });

      it('should return 0.5 for equal ratings at different levels', () => {
        expect(calculateExpectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
        expect(calculateExpectedScore(2000, 2000)).toBeCloseTo(0.5, 10);
        expect(calculateExpectedScore(800, 800)).toBeCloseTo(0.5, 10);
      });
    });

    describe('Higher rated player A', () => {
      it('should return > 0.5 when player A is higher rated', () => {
        const result = calculateExpectedScore(1600, 1400);
        expect(result).toBeGreaterThan(0.5);
      });

      it('should return approximately 0.76 for 200-point advantage', () => {
        // ELO formula: 1 / (1 + 10^((1400-1600)/400)) = 1 / (1 + 10^(-0.5))
        // = 1 / (1 + 0.3162) = 1 / 1.3162 ~ 0.7597
        const result = calculateExpectedScore(1600, 1400);
        expect(result).toBeCloseTo(0.7597, 3);
      });

      it('should return approximately 0.91 for 400-point advantage', () => {
        // ELO formula: 1 / (1 + 10^((1100-1500)/400)) = 1 / (1 + 10^(-1))
        // = 1 / (1 + 0.1) = 1 / 1.1 ~ 0.9091
        const result = calculateExpectedScore(1500, 1100);
        expect(result).toBeCloseTo(0.9091, 3);
      });
    });

    describe('Lower rated player A', () => {
      it('should return < 0.5 when player A is lower rated', () => {
        const result = calculateExpectedScore(1400, 1600);
        expect(result).toBeLessThan(0.5);
      });

      it('should return approximately 0.24 for 200-point disadvantage', () => {
        // ELO formula: 1 / (1 + 10^((1600-1400)/400)) = 1 / (1 + 10^(0.5))
        // = 1 / (1 + 3.1623) = 1 / 4.1623 ~ 0.2403
        const result = calculateExpectedScore(1400, 1600);
        expect(result).toBeCloseTo(0.2403, 3);
      });
    });

    describe('Mathematical properties', () => {
      it('should have probabilities that sum to 1 (complementary)', () => {
        const scoreA = calculateExpectedScore(1600, 1400);
        const scoreB = calculateExpectedScore(1400, 1600);
        expect(scoreA + scoreB).toBeCloseTo(1.0, 10);
      });

      it('should have probabilities that sum to 1 for various rating differences', () => {
        const testCases = [
          [1500, 1500],
          [1800, 1200],
          [1300, 1700],
          [2000, 1000],
          [1000, 2000],
        ];

        for (const [ratingA, ratingB] of testCases) {
          const scoreA = calculateExpectedScore(ratingA!, ratingB!);
          const scoreB = calculateExpectedScore(ratingB!, ratingA!);
          expect(scoreA + scoreB).toBeCloseTo(1.0, 10);
        }
      });

      it('should always return a value between 0 and 1 (exclusive)', () => {
        const testCases = [
          [1500, 1500],
          [2500, 500],
          [500, 2500],
          [3000, 100],
          [100, 3000],
        ];

        for (const [ratingA, ratingB] of testCases) {
          const result = calculateExpectedScore(ratingA!, ratingB!);
          expect(result).toBeGreaterThan(0);
          expect(result).toBeLessThan(1);
        }
      });

      it('should be monotonically increasing with player A rating', () => {
        // As player A's rating increases, expected score should increase
        const ratings = [1000, 1200, 1400, 1600, 1800, 2000];
        const opponentRating = 1500;

        let previousScore = 0;
        for (const rating of ratings) {
          const score = calculateExpectedScore(rating, opponentRating);
          expect(score).toBeGreaterThan(previousScore);
          previousScore = score;
        }
      });

      it('should be symmetric: swapping A and B complements the result', () => {
        const scoreA = calculateExpectedScore(1700, 1300);
        const scoreSwapped = calculateExpectedScore(1300, 1700);
        expect(scoreA).toBeCloseTo(1 - scoreSwapped, 10);
      });
    });

    describe('Extreme values', () => {
      it('should handle very large rating differences', () => {
        const result = calculateExpectedScore(3000, 500);
        expect(result).toBeGreaterThan(0.99);
        expect(result).toBeLessThan(1);
      });

      it('should handle very small rating A vs large rating B', () => {
        const result = calculateExpectedScore(500, 3000);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(0.01);
      });

      it('should handle zero ratings', () => {
        const result = calculateExpectedScore(0, 0);
        expect(result).toBeCloseTo(0.5, 10);
      });

      it('should handle negative rating difference gracefully', () => {
        // Not typical but function should handle it
        const result = calculateExpectedScore(100, 2000);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(0.5);
      });
    });
  });

  // ============================================================================
  // getRatingConfig - with no season (returns defaults, no DB hit for null param)
  // ============================================================================
  describe('getRatingConfig', () => {
    it('should return default config when no seasonId is provided', async () => {
      const config = await getRatingConfig();

      expect(config).toBeDefined();
      expect(config.initialRating).toBe(1500);
      expect(config.initialRD).toBe(350);
      expect(config.kFactorNew).toBe(40);
      expect(config.kFactorEstablished).toBe(20);
      expect(config.kFactorThreshold).toBe(30);
      expect(config.singlesWeight).toBe(1.0);
      expect(config.doublesWeight).toBe(1.0);
      expect(config.oneSetMatchWeight).toBe(0.5);
      expect(config.walkoverWinImpact).toBe(0.5);
      expect(config.walkoverLossImpact).toBe(1.0);
      expect(config.provisionalThreshold).toBe(10);
    });

    it('should return default config when undefined is passed', async () => {
      const config = await getRatingConfig(undefined);

      expect(config.initialRating).toBe(1500);
      expect(config.initialRD).toBe(350);
    });

    it('should return all required RatingConfig fields', async () => {
      const config = await getRatingConfig();

      // Verify all fields exist and are numbers
      const expectedFields: (keyof RatingConfig)[] = [
        'initialRating',
        'initialRD',
        'kFactorNew',
        'kFactorEstablished',
        'kFactorThreshold',
        'singlesWeight',
        'doublesWeight',
        'oneSetMatchWeight',
        'walkoverWinImpact',
        'walkoverLossImpact',
        'provisionalThreshold',
      ];

      for (const field of expectedFields) {
        expect(typeof config[field]).toBe('number');
      }
    });

    it('should return default config for non-existent seasonId', async () => {
      // Querying a non-existent seasonId should fall through to defaults
      const config = await getRatingConfig('non-existent-season-id');

      expect(config.initialRating).toBe(1500);
      expect(config.initialRD).toBe(350);
      expect(config.kFactorNew).toBe(40);
      expect(config.kFactorEstablished).toBe(20);
    });

    it('should have reasonable default values', async () => {
      const config = await getRatingConfig();

      // K-factor for new players should be higher than established
      expect(config.kFactorNew).toBeGreaterThan(config.kFactorEstablished);

      // Weights should be positive
      expect(config.singlesWeight).toBeGreaterThan(0);
      expect(config.doublesWeight).toBeGreaterThan(0);
      expect(config.oneSetMatchWeight).toBeGreaterThan(0);

      // Walkover impacts should be between 0 and 1
      expect(config.walkoverWinImpact).toBeGreaterThanOrEqual(0);
      expect(config.walkoverWinImpact).toBeLessThanOrEqual(1);
      expect(config.walkoverLossImpact).toBeGreaterThanOrEqual(0);
      expect(config.walkoverLossImpact).toBeLessThanOrEqual(1);

      // Provisional threshold should be positive
      expect(config.provisionalThreshold).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // calculateMatchRatings - error cases only (non-existent match)
  // ============================================================================
  describe('calculateMatchRatings', () => {
    // We import the function dynamically since it uses global prisma
    // and we can only test error paths (non-existent IDs)
    let calculateMatchRatings: typeof import('../../../src/services/rating/ratingCalculationService').calculateMatchRatings;

    beforeAll(async () => {
      const mod = await import('../../../src/services/rating/ratingCalculationService');
      calculateMatchRatings = mod.calculateMatchRatings;
    });

    it('should return null for non-existent match ID', async () => {
      const result = await calculateMatchRatings('non-existent-match-id');
      expect(result).toBeNull();
    });
  });
});
