/**
 * Standings Calculation Service Tests
 *
 * Tests for division standings, points calculation, and tie-breakers
 * Includes tests for both the basic StandingsCalculationService
 * and the advanced StandingsV2Service
 */

import { MatchStatus, InvitationStatus } from '@prisma/client';
import {
  createTestUser,
  createTestDivision,
  createMatchWithOpponent,
  prismaTest,
} from '../../helpers/serviceHelpers';

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
  calculateStandingsPoints,
  updatePlayerStanding,
  updateMatchStandings,
  recalculateDivisionRanks,
  getDivisionStandings,
  getPlayerStanding,
  recalculateDivisionStandings,
  MatchResult,
} from '../../../src/services/rating/standingsCalculationService';

describe('StandingsCalculationService', () => {
  describe('calculateStandingsPoints', () => {
    it('should return 0 points for no wins or matches', () => {
      const points = calculateStandingsPoints(0, 0, 0);

      expect(points.winPoints).toBe(0);
      expect(points.setPoints).toBe(0);
      expect(points.completionBonus).toBe(0);
      expect(points.totalPoints).toBe(0);
    });

    it('should give 3 points per win', () => {
      const points = calculateStandingsPoints(1, 2, 1);

      expect(points.winPoints).toBe(3);
    });

    it('should give 6 points for 2 wins', () => {
      const points = calculateStandingsPoints(2, 4, 2);

      expect(points.winPoints).toBe(6);
    });

    it('should cap wins at 7 (max 21 win points)', () => {
      const points = calculateStandingsPoints(10, 20, 10);

      expect(points.winPoints).toBe(21); // 7 * 3 = 21
    });

    it('should not count set points until 7 wins reached', () => {
      const points = calculateStandingsPoints(6, 12, 6);

      expect(points.setPoints).toBe(0);
    });

    it('should count set points after 7 wins', () => {
      const points = calculateStandingsPoints(7, 14, 7);

      expect(points.setPoints).toBe(14);
    });

    it('should count all sets won after 7 wins', () => {
      const points = calculateStandingsPoints(8, 20, 8);

      expect(points.setPoints).toBe(20);
    });

    it('should give +1 completion bonus per match', () => {
      const points = calculateStandingsPoints(0, 0, 3);

      expect(points.completionBonus).toBe(3);
    });

    it('should give +2 bonus at 4 matches', () => {
      const points = calculateStandingsPoints(0, 0, 4);

      // 4 base + 1 bonus = 5
      expect(points.completionBonus).toBe(5);
    });

    it('should give +3 bonus at 9 matches', () => {
      const points = calculateStandingsPoints(0, 0, 9);

      // 9 base + 1 (at 4) + 1 (at 9) = 11
      expect(points.completionBonus).toBe(11);
    });

    it('should calculate total points correctly', () => {
      // 5 wins * 3 = 15 win points
      // 0 set points (under 7 wins)
      // 5 matches = 5 + 1 (at 4) = 6 completion bonus
      const points = calculateStandingsPoints(5, 10, 5);

      expect(points.totalPoints).toBe(15 + 0 + 6); // 21
    });

    it('should calculate full scenario with 7+ wins', () => {
      // 8 wins capped at 7 * 3 = 21 win points
      // 16 set points
      // 8 matches = 8 + 1 (at 4) = 9 completion bonus
      const points = calculateStandingsPoints(8, 16, 8);

      expect(points.winPoints).toBe(21);
      expect(points.setPoints).toBe(16);
      expect(points.completionBonus).toBe(9);
      expect(points.totalPoints).toBe(46);
    });
  });

  describe('updatePlayerStanding', () => {
    it('should create standing if it does not exist', async () => {
      const user = await createTestUser();
      const division = await createTestDivision();
      const opponent = await createTestUser({ name: 'Opponent' });

      const matchResult: MatchResult = {
        odlayerId: user.id,
        odversaryId: opponent.id,
        userWon: true,
        userSetsWon: 2,
        userSetsLost: 0,
        userGamesWon: 22,
        userGamesLost: 10,
      };

      await updatePlayerStanding(user.id, division.id, matchResult);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id, divisionId: division.id },
      });

      expect(standing).toBeDefined();
      expect(standing?.wins).toBe(1);
      expect(standing?.losses).toBe(0);
      expect(standing?.matchesPlayed).toBe(1);
    });

    it('should update existing standing', async () => {
      const user = await createTestUser();
      const division = await createTestDivision();
      const opponent = await createTestUser({ name: 'Opponent' });

      // Create initial standing
      await prismaTest.divisionStanding.create({
        data: {
          userId: user.id,
          divisionId: division.id,
          seasonId: division.seasonId!,
          rank: 1,
          wins: 2,
          losses: 1,
          matchesPlayed: 3,
          matchesScheduled: 9,
          winPoints: 6,
          setPoints: 0,
          completionBonus: 3,
          totalPoints: 9,
          setsWon: 4,
          setsLost: 2,
          setDifferential: 2,
          headToHead: {},
        },
      });

      const matchResult: MatchResult = {
        odlayerId: user.id,
        odversaryId: opponent.id,
        userWon: true,
        userSetsWon: 2,
        userSetsLost: 1,
        userGamesWon: 24,
        userGamesLost: 15,
      };

      await updatePlayerStanding(user.id, division.id, matchResult);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id, divisionId: division.id },
      });

      expect(standing?.wins).toBe(3);
      expect(standing?.losses).toBe(1);
      expect(standing?.matchesPlayed).toBe(4);
      expect(standing?.setsWon).toBe(6);
      expect(standing?.setsLost).toBe(3);
    });

    it('should update head-to-head record', async () => {
      const user = await createTestUser();
      const division = await createTestDivision();
      const opponent = await createTestUser({ name: 'Opponent' });

      const matchResult: MatchResult = {
        odlayerId: user.id,
        odversaryId: opponent.id,
        userWon: true,
        userSetsWon: 2,
        userSetsLost: 1,
        userGamesWon: 24,
        userGamesLost: 15,
      };

      await updatePlayerStanding(user.id, division.id, matchResult);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id, divisionId: division.id },
      });

      const h2h = standing?.headToHead as Record<string, any>;
      expect(h2h[opponent.id]).toBeDefined();
      expect(h2h[opponent.id].wins).toBe(1);
      expect(h2h[opponent.id].losses).toBe(0);
      expect(h2h[opponent.id].setsWon).toBe(2);
      expect(h2h[opponent.id].setsLost).toBe(1);
    });

    it('should accumulate head-to-head against same opponent', async () => {
      const user = await createTestUser();
      const division = await createTestDivision();
      const opponent = await createTestUser({ name: 'Opponent' });

      // First match
      await updatePlayerStanding(user.id, division.id, {
        odlayerId: user.id,
        odversaryId: opponent.id,
        userWon: true,
        userSetsWon: 2,
        userSetsLost: 0,
        userGamesWon: 22,
        userGamesLost: 10,
      });

      // Second match against same opponent
      await updatePlayerStanding(user.id, division.id, {
        odlayerId: user.id,
        odversaryId: opponent.id,
        userWon: false,
        userSetsWon: 1,
        userSetsLost: 2,
        userGamesWon: 18,
        userGamesLost: 22,
      });

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id, divisionId: division.id },
      });

      const h2h = standing?.headToHead as Record<string, any>;
      expect(h2h[opponent.id].wins).toBe(1);
      expect(h2h[opponent.id].losses).toBe(1);
      expect(h2h[opponent.id].setsWon).toBe(3);
      expect(h2h[opponent.id].setsLost).toBe(2);
    });
  });

  describe('updateMatchStandings', () => {
    it('should update standings for both players after a match', async () => {
      const { match, creator, opponent } = await createMatchWithOpponent();

      // Accept opponent invitation
      await prismaTest.matchParticipant.updateMany({
        where: { matchId: match.id, userId: opponent.id },
        data: { invitationStatus: InvitationStatus.ACCEPTED },
      });

      // Add scores
      await prismaTest.matchScore.createMany({
        data: [
          { matchId: match.id, setNumber: 1, player1Games: 11, player2Games: 5 },
          { matchId: match.id, setNumber: 2, player1Games: 11, player2Games: 7 },
        ],
      });

      // Complete the match
      await prismaTest.match.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.COMPLETED,
          outcome: 'team1',
          team1Score: 2,
          team2Score: 0,
        },
      });

      await updateMatchStandings(match.id);

      // Check creator's standing
      const creatorStanding = await prismaTest.divisionStanding.findFirst({
        where: { userId: creator.id, divisionId: match.divisionId! },
      });

      expect(creatorStanding).toBeDefined();
      expect(creatorStanding?.wins).toBe(1);
      expect(creatorStanding?.losses).toBe(0);
      expect(creatorStanding?.setsWon).toBe(2);
      expect(creatorStanding?.setsLost).toBe(0);

      // Check opponent's standing
      const opponentStanding = await prismaTest.divisionStanding.findFirst({
        where: { userId: opponent.id, divisionId: match.divisionId! },
      });

      expect(opponentStanding).toBeDefined();
      expect(opponentStanding?.wins).toBe(0);
      expect(opponentStanding?.losses).toBe(1);
      expect(opponentStanding?.setsWon).toBe(0);
      expect(opponentStanding?.setsLost).toBe(2);
    });

    it('should not update for non-completed match', async () => {
      const { match, creator } = await createMatchWithOpponent();

      // Match is still SCHEDULED
      await updateMatchStandings(match.id);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: creator.id, divisionId: match.divisionId! },
      });

      expect(standing).toBeNull();
    });

    it('should not update for match without division', async () => {
      const user = await createTestUser();
      const division = await createTestDivision();

      // Create match without division
      const match = await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          matchDate: new Date(),
          status: MatchStatus.COMPLETED,
          outcome: 'team1',
          createdById: user.id,
          seasonId: division.seasonId,
          leagueId: division.leagueId,
          // No divisionId
        },
      });

      await updateMatchStandings(match.id);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id },
      });

      expect(standing).toBeNull();
    });
  });

  describe('recalculateDivisionRanks', () => {
    it('should rank players by total points', async () => {
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Player 1' });
      const user2 = await createTestUser({ name: 'Player 2' });
      const user3 = await createTestUser({ name: 'Player 3' });

      // Create standings with different points
      await prismaTest.divisionStanding.createMany({
        data: [
          {
            userId: user1.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 5,
            losses: 2,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 23,
            setsWon: 10,
            setsLost: 4,
            setDifferential: 6,
            headToHead: {},
          },
          {
            userId: user2.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 7,
            losses: 1,
            matchesPlayed: 8,
            matchesScheduled: 9,
            winPoints: 21,
            setPoints: 0,
            completionBonus: 9,
            totalPoints: 30,
            setsWon: 14,
            setsLost: 2,
            setDifferential: 12,
            headToHead: {},
          },
          {
            userId: user3.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 3,
            losses: 4,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 9,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 17,
            setsWon: 6,
            setsLost: 8,
            setDifferential: -2,
            headToHead: {},
          },
        ],
      });

      await recalculateDivisionRanks(division.id);

      const standings = await prismaTest.divisionStanding.findMany({
        where: { divisionId: division.id },
        orderBy: { rank: 'asc' },
      });

      expect(standings[0].userId).toBe(user2.id); // 30 points - rank 1
      expect(standings[1].userId).toBe(user1.id); // 23 points - rank 2
      expect(standings[2].userId).toBe(user3.id); // 17 points - rank 3

      expect(standings[0].rank).toBe(1);
      expect(standings[1].rank).toBe(2);
      expect(standings[2].rank).toBe(3);
    });

    it('should use sets won as tiebreaker', async () => {
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Player 1' });
      const user2 = await createTestUser({ name: 'Player 2' });

      // Same total points, different sets won
      await prismaTest.divisionStanding.createMany({
        data: [
          {
            userId: user1.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 5,
            losses: 2,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 23,
            setsWon: 10,
            setsLost: 4,
            setDifferential: 6,
            headToHead: {},
          },
          {
            userId: user2.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 5,
            losses: 2,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 23,
            setsWon: 12, // More sets won
            setsLost: 4,
            setDifferential: 8,
            headToHead: {},
          },
        ],
      });

      await recalculateDivisionRanks(division.id);

      const standings = await prismaTest.divisionStanding.findMany({
        where: { divisionId: division.id },
        orderBy: { rank: 'asc' },
      });

      expect(standings[0].userId).toBe(user2.id); // More sets won - rank 1
      expect(standings[1].userId).toBe(user1.id); // rank 2
    });

    it('should use set differential as final tiebreaker', async () => {
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Player 1' });
      const user2 = await createTestUser({ name: 'Player 2' });

      // Same total points and sets won, different set differential
      await prismaTest.divisionStanding.createMany({
        data: [
          {
            userId: user1.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 5,
            losses: 2,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 23,
            setsWon: 10,
            setsLost: 6,
            setDifferential: 4,
            headToHead: {},
          },
          {
            userId: user2.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 0,
            wins: 5,
            losses: 2,
            matchesPlayed: 7,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 8,
            totalPoints: 23,
            setsWon: 10,
            setsLost: 4,
            setDifferential: 6, // Better differential
            headToHead: {},
          },
        ],
      });

      await recalculateDivisionRanks(division.id);

      const standings = await prismaTest.divisionStanding.findMany({
        where: { divisionId: division.id },
        orderBy: { rank: 'asc' },
      });

      expect(standings[0].userId).toBe(user2.id); // Better differential - rank 1
      expect(standings[1].userId).toBe(user1.id); // rank 2
    });
  });

  describe('getDivisionStandings', () => {
    it('should return standings sorted by rank', async () => {
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Top Player' });
      const user2 = await createTestUser({ name: 'Middle Player' });
      const user3 = await createTestUser({ name: 'Bottom Player' });

      await prismaTest.divisionStanding.createMany({
        data: [
          {
            userId: user1.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 1,
            wins: 7,
            losses: 1,
            matchesPlayed: 8,
            matchesScheduled: 9,
            winPoints: 21,
            setPoints: 0,
            completionBonus: 9,
            totalPoints: 30,
            setsWon: 14,
            setsLost: 2,
            setDifferential: 12,
            headToHead: {},
          },
          {
            userId: user2.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 2,
            wins: 5,
            losses: 3,
            matchesPlayed: 8,
            matchesScheduled: 9,
            winPoints: 15,
            setPoints: 0,
            completionBonus: 9,
            totalPoints: 24,
            setsWon: 10,
            setsLost: 6,
            setDifferential: 4,
            headToHead: {},
          },
          {
            userId: user3.id,
            divisionId: division.id,
            seasonId: division.seasonId!,
            rank: 3,
            wins: 2,
            losses: 6,
            matchesPlayed: 8,
            matchesScheduled: 9,
            winPoints: 6,
            setPoints: 0,
            completionBonus: 9,
            totalPoints: 15,
            setsWon: 4,
            setsLost: 12,
            setDifferential: -8,
            headToHead: {},
          },
        ],
      });

      const standings = await getDivisionStandings(division.id);

      expect(standings).toHaveLength(3);
      expect(standings[0].rank).toBe(1);
      expect(standings[0].odlayerName).toBe('Top Player');
      expect(standings[1].rank).toBe(2);
      expect(standings[1].odlayerName).toBe('Middle Player');
      expect(standings[2].rank).toBe(3);
      expect(standings[2].odlayerName).toBe('Bottom Player');
    });

    it('should return empty array for empty division', async () => {
      const division = await createTestDivision();

      const standings = await getDivisionStandings(division.id);

      expect(standings).toHaveLength(0);
    });

    it('should calculate matches remaining', async () => {
      const division = await createTestDivision();
      const user = await createTestUser();

      await prismaTest.divisionStanding.create({
        data: {
          userId: user.id,
          divisionId: division.id,
          seasonId: division.seasonId!,
          rank: 1,
          wins: 3,
          losses: 2,
          matchesPlayed: 5,
          matchesScheduled: 9,
          winPoints: 9,
          setPoints: 0,
          completionBonus: 6,
          totalPoints: 15,
          setsWon: 6,
          setsLost: 4,
          setDifferential: 2,
          headToHead: {},
        },
      });

      const standings = await getDivisionStandings(division.id);

      expect(standings[0].matchesRemaining).toBe(4); // 9 - 5
    });
  });

  describe('getPlayerStanding', () => {
    it('should return player standing', async () => {
      const division = await createTestDivision();
      const user = await createTestUser({ name: 'Test Player' });

      await prismaTest.divisionStanding.create({
        data: {
          userId: user.id,
          divisionId: division.id,
          seasonId: division.seasonId!,
          rank: 1,
          wins: 5,
          losses: 2,
          matchesPlayed: 7,
          matchesScheduled: 9,
          winPoints: 15,
          setPoints: 0,
          completionBonus: 8,
          totalPoints: 23,
          setsWon: 10,
          setsLost: 4,
          setDifferential: 6,
          headToHead: {},
        },
      });

      const standing = await getPlayerStanding(user.id, division.id);

      expect(standing).toBeDefined();
      expect(standing?.odlayerName).toBe('Test Player');
      expect(standing?.wins).toBe(5);
      expect(standing?.losses).toBe(2);
      expect(standing?.totalPoints).toBe(23);
    });

    it('should return null for non-existent player', async () => {
      const division = await createTestDivision();

      const standing = await getPlayerStanding('non-existent-user', division.id);

      expect(standing).toBeNull();
    });
  });

  describe('recalculateDivisionStandings', () => {
    it('should reset and recalculate all standings', async () => {
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Player 1' });
      const user2 = await createTestUser({ name: 'Player 2' });

      // Create initial standings (potentially incorrect)
      await prismaTest.divisionStanding.create({
        data: {
          userId: user1.id,
          divisionId: division.id,
          seasonId: division.seasonId!,
          rank: 1,
          wins: 10, // Incorrect
          losses: 0,
          matchesPlayed: 10,
          matchesScheduled: 9,
          winPoints: 30,
          setPoints: 0,
          completionBonus: 12,
          totalPoints: 42,
          setsWon: 20,
          setsLost: 0,
          setDifferential: 20,
          headToHead: {},
        },
      });

      // Create a completed match
      const match = await prismaTest.match.create({
        data: {
          sport: 'PICKLEBALL',
          matchType: 'SINGLES',
          matchDate: new Date(),
          status: MatchStatus.COMPLETED,
          outcome: 'team1',
          team1Score: 2,
          team2Score: 0,
          createdById: user1.id,
          divisionId: division.id,
          seasonId: division.seasonId,
          leagueId: division.leagueId,
          participants: {
            create: [
              { userId: user1.id, team: 'team1', role: 'CREATOR', invitationStatus: 'ACCEPTED' },
              { userId: user2.id, team: 'team2', role: 'OPPONENT', invitationStatus: 'ACCEPTED' },
            ],
          },
        },
      });

      await prismaTest.matchScore.createMany({
        data: [
          { matchId: match.id, setNumber: 1, player1Games: 11, player2Games: 5 },
          { matchId: match.id, setNumber: 2, player1Games: 11, player2Games: 7 },
        ],
      });

      await recalculateDivisionStandings(division.id);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user1.id, divisionId: division.id },
      });

      // Should be reset to 1 win from the one completed match
      expect(standing?.wins).toBe(1);
      expect(standing?.losses).toBe(0);
      expect(standing?.matchesPlayed).toBe(1);
    });

    it('should handle division with no completed matches', async () => {
      const division = await createTestDivision();
      const user = await createTestUser();

      // Create standing
      await prismaTest.divisionStanding.create({
        data: {
          userId: user.id,
          divisionId: division.id,
          seasonId: division.seasonId!,
          rank: 1,
          wins: 5,
          losses: 2,
          matchesPlayed: 7,
          matchesScheduled: 9,
          winPoints: 15,
          setPoints: 0,
          completionBonus: 8,
          totalPoints: 23,
          setsWon: 10,
          setsLost: 4,
          setDifferential: 6,
          headToHead: {},
        },
      });

      await recalculateDivisionStandings(division.id);

      const standing = await prismaTest.divisionStanding.findFirst({
        where: { userId: user.id, divisionId: division.id },
      });

      // Should be reset to 0 (no completed matches)
      expect(standing?.wins).toBe(0);
      expect(standing?.losses).toBe(0);
      expect(standing?.matchesPlayed).toBe(0);
      expect(standing?.totalPoints).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle player with maximum wins scenario', async () => {
      // 9 wins in a 9-match season
      const points = calculateStandingsPoints(9, 18, 9);

      expect(points.winPoints).toBe(21); // Capped at 7 wins
      expect(points.setPoints).toBe(18); // Set points count after 7 wins
      expect(points.completionBonus).toBe(11); // 9 + 1 + 1
      expect(points.totalPoints).toBe(50);
    });

    it('should handle player with all losses', async () => {
      const points = calculateStandingsPoints(0, 0, 9);

      expect(points.winPoints).toBe(0);
      expect(points.setPoints).toBe(0);
      expect(points.completionBonus).toBe(11); // Still gets completion bonus
      expect(points.totalPoints).toBe(11);
    });

    it('should handle decimal set calculations', async () => {
      // This ensures no floating point issues
      const points = calculateStandingsPoints(7, 15, 8);

      expect(Number.isInteger(points.totalPoints)).toBe(true);
    });
  });
});

