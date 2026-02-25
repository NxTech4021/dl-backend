/**
 * Achievement Evaluator Definitions
 *
 * Each evaluator is a hard-coded function that queries the database
 * and returns { currentValue, isComplete } for a given user.
 *
 * Evaluator keys (13 total):
 *   MATCH_COUNTER: total_matches
 *   LEAGUE_SEASON: seasons_completed, full_division, consecutive_seasons
 *   WINNING: total_wins, win_streak, perfect_season, division_champion
 *   MULTI_SPORT: multi_sport
 *   MATCH_STREAK: match_streak_weeks
 */

import { prisma } from '../../lib/prisma';
import { SportType, GameType, SeasonStatus } from '@prisma/client';

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
  gameTypeFilter?: GameType | null,
  excludeFriendly = false
) {
  return {
    playerId: userId,
    ...(sportFilter ? { sportType: sportFilter } : {}),
    ...(gameTypeFilter ? { gameType: gameTypeFilter } : {}),
    ...(excludeFriendly ? { match: { isFriendly: false } } : {}),
  };
}

// ========================================
// MATCH_COUNTER Evaluators
// ========================================

/**
 * Count total matches played (exclude friendlies).
 * Used for: Match Counter badge (1/25/100).
 */
async function totalMatches(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.matchResult.count({
    where: matchResultWhere(ctx.userId, sportFilter, gameTypeFilter, true),
  });
  return { currentValue: count, isComplete: count >= threshold };
}

// ========================================
// WINNING Evaluators
// ========================================

/**
 * Count total wins across all matches (exclude friendlies).
 * Used for: First Win (1), 10 Wins, 25 Wins, 50 Wins, 100 Wins.
 */
