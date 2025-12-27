/**
 * Score Validation Service
 * Implements all DEUCE League scoring rules and validations
 */

import { SportType } from '@prisma/client';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface SetScore {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  team1Tiebreak?: number;
  team2Tiebreak?: number;
  tiebreakType?: 'STANDARD_7PT' | 'MATCH_10PT';
}

export interface PickleballGameScore {
  gameNumber: number;
  team1Points: number;
  team2Points: number;
}

export interface MatchScoreInput {
  sport: SportType;
  setScores?: SetScore[];
  pickleballScores?: PickleballGameScore[];
  set3Format?: 'MATCH_TIEBREAK' | 'FULL_SET';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================
// VALIDATION SERVICE
// =============================================

export class ScoreValidationService {

  /**
   * Main validation entry point
   */
  validate(input: MatchScoreInput): ValidationResult {
    if (input.sport === 'PICKLEBALL') {
      if (!input.pickleballScores || input.pickleballScores.length === 0) {
        return {
          valid: false,
          errors: ['Pickleball scores are required'],
          warnings: []
        };
      }
      return this.validatePickleball(input.pickleballScores);
    } else {
      // Tennis or Padel
      if (!input.setScores || input.setScores.length === 0) {
        return {
          valid: false,
          errors: ['Set scores are required for Tennis/Padel'],
          warnings: []
        };
      }
      return this.validateTennisPadel(input.setScores, input.set3Format);
    }
  }

  // =============================================
  // TENNIS/PADEL VALIDATION
  // =============================================