describe('StandingsV2Service', () => {
  // Import after other tests to avoid module conflicts
  let StandingsV2Service: any;

  beforeAll(async () => {
    // Dynamically import to avoid conflicts with mocked modules
    const module = await import('../../../src/services/rating/standingsV2Service');
    StandingsV2Service = module.StandingsV2Service;
  });

  describe('sortByTiebreakers', () => {
    it('should sort by total points first', async () => {
      const service = new StandingsV2Service();

      // Access private method via any type
      const players = [
        { standingId: '1', userId: 'a', name: 'Player A', metrics: { totalPoints: 20, headToHead: {}, setWinPct: 50, gameWinPct: 50 } },
        { standingId: '2', userId: 'b', name: 'Player B', metrics: { totalPoints: 30, headToHead: {}, setWinPct: 50, gameWinPct: 50 } },
        { standingId: '3', userId: 'c', name: 'Player C', metrics: { totalPoints: 25, headToHead: {}, setWinPct: 50, gameWinPct: 50 } },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      expect(sorted[0].userId).toBe('b'); // 30 points
      expect(sorted[1].userId).toBe('c'); // 25 points
      expect(sorted[2].userId).toBe('a'); // 20 points
    });

    it('should use head-to-head for 2-way tie', async () => {
      const service = new StandingsV2Service();

      const players = [
        {
          standingId: '1',
          userId: 'a',
          name: 'Player A',
          metrics: {
            totalPoints: 25,
            headToHead: { b: { wins: 2, losses: 1 } },
            setWinPct: 50,
            gameWinPct: 50,
          },
        },
        {
          standingId: '2',
          userId: 'b',
          name: 'Player B',
          metrics: {
            totalPoints: 25,
            headToHead: { a: { wins: 1, losses: 2 } },
            setWinPct: 60,
            gameWinPct: 60,
          },
        },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      // Player A wins H2H even though B has better set/game %
      expect(sorted[0].userId).toBe('a');
      expect(sorted[1].userId).toBe('b');
    });

    it('should use set win percentage when H2H is tied', async () => {
      const service = new StandingsV2Service();

      const players = [
        {
          standingId: '1',
          userId: 'a',
          name: 'Player A',
          metrics: {
            totalPoints: 25,
            headToHead: { b: { wins: 1, losses: 1 } },
            setWinPct: 55,
            gameWinPct: 50,
          },
        },
        {
          standingId: '2',
          userId: 'b',
          name: 'Player B',
          metrics: {
            totalPoints: 25,
            headToHead: { a: { wins: 1, losses: 1 } },
            setWinPct: 60,
            gameWinPct: 50,
          },
        },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      // Player B has better set win %
      expect(sorted[0].userId).toBe('b');
      expect(sorted[1].userId).toBe('a');
    });

    it('should use game win percentage when set % is tied', async () => {
      const service = new StandingsV2Service();

      const players = [
        {
          standingId: '1',
          userId: 'a',
          name: 'Player A',
          metrics: {
            totalPoints: 25,
            headToHead: {},
            setWinPct: 60,
            gameWinPct: 55,
          },
        },
        {
          standingId: '2',
          userId: 'b',
          name: 'Player B',
          metrics: {
            totalPoints: 25,
            headToHead: {},
            setWinPct: 60,
            gameWinPct: 65,
          },
        },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      // Player B has better game win %
      expect(sorted[0].userId).toBe('b');
      expect(sorted[1].userId).toBe('a');
    });

    it('should use alphabetical order as final tiebreaker', async () => {
      const service = new StandingsV2Service();

      const players = [
        {
          standingId: '1',
          userId: 'a',
          name: 'Zack',
          metrics: { totalPoints: 25, headToHead: {}, setWinPct: 60, gameWinPct: 55 },
        },
        {
          standingId: '2',
          userId: 'b',
          name: 'Alice',
          metrics: { totalPoints: 25, headToHead: {}, setWinPct: 60, gameWinPct: 55 },
        },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      // Alice comes before Zack alphabetically
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Zack');
    });

    it('should handle 3-way tie with group H2H', async () => {
      const service = new StandingsV2Service();

      // 3-way tie: A beats B, B beats C, C beats A (circular)
      // But A has 2 H2H wins in group, B has 1, C has 1
      const players = [
        {
          standingId: '1',
          userId: 'a',
          name: 'Player A',
          metrics: {
            totalPoints: 25,
            headToHead: {
              b: { wins: 2, losses: 0 }, // A beat B twice
              c: { wins: 0, losses: 1 }, // A lost to C once
            },
            setWinPct: 50,
            gameWinPct: 50,
          },
        },
        {
          standingId: '2',
          userId: 'b',
          name: 'Player B',
          metrics: {
            totalPoints: 25,
            headToHead: {
              a: { wins: 0, losses: 2 },
              c: { wins: 1, losses: 0 },
            },
            setWinPct: 50,
            gameWinPct: 50,
          },
        },
        {
          standingId: '3',
          userId: 'c',
          name: 'Player C',
          metrics: {
            totalPoints: 25,
            headToHead: {
              a: { wins: 1, losses: 0 },
              b: { wins: 0, losses: 1 },
            },
            setWinPct: 50,
            gameWinPct: 50,
          },
        },
      ];

      const sorted = (service as any).sortByTiebreakers(players);

      // A has 2 H2H wins in group (vs B)
      // B has 1 H2H win in group (vs C)
      // C has 1 H2H win in group (vs A)
      expect(sorted[0].userId).toBe('a'); // Most H2H wins within tied group
    });
  });

  describe('calculateSetWinPercentage', () => {
    it('should return 0 for no sets', async () => {
      const service = new StandingsV2Service();

      const results: any[] = [];
      const pct = (service as any).calculateSetWinPercentage(results);

      expect(pct).toBe(0);
    });

    it('should calculate percentage correctly', async () => {
      const service = new StandingsV2Service();

      const results = [
        { setsWon: 2, setsLost: 0 },
        { setsWon: 2, setsLost: 1 },
        { setsWon: 1, setsLost: 2 },
      ];

      const pct = (service as any).calculateSetWinPercentage(results);

      // 5 won out of 8 total = 62.5%
      expect(pct).toBeCloseTo(62.5, 1);
    });
  });

  describe('calculateGameWinPercentage', () => {
    it('should return 0 for no games', async () => {
      const service = new StandingsV2Service();

      const results: any[] = [];
      const pct = (service as any).calculateGameWinPercentage(results);

      expect(pct).toBe(0);
    });

    it('should calculate percentage correctly', async () => {
      const service = new StandingsV2Service();

      const results = [
        { gamesWon: 22, gamesLost: 10 },
        { gamesWon: 18, gamesLost: 15 },
      ];

      const pct = (service as any).calculateGameWinPercentage(results);

      // 40 won out of 65 total = 61.5%
      expect(pct).toBeCloseTo(61.54, 1);
    });
  });

  describe('calculateHeadToHead', () => {
    it('should build H2H record from results', async () => {
      const service = new StandingsV2Service();

      const results = [
        { opponentId: 'opp1', isWin: true },
        { opponentId: 'opp1', isWin: false },
        { opponentId: 'opp2', isWin: true },
        { opponentId: 'opp2', isWin: true },
      ];

      const h2h = (service as any).calculateHeadToHead(results);

      expect(h2h['opp1'].wins).toBe(1);
      expect(h2h['opp1'].losses).toBe(1);
      expect(h2h['opp2'].wins).toBe(2);
      expect(h2h['opp2'].losses).toBe(0);
    });

    it('should handle empty results', async () => {
      const service = new StandingsV2Service();

      const h2h = (service as any).calculateHeadToHead([]);

      expect(Object.keys(h2h)).toHaveLength(0);
    });
  });
});
