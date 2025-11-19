/**
 * Admin Rating Service
 * Handles administrative rating operations: adjustments, recalculations, parameters, season locks
 */

import { prisma } from '../../lib/prisma';
import {
  GameType,
  RatingChangeReason,
  SportType
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { getRatingConfig } from './ratingCalculationService';

// Types
export interface ManualAdjustmentInput {
  userId: string;
  seasonId: string;
  gameType: GameType;
  newRating: number;
  reason: string;
  adminId: string;
}

export interface RatingParametersInput {
  seasonId: string;
  initialRating?: number;
  initialRD?: number;
  kFactorNew?: number;
  kFactorEstablished?: number;
  kFactorThreshold?: number;
  singlesWeight?: number;
  doublesWeight?: number;
  oneSetMatchWeight?: number;
  walkoverWinImpact?: number;
  walkoverLossImpact?: number;
  provisionalThreshold?: number;
}

export interface SeasonLockInput {
  seasonId: string;
  adminId: string;
  notes?: string;
}

export interface PlayerRatingSummary {
  userId: string;
  userName: string;
  singlesRating: number | null;
  doublesRating: number | null;
  singlesMatches: number;
  doublesMatches: number;
  isProvisionalSingles: boolean;
  isProvisionalDoubles: boolean;
  lastSinglesDelta: number | null;
  lastDoublesDelta: number | null;
}

export interface DivisionRatingSummary {
  divisionId: string;
  divisionName: string;
  playerCount: number;
  averageSinglesRating: number;
  averageDoublesRating: number;
  highestRating: number;
  lowestRating: number;
}

/**
 * Manually adjust a player's rating
 */
export async function adjustPlayerRating(input: ManualAdjustmentInput): Promise<void> {
  const { userId, seasonId, gameType, newRating, reason, adminId } = input;

  // Find existing rating
  const rating = await prisma.playerRating.findFirst({
    where: {
      userId,
      seasonId,
      gameType
    }
  });

  if (!rating) {
    throw new Error(`No rating found for user ${userId} in season ${seasonId} for ${gameType}`);
  }

  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  if (lock) {
    throw new Error(`Season ${seasonId} is locked. Cannot adjust ratings.`);
  }

  const oldRating = rating.currentRating;
  const delta = newRating - oldRating;

  await prisma.$transaction(async (tx) => {
    // Update rating
    await tx.playerRating.update({
      where: { id: rating.id },
      data: {
        currentRating: newRating,
        lastUpdatedAt: new Date(),
        // Update peak/lowest if needed
        peakRating: newRating > (rating.peakRating || 0) ? newRating : undefined,
        peakRatingDate: newRating > (rating.peakRating || 0) ? new Date() : undefined,
        lowestRating: newRating < (rating.lowestRating || 9999) ? newRating : undefined
      }
    });

    // Create history entry
    await tx.ratingHistory.create({
      data: {
        playerRatingId: rating.id,
        ratingBefore: oldRating,
        ratingAfter: newRating,
        delta,
        rdBefore: rating.ratingDeviation || 350,
        rdAfter: rating.ratingDeviation || 350,
        reason: RatingChangeReason.MANUAL_ADJUSTMENT,
        notes: `Admin adjustment by ${adminId}: ${reason}`
      }
    });
  });

  logger.info(`Admin ${adminId} adjusted rating for user ${userId}`, {
    seasonId,
    gameType,
    oldRating,
    newRating,
    delta,
    reason
  });
}

/**
 * Get all player ratings for a division (admin view)
 */
export async function getDivisionPlayerRatings(
  divisionId: string
): Promise<PlayerRatingSummary[]> {
  // Get all players in division
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      season: true
    }
  });

  if (!division) {
    throw new Error(`Division ${divisionId} not found`);
  }

  const playerRatings: PlayerRatingSummary[] = [];

  for (const player of division.players) {
    // Get singles rating with last history entry
    const singlesRating = await prisma.playerRating.findFirst({
      where: {
        userId: player.userId,
        seasonId: division.seasonId,
        gameType: GameType.SINGLES
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Get doubles rating with last history entry
    const doublesRating = await prisma.playerRating.findFirst({
      where: {
        userId: player.userId,
        seasonId: division.seasonId,
        gameType: GameType.DOUBLES
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    playerRatings.push({
      userId: player.userId,
      userName: player.user.name || 'Unknown',
      singlesRating: singlesRating?.currentRating || null,
      doublesRating: doublesRating?.currentRating || null,
      singlesMatches: singlesRating?.matchesPlayed || 0,
      doublesMatches: doublesRating?.matchesPlayed || 0,
      isProvisionalSingles: singlesRating?.isProvisional || true,
      isProvisionalDoubles: doublesRating?.isProvisional || true,
      lastSinglesDelta: singlesRating?.history[0]?.delta || null,
      lastDoublesDelta: doublesRating?.history[0]?.delta || null
    });
  }

  // Sort by singles rating descending
  playerRatings.sort((a, b) => (b.singlesRating || 0) - (a.singlesRating || 0));

  return playerRatings;
}

/**
 * Get division rating summary/averages
 */
export async function getDivisionRatingSummary(
  divisionId: string
): Promise<DivisionRatingSummary> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      players: true
    }
  });

  if (!division) {
    throw new Error(`Division ${divisionId} not found`);
  }

  // Get all ratings for players in this division
  const userIds = division.players.map(p => p.userId);

  const ratings = await prisma.playerRating.findMany({
    where: {
      userId: { in: userIds },
      seasonId: division.seasonId
    }
  });

  const singlesRatings = ratings
    .filter(r => r.gameType === GameType.SINGLES)
    .map(r => r.currentRating);

  const doublesRatings = ratings
    .filter(r => r.gameType === GameType.DOUBLES)
    .map(r => r.currentRating);

  const allRatings = ratings.map(r => r.currentRating);

  return {
    divisionId,
    divisionName: division.name,
    playerCount: division.players.length,
    averageSinglesRating: singlesRatings.length > 0
      ? Math.round(singlesRatings.reduce((a, b) => a + b, 0) / singlesRatings.length)
      : 0,
    averageDoublesRating: doublesRatings.length > 0
      ? Math.round(doublesRatings.reduce((a, b) => a + b, 0) / doublesRatings.length)
      : 0,
    highestRating: allRatings.length > 0 ? Math.max(...allRatings) : 0,
    lowestRating: allRatings.length > 0 ? Math.min(...allRatings) : 0
  };
}

/**
 * Preview recalculation changes without applying
 */
export async function previewRecalculation(
  scope: 'match' | 'player' | 'division' | 'season',
  targetId: string
): Promise<{
  scope: string;
  targetId: string;
  affectedPlayers: number;
  affectedMatches: number;
  changes: Array<{
    userId: string;
    userName: string;
    currentRating: number;
    projectedRating: number;
    delta: number;
  }>;
}> {
  let affectedMatches = 0;
  let affectedPlayers = 0;
  const changes: Array<{
    userId: string;
    userName: string;
    currentRating: number;
    projectedRating: number;
    delta: number;
  }> = [];

  switch (scope) {
    case 'match': {
      const match = await prisma.match.findUnique({
        where: { id: targetId },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true } }
            }
          }
        }
      });
      if (match) {
        affectedMatches = 1;
        affectedPlayers = match.participants.length;
        for (const p of match.participants) {
          const rating = await prisma.playerRating.findFirst({
            where: { userId: p.userId, seasonId: match.seasonId }
          });
          changes.push({
            userId: p.userId,
            userName: p.user.name || 'Unknown',
            currentRating: rating?.currentRating || 1500,
            projectedRating: rating?.currentRating || 1500, // Would need full calc
            delta: 0
          });
        }
      }
      break;
    }
    case 'player': {
      const ratings = await prisma.playerRating.findMany({
        where: { userId: targetId },
        include: { user: { select: { name: true } } }
      });
      const matchCount = await prisma.match.count({
        where: {
          participants: { some: { userId: targetId } },
          status: 'COMPLETED'
        }
      });
      affectedMatches = matchCount;
      affectedPlayers = 1;
      for (const r of ratings) {
        changes.push({
          userId: targetId,
          userName: r.user?.name || 'Unknown',
          currentRating: r.currentRating,
          projectedRating: r.currentRating,
          delta: 0
        });
      }
      break;
    }
    case 'division': {
      const division = await prisma.division.findUnique({
        where: { id: targetId },
        include: { players: true }
      });
      if (division) {
        affectedPlayers = division.players.length;
        affectedMatches = await prisma.match.count({
          where: { divisionId: targetId, status: 'COMPLETED' }
        });
        for (const p of division.players) {
          const rating = await prisma.playerRating.findFirst({
            where: { userId: p.userId, seasonId: division.seasonId }
          });
          const user = await prisma.user.findUnique({
            where: { id: p.userId },
            select: { name: true }
          });
          changes.push({
            userId: p.userId,
            userName: user?.name || 'Unknown',
            currentRating: rating?.currentRating || 1500,
            projectedRating: rating?.currentRating || 1500,
            delta: 0
          });
        }
      }
      break;
    }
    case 'season': {
      affectedMatches = await prisma.match.count({
        where: { seasonId: targetId, status: 'COMPLETED' }
      });
      const ratings = await prisma.playerRating.findMany({
        where: { seasonId: targetId },
        include: { user: { select: { name: true } } }
      });
      affectedPlayers = new Set(ratings.map(r => r.userId)).size;
      for (const r of ratings) {
        changes.push({
          userId: r.userId,
          userName: r.user?.name || 'Unknown',
          currentRating: r.currentRating,
          projectedRating: r.currentRating,
          delta: 0
        });
      }
      break;
    }
  }

  return {
    scope,
    targetId,
    affectedPlayers,
    affectedMatches,
    changes
  };
}

