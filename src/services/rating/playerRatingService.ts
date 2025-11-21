/**
 * Player Rating Service
 * Handles player rating retrieval, history, and initial creation
 */

import { prisma } from '../../lib/prisma';
import { GameType, SportType, RatingChangeReason } from '@prisma/client';
import { logger } from '../../utils/logger';

// Types
export interface PlayerRatingResponse {
  userId: string;
  seasonId: string;
  divisionId: string | null;
  divisionName: string | null;

  // Rating info
  currentRating: number;
  ratingDeviation: number;
  isProvisional: boolean;
  matchesPlayed: number;

  // Peak/low tracking
  peakRating: number | null;
  peakRatingDate: Date | null;
  lowestRating: number | null;

  // Timestamps
  lastUpdatedAt: Date;
  lastMatchId: string | null;

  // Sport context
  sport: SportType;
  gameType: GameType;
}

export interface RatingHistoryEntry {
  id: string;
  matchId: string | null;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  reason: RatingChangeReason;
  notes: string | null;
  createdAt: Date;
  matchDate: Date | null;
  adversary: string | null;
}

export interface CreateInitialRatingInput {
  userId: string;
  seasonId: string;
  divisionId?: string;
  sport: SportType;
  singles: number | null;
  doubles: number | null;
  rd: number;
}

/**
 * Get player's current rating
 */
