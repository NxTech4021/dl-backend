/**
 * DMR (Deuce Match Rating) Service
 *
 * A Glicko-2 based rating system for racquet sports (Pickleball, Tennis, Padel).
 * Supports singles and doubles play with sport-specific scoring and validation.
 *
 * Features:
 * - Full Glicko-2 algorithm with volatility tracking
 * - Margin-of-victory score factor
 * - Dampening for rating stability
 * - Rating caps to prevent extreme swings
 * - Team-based doubles calculations with RD-weighted distribution
 * - Sport-specific scoring validation
 * - Inactivity RD adjustment
 */

import { prisma, PrismaClient } from '../../lib/prisma';
import { GameType, RatingChangeReason, SportType } from '@prisma/client';
import { logger } from '../../utils/logger';

// ==================== Types ====================

export interface RatingEntry {
  rating: number;
  rd: number;
  volatility: number;
  lastPlayed: Date | null;
}

export interface DMRConfig {
  // System constants
  tau: number;                    // Volatility system constant (0.5)
  epsilon: number;                // Convergence tolerance (0.000001)

  // Weighting factors
  setWeight: number;              // Weight for set differential (0.7)
  pointWeight: number;            // Weight for point differential (0.3)
  doublesWeight: number;          // Multiplier for doubles (0.7)
  dampening: number;              // Dampening factor (0.7)

  // Default values
  defaultRating: number;          // Starting rating (1500)
  defaultRD: number;              // Starting RD (350)
  minRD: number;                  // Minimum RD (30)
  maxRD: number;                  // Maximum RD (350)
  defaultVolatility: number;      // Starting volatility (0.06)

  // Inactivity parameters
  inactivityThresholdDays: number;    // Days before RD increases (30)
  inactivityRDIncreaseRate: number;   // Rate of RD increase (0.1)
  minRDIncrease: number;              // Minimum RD increase per period (5)

  // Rating caps
  capK: number;                   // Cap factor: maxDelta = capK * rd (0.08)
  absMaxDelta: number;            // Absolute max rating change (75)
  scoreFactorSoften: boolean;     // Use sqrt to soften score factor (true)

  // Doubles-specific
  doublesRDBlendFactor: number;   // Alpha for RD blending (0.5)
  doublesVolBlendFactor: number;  // Alpha for volatility blending (0.35)
}

export interface SetScore {
  score1: number;
  score2: number;
}

export interface SinglesMatchInput {
  winnerId: string;
  loserId: string;
  setScores: SetScore[];
  matchDate?: Date;
  seasonId: string;
  matchId?: string;
  isWalkover?: boolean;
}

export interface DoublesMatchInput {
  team1Ids: [string, string];
  team2Ids: [string, string];
  setScores: SetScore[];  // score1 = team1, score2 = team2
  matchDate?: Date;
  seasonId: string;
  matchId?: string;
  isWalkover?: boolean;
}

export interface RatingUpdate {
  odlayerId: string;
  odlayerName?: string;
  ratingId: string;
  oldRating: number;
  newRating: number;
  delta: number;
  oldRD: number;
  newRD: number;
  oldVolatility: number;
  newVolatility: number;
  matchesPlayed: number;
}

export interface MatchRatingResult {
  winner: RatingUpdate;
  loser: RatingUpdate;
  scoreFactor: number;
}

export interface DoublesRatingResult {
  ratingChanges: Record<string, RatingUpdate>;
  winnerIds: string[];
  loserIds: string[];
  scoreFactor: number;
}

// ==================== Default Configuration ====================

const DEFAULT_DMR_CONFIG: DMRConfig = {
  // System constants
  tau: 0.5,
  epsilon: 0.000001,

  // Weighting factors
  setWeight: 0.7,
  pointWeight: 0.3,
  doublesWeight: 0.7,
  dampening: 0.7,

  // Default values
  defaultRating: 1500,
  defaultRD: 350,
  minRD: 30,
  maxRD: 350,
  defaultVolatility: 0.06,

  // Inactivity parameters
  inactivityThresholdDays: 30,
  inactivityRDIncreaseRate: 0.1,
  minRDIncrease: 5,

  // Rating caps
  capK: 0.08,
  absMaxDelta: 75,
  scoreFactorSoften: true,

  // Doubles-specific
  doublesRDBlendFactor: 0.5,
  doublesVolBlendFactor: 0.35,
};

// Glicko-2 scale conversion constant: 400/ln(10)
const GLICKO_SCALE = 173.7178;

// ==================== Custom Errors ====================

export class DMRError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DMRError';
  }
}

export class InvalidMatchDataError extends DMRError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMatchDataError';
  }
}

export class PlayerNotFoundError extends DMRError {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerNotFoundError';
  }
}

// ==================== DMR Rating Service Class ====================

export class DMRRatingService {
  private prisma: PrismaClient;
  private config: DMRConfig;
  private sport: SportType;

  constructor(
    sport: SportType = SportType.PICKLEBALL,
    config?: Partial<DMRConfig>,
    prismaClient?: PrismaClient
  ) {
    this.prisma = prismaClient ?? prisma;
    this.sport = sport;
    this.config = { ...DEFAULT_DMR_CONFIG, ...config };
  }

  // ==================== Glicko-2 Core Functions ====================

  /**
   * Scale rating from Glicko to Glicko-2 scale
   */
  private scaleDown(rating: number): number {
    return (rating - 1500) / GLICKO_SCALE;
  }