/**
 * Recalculate ratings for a single match
 */
export async function recalculateMatchRatings(
  matchId: string,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { participants: true }
  });

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.status !== 'COMPLETED') {
    throw new Error(`Match ${matchId} is not completed`);
  }

  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: { seasonId: match.seasonId, isLocked: true }
  });

  if (lock) {
    throw new Error(`Season is locked. Cannot recalculate.`);
  }

  const { calculateMatchRatings, applyMatchRatings } = await import('./ratingCalculationService');

  try {
    const updates = await calculateMatchRatings(matchId);
    if (updates) {
      await applyMatchRatings(matchId, updates);
    }

    logger.info(`Recalculated ratings for match ${matchId} by admin ${adminId}`);
    return { success: true, message: `Recalculated ratings for match ${matchId}` };
  } catch (error) {
    throw new Error(`Failed to recalculate match: ${(error as Error).message}`);
  }
}

/**
 * Recalculate ratings for a single player
 */
export async function recalculatePlayerRatings(
  userId: string,
  seasonId: string,
  adminId: string
): Promise<{ matchesProcessed: number; ratingsUpdated: number }> {
  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: { seasonId, isLocked: true }
  });

  if (lock) {
    throw new Error(`Season is locked. Cannot recalculate.`);
  }

  // Get player's ratings
  const ratings = await prisma.playerRating.findMany({
    where: { userId, seasonId }
  });

  if (ratings.length === 0) {
    throw new Error(`No ratings found for user ${userId} in season ${seasonId}`);
  }

  const config = await getRatingConfig(seasonId);

  // Reset player's ratings
  for (const rating of ratings) {
    await prisma.playerRating.update({
      where: { id: rating.id },
      data: {
        currentRating: config.initialRating,
        ratingDeviation: config.initialRD,
        matchesPlayed: 0,
        isProvisional: true,
        peakRating: config.initialRating,
        lowestRating: config.initialRating
      }
    });

    await prisma.ratingHistory.create({
      data: {
        playerRatingId: rating.id,
        ratingBefore: rating.currentRating,
        ratingAfter: config.initialRating,
        delta: config.initialRating - rating.currentRating,
        rdBefore: rating.ratingDeviation || 350,
        rdAfter: config.initialRD,
        reason: RatingChangeReason.RECALCULATION,
        notes: `Player recalculation by admin ${adminId}`
      }
    });
  }

  // Get all completed matches for this player
  const matches = await prisma.match.findMany({
    where: {
      seasonId,
      status: 'COMPLETED',
      participants: { some: { userId } }
    },
    orderBy: { completedAt: 'asc' }
  });

  const { calculateMatchRatings, applyMatchRatings } = await import('./ratingCalculationService');

  let matchesProcessed = 0;
  let ratingsUpdated = 0;

  for (const match of matches) {
    try {
      const updates = await calculateMatchRatings(match.id);
      if (updates) {
        await applyMatchRatings(match.id, updates);
        ratingsUpdated++;
      }
      matchesProcessed++;
    } catch (error) {
      logger.error(`Failed to process match ${match.id}:`, {}, error as Error);
    }
  }

  logger.info(`Recalculated ratings for player ${userId} by admin ${adminId}`, {
    matchesProcessed,
    ratingsUpdated
  });

  return { matchesProcessed, ratingsUpdated };
}

