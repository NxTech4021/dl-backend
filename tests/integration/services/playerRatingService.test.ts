/**
 * Player Rating Service Tests
 *
 * Tests for player rating retrieval, history, and creation
 */

import * as playerRatingService from '../../../src/services/rating/playerRatingService';
import {
  createTestUser,
  createTestDivision,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { GameType, SportType, RatingChangeReason } from '@prisma/client';

describe('PlayerRatingService', () => {
  describe('getPlayerRating', () => {
    it('should return null when player has no rating', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const rating = await playerRatingService.getPlayerRating(user.id);

      // Assert
      expect(rating).toBeNull();
    });

    it('should return player rating for singles', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1650,
          ratingDeviation: 200,
          isProvisional: false,
          matchesPlayed: 10,
          peakRating: 1700,
          peakRatingDate: new Date(),
          lowestRating: 1500,
        },
      });

      // Act
      const rating = await playerRatingService.getPlayerRating(user.id);

      // Assert
      expect(rating).toBeDefined();
      expect(rating?.currentRating).toBe(1650);
      expect(rating?.ratingDeviation).toBe(200);
      expect(rating?.matchesPlayed).toBe(10);
      expect(rating?.isProvisional).toBe(false);
      expect(rating?.gameType).toBe(GameType.SINGLES);
    });

    it('should filter by seasonId when provided', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision();
      const division2 = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division1.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1500,
          isProvisional: true,
          matchesPlayed: 0,
        },
      });

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division2.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1700,
          isProvisional: false,
          matchesPlayed: 15,
        },
      });

      // Act
      const rating = await playerRatingService.getPlayerRating(
        user.id,
        division1.seasonId!,
        GameType.SINGLES
      );

      // Assert
      expect(rating).toBeDefined();
      expect(rating?.currentRating).toBe(1500);
      expect(rating?.seasonId).toBe(division1.seasonId);
    });

    it('should filter by gameType', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1500,
          isProvisional: true,
          matchesPlayed: 5,
        },
      });

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.DOUBLES,
          currentRating: 1600,
          isProvisional: false,
          matchesPlayed: 8,
        },
      });

      // Act
      const doublesRating = await playerRatingService.getPlayerRating(
        user.id,
        undefined,
        GameType.DOUBLES
      );

      // Assert
      expect(doublesRating).toBeDefined();
      expect(doublesRating?.currentRating).toBe(1600);
      expect(doublesRating?.gameType).toBe(GameType.DOUBLES);
    });

    it('should include division name when available', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision({ name: 'Division A' });

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1550,
          isProvisional: true,
          matchesPlayed: 3,
        },
      });

      // Act
      const rating = await playerRatingService.getPlayerRating(user.id);

      // Assert
      expect(rating?.divisionId).toBe(division.id);
      expect(rating?.divisionName).toBe('Division A');
    });
  });

  describe('getPlayerRatings', () => {
    it('should return empty array when player has no ratings', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const ratings = await playerRatingService.getPlayerRatings(user.id);

      // Assert
      expect(ratings).toEqual([]);
    });

    it('should return all ratings for a player', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1500,
          isProvisional: true,
          matchesPlayed: 0,
        },
      });

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.DOUBLES,
          currentRating: 1550,
          isProvisional: true,
          matchesPlayed: 0,
        },
      });

      // Act
      const ratings = await playerRatingService.getPlayerRatings(user.id);

      // Assert
      expect(ratings.length).toBe(2);
      const gameTypes = ratings.map(r => r.gameType);
      expect(gameTypes).toContain(GameType.SINGLES);
      expect(gameTypes).toContain(GameType.DOUBLES);
    });
  });

  describe('getPlayerRatingHistory', () => {
    it('should return empty array when player has no rating', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const history = await playerRatingService.getPlayerRatingHistory(user.id);

      // Assert
      expect(history).toEqual([]);
    });

    it('should return rating history entries', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      const rating = await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1550,
          isProvisional: false,
          matchesPlayed: 2,
        },
      });

      await prismaTest.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: 1500,
          ratingAfter: 1525,
          delta: 25,
          rdBefore: 350,
          rdAfter: 300,
          reason: RatingChangeReason.MATCH_WIN,
          notes: 'Won against Player X',
        },
      });

      await prismaTest.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: 1525,
          ratingAfter: 1550,
          delta: 25,
          rdBefore: 300,
          rdAfter: 250,
          reason: RatingChangeReason.MATCH_WIN,
          notes: 'Won against Player Y',
        },
      });

      // Act
      const history = await playerRatingService.getPlayerRatingHistory(user.id);

      // Assert
      expect(history.length).toBe(2);
      expect(history[0].ratingAfter).toBe(1550); // Most recent first
      expect(history[1].ratingAfter).toBe(1525);
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      const rating = await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1600,
          isProvisional: false,
          matchesPlayed: 5,
        },
      });

      // Create 5 history entries
      for (let i = 0; i < 5; i++) {
        await prismaTest.ratingHistory.create({
          data: {
            playerRatingId: rating.id,
            ratingBefore: 1500 + i * 20,
            ratingAfter: 1520 + i * 20,
            delta: 20,
            rdBefore: 350 - i * 20,
            rdAfter: 330 - i * 20,
            reason: RatingChangeReason.MATCH_WIN,
          },
        });
      }

      // Act
      const history = await playerRatingService.getPlayerRatingHistory(
        user.id,
        undefined,
        GameType.SINGLES,
        2 // Limit to 2
      );

      // Assert
      expect(history.length).toBe(2);
    });
  });

  describe('createInitialRating', () => {
    it('should create initial singles rating', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        divisionId: division.id,
        sport: SportType.PICKLEBALL,
        singles: 1500,
        doubles: null,
        rd: 350,
      });

      // Assert
      const rating = await prismaTest.playerRating.findFirst({
        where: {
          userId: user.id,
          seasonId: division.seasonId!,
          gameType: GameType.SINGLES,
        },
      });

      expect(rating).toBeDefined();
      expect(rating?.currentRating).toBe(1500);
      expect(rating?.ratingDeviation).toBe(350);
      expect(rating?.isProvisional).toBe(true);
      expect(rating?.matchesPlayed).toBe(0);
    });

    it('should create initial doubles rating', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        sport: SportType.PICKLEBALL,
        singles: null,
        doubles: 1600,
        rd: 300,
      });

      // Assert
      const rating = await prismaTest.playerRating.findFirst({
        where: {
          userId: user.id,
          seasonId: division.seasonId!,
          gameType: GameType.DOUBLES,
        },
      });

      expect(rating).toBeDefined();
      expect(rating?.currentRating).toBe(1600);
      expect(rating?.ratingDeviation).toBe(300);
    });

    it('should create both singles and doubles ratings', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        sport: SportType.PICKLEBALL,
        singles: 1450,
        doubles: 1500,
        rd: 350,
      });

      // Assert
      const ratings = await prismaTest.playerRating.findMany({
        where: {
          userId: user.id,
          seasonId: division.seasonId!,
        },
      });

      expect(ratings.length).toBe(2);
      const singlesRating = ratings.find(r => r.gameType === GameType.SINGLES);
      const doublesRating = ratings.find(r => r.gameType === GameType.DOUBLES);

      expect(singlesRating?.currentRating).toBe(1450);
      expect(doublesRating?.currentRating).toBe(1500);
    });

    it('should create rating history entry for initial placement', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        sport: SportType.PICKLEBALL,
        singles: 1500,
        doubles: null,
        rd: 350,
      });

      // Assert
      const rating = await prismaTest.playerRating.findFirst({
        where: {
          userId: user.id,
          seasonId: division.seasonId!,
          gameType: GameType.SINGLES,
        },
      });

      const history = await prismaTest.ratingHistory.findFirst({
        where: { playerRatingId: rating!.id },
      });

      expect(history).toBeDefined();
      expect(history?.reason).toBe(RatingChangeReason.INITIAL_PLACEMENT);
      expect(history?.ratingBefore).toBe(1500); // Default starting rating
      expect(history?.ratingAfter).toBe(1500);
    });

    it('should not duplicate ratings if already exists', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Create initial rating
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        sport: SportType.PICKLEBALL,
        singles: 1500,
        doubles: null,
        rd: 350,
      });

      // Act - Try to create again
      await playerRatingService.createInitialRating({
        userId: user.id,
        seasonId: division.seasonId!,
        sport: SportType.PICKLEBALL,
        singles: 1600, // Different rating
        doubles: null,
        rd: 350,
      });

      // Assert - Should still have only one rating
      const ratings = await prismaTest.playerRating.findMany({
        where: {
          userId: user.id,
          seasonId: division.seasonId!,
          gameType: GameType.SINGLES,
        },
      });

      expect(ratings.length).toBe(1);
      expect(ratings[0].currentRating).toBe(1500); // Original rating kept
    });
  });

  describe('getPlayerRatingSummary', () => {
    it('should return null for both when player has no ratings', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const summary = await playerRatingService.getPlayerRatingSummary(user.id);

      // Assert
      expect(summary.singles).toBeNull();
      expect(summary.doubles).toBeNull();
    });

    it('should return both singles and doubles ratings', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1500,
          isProvisional: true,
          matchesPlayed: 0,
        },
      });

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.DOUBLES,
          currentRating: 1600,
          isProvisional: false,
          matchesPlayed: 10,
        },
      });

      // Act
      const summary = await playerRatingService.getPlayerRatingSummary(user.id);

      // Assert
      expect(summary.singles).toBeDefined();
      expect(summary.singles?.currentRating).toBe(1500);
      expect(summary.doubles).toBeDefined();
      expect(summary.doubles?.currentRating).toBe(1600);
    });
  });

  describe('hasPlayerRating', () => {
    it('should return false when player has no ratings', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const hasRating = await playerRatingService.hasPlayerRating(user.id);

      // Assert
      expect(hasRating).toBe(false);
    });

    it('should return true when player has at least one rating', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1500,
          isProvisional: true,
          matchesPlayed: 0,
        },
      });

      // Act
      const hasRating = await playerRatingService.hasPlayerRating(user.id);

      // Assert
      expect(hasRating).toBe(true);
    });
  });

  describe('getPlayerRatingStats', () => {
    it('should return zero stats when player has no ratings', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const stats = await playerRatingService.getPlayerRatingStats(user.id);

      // Assert
      expect(stats.totalMatches).toBe(0);
      expect(stats.totalDelta).toBe(0);
      expect(stats.avgDelta).toBe(0);
      expect(stats.biggestGain).toBe(0);
      expect(stats.biggestLoss).toBe(0);
    });

    it('should calculate stats from rating history', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      const rating = await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1550,
          isProvisional: false,
          matchesPlayed: 3,
        },
      });

      // Win: +30
      await prismaTest.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: 1500,
          ratingAfter: 1530,
          delta: 30,
          rdBefore: 350,
          rdAfter: 320,
          reason: RatingChangeReason.MATCH_WIN,
        },
      });

      // Win: +25
      await prismaTest.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: 1530,
          ratingAfter: 1555,
          delta: 25,
          rdBefore: 320,
          rdAfter: 290,
          reason: RatingChangeReason.MATCH_WIN,
        },
      });

      // Loss: -5
      await prismaTest.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: 1555,
          ratingAfter: 1550,
          delta: -5,
          rdBefore: 290,
          rdAfter: 260,
          reason: RatingChangeReason.MATCH_LOSS,
        },
      });

      // Act
      const stats = await playerRatingService.getPlayerRatingStats(user.id);

      // Assert
      expect(stats.totalMatches).toBe(3);
      expect(stats.totalDelta).toBe(50); // 30 + 25 - 5
      expect(stats.biggestGain).toBe(30);
      expect(stats.biggestLoss).toBe(-5);
    });
  });
});