  /**
   * Scale rating from Glicko-2 to Glicko scale
   */
  private scaleUp(rating: number): number {
    return rating * GLICKO_SCALE + 1500;
  }

  /**
   * Scale RD from Glicko to Glicko-2 scale
   */
  private scaleDownRD(rd: number): number {
    return rd / GLICKO_SCALE;
  }

  /**
   * Scale RD from Glicko-2 to Glicko scale
   */
  private scaleUpRD(rd: number): number {
    return rd * GLICKO_SCALE;
  }

  /**
   * The g function for the Glicko-2 system
   */
  private g(rd: number): number {
    return 1 / Math.sqrt(1 + 3 * rd * rd / (Math.PI * Math.PI));
  }

  /**
   * The E function (expected score) for the Glicko-2 system
   */
  private E(rating: number, opponentRating: number, opponentRD: number): number {
    return 1 / (1 + Math.exp(-this.g(opponentRD) * (rating - opponentRating)));
  }

  /**
   * Compute new rating, RD, and volatility using Glicko-2 algorithm
   *
   * @param rating - Current rating (Glicko-2 scale)
   * @param rd - Current RD (Glicko-2 scale)
   * @param volatility - Current volatility
   * @param matches - List of [opponentRating, opponentRD, score] where score is 1.0 for win, 0.0 for loss
   * @returns [newRating, newRD, newVolatility]
   */
  private computeNewRating(
    rating: number,
    rd: number,
    volatility: number,
    matches: Array<[number, number, number]>  // [oppRating, oppRD, score]
  ): [number, number, number] {
    const { tau, epsilon, maxRD } = this.config;

    if (matches.length === 0) {
      // No matches played: increase RD due to inactivity
      const newRD = Math.sqrt(rd * rd + volatility * volatility);
      return [rating, Math.min(newRD, this.scaleDownRD(maxRD)), volatility];
    }

    // Step 3: Compute the quantity v (variance)
    let vSum = 0;
    for (const [oppR, oppRD] of matches) {
      const gRD = this.g(oppRD);
      const e = this.E(rating, oppR, oppRD);
      vSum += gRD * gRD * e * (1 - e);
    }

    // Guard against division by zero
    if (vSum < epsilon) {
      vSum = epsilon;
    }
    const v = 1 / vSum;

    // Step 4: Compute delta (estimated improvement)
    let deltaSum = 0;
    for (const [oppR, oppRD, score] of matches) {
      const gRD = this.g(oppRD);
      const e = this.E(rating, oppR, oppRD);
      deltaSum += gRD * (score - e);
    }
    const delta = v * deltaSum;

    // Step 5: Determine new volatility using Illinois algorithm
    const a = Math.log(volatility * volatility);

    const f = (x: number): number => {
      const ex = Math.exp(x);
      const term1 = (ex * (delta * delta - v - ex)) / (2 * Math.pow(v + ex, 2));
      const term2 = (x - a) / (tau * tau);
      return term1 - term2;
    };

    // Find the value of B
    let B: number;
    if (delta * delta > v + volatility * volatility) {
      B = Math.log(delta * delta - v - volatility * volatility);
    } else {
      let k = 1;
      while (f(a - k * tau) < 0) {
        k++;
        if (k > 100) break;  // Safety limit
      }
      B = a - k * tau;
    }

    // Illinois algorithm iteration
    let A = a;
    let fA = f(A);
    let fB = f(B);

    const maxIterations = 100;
    let iteration = 0;

    while (Math.abs(B - A) > epsilon && iteration < maxIterations) {
      iteration++;
      const C = A + (A - B) * fA / (fB - fA);
      const fC = f(C);

      if (fC * fB <= 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }

      B = C;
      fB = fC;
    }

    const newVolatility = Math.exp(A / 2);

    // Step 6 & 7: Update rating deviation and rating
    const preRD = Math.sqrt(rd * rd + newVolatility * newVolatility);
    const newRD = 1 / Math.sqrt(1 / (preRD * preRD) + 1 / v);

    // Calculate new rating
    let ratingChangeSum = 0;
    for (const [oppR, oppRD, score] of matches) {
      const gRD = this.g(oppRD);
      const e = this.E(rating, oppR, oppRD);
      ratingChangeSum += gRD * (score - e);
    }

    const newRating = rating + (newRD * newRD * ratingChangeSum);

    return [newRating, newRD, newVolatility];
  }

  // ==================== Score Factor Calculation ====================

  /**
   * Calculate margin-of-victory score factor
   * Returns a multiplier >= 1.0 based on match dominance
   */
  private calculateScoreFactor(
    winnerSets: number,
    loserSets: number,
    winnerPoints: number,
    loserPoints: number,
    numSets: number
  ): number {
    const { setWeight, pointWeight } = this.config;

    // Set differential factor
    const setDifferentialFactor = (winnerSets - loserSets) / Math.max(numSets, 3);

    // Point differential factor (normalized by total points)
    const totalPoints = winnerPoints + loserPoints;
    let pointDifferentialFactor = 0;
    if (totalPoints > 0) {
      pointDifferentialFactor = (winnerPoints - loserPoints) / totalPoints;
    }

    // Combine factors
    const scoreFactor = 1 + (
      setWeight * setDifferentialFactor +
      pointWeight * pointDifferentialFactor
    ) * 0.5;

    return Math.max(1.0, scoreFactor);
  }