  /**
   * Tennis/Padel Main Validation
   */
  private validateTennisPadel(
    setScores: SetScore[],
    set3Format?: 'MATCH_TIEBREAK' | 'FULL_SET'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: At least 2 sets required
    if (setScores.length < 2) {
      errors.push('At least 2 sets are required');
    }

    // Rule 2: Maximum 3 sets
    if (setScores.length > 3) {
      errors.push('Maximum 3 sets allowed');
    }

    if (setScores.length < 2 || setScores.length > 3) {
      return { valid: false, errors, warnings };
    }

    // Rule 3: Must have definitive winner (one team wins 2 sets)
    const setWinners = setScores.map(s => this.determineSetWinner(s));
    const team1Sets = setWinners.filter(w => w === 'team1').length;
    const team2Sets = setWinners.filter(w => w === 'team2').length;

    if (team1Sets !== 2 && team2Sets !== 2) {
      errors.push('Match must have a definitive winner (one team must win 2 sets)');
    }

    // Rule 4: If 2-0, Set 3 must not exist
    if (setScores.length === 3 && setScores[0] && setScores[1]) {
      const set1Winner = this.determineSetWinner(setScores[0]);
      const set2Winner = this.determineSetWinner(setScores[1]);

      if (set1Winner === set2Winner) {
        errors.push('Cannot have Set 3 when match is won 2-0');
      }
    }

    // If only 2 sets, both must be won by same team
    if (setScores.length === 2 && setScores[0] && setScores[1]) {
      const set1Winner = this.determineSetWinner(setScores[0]);
      const set2Winner = this.determineSetWinner(setScores[1]);

      if (set1Winner !== set2Winner) {
        errors.push('If only 2 sets are played, same team must win both');
      }
    }

    // Rule 5: Validate each set
    setScores.forEach((set, index) => {
      const setNum = index + 1;

      if (setNum === 3) {
        // Set 3 validation (special rules)
        const setErrors = this.validateSet3(set, set3Format || 'MATCH_TIEBREAK');
        errors.push(...setErrors.map(e => `Set 3: ${e}`));
      } else {
        // Sets 1 & 2 validation
        const setErrors = this.validateStandardSet(set);
        errors.push(...setErrors.map(e => `Set ${setNum}: ${e}`));
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate standard set (Sets 1 & 2)
   */
  private validateStandardSet(set: SetScore): string[] {
    const errors: string[] = [];
    const maxGames = Math.max(set.team1Games, set.team2Games);
    const minGames = Math.min(set.team1Games, set.team2Games);

    // Negative check
    if (set.team1Games < 0 || set.team2Games < 0) {
      errors.push('Game scores cannot be negative');
      return errors;
    }

    // Winner must have at least 6 games
    if (maxGames < 6) {
      errors.push('Winner must have at least 6 games');
    }

    // Valid score combinations
    const validCombinations = [
      [6, 0], [6, 1], [6, 2], [6, 3], [6, 4],  // Straight wins
      [7, 5],                                    // Break win
      [7, 6]                                     // Tiebreak
    ];

    const isValid = validCombinations.some(([a, b]) =>
      (set.team1Games === a && set.team2Games === b) ||
      (set.team1Games === b && set.team2Games === a)
    );

    if (!isValid) {
      // Specific error messages for common mistakes
      if ((set.team1Games === 6 && set.team2Games === 5) ||
          (set.team1Games === 5 && set.team2Games === 6)) {
        errors.push('6-5 is not a valid final score (must reach 7-5 or play tiebreak)');
      } else if (set.team1Games === 6 && set.team2Games === 6) {
        errors.push('6-6 is not valid - must play tiebreak to 7-6');
      } else if (maxGames > 7) {
        errors.push(`Games cannot exceed 7 (except 7-5 or 7-6), got ${set.team1Games}-${set.team2Games}`);
      } else {
        errors.push(`Invalid score combination: ${set.team1Games}-${set.team2Games}`);
      }
    }

    // If 7-6, tiebreak is REQUIRED
    if ((set.team1Games === 7 && set.team2Games === 6) ||
        (set.team1Games === 6 && set.team2Games === 7)) {
      if (set.team1Tiebreak === undefined || set.team2Tiebreak === undefined) {
        errors.push('7-6 score requires tiebreak scores');
      } else {
        // Validate standard tiebreak (7-point)
        const tbErrors = this.validateTiebreak(
          set.team1Tiebreak,
          set.team2Tiebreak,
          7,
          'STANDARD_7PT'
        );
        errors.push(...tbErrors);
      }
    }

    // If NOT 7-6, tiebreak should NOT be present
    if (!((set.team1Games === 7 && set.team2Games === 6) ||
          (set.team1Games === 6 && set.team2Games === 7))) {
      if (set.team1Tiebreak !== undefined || set.team2Tiebreak !== undefined) {
        errors.push('Tiebreak scores only allowed for 7-6 sets');
      }
    }

    return errors;
  }

  /**
   * Validate Set 3 (special rules)
   */
  private validateSet3(set: SetScore, format: 'MATCH_TIEBREAK' | 'FULL_SET'): string[] {
    const errors: string[] = [];

    if (format === 'MATCH_TIEBREAK') {
      // Set 3 is just a match tiebreak (10-point)
      // The tiebreak scores should be in the tiebreak fields

      if (set.team1Tiebreak !== undefined && set.team2Tiebreak !== undefined) {
        // Validate match tiebreak (10-point)
        const tbErrors = this.validateTiebreak(
          set.team1Tiebreak,
          set.team2Tiebreak,
          10,
          'MATCH_10PT'
        );
        errors.push(...tbErrors);
      } else if (set.team1Games !== undefined && set.team2Games !== undefined) {
        // Games field might contain tiebreak points
        const tbErrors = this.validateTiebreak(
          set.team1Games,
          set.team2Games,
          10,
          'MATCH_10PT'
        );
        errors.push(...tbErrors);
      } else {
        errors.push('Match tiebreak scores are required');
      }

    } else {
      // Set 3 is full standard set
      // CRITICAL RULE: If 6-6, must use MATCH tiebreak (not standard)

      if (set.team1Games === 6 && set.team2Games === 6) {
        // At 6-6, MUST use match tiebreak
        if (set.team1Tiebreak === undefined || set.team2Tiebreak === undefined) {
          errors.push('Set 3 at 6-6 requires 10-point match tiebreak');
        } else {
          // Validate as match tiebreak (10-point)
          const tbErrors = this.validateTiebreak(
            set.team1Tiebreak,
            set.team2Tiebreak,
            10,
            'MATCH_10PT'
          );
          errors.push(...tbErrors);

          // Also check tiebreak type is correct
          if (set.tiebreakType === 'STANDARD_7PT') {
            errors.push('Set 3 at 6-6 must use 10-point match tiebreak, not standard 7-point tiebreak');
          }
        }
      } else {
        // Not 6-6, validate as standard set
        const setErrors = this.validateStandardSet(set);
        errors.push(...setErrors);
      }
    }

    return errors;
  }

  /**
   * Validate tiebreak scores
   */
  private validateTiebreak(
    score1: number,
    score2: number,
    minWinningScore: number,
    type: 'STANDARD_7PT' | 'MATCH_10PT'
  ): string[] {
    const errors: string[] = [];
    const winner = Math.max(score1, score2);
    const loser = Math.min(score1, score2);

    // Negative check
    if (score1 < 0 || score2 < 0) {
      errors.push('Tiebreak scores cannot be negative');
      return errors;
    }

    // Minimum winning score
    if (winner < minWinningScore) {
      const tiebreakName = type === 'MATCH_10PT' ? 'Match tiebreak' : 'Tiebreak';
      errors.push(`${tiebreakName} winner must have at least ${minWinningScore} points`);
    }

    // Win by 2
    if (winner - loser < 2) {
      errors.push('Tiebreak must be won by 2 points');
    }

    // If winner is exactly minWinningScore, loser must be <= minWinningScore - 2
    if (winner === minWinningScore && loser > minWinningScore - 2) {
      errors.push(`Invalid tiebreak score: ${score1}-${score2} (must win by 2)`);
    }

    // Extended tiebreaks are allowed (e.g., 14-12, 15-13)
    // No maximum limit

    return errors;
  }

  // =============================================
  // PICKLEBALL VALIDATION
  // =============================================

  /**
   * Pickleball Main Validation
   */
  private validatePickleball(games: PickleballGameScore[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: At least 2 games required
    if (games.length < 2) {
      errors.push('At least 2 games are required');
    }

    // Rule 2: Maximum 3 games
    if (games.length > 3) {
      errors.push('Maximum 3 games allowed');
    }

    if (games.length < 2 || games.length > 3) {
      return { valid: false, errors, warnings };
    }

    // Rule 3: Must have definitive winner (one team wins 2 games)
    const gameWinners = games.map(g =>
      g.team1Points > g.team2Points ? 'team1' : 'team2'
    );
    const team1Games = gameWinners.filter(w => w === 'team1').length;
    const team2Games = gameWinners.filter(w => w === 'team2').length;

    if (team1Games !== 2 && team2Games !== 2) {
      errors.push('Match must have a definitive winner (one team must win 2 games)');
    }

    // Rule 4: If 2-0, Game 3 must not exist
    if (games.length === 3 && games[0] && games[1]) {
      const game1Winner = games[0].team1Points > games[0].team2Points ? 'team1' : 'team2';
      const game2Winner = games[1].team1Points > games[1].team2Points ? 'team1' : 'team2';

      if (game1Winner === game2Winner) {
        errors.push('Cannot have Game 3 when match is won 2-0');
      }
    }

    // If only 2 games, both must be won by same team
    if (games.length === 2 && games[0] && games[1]) {
      const game1Winner = games[0].team1Points > games[0].team2Points ? 'team1' : 'team2';
      const game2Winner = games[1].team1Points > games[1].team2Points ? 'team1' : 'team2';

      if (game1Winner !== game2Winner) {
        errors.push('If only 2 games are played, same team must win both');
      }
    }

    // Rule 5: Validate each game
    games.forEach((game, index) => {
      const gameNum = index + 1;
      const gameErrors = this.validatePickleballGame(game);
      errors.push(...gameErrors.map(e => `Game ${gameNum}: ${e}`));
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate single Pickleball game
   */
  private validatePickleballGame(game: PickleballGameScore): string[] {
    const errors: string[] = [];
    const winner = Math.max(game.team1Points, game.team2Points);
    const loser = Math.min(game.team1Points, game.team2Points);

    // Negative check
    if (game.team1Points < 0 || game.team2Points < 0) {
      errors.push('Point scores cannot be negative');
      return errors;
    }

    // Winner must have at least 15 points
    if (winner < 15) {
      errors.push('Winner must have at least 15 points');
    }

    // Must win by 2
    if (winner - loser < 2) {
      errors.push('Must win by 2 points');
    }

    // If winner is exactly 15, loser must be <= 13
    if (winner === 15 && loser > 13) {
      errors.push(`Invalid score: ${game.team1Points}-${game.team2Points} (must win by 2)`);
    }

    // Extended scores allowed (e.g., 17-15, 22-20)
    // No maximum limit

    return errors;
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Determine set winner
   */
  private determineSetWinner(set: SetScore): 'team1' | 'team2' {
    if (set.team1Games > set.team2Games) {
      return 'team1';
    } else if (set.team2Games > set.team1Games) {
      return 'team2';
    } else {
      // Tiebreak decides
      return (set.team1Tiebreak || 0) > (set.team2Tiebreak || 0) ? 'team1' : 'team2';
    }
  }
}