/**
 * Recalculate ratings for a division
 */
export async function recalculateDivisionRatings(
  divisionId: string,
  adminId: string
): Promise<{ matchesProcessed: number; ratingsUpdated: number }> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: { players: true }
  });

  if (!division) {
    throw new Error(`Division ${divisionId} not found`);
  }

  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: { seasonId: division.seasonId, isLocked: true }
  });

  if (lock) {
    throw new Error(`Season is locked. Cannot recalculate.`);
  }

  const config = await getRatingConfig(division.seasonId);
  const userIds = division.players.map(p => p.userId);

  // Reset all ratings for players in division
  const ratings = await prisma.playerRating.findMany({
    where: {
      userId: { in: userIds },
      seasonId: division.seasonId
    }
  });

  for (const rating of ratings) {
    await prisma.playerRating.update({
      where: { id: rating.id },
      data: {
        currentRating: config.initialRating,
        ratingDeviation: config.initialRD,
        matchesPlayed: 0,
        isProvisional: true,
        peakRating: config.initialRating,
        lowestRating: config.initialRating
      }
    });

    await prisma.ratingHistory.create({
      data: {
        playerRatingId: rating.id,
        ratingBefore: rating.currentRating,
        ratingAfter: config.initialRating,
        delta: config.initialRating - rating.currentRating,
        rdBefore: rating.ratingDeviation || 350,
        rdAfter: config.initialRD,
        reason: RatingChangeReason.RECALCULATION,
        notes: `Division recalculation by admin ${adminId}`
      }
    });
  }

  // Get all completed matches in division
  const matches = await prisma.match.findMany({
    where: {
      divisionId,
      status: 'COMPLETED'
    },
    orderBy: { completedAt: 'asc' }
  });

  const { calculateMatchRatings, applyMatchRatings } = await import('./ratingCalculationService');

  let matchesProcessed = 0;
  let ratingsUpdated = 0;

  for (const match of matches) {
    try {
      const updates = await calculateMatchRatings(match.id);
      if (updates) {
        await applyMatchRatings(match.id, updates);
        ratingsUpdated += 2;
      }
      matchesProcessed++;
    } catch (error) {
      logger.error(`Failed to process match ${match.id}:`, {}, error as Error);
    }
  }

  logger.info(`Recalculated ratings for division ${divisionId} by admin ${adminId}`, {
    matchesProcessed,
    ratingsUpdated
  });

  return { matchesProcessed, ratingsUpdated };
}

