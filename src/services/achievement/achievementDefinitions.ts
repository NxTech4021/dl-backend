/**
 * Achievement Evaluator Definitions
 *
 * Each evaluator is a hard-coded function that queries the database
 * and returns { currentValue, isComplete } for a given user.
 *
 * Design decision: Hard-coded functions over a JSON rules engine.
 * - TypeScript-checked, unit-testable, debuggable
 * - 10-12 functions at 10-20 lines each — manageable
 * - No abstraction overhead for 20 achievements
 */

import { prisma } from '../../lib/prisma';
import { SportType, GameType, SeasonStatus, MatchStatus } from '@prisma/client';

// ========================================
// Types
// ========================================

export interface EvaluatorContext {
  userId: string;
  matchId?: string | undefined;
  seasonId?: string | undefined;
  divisionId?: string | undefined;
  sportType?: SportType | undefined;
  gameType?: GameType | undefined;
}

export interface EvaluatorResult {
  currentValue: number;
  isComplete: boolean;
}

export type EvaluatorFn = (
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
) => Promise<EvaluatorResult>;

// ========================================
// Helper: build sport/gameType where clause for MatchResult
// ========================================

function matchResultWhere(
  userId: string,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
) {
  return {
    playerId: userId,
    ...(sportFilter ? { sportType: sportFilter } : {}),
    ...(gameTypeFilter ? { gameType: gameTypeFilter } : {}),
  };
}

// ========================================
// COMPETITION Evaluators
// ========================================

/**
 * Count total wins across all matches.
 * Used for: First Victory (1), On a Roll (10), Quarter Century (25), etc.
 */