  /**
   * Cap rating change to prevent extreme swings
   */
  private capRatingChange(ratingChange: number, rd: number): number {
    const { capK, absMaxDelta } = this.config;
    const maxDelta = Math.min(capK * rd, absMaxDelta);
    return Math.max(-maxDelta, Math.min(maxDelta, ratingChange));
  }

  // ==================== Set Score Validation ====================

  /**
   * Validate set scores for Pickleball
   * Standard: 11 points, win by 2. Alternative: 15 or 21 points.
   */
  private validatePickleballSetScores(setScores: SetScore[]): void {
    const maxPoints = 11;
    const altMaxPoints = [15, 21];
    const validMaxScores = [maxPoints, ...altMaxPoints];

    for (let i = 0; i < setScores.length; i++) {
      const setScore = setScores[i]!;
      const { score1, score2 } = setScore;
      const setNum = i + 1;
      const maxScore = Math.max(score1, score2);
      const minScore = Math.min(score1, score2);

      // Check for negative scores
      if (score1 < 0 || score2 < 0) {
        throw new InvalidMatchDataError(
          `Set ${setNum}: Scores cannot be negative (${score1}-${score2})`
        );
      }

      // Check for tied sets
      if (score1 === score2) {
        throw new InvalidMatchDataError(
          `Set ${setNum}: Scores cannot be tied (${score1}-${score2})`
        );
      }

      // Check both scores aren't zero
      if (score1 === 0 && score2 === 0) {
        throw new InvalidMatchDataError(
          `Set ${setNum}: At least one player must score`
        );
      }

      // If max score matches a standard, check win-by-2
      if (validMaxScores.includes(maxScore)) {
        if (maxScore - minScore < 2) {
          throw new InvalidMatchDataError(
            `Set ${setNum}: Must win by at least 2 points (${score1}-${score2})`
          );
        }
      } else if (maxScore > maxPoints) {
        // Extended games (deuce) must win by exactly 2
        if (maxScore - minScore !== 2) {
          throw new InvalidMatchDataError(
            `Set ${setNum}: Extended games must win by exactly 2 points (${score1}-${score2})`
          );
        }
        // Check that it went to deuce
        if (minScore < maxPoints - 1) {
          throw new InvalidMatchDataError(
            `Set ${setNum}: Invalid deuce score (${score1}-${score2})`
          );
        }
      } else {
        throw new InvalidMatchDataError(
          `Set ${setNum}: Invalid score (${score1}-${score2}). ` +
          `Valid endings: ${validMaxScores.join(', ')} or deuce extensions`
        );
      }

      // Sanity check for unrealistic scores
      if (maxScore > 50) {
        throw new InvalidMatchDataError(
          `Set ${setNum}: Score ${maxScore} seems unrealistically high (${score1}-${score2})`
        );
      }
    }
  }

  /**
   * Validate set scores based on sport type
   */
  private validateSetScores(setScores: SetScore[]): void {
    if (!setScores || setScores.length === 0) {
      throw new InvalidMatchDataError('Set scores cannot be empty');
    }

    if (setScores.length > 5) {
      throw new InvalidMatchDataError('Maximum 5 sets allowed');
    }

    // Sport-specific validation
    switch (this.sport) {
      case SportType.PICKLEBALL:
        this.validatePickleballSetScores(setScores);
        break;
      case SportType.TENNIS:
        // Tennis validation would go here
        // For now, basic validation
        for (let i = 0; i < setScores.length; i++) {
          const setScore = setScores[i]!;
          if (setScore.score1 < 0 || setScore.score2 < 0) {
            throw new InvalidMatchDataError(`Set ${i + 1}: Scores cannot be negative`);
          }
          if (setScore.score1 === setScore.score2) {
            throw new InvalidMatchDataError(`Set ${i + 1}: Scores cannot be tied`);
          }
        }
        break;
      default:
        // Basic validation for other sports
        for (let i = 0; i < setScores.length; i++) {
          const setScore = setScores[i]!;
          if (setScore.score1 < 0 || setScore.score2 < 0) {
            throw new InvalidMatchDataError(`Set ${i + 1}: Scores cannot be negative`);
          }
        }
    }
  }

  // ==================== Player Rating Management ====================

