/**
 * Match Points Calculator Tests
 *
 * Tests for the DEUCE League match points calculation system (1-5 points)
 * - Points calculation for different match outcomes
 * - Singles and doubles match handling
 * - Tennis/Padel and Pickleball outcome parsing
 * - Edge cases (ties, walkovers, etc.)
 */

import {
  MatchPointsCalculator,
  MatchOutcome,
  PlayerMatchPoints,
} from '../../../src/services/match/calculation/matchPointsCalculator';

describe('MatchPointsCalculator', () => {
  let calculator: MatchPointsCalculator;

  beforeEach(() => {
    calculator = new MatchPointsCalculator();
  });

  // ============================================================================
  // SINGLES MATCH POINTS CALCULATION
  // ============================================================================
  describe('Singles Match Points Calculation', () => {
    describe('Win scenarios', () => {
      it('should calculate maximum points (5) for 2-0 win', () => {
        // Arrange
        const outcome: MatchOutcome = {
          team1SetsWon: 2,
          team2SetsWon: 0,
          team1GamesWon: 12,
          team2GamesWon: 4,
          winner: 'team1',
        };

        const participants = [
          { userId: 'player1', team: 'team1' },
          { userId: 'player2', team: 'team2' },
        ];

        // Act
        const results = calculator.calculateForMatch('match1', outcome, participants);

        // Assert
        const winnerResult = results.find((r) => r.playerId === 'player1')!;
        expect(winnerResult.matchPoints).toBe(5); // 1 (participation) + 2 (sets won) + 2 (win bonus)
        expect(winnerResult.participationPoints).toBe(1);
        expect(winnerResult.setsWonPoints).toBe(2);
        expect(winnerResult.winBonusPoints).toBe(2);
        expect(winnerResult.isWin).toBe(true);
        expect(winnerResult.setsWon).toBe(2);
        expect(winnerResult.setsLost).toBe(0);
        expect(winnerResult.margin).toBe(8); // 12 - 4
      });

      it('should calculate 4 points for 2-1 win', () => {
        // Arrange
        const outcome: MatchOutcome = {
          team1SetsWon: 2,
          team2SetsWon: 1,
          team1GamesWon: 16,
          team2GamesWon: 14,
          winner: 'team1',
        };

        const participants = [
          { userId: 'player1', team: 'team1' },
          { userId: 'player2', team: 'team2' },
        ];

        // Act
        const results = calculator.calculateForMatch('match1', outcome, participants);

        // Assert
        const winnerResult = results.find((r) => r.playerId === 'player1')!;
        expect(winnerResult.matchPoints).toBe(5); // 1 + 2 + 2 = 5 (still max because 2 sets won)
        expect(winnerResult.setsWonPoints).toBe(2);
        expect(winnerResult.winBonusPoints).toBe(2);
        expect(winnerResult.margin).toBe(2);
      });
    });

    describe('Loss scenarios', () => {
      it('should calculate 1 point for 0-2 loss', () => {
        // Arrange
        const outcome: MatchOutcome = {
          team1SetsWon: 0,
          team2SetsWon: 2,
          team1GamesWon: 4,
          team2GamesWon: 12,
          winner: 'team2',
        };

        const participants = [
          { userId: 'player1', team: 'team1' },
          { userId: 'player2', team: 'team2' },
        ];

        // Act
        const results = calculator.calculateForMatch('match1', outcome, participants);

        // Assert
        const loserResult = results.find((r) => r.playerId === 'player1')!;
        expect(loserResult.matchPoints).toBe(1); // 1 (participation) + 0 (sets won) + 0 (no win bonus)
        expect(loserResult.participationPoints).toBe(1);
        expect(loserResult.setsWonPoints).toBe(0);
        expect(loserResult.winBonusPoints).toBe(0);
        expect(loserResult.isWin).toBe(false);
        expect(loserResult.margin).toBe(-8); // 4 - 12
      });

      it('should calculate 2 points for 1-2 loss', () => {
        // Arrange
        const outcome: MatchOutcome = {
          team1SetsWon: 1,
          team2SetsWon: 2,
          team1GamesWon: 14,
          team2GamesWon: 16,
          winner: 'team2',
        };

        const participants = [
          { userId: 'player1', team: 'team1' },
          { userId: 'player2', team: 'team2' },
        ];

        // Act
        const results = calculator.calculateForMatch('match1', outcome, participants);

        // Assert
        const loserResult = results.find((r) => r.playerId === 'player1')!;
        expect(loserResult.matchPoints).toBe(2); // 1 (participation) + 1 (set won) + 0 (no win bonus)
        expect(loserResult.setsWonPoints).toBe(1);
        expect(loserResult.winBonusPoints).toBe(0);
        expect(loserResult.margin).toBe(-2);
      });
    });

    describe('Result count verification', () => {
      it('should create exactly 2 results for singles match', () => {
        // Arrange
        const outcome: MatchOutcome = {
          team1SetsWon: 2,
          team2SetsWon: 0,
          team1GamesWon: 12,
          team2GamesWon: 4,
          winner: 'team1',
        };

        const participants = [
          { userId: 'player1', team: 'team1' },
          { userId: 'player2', team: 'team2' },
        ];

        // Act
        const results = calculator.calculateForMatch('match1', outcome, participants);

        // Assert
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.playerId).sort()).toEqual(['player1', 'player2']);
      });
    });
  });

  // ============================================================================
  // DOUBLES MATCH POINTS CALCULATION
  // ============================================================================
  describe('Doubles Match Points Calculation', () => {
    it('should create exactly 4 results for doubles match', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 1,
        team1GamesWon: 18,
        team2GamesWon: 15,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team1' },
        { userId: 'player3', team: 'team2' },
        { userId: 'player4', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      expect(results).toHaveLength(4);
    });

    it('should give same points to both players on winning team', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team1' },
        { userId: 'player3', team: 'team2' },
        { userId: 'player4', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const team1Results = results.filter((r) => r.isWin);
      expect(team1Results).toHaveLength(2);
      expect(team1Results[0].matchPoints).toBe(team1Results[1].matchPoints);
      expect(team1Results[0].matchPoints).toBe(5);
    });

    it('should give same points to both players on losing team', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 1,
        team1GamesWon: 18,
        team2GamesWon: 15,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team1' },
        { userId: 'player3', team: 'team2' },
        { userId: 'player4', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const team2Results = results.filter((r) => !r.isWin);
      expect(team2Results).toHaveLength(2);
      expect(team2Results[0].matchPoints).toBe(team2Results[1].matchPoints);
      expect(team2Results[0].matchPoints).toBe(2); // 1 + 1 set won
    });

    it('should set correct opponent reference for doubles', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team1' },
        { userId: 'player3', team: 'team2' },
        { userId: 'player4', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const player1Result = results.find((r) => r.playerId === 'player1')!;
      const player2Result = results.find((r) => r.playerId === 'player2')!;
      const player3Result = results.find((r) => r.playerId === 'player3')!;
      const player4Result = results.find((r) => r.playerId === 'player4')!;

      // Team 1 players should reference first player of team 2
      expect(player1Result.opponentId).toBe('player3');
      expect(player2Result.opponentId).toBe('player3');

      // Team 2 players should reference first player of team 1
      expect(player3Result.opponentId).toBe('player1');
      expect(player4Result.opponentId).toBe('player1');
    });
  });

  // ============================================================================
  // TEAM ASSIGNMENT EDGE CASES
  // ============================================================================
  describe('Team Assignment Edge Cases', () => {
    it('should handle TEAM_A and TEAM_B naming (backwards compatibility)', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'TEAM_A' },
        { userId: 'player2', team: 'TEAM_B' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      expect(results).toHaveLength(2);
      const player1Result = results.find((r) => r.playerId === 'player1')!;
      expect(player1Result.isWin).toBe(true);
    });

    it('should use fallback assignment when teams are null', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: null },
        { userId: 'player2', team: null },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      expect(results).toHaveLength(2);
      // First player should be team1 (winner), second should be team2
      const player1Result = results.find((r) => r.playerId === 'player1')!;
      expect(player1Result.isWin).toBe(true);
    });

    it('should throw error when only one participant', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [{ userId: 'player1', team: 'team1' }];

      // Act & Assert
      expect(() => calculator.calculateForMatch('match1', outcome, participants)).toThrow(
        'Cannot calculate match points: Team 2 has no participants'
      );
    });

    it('should throw error when all participants on same team', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team1' },
      ];

      // Act & Assert
      expect(() => calculator.calculateForMatch('match1', outcome, participants)).toThrow(
        'Cannot calculate match points: Team 2 has no participants'
      );
    });
  });

  // ============================================================================
  // TENNIS/PADEL OUTCOME PARSING
  // ============================================================================
  describe('Tennis/Padel Outcome Parsing', () => {
    it('should parse standard 2-0 match correctly', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 6, player2Games: 4 },
        { setNumber: 2, player1Games: 6, player2Games: 3 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
      expect(outcome.team2SetsWon).toBe(0);
      expect(outcome.team1GamesWon).toBe(12);
      expect(outcome.team2GamesWon).toBe(7);
    });

    it('should parse 2-1 match correctly', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 6, player2Games: 4 },
        { setNumber: 2, player1Games: 4, player2Games: 6 },
        { setNumber: 3, player1Games: 7, player2Games: 5 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
      expect(outcome.team2SetsWon).toBe(1);
      expect(outcome.team1GamesWon).toBe(17);
      expect(outcome.team2GamesWon).toBe(15);
    });

    it('should handle set with tiebreak correctly', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 7, player2Games: 6, player1Tiebreak: 7, player2Tiebreak: 5 },
        { setNumber: 2, player1Games: 6, player2Games: 4 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
      expect(outcome.team2SetsWon).toBe(0);
      expect(outcome.team1GamesWon).toBe(13);
      expect(outcome.team2GamesWon).toBe(10);
    });

    it('should determine set winner by tiebreak when games are equal', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 6, player2Games: 6, player1Tiebreak: 7, player2Tiebreak: 4 },
        { setNumber: 2, player1Games: 6, player2Games: 4 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
    });

    it('should handle match tiebreak (set 3) with points counting as games', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 6, player2Games: 4 },
        { setNumber: 2, player1Games: 4, player2Games: 6 },
        { setNumber: 3, player1Games: 0, player2Games: 0, player1Tiebreak: 10, player2Tiebreak: 8 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores, 'MATCH_TIEBREAK');

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
      expect(outcome.team2SetsWon).toBe(1);
      // For match tiebreak, tiebreak points count as games
      expect(outcome.team1GamesWon).toBe(20); // 6 + 4 + 10
      expect(outcome.team2GamesWon).toBe(18); // 4 + 6 + 8
    });

    it('should handle full Set 3 format (not match tiebreak)', () => {
      // Arrange
      const setScores = [
        { setNumber: 1, player1Games: 6, player2Games: 4 },
        { setNumber: 2, player1Games: 4, player2Games: 6 },
        { setNumber: 3, player1Games: 7, player2Games: 5 },
      ];

      // Act
      const outcome = calculator.parseTennisPadelOutcome(setScores, 'FULL_SET');

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1GamesWon).toBe(17);
      expect(outcome.team2GamesWon).toBe(15);
    });
  });

  // ============================================================================
  // PICKLEBALL OUTCOME PARSING
  // ============================================================================
  describe('Pickleball Outcome Parsing', () => {
    it('should parse 2-0 game win correctly', () => {
      // Arrange
      const gameScores = [
        { gameNumber: 1, player1Points: 15, player2Points: 10 },
        { gameNumber: 2, player1Points: 15, player2Points: 8 },
      ];

      // Act
      const outcome = calculator.parsePickleballOutcome(gameScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2); // Games won counts as "sets"
      expect(outcome.team2SetsWon).toBe(0);
      expect(outcome.team1GamesWon).toBe(30); // Total points for margin
      expect(outcome.team2GamesWon).toBe(18);
    });

    it('should parse 2-1 game win correctly', () => {
      // Arrange
      const gameScores = [
        { gameNumber: 1, player1Points: 15, player2Points: 10 },
        { gameNumber: 2, player1Points: 10, player2Points: 15 },
        { gameNumber: 3, player1Points: 15, player2Points: 13 },
      ];

      // Act
      const outcome = calculator.parsePickleballOutcome(gameScores);

      // Assert
      expect(outcome.winner).toBe('team1');
      expect(outcome.team1SetsWon).toBe(2);
      expect(outcome.team2SetsWon).toBe(1);
      expect(outcome.team1GamesWon).toBe(40); // Total points
      expect(outcome.team2GamesWon).toBe(38);
    });

    it('should handle team2 winning', () => {
      // Arrange
      const gameScores = [
        { gameNumber: 1, player1Points: 8, player2Points: 15 },
        { gameNumber: 2, player1Points: 10, player2Points: 15 },
      ];

      // Act
      const outcome = calculator.parsePickleballOutcome(gameScores);

      // Assert
      expect(outcome.winner).toBe('team2');
      expect(outcome.team1SetsWon).toBe(0);
      expect(outcome.team2SetsWon).toBe(2);
    });
  });

  // ============================================================================
  // MARGIN CALCULATION
  // ============================================================================
  describe('Margin Calculation', () => {
    it('should calculate positive margin for winner', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const winnerResult = results.find((r) => r.playerId === 'player1')!;
      expect(winnerResult.margin).toBe(8);
    });

    it('should calculate negative margin for loser', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 0,
        team1GamesWon: 12,
        team2GamesWon: 4,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const loserResult = results.find((r) => r.playerId === 'player2')!;
      expect(loserResult.margin).toBe(-8);
    });

    it('should handle zero margin for close match', () => {
      // Arrange
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 1,
        team1GamesWon: 15,
        team2GamesWon: 15,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      // Act
      const results = calculator.calculateForMatch('match1', outcome, participants);

      // Assert
      const winnerResult = results.find((r) => r.playerId === 'player1')!;
      expect(winnerResult.margin).toBe(0);
    });
  });

  // ============================================================================
  // POINTS FORMULA VERIFICATION
  // ============================================================================
  describe('Points Formula Verification', () => {
    it('should always award 1 participation point', () => {
      const outcomes = [
        { team1SetsWon: 2, team2SetsWon: 0, team1GamesWon: 12, team2GamesWon: 4, winner: 'team1' as const },
        { team1SetsWon: 0, team2SetsWon: 2, team1GamesWon: 4, team2GamesWon: 12, winner: 'team2' as const },
        { team1SetsWon: 2, team2SetsWon: 1, team1GamesWon: 18, team2GamesWon: 15, winner: 'team1' as const },
      ];

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      outcomes.forEach((outcome) => {
        const results = calculator.calculateForMatch('match1', outcome, participants);
        results.forEach((result) => {
          expect(result.participationPoints).toBe(1);
        });
      });
    });

    it('should match total points formula: participation + setsWon + winBonus', () => {
      const outcomes = [
        { team1SetsWon: 2, team2SetsWon: 0, team1GamesWon: 12, team2GamesWon: 4, winner: 'team1' as const },
        { team1SetsWon: 0, team2SetsWon: 2, team1GamesWon: 4, team2GamesWon: 12, winner: 'team2' as const },
        { team1SetsWon: 2, team2SetsWon: 1, team1GamesWon: 18, team2GamesWon: 15, winner: 'team1' as const },
        { team1SetsWon: 1, team2SetsWon: 2, team1GamesWon: 15, team2GamesWon: 18, winner: 'team2' as const },
      ];

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      outcomes.forEach((outcome) => {
        const results = calculator.calculateForMatch('match1', outcome, participants);
        results.forEach((result) => {
          const expected = result.participationPoints + result.setsWonPoints + result.winBonusPoints;
          expect(result.matchPoints).toBe(expected);
        });
      });
    });

    it('should enforce 2 point win bonus only for winners', () => {
      const outcome: MatchOutcome = {
        team1SetsWon: 2,
        team2SetsWon: 1,
        team1GamesWon: 18,
        team2GamesWon: 15,
        winner: 'team1',
      };

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      const results = calculator.calculateForMatch('match1', outcome, participants);

      const winner = results.find((r) => r.isWin)!;
      const loser = results.find((r) => !r.isWin)!;

      expect(winner.winBonusPoints).toBe(2);
      expect(loser.winBonusPoints).toBe(0);
    });

    it('should have match points in range 1-5', () => {
      const testCases = [
        // Min points: loss with 0 sets
        { team1SetsWon: 0, team2SetsWon: 2, team1GamesWon: 0, team2GamesWon: 12, winner: 'team2' as const },
        // 2 points: loss with 1 set
        { team1SetsWon: 1, team2SetsWon: 2, team1GamesWon: 15, team2GamesWon: 18, winner: 'team2' as const },
        // Max points: win with 2 sets
        { team1SetsWon: 2, team2SetsWon: 0, team1GamesWon: 12, team2GamesWon: 0, winner: 'team1' as const },
      ];

      const participants = [
        { userId: 'player1', team: 'team1' },
        { userId: 'player2', team: 'team2' },
      ];

      testCases.forEach((outcome) => {
        const results = calculator.calculateForMatch('match1', outcome, participants);
        results.forEach((result) => {
          expect(result.matchPoints).toBeGreaterThanOrEqual(1);
          expect(result.matchPoints).toBeLessThanOrEqual(5);
        });
      });
    });
  });
});