export async function getPlayerRating(
  userId: string,
  seasonId?: string,
  gameType: GameType = GameType.SINGLES
): Promise<PlayerRatingResponse | null> {
  const where: any = {
    userId,
    gameType
  };

  if (seasonId) {
    where.seasonId = seasonId;
  }

  const rating = await prisma.playerRating.findFirst({
    where,
    include: {
      division: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { lastUpdatedAt: 'desc' }
  });

  if (!rating) {
    return null;
  }

  return {
    userId: rating.userId,
    seasonId: rating.seasonId,
    divisionId: rating.divisionId,
    divisionName: rating.division?.name || null,
    currentRating: rating.currentRating,
    ratingDeviation: rating.ratingDeviation || 350,
    isProvisional: rating.isProvisional,
    matchesPlayed: rating.matchesPlayed,
    peakRating: rating.peakRating,
    peakRatingDate: rating.peakRatingDate,
    lowestRating: rating.lowestRating,
    lastUpdatedAt: rating.lastUpdatedAt,
    lastMatchId: rating.lastMatchId,
    sport: rating.sport,
    gameType: rating.gameType
  };
}

/**
 * Get all ratings for a player (across seasons/game types)
 */
export async function getPlayerRatings(userId: string): Promise<PlayerRatingResponse[]> {
  const ratings = await prisma.playerRating.findMany({
    where: { userId },
    include: {
      division: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [
      { seasonId: 'desc' },
      { lastUpdatedAt: 'desc' }
    ]
  });

  return ratings.map(rating => ({
    userId: rating.userId,
    seasonId: rating.seasonId,
    divisionId: rating.divisionId,
    divisionName: rating.division?.name || null,
    currentRating: rating.currentRating,
    ratingDeviation: rating.ratingDeviation || 350,
    isProvisional: rating.isProvisional,
    matchesPlayed: rating.matchesPlayed,
    peakRating: rating.peakRating,
    peakRatingDate: rating.peakRatingDate,
    lowestRating: rating.lowestRating,
    lastUpdatedAt: rating.lastUpdatedAt,
    lastMatchId: rating.lastMatchId,
    sport: rating.sport,
    gameType: rating.gameType
  }));
}

/**
 * Get player's rating history
 */
export async function getPlayerRatingHistory(
  userId: string,
  seasonId?: string,
  gameType: GameType = GameType.SINGLES,
  limit: number = 50
): Promise<RatingHistoryEntry[]> {
  // First get the player's rating
  const rating = await prisma.playerRating.findFirst({
    where: {
      userId,
      ...(seasonId ? { seasonId } : {}),
      gameType
    }
  });

  if (!rating) {
    return [];
  }

  // Get history entries
  const history = await prisma.ratingHistory.findMany({
    where: { playerRatingId: rating.id },
    include: {
      match: {
        select: {
          id: true,
          playedAt: true,
          participants: {
            where: {
              userId: { not: userId }
            },
            select: {
              user: {
                select: { name: true }
              }
            },
            take: 1
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return history.map(entry => ({
    id: entry.id,
    matchId: entry.matchId,
    ratingBefore: entry.ratingBefore,
    ratingAfter: entry.ratingAfter,
    delta: entry.delta,
    reason: entry.reason,
    notes: entry.notes,
    createdAt: entry.createdAt,
    matchDate: entry.match?.playedAt || null,
    adversary: entry.match?.participants[0]?.user?.name || null
  }));
}

/**
 * Create initial rating from questionnaire result
 */
export async function createInitialRating(
  input: CreateInitialRatingInput
): Promise<void> {
  const { userId, seasonId, divisionId, sport, singles, doubles, rd } = input;

  // Create singles rating if provided
  if (singles) {
    const existingSingles = await prisma.playerRating.findFirst({
      where: {
        userId,
        seasonId,
        gameType: GameType.SINGLES,
        sport
      }
    });

    if (!existingSingles) {
      const singlesRating = await prisma.playerRating.create({
        data: {
          userId,
          seasonId,
          divisionId,
          sport,
          gameType: GameType.SINGLES,
          currentRating: singles,
          ratingDeviation: rd,
          isProvisional: true,
          matchesPlayed: 0,
          peakRating: singles,
          peakRatingDate: new Date(),
          lowestRating: singles
        }
      });

      await prisma.ratingHistory.create({
        data: {
          playerRatingId: singlesRating.id,
          ratingBefore: 1500,
          ratingAfter: singles,
          delta: singles - 1500,
          rdBefore: 350,
          rdAfter: rd,
          reason: RatingChangeReason.INITIAL_PLACEMENT,
          notes: 'Created from questionnaire result'
        }
      });

      logger.info(`Created initial singles rating for user ${userId}: ${singles}`);
    }
  }

  // Create doubles rating if provided
  if (doubles) {
    const existingDoubles = await prisma.playerRating.findFirst({
      where: {
        userId,
        seasonId,
        gameType: GameType.DOUBLES,
        sport
      }
    });

    if (!existingDoubles) {
      const doublesRating = await prisma.playerRating.create({
        data: {
          userId,
          seasonId,
          divisionId,
          sport,
          gameType: GameType.DOUBLES,
          currentRating: doubles,
          ratingDeviation: rd,
          isProvisional: true,
          matchesPlayed: 0,
          peakRating: doubles,
          peakRatingDate: new Date(),
          lowestRating: doubles
        }
      });

      await prisma.ratingHistory.create({
        data: {
          playerRatingId: doublesRating.id,
          ratingBefore: 1500,
          ratingAfter: doubles,
          delta: doubles - 1500,
          rdBefore: 350,
          rdAfter: rd,
          reason: RatingChangeReason.INITIAL_PLACEMENT,
          notes: 'Created from questionnaire result'
        }
      });

      logger.info(`Created initial doubles rating for user ${userId}: ${doubles}`);
    }
  }
}

/**
 * Get rating summary for profile display
 */
export async function getPlayerRatingSummary(userId: string): Promise<{
  singles: PlayerRatingResponse | null;
  doubles: PlayerRatingResponse | null;
}> {
  const [singles, doubles] = await Promise.all([
    getPlayerRating(userId, undefined, GameType.SINGLES),
    getPlayerRating(userId, undefined, GameType.DOUBLES)
  ]);

  return { singles, doubles };
}

/**
 * Check if player has any ratings
 */
export async function hasPlayerRating(userId: string): Promise<boolean> {
  const count = await prisma.playerRating.count({
    where: { userId }
  });
  return count > 0;
}

/**
 * Get rating statistics for a player
 */
export async function getPlayerRatingStats(userId: string): Promise<{
  totalMatches: number;
  totalDelta: number;
  avgDelta: number;
  biggestGain: number;
  biggestLoss: number;
  winStreak: number;
  currentStreak: number;
}> {
  const ratings = await prisma.playerRating.findMany({
    where: { userId },
    include: {
      history: {
        where: { reason: RatingChangeReason.MATCH_RESULT },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  let totalMatches = 0;
  let totalDelta = 0;
  let biggestGain = 0;
  let biggestLoss = 0;
  let winStreak = 0;
  let currentStreak = 0;
  let countingStreak = true;

  for (const rating of ratings) {
    totalMatches += rating.matchesPlayed;

    for (const entry of rating.history) {
      totalDelta += entry.delta;

      if (entry.delta > biggestGain) {
        biggestGain = entry.delta;
      }
      if (entry.delta < biggestLoss) {
        biggestLoss = entry.delta;
      }

      // Track streaks
      if (entry.delta > 0) {
        if (countingStreak) currentStreak++;
        winStreak = Math.max(winStreak, currentStreak);
      } else {
        if (countingStreak && entry.delta < 0) {
          countingStreak = false;
        }
      }
    }
  }

  return {
    totalMatches,
    totalDelta,
    avgDelta: totalMatches > 0 ? Math.round(totalDelta / totalMatches) : 0,
    biggestGain,
    biggestLoss,
    winStreak,
    currentStreak
  };
}

// Singleton pattern
let playerRatingServiceInstance: typeof playerRatingService | null = null;

const playerRatingService = {
  getPlayerRating,
  getPlayerRatings,
  getPlayerRatingHistory,
  createInitialRating,
  getPlayerRatingSummary,
  hasPlayerRating,
  getPlayerRatingStats
};

export function getPlayerRatingService() {
  if (!playerRatingServiceInstance) {
    playerRatingServiceInstance = playerRatingService;
  }
  return playerRatingServiceInstance;
}

export default playerRatingService;