async function totalWins(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const count = await prisma.matchResult.count({
    where: {
      ...matchResultWhere(ctx.userId, sportFilter, gameTypeFilter, true),
      isWin: true,
    },
  });
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Highest-ever consecutive win streak (personal record).
 * Friendlies are excluded from the sequence but DON'T break the streak.
 * Scans all non-friendly match results in chronological order.
 */
async function winStreak(
  ctx: EvaluatorContext,
  threshold: number,
  sportFilter?: SportType | null,
  gameTypeFilter?: GameType | null
): Promise<EvaluatorResult> {
  const results = await prisma.matchResult.findMany({
    where: matchResultWhere(ctx.userId, sportFilter, gameTypeFilter, true),
    orderBy: { datePlayed: 'asc' },
    select: { isWin: true },
  });

  let bestStreak = 0;
  let currentStreak = 0;
  for (const r of results) {
    if (r.isWin) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  return { currentValue: bestStreak, isComplete: bestStreak >= threshold };
}

/**
 * Count perfect seasons: Best 6 = all wins (countedWins=6, countedLosses=0).
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
 * Count times player finished rank 1 in a completed division (after tiebreakers).
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

// ========================================
// LEAGUE_SEASON Evaluators
// ========================================

/**
 * Count finished seasons where user played at least 1 league match.
 * A season counts if: status=FINISHED AND user has ≥1 MatchResult with isFriendly=false in that season.
 */
async function seasonsCompleted(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  // Get distinct seasonIds from non-friendly match results in finished seasons
  const results = await prisma.matchResult.findMany({
    where: {
      playerId: ctx.userId,
      match: {
        isFriendly: false,
        season: { status: SeasonStatus.FINISHED },
        seasonId: { not: null },
      },
    },
    select: { match: { select: { seasonId: true } } },
    distinct: ['matchId'],
  });

  const seasonIds = new Set(results.map(r => r.match.seasonId).filter(Boolean));
  const count = seasonIds.size;
  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Count seasons where user played every opponent in their division.
 * For each DivisionAssignment in a FINISHED season: count distinct opponents
 * in match results vs (division size - 1).
 */
async function fullDivision(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  // Get all division assignments for the user in finished seasons
  const assignments = await prisma.divisionAssignment.findMany({
    where: {
      userId: ctx.userId,
      division: {
        season: { status: SeasonStatus.FINISHED },
      },
    },
    select: {
      divisionId: true,
      division: {
        select: {
          seasonId: true,
          assignments: { select: { userId: true } },
        },
      },
    },
  });

  let count = 0;
  for (const assignment of assignments) {
    const divisionSize = assignment.division.assignments.length;
    const expectedOpponents = divisionSize - 1;
    if (expectedOpponents <= 0) continue;

    // Count distinct opponents in this division's non-friendly matches
    const matchResults = await prisma.matchResult.findMany({
      where: {
        playerId: ctx.userId,
        match: {
          divisionId: assignment.divisionId,
          isFriendly: false,
        },
      },
      select: { opponentId: true },
      distinct: ['opponentId'],
    });

    if (matchResults.length >= expectedOpponents) {
      count++;
    }
  }

  return { currentValue: count, isComplete: count >= threshold };
}

/**
 * Max consecutive finished seasons with at least 1 league match.
 * Seasons are ordered by startDate. A gap (season with no participation) resets the streak.
 */
async function consecutiveSeasons(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  // Get all finished seasons ordered by startDate
  const finishedSeasons = await prisma.season.findMany({
    where: { status: SeasonStatus.FINISHED },
    orderBy: { startDate: 'asc' },
    select: { id: true },
  });

  if (finishedSeasons.length === 0) {
    return { currentValue: 0, isComplete: false };
  }

  // For each finished season, check if user played at least 1 non-friendly match
  const participatedSeasonIds = new Set<string>();
  const matchResults = await prisma.matchResult.findMany({
    where: {
      playerId: ctx.userId,
      match: {
        isFriendly: false,
        seasonId: { in: finishedSeasons.map(s => s.id) },
      },
    },
    select: { match: { select: { seasonId: true } } },
  });

  for (const r of matchResults) {
    if (r.match.seasonId) participatedSeasonIds.add(r.match.seasonId);
  }

  // Walk through seasons in order, track max consecutive participation
  let bestStreak = 0;
  let currentStreak = 0;
  for (const season of finishedSeasons) {
    if (participatedSeasonIds.has(season.id)) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return { currentValue: bestStreak, isComplete: bestStreak >= threshold };
}

// ========================================
// MULTI_SPORT Evaluators
// ========================================

/**
 * Count distinct sports the player has league matches in.
 * Only counts non-friendly matches.
 */
async function multiSport(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  const sports = await prisma.matchResult.findMany({
    where: {
      playerId: ctx.userId,
      match: { isFriendly: false },
    },
    select: { sportType: true },
    distinct: ['sportType'],
  });
  const count = sports.length;
  return { currentValue: count, isComplete: count >= threshold };
}

// ========================================
// MATCH_STREAK Evaluators
// ========================================

/**
 * Current consecutive calendar weeks with at least 1 match (league OR friendly).
 * Week = Mon 00:00 – Sun 23:59 UTC.
 * Badge disappears if streak breaks (revocable achievement).
 */
async function matchStreakWeeks(
  ctx: EvaluatorContext,
  threshold: number
): Promise<EvaluatorResult> {
  // Get all match dates for this user (league AND friendly)
  const results = await prisma.matchResult.findMany({
    where: { playerId: ctx.userId },
    select: { datePlayed: true },
    orderBy: { datePlayed: 'desc' },
  });

  if (results.length === 0) {
    return { currentValue: 0, isComplete: false };
  }

  // Convert dates to Mon-Sun week keys (ISO week: Mon=start)
  const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    // Shift to Monday-based: 0=Mon, 6=Sun
    const dayOfWeek = (d.getUTCDay() + 6) % 7;
    // Get Monday of this week
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - dayOfWeek);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10); // "YYYY-MM-DD"
  };

  // Collect unique week keys
  const weekKeys = new Set<string>();
  for (const r of results) {
    weekKeys.add(getWeekKey(r.datePlayed));
  }

  // Get current week key
  const now = new Date();
  const currentWeekKey = getWeekKey(now);

  // Walk back from current week, counting consecutive weeks
  let streak = 0;
  const checkDate = new Date(now);
  // Set to Monday of current week
  const dayOfWeek = (checkDate.getUTCDay() + 6) % 7;
  checkDate.setUTCDate(checkDate.getUTCDate() - dayOfWeek);
  checkDate.setUTCHours(0, 0, 0, 0);

  // Check current week first — if no match this week, streak is 0
  if (!weekKeys.has(currentWeekKey)) {
    return { currentValue: 0, isComplete: false };
  }

  // Count consecutive weeks going back
  while (weekKeys.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setUTCDate(checkDate.getUTCDate() - 7); // Go to previous week
  }

  return { currentValue: streak, isComplete: streak >= threshold };
}

// ========================================
// Evaluator Registry
// ========================================

const evaluatorRegistry: Record<string, EvaluatorFn> = {
  // MATCH_COUNTER
  total_matches: totalMatches,
  // WINNING
  total_wins: totalWins,
  win_streak: winStreak,
  perfect_season: perfectSeason,
  division_champion: divisionChampion,
  // LEAGUE_SEASON
  seasons_completed: seasonsCompleted,
  full_division: fullDivision,
  consecutive_seasons: consecutiveSeasons,
  // MULTI_SPORT
  multi_sport: multiSport,
  // MATCH_STREAK
  match_streak_weeks: matchStreakWeeks,
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