/**
 * Recalculate all ratings for a season
 * This replays all matches in chronological order
 */
export async function recalculateSeasonRatings(
  seasonId: string,
  adminId: string
): Promise<{ matchesProcessed: number; ratingsUpdated: number }> {
  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  if (lock) {
    throw new Error(`Season ${seasonId} is locked. Cannot recalculate ratings.`);
  }

  logger.info(`Starting rating recalculation for season ${seasonId} by admin ${adminId}`);

  // Get all completed matches in chronological order
  const matches = await prisma.match.findMany({
    where: {
      seasonId,
      status: 'COMPLETED'
    },
    orderBy: { completedAt: 'asc' },
    include: {
      participants: true
    }
  });

  // Reset all ratings for the season to initial values
  const ratings = await prisma.playerRating.findMany({
    where: { seasonId }
  });

  const config = await getRatingConfig(seasonId);

  // Reset ratings
  await prisma.$transaction(async (tx) => {
    for (const rating of ratings) {
      await tx.playerRating.update({
        where: { id: rating.id },
        data: {
          currentRating: config.initialRating,
          ratingDeviation: config.initialRD,
          matchesPlayed: 0,
          isProvisional: true,
          peakRating: config.initialRating,
          lowestRating: config.initialRating
        }
      });

      // Create history entry for reset
      await tx.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          ratingBefore: rating.currentRating,
          ratingAfter: config.initialRating,
          delta: config.initialRating - rating.currentRating,
          rdBefore: rating.ratingDeviation || 350,
          rdAfter: config.initialRD,
          reason: RatingChangeReason.ADMIN_RESET,
          notes: `Recalculation initiated by admin ${adminId}`
        }
      });
    }
  });

  // Import dynamically to avoid circular dependency
  const { calculateMatchRatings, applyMatchRatings } = await import('./ratingCalculationService');

  // Replay all matches
  let matchesProcessed = 0;
  let ratingsUpdated = 0;

  for (const match of matches) {
    try {
      const updates = await calculateMatchRatings(match.id);
      if (updates) {
        await applyMatchRatings(match.id, updates);
        ratingsUpdated += 2; // Winner and loser
      }
      matchesProcessed++;
    } catch (error) {
      logger.error(`Failed to process match ${match.id} during recalculation:`, {}, error as Error);
    }
  }

  logger.info(`Completed rating recalculation for season ${seasonId}`, {
    matchesProcessed,
    ratingsUpdated,
    adminId
  });

  return { matchesProcessed, ratingsUpdated };
}