  /**
   * Get or create player rating for a season
   */
  async getOrCreatePlayerRating(
    userId: string,
    seasonId: string,
    gameType: GameType
  ): Promise<{
    id: string;
    currentRating: number;
    ratingDeviation: number;
    volatility: number;
    isProvisional: boolean;
    matchesPlayed: number;
    lastPlayedAt: Date | null;
  }> {
    // Try to find existing rating
    let rating = await this.prisma.playerRating.findFirst({
      where: {
        userId,
        seasonId,
        gameType,
      },
    });

    if (rating) {
      return {
        id: rating.id,
        currentRating: rating.currentRating,
        ratingDeviation: rating.ratingDeviation || this.config.defaultRD,
        volatility: rating.volatility || this.config.defaultVolatility,
        isProvisional: rating.isProvisional,
        matchesPlayed: rating.matchesPlayed,
        lastPlayedAt: rating.lastUpdatedAt,
      };
    }

    // Try to get initial rating from questionnaire
    const questionnaire = await this.prisma.questionnaireResponse.findFirst({
      where: {
        userId,
        completedAt: { not: null },
      },
      include: { result: true },
      orderBy: { completedAt: 'desc' },
    });

    const initialRating = gameType === GameType.DOUBLES
      ? questionnaire?.result?.doubles || this.config.defaultRating
      : questionnaire?.result?.singles || this.config.defaultRating;

    const initialRD = questionnaire?.result?.rd || this.config.defaultRD;

    // Create new rating
    rating = await this.prisma.playerRating.create({
      data: {
        userId,
        seasonId,
        sport: this.sport,
        gameType,
        currentRating: initialRating,
        ratingDeviation: initialRD,
        volatility: this.config.defaultVolatility,
        isProvisional: true,
        matchesPlayed: 0,
        peakRating: initialRating,
        peakRatingDate: new Date(),
        lowestRating: initialRating,
      },
    });

    // Create initial history entry
    await this.prisma.ratingHistory.create({
      data: {
        playerRatingId: rating.id,
        ratingBefore: this.config.defaultRating,
        ratingAfter: initialRating,
        delta: initialRating - this.config.defaultRating,
        rdBefore: this.config.defaultRD,
        rdAfter: initialRD,
        reason: RatingChangeReason.INITIAL_PLACEMENT,
        notes: 'Initial rating from questionnaire or default',
      },
    });

    logger.info(`Created initial ${gameType} rating for user ${userId}: ${initialRating}`);

    return {
      id: rating.id,
      currentRating: initialRating,
      ratingDeviation: initialRD,
      volatility: this.config.defaultVolatility,
      isProvisional: true,
      matchesPlayed: 0,
      lastPlayedAt: null,
    };
  }

  // ==================== Singles Match Processing ====================

  /**
   * Calculate and apply rating changes for a singles match
   */
  async processSinglesMatch(input: SinglesMatchInput): Promise<MatchRatingResult> {
    const {
      winnerId,
      loserId,
      setScores,
      matchDate = new Date(),
      seasonId,
      matchId,
      isWalkover = false,
    } = input;

    // Validate
    if (winnerId === loserId) {
      throw new InvalidMatchDataError('A player cannot play against themselves');
    }

    this.validateSetScores(setScores);

    // Validate winner actually won
    const setsWonByWinner = setScores.filter(s => s.score1 > s.score2).length;
    const setsWonByLoser = setScores.filter(s => s.score2 > s.score1).length;

    // Note: setScores are from winner's perspective (score1 = winner's score)
    if (setsWonByWinner <= setsWonByLoser) {
      throw new InvalidMatchDataError('Winner must have won more sets than loser');
    }

    // Get current ratings
    const [winnerRating, loserRating] = await Promise.all([
      this.getOrCreatePlayerRating(winnerId, seasonId, GameType.SINGLES),
      this.getOrCreatePlayerRating(loserId, seasonId, GameType.SINGLES),
    ]);

    // Calculate match statistics
    const totalWinnerScore = setScores.reduce((sum, s) => sum + s.score1, 0);
    const totalLoserScore = setScores.reduce((sum, s) => sum + s.score2, 0);

    // Calculate score factor
    let scoreFactor = this.calculateScoreFactor(
      setsWonByWinner,
      setsWonByLoser,
      totalWinnerScore,
      totalLoserScore,
      setScores.length
    );

    // Reduce score factor for walkovers
    if (isWalkover) {
      scoreFactor = 1.0;  // No margin-of-victory bonus for walkovers
    }

    // Convert to Glicko-2 scale
    const winnerRatingG2 = this.scaleDown(winnerRating.currentRating);
    const winnerRDG2 = this.scaleDownRD(winnerRating.ratingDeviation);
    const winnerVol = winnerRating.volatility;

    const loserRatingG2 = this.scaleDown(loserRating.currentRating);
    const loserRDG2 = this.scaleDownRD(loserRating.ratingDeviation);
    const loserVol = loserRating.volatility;

    // Compute new ratings using Glicko-2
    const [winnerNewRatingG2, winnerNewRDG2, winnerNewVol] = this.computeNewRating(
      winnerRatingG2,
      winnerRDG2,
      winnerVol,
      [[loserRatingG2, loserRDG2, 1.0]]  // Win
    );

    const [loserNewRatingG2, loserNewRDG2, loserNewVol] = this.computeNewRating(
      loserRatingG2,
      loserRDG2,
      loserVol,
      [[winnerRatingG2, winnerRDG2, 0.0]]  // Loss
    );

    // Calculate base deltas
    let winnerBaseDelta = this.scaleUp(winnerNewRatingG2) - winnerRating.currentRating;
    let loserBaseDelta = this.scaleUp(loserNewRatingG2) - loserRating.currentRating;

    // Apply score factor (softened if configured) and dampening
    const effectiveScoreFactor = this.config.scoreFactorSoften
      ? Math.sqrt(scoreFactor)
      : scoreFactor;

    let winnerDelta = winnerBaseDelta * effectiveScoreFactor * this.config.dampening;
    let loserDelta = loserBaseDelta * effectiveScoreFactor * this.config.dampening;

    // Cap rating changes
    winnerDelta = this.capRatingChange(winnerDelta, winnerRating.ratingDeviation);
    loserDelta = this.capRatingChange(loserDelta, loserRating.ratingDeviation);

    // Round to integers
    winnerDelta = Math.round(winnerDelta);
    loserDelta = Math.round(loserDelta);

    // Calculate new values
    const winnerNewRating = winnerRating.currentRating + winnerDelta;
    const loserNewRating = loserRating.currentRating + loserDelta;
    const winnerNewRD = Math.round(this.scaleUpRD(winnerNewRDG2));
    const loserNewRD = Math.round(this.scaleUpRD(loserNewRDG2));

    // Apply updates to database
    await this.applyRatingUpdates(
      winnerRating.id,
      loserRating.id,
      {
        winnerId,
        loserId,
        winnerOldRating: winnerRating.currentRating,
        winnerNewRating,
        winnerDelta,
        winnerOldRD: winnerRating.ratingDeviation,
        winnerNewRD,
        winnerOldVol: winnerRating.volatility,
        winnerNewVol,
        winnerMatchesPlayed: winnerRating.matchesPlayed + 1,
        loserOldRating: loserRating.currentRating,
        loserNewRating,
        loserDelta,
        loserOldRD: loserRating.ratingDeviation,
        loserNewRD,
        loserOldVol: loserRating.volatility,
        loserNewVol,
        loserMatchesPlayed: loserRating.matchesPlayed + 1,
      },
      matchId,
      matchDate
    );

    const result: MatchRatingResult = {
      winner: {
        odlayerId: winnerId,
        ratingId: winnerRating.id,
        oldRating: winnerRating.currentRating,
        newRating: winnerNewRating,
        delta: winnerDelta,
        oldRD: winnerRating.ratingDeviation,
        newRD: winnerNewRD,
        oldVolatility: winnerRating.volatility,
        newVolatility: winnerNewVol,
        matchesPlayed: winnerRating.matchesPlayed + 1,
      },
      loser: {
        odlayerId: loserId,
        ratingId: loserRating.id,
        oldRating: loserRating.currentRating,
        newRating: loserNewRating,
        delta: loserDelta,
        oldRD: loserRating.ratingDeviation,
        newRD: loserNewRD,
        oldVolatility: loserRating.volatility,
        newVolatility: loserNewVol,
        matchesPlayed: loserRating.matchesPlayed + 1,
      },
      scoreFactor,
    };

    logger.info(`Processed singles match`, {
      matchId: matchId || 'unknown',
      winnerId,
      loserId,
      winnerDelta,
      loserDelta,
      scoreFactor,
    });

    return result;
  }

