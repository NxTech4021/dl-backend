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

export interface SetScoreDetail {
  setNumber: number;
  userGames: number;
  opponentGames: number;
  userWonSet: boolean;
  hasTiebreak: boolean;
  userTiebreak: number | null;
  opponentTiebreak: number | null;
}

export interface ParticipantInfo {
  name: string;
  image: string | null;
}

export interface RatingHistoryEntry {
  id: string;
  matchId: string | null;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  rdBefore: number | null;
  rdAfter: number | null;
  reason: RatingChangeReason;
  notes: string | null;
  createdAt: Date;
  matchDate: Date | null;
  matchType: 'singles' | 'doubles';
  // For backwards compatibility
  adversary: string | null;
  adversaryImage: string | null;
  // New fields for doubles support
  partner: ParticipantInfo | null;
  opponents: ParticipantInfo[];
  result: 'W' | 'L' | null;
  setScores: SetScoreDetail[];
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
  limit: number = 50,
  sport?: SportType
): Promise<RatingHistoryEntry[]> {
  // First get the player's rating
  const rating = await prisma.playerRating.findFirst({
    where: {
      userId,
      ...(seasonId ? { seasonId } : {}),
      ...(sport ? { sport } : {}),
      gameType
    }
  });

  if (!rating) {
    return [];
  }

  // Get history entries with full match details
  const history = await prisma.ratingHistory.findMany({
    where: { playerRatingId: rating.id },
    include: {
      match: {
        select: {
          id: true,
          matchDate: true,
          outcome: true,
          setScores: true, // Json fallback for scores
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { name: true, image: true }
              }
            }
          },
          scores: {
            select: {
              setNumber: true,
              player1Games: true,
              player2Games: true,
              hasTiebreak: true,
              player1Tiebreak: true,
              player2Tiebreak: true
            },
            orderBy: { setNumber: 'asc' }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  // Determine match type from gameType parameter
  const matchType: 'singles' | 'doubles' = gameType === GameType.DOUBLES ? 'doubles' : 'singles';

  return history.map(entry => {
    const match = entry.match;
    let adversary: string | null = null;
    let adversaryImage: string | null = null;
    let partner: ParticipantInfo | null = null;
    let opponents: ParticipantInfo[] = [];
    let result: 'W' | 'L' | null = null;
    let setScores: SetScoreDetail[] = [];

    if (match) {
      // Find user's participant record
      const userParticipant = match.participants.find(p => p.userId === userId);
      const userTeam = userParticipant?.team;

      // For doubles: find partner (same team, different user)
      if (matchType === 'doubles' && userTeam) {
        const partnerParticipant = match.participants.find(
          p => p.team === userTeam && p.userId !== userId
        );
        if (partnerParticipant?.user) {
          partner = {
            name: partnerParticipant.user.name || 'Unknown',
            image: partnerParticipant.user.image || null
          };
        }
      }

      // Find all opponents (different team or different user for singles)
      const opponentParticipants = match.participants.filter(p => {
        if (matchType === 'doubles' && userTeam) {
          return p.team !== userTeam;
        }
        return p.userId !== userId;
      });

      opponents = opponentParticipants.map(p => ({
        name: p.user?.name || 'Unknown',
        image: p.user?.image || null
      }));

      // For backwards compatibility: set adversary to first opponent or combined names
      if (opponents.length > 0) {
        const firstOpponent = opponents[0];
        if (opponents.length === 1 && firstOpponent) {
          adversary = firstOpponent.name;
          adversaryImage = firstOpponent.image;
        } else {
          // Combine opponent names for doubles
          adversary = opponents.map(o => o.name).join(' & ');
          adversaryImage = null; // Can't show single image for multiple opponents
        }
      }

      // Determine if user won based on outcome and team
      if (match.outcome && userParticipant?.team) {
        result = match.outcome === userTeam ? 'W' : 'L';
      } else {
        // Fallback: use delta to determine result
        result = entry.delta > 0 ? 'W' : 'L';
      }

      // Transform scores to user's perspective
      // In MatchScore: player1 = team1, player2 = team2
      const userIsTeam1 = userParticipant?.team === 'team1';

      // First try MatchScore relation, fallback to setScores Json
      let rawScores: any[] = match.scores;

      if ((!rawScores || rawScores.length === 0) && match.setScores) {
        try {
          const parsedScores = typeof match.setScores === 'string'
            ? JSON.parse(match.setScores)
            : match.setScores;

          // Handle both formats:
          // 1. { sets: [...] } - nested structure from seed data
          // 2. [...] - direct array format
          let setsArray: any[] = [];
          if (Array.isArray(parsedScores)) {
            setsArray = parsedScores;
          } else if (parsedScores?.sets && Array.isArray(parsedScores.sets)) {
            setsArray = parsedScores.sets;
          }

          if (setsArray.length > 0) {
            rawScores = setsArray.map((s: any, index: number) => ({
              // setNumber: Tennis uses setNumber, Pickleball uses gameNumber, seed uses index
              setNumber: s.setNumber ?? s.gameNumber ?? index + 1,
              // player1Games: Tennis/Padel use team1Games, Pickleball uses team1Points, seed uses player1
              player1Games: s.team1Games ?? s.player1Games ?? s.team1Points ?? s.player1 ?? 0,
              player2Games: s.team2Games ?? s.player2Games ?? s.team2Points ?? s.player2 ?? 0,
              hasTiebreak: s.hasTiebreak ?? false,
              player1Tiebreak: s.team1Tiebreak ?? s.player1Tiebreak ?? null,
              player2Tiebreak: s.team2Tiebreak ?? s.player2Tiebreak ?? null,
            }));
          }
        } catch (e) {
          rawScores = [];
        }
      }

      setScores = rawScores.map(score => {
        const userGames = userIsTeam1 ? score.player1Games : score.player2Games;
        const opponentGames = userIsTeam1 ? score.player2Games : score.player1Games;
        const userTiebreak = userIsTeam1 ? score.player1Tiebreak : score.player2Tiebreak;
        const opponentTiebreak = userIsTeam1 ? score.player2Tiebreak : score.player1Tiebreak;

        return {
          setNumber: score.setNumber,
          userGames,
          opponentGames,
          userWonSet: userGames > opponentGames,
          hasTiebreak: score.hasTiebreak,
          userTiebreak: userTiebreak ?? null,
          opponentTiebreak: opponentTiebreak ?? null
        };
      });
    }

    return {
      id: entry.id,
      matchId: entry.matchId,
      ratingBefore: entry.ratingBefore,
      ratingAfter: entry.ratingAfter,
      delta: entry.delta,
      rdBefore: entry.rdBefore ?? null,
      rdAfter: entry.rdAfter ?? null,
      reason: entry.reason,
      notes: entry.notes,
      createdAt: entry.createdAt,
      matchDate: match?.matchDate || null,
      matchType,
      adversary,
      adversaryImage,
      partner,
      opponents,
      result,
      setScores
    };
  });
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
      const singlesData: any = {
        userId,
        seasonId,
        sport,
        gameType: GameType.SINGLES,
        currentRating: singles,
        ratingDeviation: rd,
        isProvisional: true,
        matchesPlayed: 0,
        peakRating: singles,
        peakRatingDate: new Date(),
        lowestRating: singles
      };
      if (divisionId) singlesData.divisionId = divisionId;

      const singlesRating = await prisma.playerRating.create({
        data: singlesData
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
      const doublesData: any = {
        userId,
        seasonId,
        sport,
        gameType: GameType.DOUBLES,
        currentRating: doubles,
        ratingDeviation: rd,
        isProvisional: true,
        matchesPlayed: 0,
        peakRating: doubles,
        peakRatingDate: new Date(),
        lowestRating: doubles
      };
      if (divisionId) doublesData.divisionId = divisionId;

      const doublesRating = await prisma.playerRating.create({
        data: doublesData
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
        where: {
          reason: {
            in: [RatingChangeReason.MATCH_WIN, RatingChangeReason.MATCH_LOSS]
          }
        },
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