/**
 * Update rating parameters for a season
 */
export async function updateRatingParameters(
  input: RatingParametersInput
): Promise<{ warning?: string }> {
  const { seasonId, ...params } = input;

  // Check if season is locked
  const lock = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  if (lock) {
    throw new Error(`Season ${seasonId} is locked. Cannot update parameters.`);
  }

  // Check if season has started (has completed matches)
  let warning: string | undefined;
  const completedMatches = await prisma.match.count({
    where: {
      seasonId,
      status: 'COMPLETED'
    }
  });

  if (completedMatches > 0) {
    warning = `Warning: Season has ${completedMatches} completed matches. Changing parameters may cause rating inconsistencies. Consider recalculating ratings after this change.`;
  }

  // Get existing parameters or create new
  const existing = await prisma.ratingParameters.findFirst({
    where: {
      seasonId,
      isActive: true
    },
    orderBy: { version: 'desc' }
  });

  if (existing) {
    // Deactivate old parameters
    await prisma.ratingParameters.update({
      where: { id: existing.id },
      data: { isActive: false }
    });

    // Create new version
    await prisma.ratingParameters.create({
      data: {
        seasonId,
        version: existing.version + 1,
        isActive: true,
        initialRating: params.initialRating ?? existing.initialRating,
        initialRD: params.initialRD ?? existing.initialRD,
        kFactorNew: params.kFactorNew ?? existing.kFactorNew,
        kFactorEstablished: params.kFactorEstablished ?? existing.kFactorEstablished,
        kFactorThreshold: params.kFactorThreshold ?? existing.kFactorThreshold,
        singlesWeight: params.singlesWeight ?? existing.singlesWeight,
        doublesWeight: params.doublesWeight ?? existing.doublesWeight,
        oneSetMatchWeight: params.oneSetMatchWeight ?? existing.oneSetMatchWeight,
        walkoverWinImpact: params.walkoverWinImpact ?? existing.walkoverWinImpact,
        walkoverLossImpact: params.walkoverLossImpact ?? existing.walkoverLossImpact,
        provisionalThreshold: params.provisionalThreshold ?? existing.provisionalThreshold
      }
    });
  } else {
    // Create first version with defaults
    const config = await getRatingConfig();

    await prisma.ratingParameters.create({
      data: {
        seasonId,
        version: 1,
        isActive: true,
        initialRating: params.initialRating ?? config.initialRating,
        initialRD: params.initialRD ?? config.initialRD,
        kFactorNew: params.kFactorNew ?? config.kFactorNew,
        kFactorEstablished: params.kFactorEstablished ?? config.kFactorEstablished,
        kFactorThreshold: params.kFactorThreshold ?? config.kFactorThreshold,
        singlesWeight: params.singlesWeight ?? config.singlesWeight,
        doublesWeight: params.doublesWeight ?? config.doublesWeight,
        oneSetMatchWeight: params.oneSetMatchWeight ?? config.oneSetMatchWeight,
        walkoverWinImpact: params.walkoverWinImpact ?? config.walkoverWinImpact,
        walkoverLossImpact: params.walkoverLossImpact ?? config.walkoverLossImpact,
        provisionalThreshold: params.provisionalThreshold ?? config.provisionalThreshold
      }
    });
  }

  logger.info(`Updated rating parameters for season ${seasonId}`);

  return { warning };
}

