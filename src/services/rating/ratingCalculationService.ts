/**
 * Rating Calculation Service
 * Handles ELO rating calculations and updates after matches
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  GameType,
  RatingChangeReason
} from '@prisma/client';
import { logger } from '../../utils/logger';

// Types
export interface RatingUpdate {
  odlayerId: string;
  ratingId: string;
  oldRating: number;
  newRating: number;
  delta: number;
  oldRd: number;
  newRd: number;
  matchesPlayed: number;
}

export interface MatchRatingResult {
  winner: RatingUpdate;
  loser: RatingUpdate;
}

export interface RatingConfig {
  initialRating: number;
  initialRD: number;
  kFactorNew: number;
  kFactorEstablished: number;
  kFactorThreshold: number;
  singlesWeight: number;
  doublesWeight: number;
  oneSetMatchWeight: number;
  walkoverWinImpact: number;
  walkoverLossImpact: number;
  provisionalThreshold: number;
}

// Default configuration
const DEFAULT_CONFIG: RatingConfig = {
  initialRating: 1500,
  initialRD: 350,
  kFactorNew: 40,
  kFactorEstablished: 20,
  kFactorThreshold: 30,
  singlesWeight: 1.0,
  doublesWeight: 1.0,
  oneSetMatchWeight: 0.5,
  walkoverWinImpact: 0.5,
  walkoverLossImpact: 1.0,
  provisionalThreshold: 10
};

/**
 * Get rating configuration for a season
 */