  // ==================== Doubles Match Processing ====================

  /**
   * Calculate and apply rating changes for a doubles match
   * Uses team-based calculation with RD-weighted distribution
   */
  async processDoublesMatch(input: DoublesMatchInput): Promise<DoublesRatingResult> {
    const {
      team1Ids,
      team2Ids,
      setScores,
      matchDate = new Date(),
      seasonId,
      matchId,
      isWalkover = false,
    } = input;

    // Validate teams
    if (team1Ids.length !== 2 || team2Ids.length !== 2) {
      throw new InvalidMatchDataError('Each team must have exactly 2 players');
    }

    const allPlayers = [...team1Ids, ...team2Ids];
    if (new Set(allPlayers).size !== 4) {
      throw new InvalidMatchDataError('All players must be unique (no duplicates)');
    }

    this.validateSetScores(setScores);

    // Calculate sets won by each team
    const setsWonByTeam1 = setScores.filter(s => s.score1 > s.score2).length;
    const setsWonByTeam2 = setScores.filter(s => s.score2 > s.score1).length;
    const totalTeam1Score = setScores.reduce((sum, s) => sum + s.score1, 0);
    const totalTeam2Score = setScores.reduce((sum, s) => sum + s.score2, 0);

    // Determine winner
    let winnerIds: string[];
    let loserIds: string[];
    let winnerSets: number;
    let loserSets: number;
    let winnerPoints: number;
    let loserPoints: number;

    if (setsWonByTeam1 > setsWonByTeam2) {
      winnerIds = team1Ids;
      loserIds = team2Ids;
      winnerSets = setsWonByTeam1;
      loserSets = setsWonByTeam2;
      winnerPoints = totalTeam1Score;
      loserPoints = totalTeam2Score;
    } else if (setsWonByTeam2 > setsWonByTeam1) {
      winnerIds = team2Ids;
      loserIds = team1Ids;
      winnerSets = setsWonByTeam2;
      loserSets = setsWonByTeam1;
      winnerPoints = totalTeam2Score;
      loserPoints = totalTeam1Score;
    } else {
      // Tie on sets - use point differential
      if (totalTeam1Score > totalTeam2Score) {
        winnerIds = team1Ids;
        loserIds = team2Ids;
        winnerSets = setsWonByTeam1;
        loserSets = setsWonByTeam2;
        winnerPoints = totalTeam1Score;
        loserPoints = totalTeam2Score;
      } else {
        winnerIds = team2Ids;
        loserIds = team1Ids;
        winnerSets = setsWonByTeam2;
        loserSets = setsWonByTeam1;
        winnerPoints = totalTeam2Score;
        loserPoints = totalTeam1Score;
      }
    }

    // Get all player ratings
    const [w1Rating, w2Rating, l1Rating, l2Rating] = await Promise.all([
      this.getOrCreatePlayerRating(winnerIds[0]!, seasonId, GameType.DOUBLES),
      this.getOrCreatePlayerRating(winnerIds[1]!, seasonId, GameType.DOUBLES),
      this.getOrCreatePlayerRating(loserIds[0]!, seasonId, GameType.DOUBLES),
      this.getOrCreatePlayerRating(loserIds[1]!, seasonId, GameType.DOUBLES),
    ]);

    const winningTeam = [w1Rating, w2Rating];
    const losingTeam = [l1Rating, l2Rating];

    // Calculate score factor
    let scoreFactor = this.calculateScoreFactor(
      winnerSets,
      loserSets,
      winnerPoints,
      loserPoints,
      setScores.length
    );

    if (isWalkover) {
      scoreFactor = 1.0;
    }

    // Calculate team averages using RMS for RD
    const winTeamRating = (w1Rating.currentRating + w2Rating.currentRating) / 2;
    const winTeamRDSq = (w1Rating.ratingDeviation ** 2 + w2Rating.ratingDeviation ** 2) / 2;
    const winTeamRD = Math.sqrt(winTeamRDSq);
    const winTeamVol = (w1Rating.volatility + w2Rating.volatility) / 2;

    const loseTeamRating = (l1Rating.currentRating + l2Rating.currentRating) / 2;
    const loseTeamRDSq = (l1Rating.ratingDeviation ** 2 + l2Rating.ratingDeviation ** 2) / 2;
    const loseTeamRD = Math.sqrt(loseTeamRDSq);
    const loseTeamVol = (l1Rating.volatility + l2Rating.volatility) / 2;

    // Convert to Glicko-2 scale
    const winTeamRatingG2 = this.scaleDown(winTeamRating);
    const winTeamRDG2 = this.scaleDownRD(winTeamRD);
    const loseTeamRatingG2 = this.scaleDown(loseTeamRating);
    const loseTeamRDG2 = this.scaleDownRD(loseTeamRD);

    // Compute team rating updates
    const [winTeamNewRatingG2, winTeamNewRDG2, winTeamNewVol] = this.computeNewRating(
      winTeamRatingG2,
      winTeamRDG2,
      winTeamVol,
      [[loseTeamRatingG2, loseTeamRDG2, 1.0]]
    );

    const [loseTeamNewRatingG2, loseTeamNewRDG2, loseTeamNewVol] = this.computeNewRating(
      loseTeamRatingG2,
      loseTeamRDG2,
      loseTeamVol,
      [[winTeamRatingG2, winTeamRDG2, 0.0]]
    );

    // Calculate team deltas
    let winTeamBaseDelta = this.scaleUp(winTeamNewRatingG2) - winTeamRating;
    let loseTeamBaseDelta = this.scaleUp(loseTeamNewRatingG2) - loseTeamRating;

    // Apply score factor and dampening
    const effectiveScoreFactor = this.config.scoreFactorSoften
      ? Math.sqrt(scoreFactor)
      : scoreFactor;

    const winTeamDelta = winTeamBaseDelta * effectiveScoreFactor * this.config.dampening;
    const loseTeamDelta = loseTeamBaseDelta * effectiveScoreFactor * this.config.dampening;

    // Distribute rating changes by RD weighting
    const ratingChanges: Record<string, RatingUpdate> = {};

    // Winners - distribute by RD weight
    const winRDSum = w1Rating.ratingDeviation + w2Rating.ratingDeviation;
    for (let i = 0; i < 2; i++) {
      const player = winningTeam[i]!;
      const playerId = winnerIds[i]!;
      const weight = player.ratingDeviation / winRDSum;
      let playerDelta = Math.round(winTeamDelta * weight);

      // Cap individual change
      playerDelta = this.capRatingChange(playerDelta, player.ratingDeviation);
      playerDelta = Math.round(playerDelta);

      const newRating = player.currentRating + playerDelta;
      const newRD = this.updateDoublesRD(
        player.ratingDeviation,
        this.scaleUpRD(winTeamNewRDG2),
        winTeamRD
      );
      const newVol = (1 - this.config.doublesVolBlendFactor) * player.volatility +
        this.config.doublesVolBlendFactor * winTeamNewVol;

      ratingChanges[playerId] = {
        odlayerId: playerId,
        ratingId: player.id,
        oldRating: player.currentRating,
        newRating,
        delta: playerDelta,
        oldRD: player.ratingDeviation,
        newRD: Math.round(newRD),
        oldVolatility: player.volatility,
        newVolatility: newVol,
        matchesPlayed: player.matchesPlayed + 1,
      };
    }

    // Losers - distribute by RD weight
    const loseRDSum = l1Rating.ratingDeviation + l2Rating.ratingDeviation;
    for (let i = 0; i < 2; i++) {
      const player = losingTeam[i]!;
      const playerId = loserIds[i]!;
      const weight = player.ratingDeviation / loseRDSum;
      let playerDelta = Math.round(loseTeamDelta * weight);

      // Cap individual change
      playerDelta = this.capRatingChange(playerDelta, player.ratingDeviation);
      playerDelta = Math.round(playerDelta);

      const newRating = player.currentRating + playerDelta;
      const newRD = this.updateDoublesRD(
        player.ratingDeviation,
        this.scaleUpRD(loseTeamNewRDG2),
        loseTeamRD
      );
      const newVol = (1 - this.config.doublesVolBlendFactor) * player.volatility +
        this.config.doublesVolBlendFactor * loseTeamNewVol;

      ratingChanges[playerId] = {
        odlayerId: playerId,
        ratingId: player.id,
        oldRating: player.currentRating,
        newRating,
        delta: playerDelta,
        oldRD: player.ratingDeviation,
        newRD: Math.round(newRD),
        oldVolatility: player.volatility,
        newVolatility: newVol,
        matchesPlayed: player.matchesPlayed + 1,
      };
    }

    // Apply all updates to database
    await this.applyDoublesRatingUpdates(ratingChanges, winnerIds, loserIds, matchId, matchDate);

    logger.info(`Processed doubles match`, {
      matchId: matchId || 'unknown',
      winnerIds,
      loserIds,
      scoreFactor,
      ratingChanges: Object.fromEntries(
        Object.entries(ratingChanges).map(([k, v]) => [k, v.delta])
      ),
    });

    return {
      ratingChanges,
      winnerIds,
      loserIds,
      scoreFactor,
    };
  }

