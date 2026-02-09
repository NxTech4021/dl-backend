/**
 * Match Result Creation Service Tests
 *
 * Tests for creating MatchResult records after match completion
 * - Creates one MatchResult per player
 * - Handles singles and doubles matches
 * - Handles walkovers
 * - Validates match state before creation
 */

import { MatchResultCreationService } from '../../../src/services/match/calculation/matchResultCreationService';
import {
  createTestUser,
  createTestDivision,
  prismaTest,
} from '../../helpers/serviceHelpers';
import {
  MatchStatus,
  MatchType,
  MatchFormat,
  InvitationStatus,
  ParticipantRole,
  MatchFeeType,
} from '@prisma/client';

describe('MatchResultCreationService', () => {
  let service: MatchResultCreationService;

  beforeAll(() => {
    service = new MatchResultCreationService();
  });

  /**
   * Helper to create a match with participants and scores
   */
  async function createMatchWithScores(options: {
    matchType?: MatchType;
    sport?: string;
    status?: MatchStatus;
    isWalkover?: boolean;
    team1Score?: number;
    team2Score?: number;
    divisionId?: string;
    seasonId?: string;
    leagueId?: string;
    scores?: Array<{
      setNumber: number;
      player1Games: number;
      player2Games: number;
      player1Tiebreak?: number;
      player2Tiebreak?: number;
    }>;
    gameScores?: Array<{
      gameNumber: number;
      player1Points: number;
      player2Points: number;
    }>;
    set3Format?: 'MATCH_TIEBREAK' | 'FULL_SET';
  }) {
    const uniqueSuffix = Math.random().toString(36).substring(7);

    // Create players
    const player1 = await createTestUser({ name: 'Player 1' });
    const player2 = await createTestUser({ name: 'Player 2' });

    let player3, player4;
    if (options.matchType === MatchType.DOUBLES) {
      player3 = await createTestUser({ name: 'Player 3' });
      player4 = await createTestUser({ name: 'Player 4' });
    }

    // Create division if needed
    let divisionId = options.divisionId;
    let seasonId = options.seasonId;
    let leagueId = options.leagueId;

    if (!divisionId) {
      const division = await createTestDivision();
      divisionId = division.id;
      seasonId = division.seasonId!;
      leagueId = division.leagueId!;
    }

    // Build participants data
    const participantsData: any[] = [
      {
        userId: player1.id,
        role: ParticipantRole.CREATOR,
        team: 'team1',
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      {
        userId: player2.id,
        role: ParticipantRole.OPPONENT,
        team: 'team2',
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    ];

    if (options.matchType === MatchType.DOUBLES && player3 && player4) {
      participantsData.push(
        {
          userId: player3.id,
          role: ParticipantRole.PARTNER,
          team: 'team1',
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        {
          userId: player4.id,
          role: ParticipantRole.OPPONENT,
          team: 'team2',
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        }
      );
    }

    // Create match
    const match = await prismaTest.match.create({
      data: {
        id: `test-match-${uniqueSuffix}`,
        sport: options.sport ?? 'TENNIS',
        matchType: options.matchType ?? MatchType.SINGLES,
        matchDate: new Date(),
        status: options.status ?? MatchStatus.COMPLETED,
        format: MatchFormat.STANDARD,
        fee: MatchFeeType.FREE,
        feeAmount: 0,
        divisionId,
        seasonId,
        leagueId,
        createdById: player1.id,
        isWalkover: options.isWalkover ?? false,
        team1Score: options.team1Score,
        team2Score: options.team2Score,
        set3Format: options.set3Format,
        participants: {
          create: participantsData,
        },
      },
      include: {
        participants: true,
      },
    });

    // Create scores if provided
    if (options.scores) {
      for (const score of options.scores) {
        await prismaTest.matchScore.create({
          data: {
            matchId: match.id,
            setNumber: score.setNumber,
            player1Games: score.player1Games,
            player2Games: score.player2Games,
            player1Tiebreak: score.player1Tiebreak ?? null,
            player2Tiebreak: score.player2Tiebreak ?? null,
            hasTiebreak: !!(score.player1Tiebreak || score.player2Tiebreak),
          },
        });
      }
    }

    // Create game scores for sports like tennis (pickleball uses different table)
    if (options.gameScores) {
      for (const score of options.gameScores) {
        await prismaTest.pickleballGameScore.create({
          data: {
            matchId: match.id,
            gameNumber: score.gameNumber,
            player1Points: score.player1Points,
            player2Points: score.player2Points,
          },
        });
      }
    }

    return {
      match,
      player1,
      player2,
      player3,
      player4,
    };
  }

  // ============================================================================
  // SINGLES MATCH RESULT CREATION
  // ============================================================================
  describe('Singles Match Result Creation', () => {
    it('should create 2 match results for singles match', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.playerId).sort()).toEqual([player1.id, player2.id].sort());
    });

    it('should correctly calculate winner and loser points for 2-0 win', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;
      const loserResult = results.find((r) => r.playerId === player2.id)!;

      expect(winnerResult.isWin).toBe(true);
      expect(winnerResult.matchPoints).toBe(5); // 1 + 2 + 2
      expect(winnerResult.setsWon).toBe(2);
      expect(winnerResult.setsLost).toBe(0);

      expect(loserResult.isWin).toBe(false);
      expect(loserResult.matchPoints).toBe(1); // 1 + 0 + 0
      expect(loserResult.setsWon).toBe(0);
      expect(loserResult.setsLost).toBe(2);
    });

    it('should correctly calculate points for 2-1 win', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 4, player2Games: 6 },
          { setNumber: 3, player1Games: 7, player2Games: 5 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;
      const loserResult = results.find((r) => r.playerId === player2.id)!;

      expect(winnerResult.isWin).toBe(true);
      expect(winnerResult.matchPoints).toBe(5); // 1 + 2 + 2
      expect(winnerResult.setsWon).toBe(2);
      expect(winnerResult.setsLost).toBe(1);

      expect(loserResult.isWin).toBe(false);
      expect(loserResult.matchPoints).toBe(2); // 1 + 1 + 0
      expect(loserResult.setsWon).toBe(1);
      expect(loserResult.setsLost).toBe(2);
    });

    it('should correctly set opponent references', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const player1Result = results.find((r) => r.playerId === player1.id)!;
      const player2Result = results.find((r) => r.playerId === player2.id)!;

      expect(player1Result.opponentId).toBe(player2.id);
      expect(player2Result.opponentId).toBe(player1.id);
    });
  });

  // ============================================================================
  // DOUBLES MATCH RESULT CREATION
  // ============================================================================
  describe('Doubles Match Result Creation', () => {
    it('should create 4 match results for doubles match', async () => {
      // Arrange
      const { match, player1, player2, player3, player4 } = await createMatchWithScores({
        matchType: MatchType.DOUBLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results).toHaveLength(4);
      const playerIds = results.map((r) => r.playerId).sort();
      expect(playerIds).toEqual([player1.id, player2.id, player3!.id, player4!.id].sort());
    });

    it('should give same points to both players on winning team', async () => {
      // Arrange
      const { match, player1, player3 } = await createMatchWithScores({
        matchType: MatchType.DOUBLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const team1Results = results.filter((r) => r.isWin);
      expect(team1Results).toHaveLength(2);
      expect(team1Results[0].matchPoints).toBe(team1Results[1].matchPoints);
    });

    it('should set gameType to DOUBLES', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        matchType: MatchType.DOUBLES,
        sport: 'TENNIS',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results.every((r) => r.gameType === 'DOUBLES')).toBe(true);
    });
  });

  // ============================================================================
  // WALKOVER HANDLING
  // ============================================================================
  describe('Walkover Handling', () => {
    it('should give winner full points (5) for walkover', async () => {
      // Arrange
      const { match, player1 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        isWalkover: true,
        team1Score: 2,
        team2Score: 0,
        scores: [], // Walkovers have no set scores
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;
      expect(winnerResult.isWin).toBe(true);
      expect(winnerResult.matchPoints).toBe(5);
      expect(winnerResult.setsWon).toBe(2);
      expect(winnerResult.setsLost).toBe(0);
    });

    it('should give loser 1 point for walkover', async () => {
      // Arrange
      const { match, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        isWalkover: true,
        team1Score: 2,
        team2Score: 0,
        scores: [],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const loserResult = results.find((r) => r.playerId === player2.id)!;
      expect(loserResult.isWin).toBe(false);
      expect(loserResult.matchPoints).toBe(1);
      expect(loserResult.setsWon).toBe(0);
      expect(loserResult.setsLost).toBe(2);
    });

    it('should handle team2 winning walkover', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        isWalkover: true,
        team1Score: 0,
        team2Score: 2,
        scores: [],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const player1Result = results.find((r) => r.playerId === player1.id)!;
      const player2Result = results.find((r) => r.playerId === player2.id)!;

      expect(player1Result.isWin).toBe(false);
      expect(player2Result.isWin).toBe(true);
    });
  });

  // ============================================================================
  // SPORTS-SPECIFIC MATCH HANDLING
  // ============================================================================
  describe('Sports-Specific Match Handling', () => {
    it('should create results for sports match with game scores', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'PICKLEBALL',
        gameScores: [
          { gameNumber: 1, player1Points: 15, player2Points: 10 },
          { gameNumber: 2, player1Points: 15, player2Points: 8 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.sportType === 'PICKLEBALL')).toBe(true);
    });

    it('should calculate game-based points correctly', async () => {
      // Arrange
      const { match, player1, player2 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'PICKLEBALL',
        gameScores: [
          { gameNumber: 1, player1Points: 15, player2Points: 10 },
          { gameNumber: 2, player1Points: 10, player2Points: 15 },
          { gameNumber: 3, player1Points: 15, player2Points: 12 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;
      const loserResult = results.find((r) => r.playerId === player2.id)!;

      expect(winnerResult.isWin).toBe(true);
      expect(winnerResult.setsWon).toBe(2); // Games won counts as "sets"
      expect(winnerResult.setsLost).toBe(1);

      expect(loserResult.isWin).toBe(false);
      expect(loserResult.setsWon).toBe(1);
      expect(loserResult.setsLost).toBe(2);
    });
  });

  // ============================================================================
  // MATCH TIEBREAK HANDLING
  // ============================================================================
  describe('Match Tiebreak Handling', () => {
    it('should count tiebreak points as games for match tiebreak', async () => {
      // Arrange
      const { match, player1 } = await createMatchWithScores({
        matchType: MatchType.SINGLES,
        sport: 'TENNIS',
        set3Format: 'MATCH_TIEBREAK',
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 4, player2Games: 6 },
          { setNumber: 3, player1Games: 0, player2Games: 0, player1Tiebreak: 10, player2Tiebreak: 8 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;

      // Games won should include match tiebreak points
      // 6 + 4 + 10 = 20
      expect(winnerResult.gamesWon).toBe(20);
      // 4 + 6 + 8 = 18
      expect(winnerResult.gamesLost).toBe(18);
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================
  describe('Validation', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(service.createMatchResults('non-existent-id')).rejects.toThrow('Match not found');
    });

    it('should throw error if match is not completed', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        status: MatchStatus.SCHEDULED,
        scores: [],
      });

      // Act & Assert
      await expect(service.createMatchResults(match.id)).rejects.toThrow(
        'Match must be completed before creating results'
      );
    });

    it('should skip creation if match has no division/season', async () => {
      // Arrange
      const player1 = await createTestUser({ name: 'Player 1' });
      const player2 = await createTestUser({ name: 'Player 2' });

      const match = await prismaTest.match.create({
        data: {
          id: `test-match-${Math.random().toString(36).substring(7)}`,
          sport: 'TENNIS',
          matchType: MatchType.SINGLES,
          matchDate: new Date(),
          status: MatchStatus.COMPLETED,
          format: MatchFormat.STANDARD,
          fee: MatchFeeType.FREE,
          feeAmount: 0,
          createdById: player1.id,
          // No divisionId, seasonId, leagueId
          participants: {
            create: [
              {
                userId: player1.id,
                role: ParticipantRole.CREATOR,
                team: 'team1',
                invitationStatus: InvitationStatus.ACCEPTED,
                acceptedAt: new Date(),
              },
              {
                userId: player2.id,
                role: ParticipantRole.OPPONENT,
                team: 'team2',
                invitationStatus: InvitationStatus.ACCEPTED,
                acceptedAt: new Date(),
              },
            ],
          },
        },
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert - No results should be created
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });
      expect(results).toHaveLength(0);
    });

    it('should not create duplicate results if called twice', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);
      await service.createMatchResults(match.id); // Call again

      // Assert - Should still have only 2 results
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });
      expect(results).toHaveLength(2);
    });

    it('should throw error if tennis match has no scores', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        sport: 'TENNIS',
        scores: [],
      });

      // Act & Assert
      await expect(service.createMatchResults(match.id)).rejects.toThrow('Set scores not found');
    });

    it('should throw error if game-based match has no scores', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        sport: 'PICKLEBALL',
        gameScores: [],
      });

      // Act & Assert
      await expect(service.createMatchResults(match.id)).rejects.toThrow('scores not found');
    });
  });

  // ============================================================================
  // DELETE MATCH RESULTS
  // ============================================================================
  describe('Delete Match Results', () => {
    it('should delete all match results for a match', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      await service.createMatchResults(match.id);

      // Verify results exist
      let results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });
      expect(results).toHaveLength(2);

      // Act
      await service.deleteMatchResults(match.id);

      // Assert
      results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // MARGIN CALCULATION
  // ============================================================================
  describe('Margin Calculation', () => {
    it('should calculate positive margin for winner', async () => {
      // Arrange
      const { match, player1 } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 2 },
          { setNumber: 2, player1Games: 6, player2Games: 1 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const winnerResult = results.find((r) => r.playerId === player1.id)!;
      expect(winnerResult.margin).toBe(9); // (6+6) - (2+1) = 12 - 3 = 9
    });

    it('should calculate negative margin for loser', async () => {
      // Arrange
      const { match, player2 } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 2 },
          { setNumber: 2, player1Games: 6, player2Games: 1 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      const loserResult = results.find((r) => r.playerId === player2.id)!;
      expect(loserResult.margin).toBe(-9); // (2+1) - (6+6) = 3 - 12 = -9
    });
  });

  // ============================================================================
  // DEFAULT FLAGS
  // ============================================================================
  describe('Default Flags', () => {
    it('should set countsForStandings to false initially', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results.every((r) => r.countsForStandings === false)).toBe(true);
    });

    it('should set resultSequence to null initially', async () => {
      // Arrange
      const { match } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results.every((r) => r.resultSequence === null)).toBe(true);
    });

    it('should set datePlayed from match matchDate', async () => {
      // Arrange
      const matchDate = new Date('2024-06-15');
      const { match } = await createMatchWithScores({
        scores: [
          { setNumber: 1, player1Games: 6, player2Games: 4 },
          { setNumber: 2, player1Games: 6, player2Games: 3 },
        ],
      });

      // Update match date
      await prismaTest.match.update({
        where: { id: match.id },
        data: { matchDate },
      });

      // Act
      await service.createMatchResults(match.id);

      // Assert
      const results = await prismaTest.matchResult.findMany({
        where: { matchId: match.id },
      });

      expect(results.every((r) => r.datePlayed.getTime() === matchDate.getTime())).toBe(true);
    });
  });
});