async function totalWins(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.matchResult.count({
    where: {
      ...matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
      isWin: true,
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count total matches played.
 */
async function totalMatches(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.matchResult.count({
    where: matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Current consecutive win streak.
 * Scans recent match results in reverse chronological order.
 */
async function winStreak(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const results = await prisma.matchResult.findMany({
    where: matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
    orderBy: { datePlayed: 'desc' },
    take: Math.max(threshold, 20), // fetch enough to detect the streak
    select: { isWin: true },
  });

  let streak = 0;
  for (const r of results) {
    if (r.isWin) streak++;
    else break;
  }
  return { currentValue: streak, isComplete: streak >= threshold };
}

/**
 * Count comeback wins: lost the first set but won the match.
 * Parses Match.setScores JSON to determine set-by-set results.
 */
async function comebackWins(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  // Get winning match results with their match's set scores
  const results = await prisma.matchResult.findMany({
    where: {
      ...matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
      isWin: true,
      setsLost: { gte: 1 }, // must have lost at least 1 set
    },
    include: {
      match: { select: { setScores: true, participants: { select: { userId: true, team: true } } } },
    },
  });

  let count = 0;
  for (const r of results) {
    const setScores = r.match.setScores as Array<{ team1Games: number; team2Games: number }> | null;
    if (!setScores || setScores.length === 0) continue;

    // Determine which team the player is on
    const participant = r.match.participants.find(p => p.userId === ctx.userId);
    if (!participant) continue;

    const playerTeam = participant.team; // "team1" or "team2"
    const firstSet = setScores[0];
    if (!firstSet) continue;

    // Check if player lost the first set
    const lostFirstSet = playerTeam === 'team1'
      ? firstSet.team1Games < firstSet.team2Games
      : firstSet.team2Games < firstSet.team1Games;

    if (lostFirstSet) count++;
  }
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count straight-set wins (won without losing a set).
 */
async function straightSetWins(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.matchResult.count({
    where: {
      ...matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
      isWin: true,
      setsLost: 0,
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

// ========================================
// RATING Evaluators
// ========================================

/**
 * Player's peak rating across any sport/gameType combination.
 */
async function peakRating(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const ratings = await prisma.playerRating.findMany({
    where: {
      userId: ctx.userId,
      ...(sportFilter ? { sport: sportFilter } : {}),
      ...(gameTypeFilter ? { gameType: gameTypeFilter } : {}),
    },
    select: { peakRating: true },
  });

  const peak = Math.max(0, ...ratings.map(r => r.peakRating ?? 0));
  return { currentValue: peak, isComplete: peak >= threshold };
}

/**
 * Count upset victories: won against an opponent rated 100+ points higher.
 * Checks RatingHistory for the match where the player's pre-match rating
 * was significantly lower than the opponent's.
 */
async function ratingUpset(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  // Get all winning match results
  const wins = await prisma.matchResult.findMany({
    where: {
      ...matchResultWhere(ctx.userId, sportFilter, gameTypeFilter),
      isWin: true,
    },
    select: { matchId: true, opponentId: true },
  });

  if (wins.length === 0) {
    return { currentValue: 0, isComplete: false };
  }

  // For each win, check if the opponent's rating was 100+ higher at match time
  let upsetCount = 0;
  for (const win of wins) {
    const [playerHistory, opponentHistory] = await Promise.all([
      prisma.ratingHistory.findFirst({
        where: { matchId: win.matchId, playerRating: { userId: ctx.userId } },
        select: { ratingBefore: true },
      }),
      prisma.ratingHistory.findFirst({
        where: { matchId: win.matchId, playerRating: { userId: win.opponentId } },
        select: { ratingBefore: true },
      }),
    ]);

    if (playerHistory && opponentHistory) {
      if (opponentHistory.ratingBefore - playerHistory.ratingBefore >= 100) {
        upsetCount++;
      }
    }

    // Early exit if we've already met threshold
    if (upsetCount >= threshold) break;
  }

  return { currentValue: upsetCount, isComplete: upsetCount >= threshold };
}

// ========================================
// SEASON Evaluators
// ========================================

/**
 * Count times player finished rank 1 in a completed season.
 */
async function divisionChampion(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.divisionStanding.count({
    where: {
      userId: ctx.userId,
      rank: 1,
      season: { status: SeasonStatus.FINISHED },
      ...(sportFilter
        ? { division: { league: { sportType: sportFilter } } }
        : {}),
      ...(gameTypeFilter
        ? { division: { gameType: gameTypeFilter } }
        : {}),
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count times player finished in top 3 in a completed season.
 */
async function top3Finish(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.divisionStanding.count({
    where: {
      userId: ctx.userId,
      rank: { lte: 3 },
      season: { status: SeasonStatus.FINISHED },
      ...(sportFilter
        ? { division: { league: { sportType: sportFilter } } }
        : {}),
      ...(gameTypeFilter
        ? { division: { gameType: gameTypeFilter } }
        : {}),
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count perfect seasons: Best 6 all wins (countedWins=6, countedLosses=0).
 */
async function perfectSeason(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.divisionStanding.count({
    where: {
      userId: ctx.userId,
      countedWins: 6,
      countedLosses: 0,
      season: { status: SeasonStatus.FINISHED },
      ...(sportFilter
        ? { division: { league: { sportType: sportFilter } } }
        : {}),
      ...(gameTypeFilter
        ? { division: { gameType: gameTypeFilter } }
        : {}),
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count seasons where player played all scheduled matches.
 */
async function ironPlayer(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  // Find standings where matchesPlayed equals matchesScheduled
  const standings = await prisma.divisionStanding.findMany({
    where: {
      userId: ctx.userId,
      season: { status: SeasonStatus.FINISHED },
      ...(sportFilter
        ? { division: { league: { sportType: sportFilter } } }
        : {}),
      ...(gameTypeFilter
        ? { division: { gameType: gameTypeFilter } }
        : {}),
    },
    select: { matchesPlayed: true, matchesScheduled: true },
  });

  const count = standings.filter(s => s.matchesPlayed >= s.matchesScheduled && s.matchesScheduled > 0).length;
  return { currentValue: count, isComplete: count >= threshold };
}

// ========================================
// SOCIAL Evaluators
// ========================================

/**
 * Count distinct sports the player has a rating in.
 */
async function multiSport(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  const sports = await prisma.playerRating.findMany({
    where: { userId: ctx.userId },
    select: { sport: true },
    distinct: ['sport'],
  });
  const count = sports.length;
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count seasons where player had an active partnership (doubles).
 */
async function partnershipSeasons(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  const partnerships = await prisma.partnership.findMany({
    where: {
      OR: [{ captainId: ctx.userId }, { partnerId: ctx.userId }],
    },
    select: { seasonId: true },
    distinct: ['seasonId'],
  });
  const count = partnerships.length;
  return { currentValue: count, isComplete: count >= threshold };
}

// ========================================
// Evaluator Registry
// ========================================

const evaluatorRegistry: Record<string, EvaluatorFn> = {
  total_wins: totalWins,
  total_matches: totalMatches,
  win_streak: winStreak,
  comeback_wins: comebackWins,
  straight_set_wins: straightSetWins,
  peak_rating: peakRating,
  rating_upset: ratingUpset,
  division_champion: divisionChampion,
  top_3_finish: top3Finish,
  perfect_season: perfectSeason,
  iron_player: ironPlayer,
  multi_sport: multiSport,
  partnership_seasons: partnershipSeasons,
};

/**
 * Get the evaluator function for a given key.
 * Returns undefined if the key is not registered.
 */
export function getEvaluator(key: string): EvaluatorFn | undefined {
  return evaluatorRegistry[key];
}

/**
 * Get all registered evaluator keys (for admin UI dropdowns).
 */
export function getEvaluatorKeys(): string[] {
  return Object.keys(evaluatorRegistry);
}