  /**
   * Update player's RD using Bayesian variance composition for doubles
   */
  private updateDoublesRD(
    playerRD: number,
    teamUpdatedRD: number,
    teamInitialRD: number
  ): number {
    const { doublesRDBlendFactor, minRD, maxRD } = this.config;

    // Estimate the information gained from the match
    const rdReduction = Math.max(0, teamInitialRD - teamUpdatedRD);

    if (rdReduction > 0) {
      // Bayesian update: combine prior and new information
      const variancePrior = playerRD ** 2;
      const varianceNewInfo = (teamInitialRD ** 2) * doublesRDBlendFactor;

      if (varianceNewInfo > 0) {
        const variancePost = 1 / (1 / variancePrior + 1 / varianceNewInfo);
        const newRD = Math.sqrt(variancePost);
        return Math.max(minRD, Math.min(maxRD, newRD));
      }
    }

    // Fallback: simple blending
    const newRD = (1 - doublesRDBlendFactor) * playerRD + doublesRDBlendFactor * teamUpdatedRD;
    return Math.max(minRD, Math.min(maxRD, newRD));
  }

  // ==================== Database Updates ====================

  private async applyRatingUpdates(
    winnerRatingId: string,
    loserRatingId: string,
    data: {
      winnerId: string;
      loserId: string;
      winnerOldRating: number;
      winnerNewRating: number;
      winnerDelta: number;
      winnerOldRD: number;
      winnerNewRD: number;
      winnerOldVol: number;
      winnerNewVol: number;
      winnerMatchesPlayed: number;
      loserOldRating: number;
      loserNewRating: number;
      loserDelta: number;
      loserOldRD: number;
      loserNewRD: number;
      loserOldVol: number;
      loserNewVol: number;
      loserMatchesPlayed: number;
    },
    matchId?: string,
    matchDate?: Date
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update winner rating
      const winnerUpdateData: any = {
        currentRating: data.winnerNewRating,
        ratingDeviation: data.winnerNewRD,
        volatility: data.winnerNewVol,
        matchesPlayed: data.winnerMatchesPlayed,
        lastUpdatedAt: matchDate || new Date(),
        isProvisional: data.winnerMatchesPlayed < 10,
      };

      if (matchId) {
        winnerUpdateData.lastMatchId = matchId;
      }

      // Update peak if applicable
      const winnerCurrent = await tx.playerRating.findUnique({
        where: { id: winnerRatingId },
        select: { peakRating: true },
      });

      if (winnerCurrent && data.winnerNewRating > (winnerCurrent.peakRating || 0)) {
        winnerUpdateData.peakRating = data.winnerNewRating;
        winnerUpdateData.peakRatingDate = new Date();
      }

      await tx.playerRating.update({
        where: { id: winnerRatingId },
        data: winnerUpdateData,
      });

      // Create winner history
      await tx.ratingHistory.create({
        data: {
          playerRatingId: winnerRatingId,
          ...(matchId && { matchId }),
          ratingBefore: data.winnerOldRating,
          ratingAfter: data.winnerNewRating,
          delta: data.winnerDelta,
          rdBefore: data.winnerOldRD,
          rdAfter: data.winnerNewRD,
          reason: RatingChangeReason.MATCH_WIN,
        },
      });

      // Update loser rating
      const loserUpdateData: any = {
        currentRating: data.loserNewRating,
        ratingDeviation: data.loserNewRD,
        volatility: data.loserNewVol,
        matchesPlayed: data.loserMatchesPlayed,
        lastUpdatedAt: matchDate || new Date(),
        isProvisional: data.loserMatchesPlayed < 10,
      };

      if (matchId) {
        loserUpdateData.lastMatchId = matchId;
      }

      // Update lowest if applicable
      const loserCurrent = await tx.playerRating.findUnique({
        where: { id: loserRatingId },
        select: { lowestRating: true },
      });

      if (loserCurrent && data.loserNewRating < (loserCurrent.lowestRating || Infinity)) {
        loserUpdateData.lowestRating = data.loserNewRating;
      }

      await tx.playerRating.update({
        where: { id: loserRatingId },
        data: loserUpdateData,
      });

      // Create loser history
      await tx.ratingHistory.create({
        data: {
          playerRatingId: loserRatingId,
          ...(matchId && { matchId }),
          ratingBefore: data.loserOldRating,
          ratingAfter: data.loserNewRating,
          delta: data.loserDelta,
          rdBefore: data.loserOldRD,
          rdAfter: data.loserNewRD,
          reason: RatingChangeReason.MATCH_LOSS,
        },
      });
    });
  }

  private async applyDoublesRatingUpdates(
    ratingChanges: Record<string, RatingUpdate>,
    winnerIds: string[],
    loserIds: string[],
    matchId?: string,
    matchDate?: Date
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const [playerId, update] of Object.entries(ratingChanges)) {
        const isWinner = winnerIds.includes(playerId);

        const updateData: any = {
          currentRating: update.newRating,
          ratingDeviation: update.newRD,
          volatility: update.newVolatility,
          matchesPlayed: update.matchesPlayed,
          lastUpdatedAt: matchDate || new Date(),
          isProvisional: update.matchesPlayed < 10,
        };

        if (matchId) {
          updateData.lastMatchId = matchId;
        }

        // Check peak/lowest
        const current = await tx.playerRating.findUnique({
          where: { id: update.ratingId },
          select: { peakRating: true, lowestRating: true },
        });

        if (current) {
          if (update.newRating > (current.peakRating || 0)) {
            updateData.peakRating = update.newRating;
            updateData.peakRatingDate = new Date();
          }
          if (update.newRating < (current.lowestRating || Infinity)) {
            updateData.lowestRating = update.newRating;
          }
        }

        await tx.playerRating.update({
          where: { id: update.ratingId },
          data: updateData,
        });

        // Create history entry
        await tx.ratingHistory.create({
          data: {
            playerRatingId: update.ratingId,
            ...(matchId && { matchId }),
            ratingBefore: update.oldRating,
            ratingAfter: update.newRating,
            delta: update.delta,
            rdBefore: update.oldRD,
            rdAfter: update.newRD,
            reason: isWinner ? RatingChangeReason.MATCH_WIN : RatingChangeReason.MATCH_LOSS,
          },
        });
      }
    });
  }

  // ==================== Inactivity Management ====================

  /**
   * Adjust RD for inactive players
   * Should be called periodically (e.g., daily cron job)
   */
  async adjustForInactivity(seasonId?: string): Promise<number> {
    const { inactivityThresholdDays, inactivityRDIncreaseRate, minRDIncrease, maxRD } = this.config;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactivityThresholdDays);

    const whereClause: any = {
      lastUpdatedAt: { lt: cutoffDate },
      ratingDeviation: { lt: maxRD },
    };

    if (seasonId) {
      whereClause.seasonId = seasonId;
    }

    const inactivePlayers = await this.prisma.playerRating.findMany({
      where: whereClause,
    });

    let updatedCount = 0;

    for (const player of inactivePlayers) {
      const daysSinceLastMatch = Math.floor(
        (Date.now() - player.lastUpdatedAt!.getTime()) / (1000 * 60 * 60 * 24)
      );
      const periods = daysSinceLastMatch / inactivityThresholdDays;

      const rdIncrease = Math.max(
        minRDIncrease,
        (player.ratingDeviation || 350) * inactivityRDIncreaseRate * periods
      );

      const newRD = Math.min(maxRD, (player.ratingDeviation || 350) + rdIncrease);

      await this.prisma.playerRating.update({
        where: { id: player.id },
        data: { ratingDeviation: Math.round(newRD) },
      });

      updatedCount++;
    }

    if (updatedCount > 0) {
      logger.info(`Adjusted RD for ${updatedCount} inactive players`);
    }

    return updatedCount;
  }

  // ==================== Utility Methods ====================

  /**
   * Calculate win probability between two players
   */
  calculateWinProbability(
    player1Rating: number,
    player1RD: number,
    player2Rating: number,
    player2RD: number
  ): number {
    const p1RatingG2 = this.scaleDown(player1Rating);
    const p2RatingG2 = this.scaleDown(player2Rating);
    const p2RDG2 = this.scaleDownRD(player2RD);

    return this.E(p1RatingG2, p2RatingG2, p2RDG2);
  }

  /**
   * Get confidence interval for a rating
   */
  getConfidenceInterval(rating: number, rd: number): [number, number] {
    return [rating - 2 * rd, rating + 2 * rd];
  }

  /**
   * Reverse rating changes for a voided match
   */
  async reverseMatchRatings(matchId: string): Promise<void> {
    const historyEntries = await this.prisma.ratingHistory.findMany({
      where: { matchId },
      include: { playerRating: true },
    });

    if (historyEntries.length === 0) {
      logger.warn(`No rating history found for match ${matchId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of historyEntries) {
        await tx.playerRating.update({
          where: { id: entry.playerRatingId },
          data: {
            currentRating: entry.ratingBefore,
            ratingDeviation: entry.rdBefore || entry.playerRating.ratingDeviation,
            matchesPlayed: { decrement: 1 },
            lastUpdatedAt: new Date(),
          },
        });

        await tx.ratingHistory.update({
          where: { id: entry.id },
          data: {
            notes: `${entry.notes || ''} [REVERSED]`.trim(),
          },
        });
      }
    });

    logger.info(`Reversed rating changes for match ${matchId}`);
  }
}

// ==================== Singleton Instance ====================

let dmrServiceInstance: DMRRatingService | null = null;

export function getDMRRatingService(
  sport: SportType = SportType.PICKLEBALL,
  config?: Partial<DMRConfig>
): DMRRatingService {
  if (!dmrServiceInstance) {
    dmrServiceInstance = new DMRRatingService(sport, config);
  }
  return dmrServiceInstance;
}

export default DMRRatingService;