/**
 * Get current rating parameters for a season
 */
export async function getRatingParameters(seasonId: string) {
  const params = await prisma.ratingParameters.findFirst({
    where: {
      seasonId,
      isActive: true
    },
    orderBy: { version: 'desc' }
  });

  if (!params) {
    return getRatingConfig();
  }

  return params;
}

/**
 * Lock ratings for a season (finalization)
 */
export async function lockSeasonRatings(input: SeasonLockInput): Promise<void> {
  const { seasonId, adminId, notes } = input;

  // Check if already locked
  const existing = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  if (existing) {
    throw new Error(`Season ${seasonId} is already locked`);
  }

  // Verify all matches are completed or voided
  const pendingMatches = await prisma.match.count({
    where: {
      seasonId,
      status: {
        notIn: ['COMPLETED', 'CANCELLED', 'VOID']
      }
    }
  });

  if (pendingMatches > 0) {
    throw new Error(`Cannot lock season: ${pendingMatches} matches are still pending`);
  }

  await prisma.seasonLock.create({
    data: {
      seasonId,
      isLocked: true,
      lockedAt: new Date(),
      lockedBy: adminId,
      notes
    }
  });

  logger.info(`Season ${seasonId} ratings locked by admin ${adminId}`);
}

/**
 * Unlock ratings for a season
 */
export async function unlockSeasonRatings(
  seasonId: string,
  adminId: string
): Promise<void> {
  const lock = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  if (!lock) {
    throw new Error(`Season ${seasonId} is not locked`);
  }

  await prisma.seasonLock.update({
    where: { id: lock.id },
    data: {
      isLocked: false,
      notes: `${lock.notes || ''} | Unlocked by ${adminId} at ${new Date().toISOString()}`.trim()
    }
  });

  logger.info(`Season ${seasonId} ratings unlocked by admin ${adminId}`);
}

/**
 * Check if season ratings are locked
 */
export async function isSeasonLocked(seasonId: string): Promise<boolean> {
  const lock = await prisma.seasonLock.findFirst({
    where: {
      seasonId,
      isLocked: true
    }
  });

  return !!lock;
}

/**
 * Get season lock status
 */