export async function getRatingConfig(seasonId?: string): Promise<RatingConfig> {
  if (seasonId) {
    const params = await prisma.ratingParameters.findFirst({
      where: {
        seasonId,
        isActive: true
      },
      orderBy: { version: 'desc' }
    });

    if (params) {
      return {
        initialRating: params.initialRating,
        initialRD: params.initialRD,
        kFactorNew: params.kFactorNew,
        kFactorEstablished: params.kFactorEstablished,
        kFactorThreshold: params.kFactorThreshold,
        singlesWeight: params.singlesWeight,
        doublesWeight: params.doublesWeight,
        oneSetMatchWeight: params.oneSetMatchWeight,
        walkoverWinImpact: params.walkoverWinImpact,
        walkoverLossImpact: params.walkoverLossImpact,
        provisionalThreshold: params.provisionalThreshold
      };
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Calculate expected score using ELO formula
 * @param ratingA - Player A's rating
 * @param ratingB - Player B's rating
 * @returns Expected score for player A (0 to 1)
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Get K-factor based on player's rating status
 */
function getKFactor(
  matchesPlayed: number,
  isProvisional: boolean,
  config: RatingConfig
): number {
  if (isProvisional || matchesPlayed < config.provisionalThreshold) {
    return config.kFactorNew;
  }
  return config.kFactorEstablished;
}

/**
 * Calculate new rating deviation (simplified Glicko)
 */
function calculateNewRD(currentRD: number, matchesPlayed: number): number {
  // RD decreases as more matches are played
  const minRD = 50;
  const rdDecay = 0.9;

  const newRD = Math.max(minRD, currentRD * rdDecay);
  return Math.round(newRD);
}

/**
 * Calculate rating changes for a completed match
 */
export async function calculateMatchRatings(matchId: string): Promise<MatchRatingResult | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      participants: {
        include: {
          user: true
        }
      },
      scores: true
    }
  });

  if (!match) {
    logger.error(`Match ${matchId} not found for rating calculation`);
    return null;
  }

  if (match.status !== MatchStatus.COMPLETED) {
    logger.warn(`Match ${matchId} is not completed, skipping rating calculation`);
    return null;
  }

  // Determine winner and loser
  const winnerId = match.outcome === 'team1'
    ? match.participants.find(p => p.team === 'team1')?.userId
    : match.participants.find(p => p.team === 'team2')?.userId;

  const loserId = match.outcome === 'team1'
    ? match.participants.find(p => p.team === 'team2')?.userId
    : match.participants.find(p => p.team === 'team1')?.userId;

  if (!winnerId || !loserId) {
    logger.error(`Could not determine winner/loser for match ${matchId}`);
    return null;
  }

  // Get current ratings
  const gameType = match.matchType as GameType || GameType.SINGLES;

  const [winnerRating, loserRating] = await Promise.all([
    getOrCreatePlayerRating(winnerId, match.seasonId!, gameType),
    getOrCreatePlayerRating(loserId, match.seasonId!, gameType)
  ]);

  // Get config
  const config = await getRatingConfig(match.seasonId || undefined);

  // Calculate expected scores
  const winnerExpected = calculateExpectedScore(
    winnerRating.currentRating,
    loserRating.currentRating
  );
  const loserExpected = 1 - winnerExpected;

  // Get K-factors
  const winnerK = getKFactor(winnerRating.matchesPlayed, winnerRating.isProvisional, config);
  const loserK = getKFactor(loserRating.matchesPlayed, loserRating.isProvisional, config);

  // Calculate weight multiplier
  let weight = 1.0;

  // Game type weight
  if (gameType === GameType.DOUBLES) {
    weight *= config.doublesWeight;
  } else {
    weight *= config.singlesWeight;
  }

  // One-set match weight
  if (match.format === 'ONE_SET') {
    weight *= config.oneSetMatchWeight;
  }

  // Walkover impact
  if (match.isWalkover) {
    // Winner gets reduced gain, loser gets full loss (or configurable)
    const winnerWeight = weight * config.walkoverWinImpact;
    const loserWeight = weight * config.walkoverLossImpact;

    const winnerDelta = Math.round(winnerK * (1 - winnerExpected) * winnerWeight);
    const loserDelta = Math.round(loserK * (0 - loserExpected) * loserWeight);

    return {
      winner: {
        odlayerId: winnerId,
        ratingId: winnerRating.id,
        oldRating: winnerRating.currentRating,
        newRating: winnerRating.currentRating + winnerDelta,
        delta: winnerDelta,
        oldRd: winnerRating.ratingDeviation || 350,
        newRd: calculateNewRD(winnerRating.ratingDeviation || 350, winnerRating.matchesPlayed + 1),
        matchesPlayed: winnerRating.matchesPlayed + 1
      },
      loser: {
        odlayerId: loserId,
        ratingId: loserRating.id,
        oldRating: loserRating.currentRating,
        newRating: loserRating.currentRating + loserDelta,
        delta: loserDelta,
        oldRd: loserRating.ratingDeviation || 350,
        newRd: calculateNewRD(loserRating.ratingDeviation || 350, loserRating.matchesPlayed + 1),
        matchesPlayed: loserRating.matchesPlayed + 1
      }
    };
  }

  // Normal match calculation
  const winnerDelta = Math.round(winnerK * (1 - winnerExpected) * weight);
  const loserDelta = Math.round(loserK * (0 - loserExpected) * weight);

  return {
    winner: {
      odlayerId: winnerId,
      ratingId: winnerRating.id,
      oldRating: winnerRating.currentRating,
      newRating: winnerRating.currentRating + winnerDelta,
      delta: winnerDelta,
      oldRd: winnerRating.ratingDeviation || 350,
      newRd: calculateNewRD(winnerRating.ratingDeviation || 350, winnerRating.matchesPlayed + 1),
      matchesPlayed: winnerRating.matchesPlayed + 1
    },
    loser: {
      odlayerId: loserId,
      ratingId: loserRating.id,
      oldRating: loserRating.currentRating,
      newRating: loserRating.currentRating + loserDelta,
      delta: loserDelta,
      oldRd: loserRating.ratingDeviation || 350,
      newRd: calculateNewRD(loserRating.ratingDeviation || 350, loserRating.matchesPlayed + 1),
      matchesPlayed: loserRating.matchesPlayed + 1
    }
  };
}

/**
 * Get or create player rating for a season
 */
async function getOrCreatePlayerRating(
  userId: string,
  seasonId: string,
  gameType: GameType
) {
  // Try to find existing rating
  let rating = await prisma.playerRating.findFirst({
    where: {
      userId,
      seasonId,
      gameType
    }
  });

  if (rating) {
    return rating;
  }

  // Get season info for sport type
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      leagues: {
        select: { sportType: true },
        take: 1
      }
    }
  });

  const sport = season?.leagues[0]?.sportType || 'TENNIS';

  // Try to get rating from questionnaire
  const questionnaire = await prisma.questionnaireResponse.findFirst({
    where: {
      userId,
      completedAt: { not: null }
    },
    include: { result: true },
    orderBy: { completedAt: 'desc' }
  });

  const initialRating = gameType === GameType.DOUBLES
    ? questionnaire?.result?.doubles || 1500
    : questionnaire?.result?.singles || 1500;

  const initialRD = questionnaire?.result?.rd || 350;

  // Create new rating
  rating = await prisma.playerRating.create({
    data: {
      userId,
      seasonId,
      sport: sport as any,
      gameType,
      currentRating: initialRating,
      ratingDeviation: initialRD,
      isProvisional: true,
      matchesPlayed: 0,
      peakRating: initialRating,
      peakRatingDate: new Date(),
      lowestRating: initialRating
    }
  });

  // Create initial history entry
  await prisma.ratingHistory.create({
    data: {
      playerRatingId: rating.id,
      ratingBefore: 1500,
      ratingAfter: initialRating,
      delta: initialRating - 1500,
      rdBefore: 350,
      rdAfter: initialRD,
      reason: RatingChangeReason.INITIAL_PLACEMENT,
      notes: 'Auto-created for match'
    }
  });

  return rating;
}

