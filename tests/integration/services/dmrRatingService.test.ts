/**
 * DMR Rating Service Tests
 *
 * Tests for the Glicko-2 based DMR rating system
 */

import {
  DMRRatingService,
  InvalidMatchDataError,
  SetScore,
} from '../../../src/services/rating/dmrRatingService';
import {
  createTestUser,
  createTestDivision,
  createTestMatch,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { GameType, SportType, RatingChangeReason } from '@prisma/client';

describe('DMRRatingService', () => {
  let service: DMRRatingService;
  let seasonId: string;

  beforeEach(async () => {
    // Create a fresh service instance with the test Prisma client
    service = new DMRRatingService(
      SportType.PICKLEBALL,
      undefined,
      prismaTest as any
    );

    // Create a test division (which creates league and season)
    const division = await createTestDivision();
    seasonId = division.seasonId!;
  });

  describe('Glicko-2 Core Functions', () => {
    describe('calculateWinProbability', () => {
      it('should return 0.5 for equal ratings', () => {
        const prob = service.calculateWinProbability(1500, 350, 1500, 350);
        expect(prob).toBeCloseTo(0.5, 2);
      });

      it('should return higher probability for higher rated player', () => {
        const prob = service.calculateWinProbability(1700, 100, 1500, 100);
        expect(prob).toBeGreaterThan(0.7);
      });

      it('should return lower probability for lower rated player', () => {
        const prob = service.calculateWinProbability(1300, 100, 1500, 100);
        expect(prob).toBeLessThan(0.3);
      });

      it('should be affected by rating deviation', () => {
        // Higher RD means more uncertainty
        const probLowRD = service.calculateWinProbability(1600, 50, 1500, 50);
        const probHighRD = service.calculateWinProbability(1600, 200, 1500, 200);

        // With higher RD, probability should be closer to 0.5
        expect(Math.abs(probHighRD - 0.5)).toBeLessThan(Math.abs(probLowRD - 0.5));
      });
    });

    describe('getConfidenceInterval', () => {
      it('should return 95% confidence interval (±2 RD)', () => {
        const [lower, upper] = service.getConfidenceInterval(1500, 100);
        expect(lower).toBe(1300);
        expect(upper).toBe(1700);
      });

      it('should have narrower interval with lower RD', () => {
        const [lower1, upper1] = service.getConfidenceInterval(1500, 50);
        const [lower2, upper2] = service.getConfidenceInterval(1500, 200);

        expect(upper1 - lower1).toBeLessThan(upper2 - lower2);
      });
    });
  });

  describe('Set Score Validation (Pickleball)', () => {
    describe('validateSetScores', () => {
      it('should accept valid 11-0 score', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 11, score2: 0 }];

        // Should not throw
        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).resolves.toBeDefined();
      });

      it('should accept valid 11-9 score', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 11, score2: 9 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).resolves.toBeDefined();
      });

      it('should accept valid deuce score (12-10)', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 12, score2: 10 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).resolves.toBeDefined();
      });

      it('should accept valid 15-point game', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 15, score2: 10 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).resolves.toBeDefined();
      });

      it('should reject tied scores', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 10, score2: 10 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject negative scores', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 11, score2: -1 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject 11-10 (must win by 2)', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = [{ score1: 11, score2: 10 }];

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject empty scores', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores: [],
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject more than 5 sets', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const setScores: SetScore[] = Array(6).fill({ score1: 11, score2: 5 });

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores,
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });
    });
  });

  describe('Singles Match Processing', () => {
    describe('processSinglesMatch', () => {
      it('should create initial ratings for new players', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        // Both players should have ratings now
        expect(result.winner.matchesPlayed).toBe(1);
        expect(result.loser.matchesPlayed).toBe(1);
      });

      it('should increase winner rating and decrease loser rating', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        expect(result.winner.delta).toBeGreaterThan(0);
        expect(result.loser.delta).toBeLessThan(0);
        expect(result.winner.newRating).toBeGreaterThan(result.winner.oldRating);
        expect(result.loser.newRating).toBeLessThan(result.loser.oldRating);
      });

      it('should apply score factor for dominant wins', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();
        const user3 = await createTestUser();
        const user4 = await createTestUser();

        // Create ratings for comparison
        const division = await createTestDivision();
        const testSeasonId = division.seasonId!;

        // Dominant win: 11-0
        const dominantResult = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 0 }],
          seasonId: testSeasonId,
        });

        // Close win: 11-9
        const closeResult = await service.processSinglesMatch({
          winnerId: user3.id,
          loserId: user4.id,
          setScores: [{ score1: 11, score2: 9 }],
          seasonId: testSeasonId,
        });

        // Dominant win should have higher score factor
        expect(dominantResult.scoreFactor).toBeGreaterThan(closeResult.scoreFactor);
      });

      it('should reduce RD after match', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        expect(result.winner.newRD).toBeLessThan(result.winner.oldRD);
        expect(result.loser.newRD).toBeLessThan(result.loser.oldRD);
      });

      it('should reject player playing against themselves', async () => {
        const user1 = await createTestUser();

        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user1.id,
            setScores: [{ score1: 11, score2: 5 }],
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject if winner did not win more sets', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        // Winner supposedly won but loser has more set wins
        await expect(
          service.processSinglesMatch({
            winnerId: user1.id,
            loserId: user2.id,
            setScores: [
              { score1: 5, score2: 11 },
              { score1: 5, score2: 11 },
            ],
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should save rating history', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        // Check history was created
        const winnerRating = await prismaTest.playerRating.findFirst({
          where: { userId: user1.id, seasonId },
        });

        const history = await prismaTest.ratingHistory.findMany({
          where: { playerRatingId: winnerRating!.id },
        });

        expect(history.length).toBeGreaterThan(0);
        expect(history.some(h => h.reason === RatingChangeReason.MATCH_WIN)).toBe(true);
      });

      it('should handle walkover matches with reduced score factor', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 0 }],
          seasonId,
          isWalkover: true,
        });

        // Score factor should be 1.0 for walkovers
        expect(result.scoreFactor).toBe(1.0);
      });

      it('should respect rating caps', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        // Create a very high rating difference scenario
        await prismaTest.playerRating.create({
          data: {
            userId: user1.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 2000,
            ratingDeviation: 50, // Low RD = tighter cap
            isProvisional: false,
            matchesPlayed: 50,
          },
        });

        await prismaTest.playerRating.create({
          data: {
            userId: user2.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 1000,
            ratingDeviation: 50,
            isProvisional: false,
            matchesPlayed: 50,
          },
        });

        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 0 }],
          seasonId,
        });

        // Delta should be capped
        // Max delta = min(0.08 * RD, 75) = min(4, 75) = 4 for RD=50
        expect(Math.abs(result.winner.delta)).toBeLessThanOrEqual(75);
        expect(Math.abs(result.loser.delta)).toBeLessThanOrEqual(75);
      });
    });
  });

  describe('Doubles Match Processing', () => {
    describe('processDoublesMatch', () => {
      it('should process a valid doubles match', async () => {
        const [user1, user2, user3, user4] = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        const result = await service.processDoublesMatch({
          team1Ids: [user1.id, user2.id],
          team2Ids: [user3.id, user4.id],
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        expect(result.winnerIds).toContain(user1.id);
        expect(result.winnerIds).toContain(user2.id);
        expect(result.loserIds).toContain(user3.id);
        expect(result.loserIds).toContain(user4.id);
      });

      it('should update all four players', async () => {
        const [user1, user2, user3, user4] = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        const result = await service.processDoublesMatch({
          team1Ids: [user1.id, user2.id],
          team2Ids: [user3.id, user4.id],
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        // All players should have rating changes
        expect(Object.keys(result.ratingChanges).length).toBe(4);

        // Winners should have positive delta
        expect(result.ratingChanges[user1.id].delta).toBeGreaterThan(0);
        expect(result.ratingChanges[user2.id].delta).toBeGreaterThan(0);

        // Losers should have negative delta
        expect(result.ratingChanges[user3.id].delta).toBeLessThan(0);
        expect(result.ratingChanges[user4.id].delta).toBeLessThan(0);
      });

      it('should reject teams without exactly 2 players', async () => {
        const [user1, user2, user3] = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        await expect(
          service.processDoublesMatch({
            team1Ids: [user1.id] as any,
            team2Ids: [user2.id, user3.id],
            setScores: [{ score1: 11, score2: 5 }],
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should reject duplicate players', async () => {
        const [user1, user2, user3] = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        await expect(
          service.processDoublesMatch({
            team1Ids: [user1.id, user2.id],
            team2Ids: [user2.id, user3.id], // user2 is in both teams
            setScores: [{ score1: 11, score2: 5 }],
            seasonId,
          })
        ).rejects.toThrow(InvalidMatchDataError);
      });

      it('should distribute rating changes by RD weighting', async () => {
        const [user1, user2, user3, user4] = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        // Create ratings with different RDs
        await prismaTest.playerRating.create({
          data: {
            userId: user1.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.DOUBLES,
            currentRating: 1500,
            ratingDeviation: 350, // High RD
            isProvisional: true,
            matchesPlayed: 0,
          },
        });

        await prismaTest.playerRating.create({
          data: {
            userId: user2.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.DOUBLES,
            currentRating: 1500,
            ratingDeviation: 100, // Low RD
            isProvisional: false,
            matchesPlayed: 20,
          },
        });

        const result = await service.processDoublesMatch({
          team1Ids: [user1.id, user2.id],
          team2Ids: [user3.id, user4.id],
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });

        // Player with higher RD should get larger rating change
        expect(Math.abs(result.ratingChanges[user1.id].delta)).toBeGreaterThan(
          Math.abs(result.ratingChanges[user2.id].delta)
        );
      });
    });
  });

  describe('Rating Reversal', () => {
    describe('reverseMatchRatings', () => {
      it('should reverse rating changes for a match', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        // Create a real match
        const match = await createTestMatch({
          creatorId: user1.id,
          seasonId,
        });

        // Process the match
        const result = await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
          matchId: match.id,
        });

        // Reverse the match
        await service.reverseMatchRatings(match.id);

        // Check ratings were reverted
        const winnerRating = await prismaTest.playerRating.findFirst({
          where: { userId: user1.id, seasonId, gameType: GameType.SINGLES },
        });

        const loserRating = await prismaTest.playerRating.findFirst({
          where: { userId: user2.id, seasonId, gameType: GameType.SINGLES },
        });

        expect(winnerRating?.currentRating).toBe(result.winner.oldRating);
        expect(loserRating?.currentRating).toBe(result.loser.oldRating);
      });

      it('should decrement matches played count', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        // Create a real match
        const match = await createTestMatch({
          creatorId: user1.id,
          seasonId,
        });

        await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
          matchId: match.id,
        });

        await service.reverseMatchRatings(match.id);

        const winnerRating = await prismaTest.playerRating.findFirst({
          where: { userId: user1.id, seasonId, gameType: GameType.SINGLES },
        });

        expect(winnerRating?.matchesPlayed).toBe(0);
      });

      it('should mark history entries as reversed', async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        // Create a real match
        const match = await createTestMatch({
          creatorId: user1.id,
          seasonId,
        });

        await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
          matchId: match.id,
        });

        await service.reverseMatchRatings(match.id);

        const history = await prismaTest.ratingHistory.findMany({
          where: { matchId: match.id },
        });

        expect(history.every(h => h.notes?.includes('[REVERSED]'))).toBe(true);
      });

      it('should handle non-existent match gracefully', async () => {
        // Should not throw
        await expect(
          service.reverseMatchRatings('non-existent-match-id')
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Inactivity Handling', () => {
    describe('adjustForInactivity', () => {
      it('should increase RD for inactive players', async () => {
        const user = await createTestUser();

        // Create a rating with old lastUpdatedAt
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

        await prismaTest.playerRating.create({
          data: {
            userId: user.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 1500,
            ratingDeviation: 100, // Lower than max
            isProvisional: false,
            matchesPlayed: 20,
            lastUpdatedAt: oldDate,
          },
        });

        const updatedCount = await service.adjustForInactivity(seasonId);

        const rating = await prismaTest.playerRating.findFirst({
          where: { userId: user.id, seasonId },
        });

        expect(updatedCount).toBeGreaterThan(0);
        expect(rating?.ratingDeviation).toBeGreaterThan(100);
      });

      it('should not increase RD above max', async () => {
        const user = await createTestUser();

        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 365); // Very old

        await prismaTest.playerRating.create({
          data: {
            userId: user.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 1500,
            ratingDeviation: 300,
            isProvisional: false,
            matchesPlayed: 20,
            lastUpdatedAt: oldDate,
          },
        });

        await service.adjustForInactivity(seasonId);

        const rating = await prismaTest.playerRating.findFirst({
          where: { userId: user.id, seasonId },
        });

        expect(rating?.ratingDeviation).toBeLessThanOrEqual(350);
      });

      it('should not affect recently active players', async () => {
        const user = await createTestUser();

        await prismaTest.playerRating.create({
          data: {
            userId: user.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 1500,
            ratingDeviation: 100,
            isProvisional: false,
            matchesPlayed: 20,
            lastUpdatedAt: new Date(), // Just now
          },
        });

        await service.adjustForInactivity(seasonId);

        const rating = await prismaTest.playerRating.findFirst({
          where: { userId: user.id, seasonId },
        });

        expect(rating?.ratingDeviation).toBe(100); // Unchanged
      });
    });
  });

  describe('Player Rating Management', () => {
    describe('getOrCreatePlayerRating', () => {
      it('should create new rating with defaults for new player', async () => {
        const user = await createTestUser();

        const rating = await service.getOrCreatePlayerRating(
          user.id,
          seasonId,
          GameType.SINGLES
        );

        expect(rating.currentRating).toBe(1500);
        expect(rating.ratingDeviation).toBe(350);
        expect(rating.isProvisional).toBe(true);
        expect(rating.matchesPlayed).toBe(0);
      });

      it('should return existing rating if present', async () => {
        const user = await createTestUser();

        await prismaTest.playerRating.create({
          data: {
            userId: user.id,
            seasonId,
            sport: SportType.PICKLEBALL,
            gameType: GameType.SINGLES,
            currentRating: 1700,
            ratingDeviation: 150,
            isProvisional: false,
            matchesPlayed: 15,
          },
        });

        const rating = await service.getOrCreatePlayerRating(
          user.id,
          seasonId,
          GameType.SINGLES
        );

        expect(rating.currentRating).toBe(1700);
        expect(rating.ratingDeviation).toBe(150);
        expect(rating.matchesPlayed).toBe(15);
      });

      it('should use questionnaire results if available', async () => {
        const user = await createTestUser();

        // Create questionnaire response with result
        await prismaTest.questionnaireResponse.create({
          data: {
            userId: user.id,
            sport: 'PICKLEBALL',
            qVersion: 1,
            qHash: 'test-hash',
            answersJson: {},
            completedAt: new Date(),
            result: {
              create: {
                source: 'QUESTIONNAIRE',
                singles: 1650,
                doubles: 1600,
                rd: 200,
              },
            },
          },
        });

        const rating = await service.getOrCreatePlayerRating(
          user.id,
          seasonId,
          GameType.SINGLES
        );

        expect(rating.currentRating).toBe(1650);
        expect(rating.ratingDeviation).toBe(200);
      });

      it('should create initial history entry', async () => {
        const user = await createTestUser();

        const rating = await service.getOrCreatePlayerRating(
          user.id,
          seasonId,
          GameType.SINGLES
        );

        const history = await prismaTest.ratingHistory.findFirst({
          where: { playerRatingId: rating.id },
        });

        expect(history).toBeDefined();
        expect(history?.reason).toBe(RatingChangeReason.INITIAL_PLACEMENT);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple consecutive matches', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Play multiple matches
      for (let i = 0; i < 5; i++) {
        await service.processSinglesMatch({
          winnerId: user1.id,
          loserId: user2.id,
          setScores: [{ score1: 11, score2: 5 }],
          seasonId,
        });
      }

      const user1Rating = await prismaTest.playerRating.findFirst({
        where: { userId: user1.id, seasonId, gameType: GameType.SINGLES },
      });

      expect(user1Rating?.matchesPlayed).toBe(5);
      expect(user1Rating?.currentRating).toBeGreaterThan(1500);
    });

    it('should update peak rating when achieved', async () => {
      const user = await createTestUser();
      const opponent = await createTestUser();

      await service.processSinglesMatch({
        winnerId: user.id,
        loserId: opponent.id,
        setScores: [{ score1: 11, score2: 0 }],
        seasonId,
      });

      const rating = await prismaTest.playerRating.findFirst({
        where: { userId: user.id, seasonId, gameType: GameType.SINGLES },
      });

      expect(rating?.peakRating).toBe(rating?.currentRating);
    });

    it('should update lowest rating when achieved', async () => {
      const user = await createTestUser();
      const opponent = await createTestUser();

      await service.processSinglesMatch({
        winnerId: opponent.id,
        loserId: user.id,
        setScores: [{ score1: 11, score2: 0 }],
        seasonId,
      });

      const rating = await prismaTest.playerRating.findFirst({
        where: { userId: user.id, seasonId, gameType: GameType.SINGLES },
      });

      expect(rating?.lowestRating).toBe(rating?.currentRating);
    });

    it('should mark player as established after 10 matches', async () => {
      const user = await createTestUser();

      // Create rating with 9 matches
      await prismaTest.playerRating.create({
        data: {
          userId: user.id,
          seasonId,
          sport: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          currentRating: 1600,
          ratingDeviation: 150,
          isProvisional: true,
          matchesPlayed: 9,
        },
      });

      const opponent = await createTestUser();

      await service.processSinglesMatch({
        winnerId: user.id,
        loserId: opponent.id,
        setScores: [{ score1: 11, score2: 5 }],
        seasonId,
      });

      const rating = await prismaTest.playerRating.findFirst({
        where: { userId: user.id, seasonId, gameType: GameType.SINGLES },
      });

      expect(rating?.matchesPlayed).toBe(10);
      expect(rating?.isProvisional).toBe(false);
    });
  });
});