export async function getSeasonLockStatus(seasonId: string) {
  const lock = await prisma.seasonLock.findFirst({
    where: { seasonId },
    orderBy: { lockedAt: 'desc' }
  });

  return {
    seasonId,
    isLocked: lock?.isLocked || false,
    lockedAt: lock?.lockedAt || null,
    lockedBy: lock?.lockedBy || null,
    notes: lock?.notes || null
  };
}

// Singleton pattern
let adminRatingServiceInstance: typeof adminRatingService | null = null;

/**
 * Generate season export (CSV/JSON)
 */
export async function generateSeasonExport(
  seasonId: string,
  format: 'csv' | 'json' = 'json'
): Promise<{ data: string; filename: string }> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { name: true }
  });

  if (!season) {
    throw new Error(`Season ${seasonId} not found`);
  }

  // Get all ratings for the season
  const ratings = await prisma.playerRating.findMany({
    where: { seasonId },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      },
      division: {
        select: { name: true }
      }
    },
    orderBy: [
      { divisionId: 'asc' },
      { currentRating: 'desc' }
    ]
  });

  // Get all standings
  const standings = await prisma.divisionStanding.findMany({
    where: { seasonId },
    include: {
      user: {
        select: { id: true, name: true }
      },
      division: {
        select: { name: true }
      }
    },
    orderBy: [
      { divisionId: 'asc' },
      { rank: 'asc' }
    ]
  });

  const exportData = {
    season: season.name,
    exportedAt: new Date().toISOString(),
    ratings: ratings.map(r => ({
      userId: r.userId,
      userName: r.user?.name || 'Unknown',
      email: r.user?.email || '',
      division: r.division?.name || 'N/A',
      gameType: r.gameType,
      currentRating: r.currentRating,
      matchesPlayed: r.matchesPlayed,
      isProvisional: r.isProvisional,
      peakRating: r.peakRating,
      lowestRating: r.lowestRating
    })),
    standings: standings.map(s => ({
      userId: s.userId,
      userName: s.user?.name || 'Unknown',
      division: s.division?.name || 'N/A',
      rank: s.rank,
      wins: s.wins,
      losses: s.losses,
      totalPoints: s.totalPoints,
      setsWon: s.setsWon,
      setsLost: s.setsLost
    }))
  };

  const filename = `${season.name.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}`;

  if (format === 'json') {
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `${filename}.json`
    };
  }

  // CSV format
  const ratingsCsv = [
    'userId,userName,email,division,gameType,currentRating,matchesPlayed,isProvisional,peakRating,lowestRating',
    ...exportData.ratings.map(r =>
      `${r.userId},${r.userName},${r.email},${r.division},${r.gameType},${r.currentRating},${r.matchesPlayed},${r.isProvisional},${r.peakRating},${r.lowestRating}`
    )
  ].join('\n');

  const standingsCsv = [
    'userId,userName,division,rank,wins,losses,totalPoints,setsWon,setsLost',
    ...exportData.standings.map(s =>
      `${s.userId},${s.userName},${s.division},${s.rank},${s.wins},${s.losses},${s.totalPoints},${s.setsWon},${s.setsLost}`
    )
  ].join('\n');

  return {
    data: `RATINGS\n${ratingsCsv}\n\nSTANDINGS\n${standingsCsv}`,
    filename: `${filename}.csv`
  };
}

const adminRatingService = {
  adjustPlayerRating,
  getDivisionPlayerRatings,
  getDivisionRatingSummary,
  previewRecalculation,
  recalculateMatchRatings,
  recalculatePlayerRatings,
  recalculateDivisionRatings,
  recalculateSeasonRatings,
  updateRatingParameters,
  getRatingParameters,
  lockSeasonRatings,
  unlockSeasonRatings,
  isSeasonLocked,
  getSeasonLockStatus,
  generateSeasonExport
};

export function getAdminRatingService() {
  if (!adminRatingServiceInstance) {
    adminRatingServiceInstance = adminRatingService;
  }
  return adminRatingServiceInstance;
}

export default adminRatingService;