/**
 * Apply rating updates after a match
 */
export async function applyMatchRatings(
  matchId: string,
  updates: MatchRatingResult
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update winner rating
    const winnerData: any = {
      currentRating: updates.winner.newRating,
      ratingDeviation: updates.winner.newRd,
      matchesPlayed: updates.winner.matchesPlayed,
      lastMatchId: matchId,
      lastUpdatedAt: new Date(),
      isProvisional: updates.winner.matchesPlayed < 10
    };
    // Update peak/lowest only if applicable
    if (updates.winner.newRating > updates.winner.oldRating) {
      winnerData.peakRating = updates.winner.newRating;
      winnerData.peakRatingDate = new Date();
    }

    const winnerUpdate = await tx.playerRating.update({
      where: { id: updates.winner.ratingId },
      data: winnerData
    });

    // Create winner history
    await tx.ratingHistory.create({
      data: {
        playerRatingId: updates.winner.ratingId,
        matchId,
        ratingBefore: updates.winner.oldRating,
        ratingAfter: updates.winner.newRating,
        delta: updates.winner.delta,
        rdBefore: updates.winner.oldRd,
        rdAfter: updates.winner.newRd,
        reason: RatingChangeReason.MATCH_WIN
      }
    });

    // Update loser rating
    const loserData: any = {
      currentRating: updates.loser.newRating,
      ratingDeviation: updates.loser.newRd,
      matchesPlayed: updates.loser.matchesPlayed,
      lastMatchId: matchId,
      lastUpdatedAt: new Date(),
      isProvisional: updates.loser.matchesPlayed < 10
    };
    // Update lowest only if applicable
    if (updates.loser.newRating < updates.loser.oldRating) {
      loserData.lowestRating = updates.loser.newRating;
    }

    await tx.playerRating.update({
      where: { id: updates.loser.ratingId },
      data: loserData
    });

    // Create loser history
    await tx.ratingHistory.create({
      data: {
        playerRatingId: updates.loser.ratingId,
        matchId,
        ratingBefore: updates.loser.oldRating,
        ratingAfter: updates.loser.newRating,
        delta: updates.loser.delta,
        rdBefore: updates.loser.oldRd,
        rdAfter: updates.loser.newRd,
        reason: RatingChangeReason.MATCH_LOSS
      }
    });
  });

  logger.info(`Applied rating updates for match ${matchId}`, {
    winner: { odlayerId: updates.winner.odlayerId, delta: updates.winner.delta },
    loser: { odlayerId: updates.loser.odlayerId, delta: updates.loser.delta }
  });
}

/**
 * Reverse rating changes for a voided match
 */
export async function reverseMatchRatings(matchId: string): Promise<void> {
  // Find all rating history entries for this match
  const historyEntries = await prisma.ratingHistory.findMany({
    where: { matchId },
    include: { playerRating: true }
  });

  if (historyEntries.length === 0) {
    logger.warn(`No rating history found for match ${matchId}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of historyEntries) {
      // Reverse the rating change
      await tx.playerRating.update({
        where: { id: entry.playerRatingId },
        data: {
          currentRating: entry.ratingBefore,
          ratingDeviation: entry.rdBefore || entry.playerRating.ratingDeviation,
          matchesPlayed: { decrement: 1 },
          lastUpdatedAt: new Date()
        }
      });

      // Mark history entry as reversed
      await tx.ratingHistory.update({
        where: { id: entry.id },
        data: {
          notes: `${entry.notes || ''} [REVERSED]`.trim()
        }
      });
    }
  });

  logger.info(`Reversed rating changes for match ${matchId}`);
}

// Singleton pattern
let ratingCalculationServiceInstance: typeof ratingCalculationService | null = null;

const ratingCalculationService = {
  getRatingConfig,
  calculateExpectedScore,
  calculateMatchRatings,
  applyMatchRatings,
  reverseMatchRatings
};

export function getRatingCalculationService() {
  if (!ratingCalculationServiceInstance) {
    ratingCalculationServiceInstance = ratingCalculationService;
  }
  return ratingCalculationServiceInstance;
}

export default ratingCalculationService;
