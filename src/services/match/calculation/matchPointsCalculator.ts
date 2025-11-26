/**
 * Match Points Calculator
 * Calculates match points (1-5 system), margin, and stats per DEUCE League spec
 */

import { SportType } from '@prisma/client';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface MatchOutcome {
  team1SetsWon: number;
  team2SetsWon: number;
  team1GamesWon: number;   // Tennis/Padel: games, Pickleball: points
  team2GamesWon: number;
  winner: 'team1' | 'team2';
}

export interface PlayerMatchPoints {
  playerId: string;
  opponentId: string;
  isWin: boolean;
  participationPoints: number;  // Always 1
  setsWonPoints: number;        // 0-2
  winBonusPoints: number;       // 0 or 2
  matchPoints: number;          // Total: 1-5
  margin: number;               // Games/points differential
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
}

interface SetScore {
  setNumber: number;
  player1Games: number;
  player2Games: number;
  player1Tiebreak?: number;
  player2Tiebreak?: number;
  tiebreakType?: string;
}

interface GameScore {
  gameNumber: number;
  player1Points: number;
  player2Points: number;
}

// =============================================
// MATCH POINTS CALCULATOR SERVICE
// =============================================

export class MatchPointsCalculator {

  /**
   * Calculate match points for all participants
   *
   * IMPORTANT: Creates ONE MatchResult per player
   * - Singles: 2 results (1 per player)
   * - Doubles: 4 results (1 per player)
   *
   * Each player's opponentId is set to the first opponent for reference.
   */
  calculateForMatch(
    matchId: string,
    outcome: MatchOutcome,
    participants: Array<{ userId: string; team: string }>
  ): PlayerMatchPoints[] {
    const results: PlayerMatchPoints[] = [];

    // Team 1 participants
    const team1Participants = participants.filter(p => p.team === 'team1');
    const team2Participants = participants.filter(p => p.team === 'team2');

    // Calculate for Team 1 players (ONE result per player)
    for (const p1 of team1Participants) {
      results.push(this.calculateForPlayer(
        p1.userId,
        team2Participants[0]?.userId || '',  // Reference first opponent
        outcome.winner === 'team1',
        outcome.team1SetsWon,
        outcome.team2SetsWon,
        outcome.team1GamesWon,
        outcome.team2GamesWon
      ));
    }

    // Calculate for Team 2 players (ONE result per player)
    for (const p2 of team2Participants) {
      results.push(this.calculateForPlayer(
        p2.userId,
        team1Participants[0]?.userId || '',  // Reference first opponent
        outcome.winner === 'team2',
        outcome.team2SetsWon,
        outcome.team1SetsWon,
        outcome.team2GamesWon,
        outcome.team1GamesWon
      ));
    }

    return results;
  }

  /**
   * Calculate match points for a single player
   *
   * SPEC-COMPLIANT FORMULA:
   * WIN:  1 (participation) + [sets won] + 2 (bonus) = 5 points max
   * LOSS: 1 (participation) + [sets won] = 1-2 points
   */
  private calculateForPlayer(
    playerId: string,
    opponentId: string,
    isWin: boolean,
    playerSetsWon: number,
    opponentSetsWon: number,
    playerGamesWon: number,
    opponentGamesWon: number
  ): PlayerMatchPoints {

    // Always 1 point for participation
    const participationPoints = 1;

    // 1 point per set/game won (0-2)
    const setsWonPoints = playerSetsWon;

    // 2 points bonus if win, 0 if loss
    const winBonusPoints = isWin ? 2 : 0;

    // Total: 1-5 points
    const matchPoints = participationPoints + setsWonPoints + winBonusPoints;

    // Margin calculation
    const margin = playerGamesWon - opponentGamesWon;

    return {
      playerId,
      opponentId,
      isWin,
      participationPoints,
      setsWonPoints,
      winBonusPoints,
      matchPoints,
      margin,
      setsWon: playerSetsWon,
      setsLost: opponentSetsWon,
      gamesWon: playerGamesWon,
      gamesLost: opponentGamesWon
    };
  }

  /**
   * Parse Tennis/Padel match outcome
   * CRITICAL: Match tiebreak points count as games for margin
   */
  parseTennisPadelOutcome(
    setScores: SetScore[],
    set3Format?: 'MATCH_TIEBREAK' | 'FULL_SET'
  ): MatchOutcome {
    let team1Sets = 0;
    let team2Sets = 0;
    let team1Games = 0;
    let team2Games = 0;

    for (const set of setScores) {
      // Determine set winner
      let setWinner: 'team1' | 'team2';

      if (set.player1Games > set.player2Games) {
        setWinner = 'team1';
      } else if (set.player2Games > set.player1Games) {
        setWinner = 'team2';
      } else {
        // Tiebreak decides
        setWinner = (set.player1Tiebreak || 0) > (set.player2Tiebreak || 0) ? 'team1' : 'team2';
      }

      if (setWinner === 'team1') {
        team1Sets++;
      } else {
        team2Sets++;
      }

      // Count games
      // CRITICAL: For match tiebreak, tiebreak POINTS count as "games"
      if (set.setNumber === 3 && set3Format === 'MATCH_TIEBREAK') {
        // Match tiebreak: points ARE the games
        if (set.player1Tiebreak !== undefined && set.player2Tiebreak !== undefined) {
          team1Games += set.player1Tiebreak;
          team2Games += set.player2Tiebreak;
        } else {
          // Games field might contain tiebreak points
          team1Games += set.player1Games;
          team2Games += set.player2Games;
        }
      } else {
        // Standard set or full Set 3
        team1Games += set.player1Games;
        team2Games += set.player2Games;
      }
    }

    return {
      team1SetsWon: team1Sets,
      team2SetsWon: team2Sets,
      team1GamesWon: team1Games,
      team2GamesWon: team2Games,
      winner: team1Sets > team2Sets ? 'team1' : 'team2'
    };
  }

  /**
   * Parse Pickleball match outcome
   */
  parsePickleballOutcome(
    gameScores: GameScore[]
  ): MatchOutcome {
    let team1Games = 0;
    let team2Games = 0;
    let team1Points = 0;
    let team2Points = 0;

    for (const game of gameScores) {
      // Determine game winner
      if (game.player1Points > game.player2Points) {
        team1Games++;
      } else {
        team2Games++;
      }

      // Count points (for margin calculation)
      team1Points += game.player1Points;
      team2Points += game.player2Points;
    }

    return {
      team1SetsWon: team1Games,       // "Games" in Pickleball
      team2SetsWon: team2Games,
      team1GamesWon: team1Points,     // "Points" for margin
      team2GamesWon: team2Points,
      winner: team1Games > team2Games ? 'team1' : 'team2'
    };
  }
}
