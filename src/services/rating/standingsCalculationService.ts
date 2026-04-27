/**
 * Standings Calculation Service
 * Handles division standings, points, and tie-breakers
 */

import { prisma } from '../../lib/prisma';
import { MatchStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

// Constants for points calculation
const POINTS_PER_WIN = 3;
const WIN_CAP = 7;
const MAX_WIN_POINTS = WIN_CAP * POINTS_PER_WIN; // 21
const MATCHES_FOR_BONUS_2 = 4;
const MATCHES_FOR_BONUS_3 = 9;

// Types
export interface StandingsPoints {
  winPoints: number;
  setPoints: number;
  completionBonus: number;
  totalPoints: number;
}

export interface MatchResult {
  odlayerId: string;
  odversaryId: string;
  userWon: boolean;
  userSetsWon: number;
  userSetsLost: number;
  userGamesWon: number;
  userGamesLost: number;
}

export interface HeadToHeadRecord {
  odversaryId: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
}

export interface StandingEntry {
  odlayerId: string;
  odlayerName: string;
  odlayerImage: string | null;
  rank: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  matchesRemaining: number;
  winPoints: number;
  setPoints: number;
  completionBonus: number;
  totalPoints: number;
  setsWon: number;
  setsLost: number;
  setDifferential: number;
  previousRank: number;
  rankChange: number;
  // Doubles partner fields — explicit `| undefined` so callers can pass
  // `partnership?.partnerId ?? undefined` without violating
  // exactOptionalPropertyTypes: true (resolves TS-039 from
  // docs/issues/backlog/tsc-baseline-errors-2026-04-27.md).
  partnerId?: string | undefined;
  partnerName?: string | undefined;
  partnerImage?: string | undefined;
  // Active / disbanded state
  isActive: boolean;
  disbandedAt: Date | null;
}

/**
 * Calculate standings points based on wins, sets, and matches
 */
export function calculateStandingsPoints(
  wins: number,
  setsWon: number,
  matchesCompleted: number
): StandingsPoints {
  // Win points: +3 per win, capped at 7 wins (21 pts max)
  const cappedWins = Math.min(wins, WIN_CAP);
  const winPoints = cappedWins * POINTS_PER_WIN;

  // Set points: +1 per set won, only counted after reaching 7 wins
  const setPoints = wins >= WIN_CAP ? setsWon : 0;

  // Completion bonus
  let completionBonus = matchesCompleted; // +1 per match
  if (matchesCompleted >= MATCHES_FOR_BONUS_2) completionBonus += 1; // +2 at 4 matches
  if (matchesCompleted >= MATCHES_FOR_BONUS_3) completionBonus += 1; // +3 at 9 matches

  return {
    winPoints,
    setPoints,
    completionBonus,
    totalPoints: winPoints + setPoints + completionBonus
  };
}

/**
 * Update a player's standing after a match
 */
export async function updatePlayerStanding(
  userId: string,
  divisionId: string,
  matchResult: MatchResult
): Promise<void> {
  // Get or create standing
  let standing = await prisma.divisionStanding.findFirst({
    where: { userId, divisionId }
  });

  if (!standing) {
    // Get season ID from division
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { seasonId: true }
    });

    if (!division) {
      logger.error(`Division ${divisionId} not found`);
      return;
    }

    // Create new standing
    standing = await prisma.divisionStanding.create({
      data: {
        divisionId,
        seasonId: division.seasonId,
        userId,
        rank: 0,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        matchesScheduled: 9,
        winPoints: 0,
        setPoints: 0,
        setsWon: 0,
        setsLost: 0,
        completionBonus: 0,
        totalPoints: 0,
        setDifferential: 0,
        headToHead: {}
      }
    });
  }

  // Update stats
  const newWins = standing.wins + (matchResult.userWon ? 1 : 0);
  const newLosses = standing.losses + (matchResult.userWon ? 0 : 1);
  const newMatchesPlayed = standing.matchesPlayed + 1;
  const newSetsWon = standing.setsWon + matchResult.userSetsWon;
  const newSetsLost = standing.setsLost + matchResult.userSetsLost;

  // Calculate new points
  const points = calculateStandingsPoints(newWins, newSetsWon, newMatchesPlayed);

  // Update head-to-head
  const h2h = (standing.headToHead as unknown as Record<string, HeadToHeadRecord>) || {};

  if (!h2h[matchResult.odversaryId]) {
    h2h[matchResult.odversaryId] = {
      odversaryId: matchResult.odversaryId,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0
    };
  }

  const h2hRecord = h2h[matchResult.odversaryId];
  if (!h2hRecord) {
    logger.error('Head-to-head record not found for adversary', { adversaryId: matchResult.odversaryId });
    return;
  }

  if (matchResult.userWon) {
    h2hRecord.wins += 1;
  } else {
    h2hRecord.losses += 1;
  }
  h2hRecord.setsWon += matchResult.userSetsWon;
  h2hRecord.setsLost += matchResult.userSetsLost;

  // Update standing
  await prisma.divisionStanding.update({
    where: { id: standing.id },
    data: {
      wins: newWins,
      losses: newLosses,
      matchesPlayed: newMatchesPlayed,
      setsWon: newSetsWon,
      setsLost: newSetsLost,
      setDifferential: newSetsWon - newSetsLost,
      winPoints: points.winPoints,
      setPoints: points.setPoints,
      completionBonus: points.completionBonus,
      totalPoints: points.totalPoints,
      headToHead: JSON.parse(JSON.stringify(h2h))
    }
  });

  // Recalculate ranks for the division
  await recalculateDivisionRanks(divisionId);

  logger.info(`Updated standing for user ${userId} in division ${divisionId}`, {
    wins: newWins,
    losses: newLosses,
    totalPoints: points.totalPoints
  });
}

/**
 * Update standings for both players after a match
 */
export async function updateMatchStandings(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      participants: true,
      scores: true
    }
  });

  if (!match || !match.divisionId) {
    logger.warn(`Match ${matchId} not found or has no division`);
    return;
  }

  if (match.status !== MatchStatus.COMPLETED) {
    logger.warn(`Match ${matchId} is not completed`);
    return;
  }

  // Get participants by team
  const team1Participants = match.participants.filter(p => p.team === 'team1');
  const team2Participants = match.participants.filter(p => p.team === 'team2');

  if (team1Participants.length === 0 || team2Participants.length === 0) {
    logger.error(`Match ${matchId} has invalid participants`);
    return;
  }

  // Calculate sets won by each team
  let team1Sets = 0;
  let team2Sets = 0;
  let team1Games = 0;
  let team2Games = 0;

  for (const score of match.scores) {
    team1Games += score.player1Games;
    team2Games += score.player2Games;

    if (score.player1Games > score.player2Games) {
      team1Sets++;
    } else if (score.player2Games > score.player1Games) {
      team2Sets++;
    }
  }

  const team1Won = match.outcome === 'team1';

  // Update standings for each participant
  for (const participant of team1Participants) {
    if (!participant.userId) continue;
    const adversaryId = team2Participants[0]?.userId;
    if (!adversaryId) continue;

    await updatePlayerStanding(participant.userId, match.divisionId, {
      odlayerId: participant.userId,
      odversaryId: adversaryId,
      userWon: team1Won,
      userSetsWon: team1Sets,
      userSetsLost: team2Sets,
      userGamesWon: team1Games,
      userGamesLost: team2Games
    });
  }

  for (const participant of team2Participants) {
    if (!participant.userId) continue;
    const adversaryId = team1Participants[0]?.userId;
    if (!adversaryId) continue;

    await updatePlayerStanding(participant.userId, match.divisionId, {
      odlayerId: participant.userId,
      odversaryId: adversaryId,
      userWon: !team1Won,
      userSetsWon: team2Sets,
      userSetsLost: team1Sets,
      userGamesWon: team2Games,
      userGamesLost: team1Games
    });
  }
}

/**
 * Recalculate ranks for all players in a division.
 * Only active standings participate in ranking — disbanded/moved entries are excluded.
 */
export async function recalculateDivisionRanks(divisionId: string): Promise<void> {
  const standings = await prisma.divisionStanding.findMany({
    where: { divisionId, isActive: true },
    orderBy: [
      { totalPoints: 'desc' },
      { setsWon: 'desc' },
      { setDifferential: 'desc' }
    ]
  });

  // Apply tie-breaker resolution
  const sortedStandings = resolveTieBreakers(standings);

  // Update ranks
  for (let i = 0; i < sortedStandings.length; i++) {
    const standing = sortedStandings[i];
    const newRank = i + 1;

    await prisma.divisionStanding.update({
      where: { id: standing.id },
      data: { rank: newRank }
    });
  }
}

/**
 * Resolve tie-breakers for standings
 */
function resolveTieBreakers(standings: any[]): any[] {
  return standings.sort((a, b) => {
    // 1. Total points (desc)
    if (a.totalPoints !== b.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    // 2. Sets won (desc)
    if (a.setsWon !== b.setsWon) {
      return b.setsWon - a.setsWon;
    }

    // 3. Head-to-head
    const aH2H = a.headToHead as Record<string, HeadToHeadRecord>;
    const bH2H = b.headToHead as Record<string, HeadToHeadRecord>;

    if (aH2H && bH2H) {
      const aVsB = aH2H[b.userId];
      const bVsA = bH2H[a.userId];

      if (aVsB && bVsA) {
        const aH2HWins = aVsB.wins - aVsB.losses;
        const bH2HWins = bVsA.wins - bVsA.losses;

        if (aH2HWins !== bH2HWins) {
          return bH2HWins - aH2HWins;
        }
      }
    }

    // 4. Set differential (desc)
    if (a.setDifferential !== b.setDifferential) {
      return b.setDifferential - a.setDifferential;
    }

    return 0;
  });
}

/**
 * Get division standings (leaderboard).
 *
 * For DOUBLES divisions: one row per partnership team.
 *   - ACTIVE partnerships: live stats are read from the captain's userId-based standing.
 *   - INACTIVE partnerships (disbanded / moved out): snapshot stats stored at dissolution time.
 *   - Both player names are included even for DISSOLVED partnerships.
 *   - Active rows are returned first (sorted by rank), then inactive rows.
 *
 * For SINGLES divisions: one row per player, active first then inactive.
 */
export async function getDivisionStandings(divisionId: string): Promise<StandingEntry[]> {
  // Fetch ALL partnership-based standings (both active and inactive)
  const partnershipRows = await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      partnershipId: { not: null },
      userId: null,
    },
    include: {
      partnership: {
        select: {
          status: true,
          captainId: true,
          partnerId: true,
          captain: { select: { id: true, name: true, image: true } },
          // partner is nullable (INCOMPLETE) but always has a name for DISSOLVED partnerships
          partner: { select: { id: true, name: true, image: true } },
        },
      },
    },
    // Active rows first, then inactive; within each group by stored rank
    orderBy: [{ isActive: 'desc' }, { rank: 'asc' }],
  });

  if (partnershipRows.length > 0) {
    // Treat a row as active only if the DB flag is set AND the partnership isn't dissolved.
    // This handles pre-migration data where isActive defaults to true for old dissolved partnerships.
    const isRowActive = (s: typeof partnershipRows[0]) =>
      s.isActive && s.partnership?.status !== 'DISSOLVED';

    // Fetch live user-level stats only for active captain rows
    const activeCaptainIds = partnershipRows
      .filter(s => isRowActive(s))
      .map(s => s.partnership?.captainId)
      .filter(Boolean) as string[];

    const userStats = new Map<string, typeof partnershipRows[0] & { totalPoints: number }>(); 
    if (activeCaptainIds.length > 0) {
      const captainRows = await prisma.divisionStanding.findMany({
        where: { divisionId, userId: { in: activeCaptainIds }, isActive: true },
      });
      captainRows.forEach(r => { if (r.userId) userStats.set(r.userId, r as any); });
    }

    // Assign sequential ranks separately for active vs inactive groups
    let activeRank = 0;

    // Sort active rows by live totalPoints (partnership rows may have stale rank=0)
    const activeRows = partnershipRows.filter(s => isRowActive(s));
    activeRows.sort((a, b) => {
      const aStats = userStats.get(a.partnership?.captainId ?? '');
      const bStats = userStats.get(b.partnership?.captainId ?? '');
      const aPts = aStats?.totalPoints ?? a.totalPoints;
      const bPts = bStats?.totalPoints ?? b.totalPoints;
      if (bPts !== aPts) return bPts - aPts;
      const aSets = aStats?.setsWon ?? a.setsWon;
      const bSets = bStats?.setsWon ?? b.setsWon;
      if (bSets !== aSets) return bSets - aSets;
      return (bStats?.setDifferential ?? b.setDifferential) - (aStats?.setDifferential ?? a.setDifferential);
    });

    const inactiveRows = partnershipRows.filter(s => !isRowActive(s));

    const mapRow = (s: typeof partnershipRows[0], rankOverride?: number): StandingEntry => {
      const captainId = s.partnership?.captainId ?? '';
      const effectivelyActive = isRowActive(s);
      // For active standings use live captain stats; for inactive use snapshot
      const cs = effectivelyActive ? userStats.get(captainId) : null;
      const stats = cs ?? s;
      // disbandedAt: use stored value, or fall back to now for pre-migration DISSOLVED partnerships
      const disbandedAtValue = s.disbandedAt ?? (s.partnership?.status === 'DISSOLVED' ? new Date() : null);
      return {
        odlayerId: captainId,
        odlayerName: s.partnership?.captain?.name ?? 'Unknown',
        odlayerImage: s.partnership?.captain?.image ?? null,
        partnerId: s.partnership?.partnerId ?? undefined,
        partnerName: s.partnership?.partner?.name ?? undefined,
        partnerImage: s.partnership?.partner?.image ?? undefined,
        rank: rankOverride ?? s.rank,
        isActive: effectivelyActive,
        disbandedAt: disbandedAtValue,
        wins: stats.wins,
        losses: stats.losses,
        matchesPlayed: stats.matchesPlayed,
        matchesRemaining: (stats.matchesScheduled) - (stats.matchesPlayed),
        winPoints: stats.winPoints,
        setPoints: stats.setPoints,
        completionBonus: stats.completionBonus,
        totalPoints: stats.totalPoints,
        setsWon: stats.setsWon,
        setsLost: stats.setsLost,
        setDifferential: stats.setDifferential,
        previousRank: s.rank,
        rankChange: 0,
      };
    };

    const activeEntries = activeRows.map((s) => mapRow(s, ++activeRank));
    const inactiveEntries = inactiveRows.map((s) => mapRow(s));

    return [...activeEntries, ...inactiveEntries];
  }

  // Singles division — one entry per user.
  const userStandings = await prisma.divisionStanding.findMany({
    where: { divisionId, userId: { not: null } },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
    // Active rows first ordered by rank; inactive rows after
    orderBy: [{ isActive: 'desc' }, { totalPoints: 'desc' }, { setsWon: 'desc' }, { setDifferential: 'desc' }],
  });

  let singlesRank = 0;
  return userStandings.map((s) => ({
    odlayerId: s.userId ?? '',
    odlayerName: s.user?.name ?? 'Unknown',
    odlayerImage: s.user?.image ?? null,
    rank: s.isActive ? (s.rank > 0 ? s.rank : ++singlesRank) : s.rank,
    isActive: s.isActive,
    disbandedAt: s.disbandedAt,
    wins: s.wins,
    losses: s.losses,
    matchesPlayed: s.matchesPlayed,
    matchesRemaining: s.matchesScheduled - s.matchesPlayed,
    winPoints: s.winPoints,
    setPoints: s.setPoints,
    completionBonus: s.completionBonus,
    totalPoints: s.totalPoints,
    setsWon: s.setsWon,
    setsLost: s.setsLost,
    setDifferential: s.setDifferential,
    previousRank: s.rank > 0 ? s.rank : 0,
    rankChange: 0,
  }));
}

/**
 * Get player's standing in a division
 */
export async function getPlayerStanding(
  userId: string,
  divisionId: string
): Promise<StandingEntry | null> {
  const standing = await prisma.divisionStanding.findFirst({
    where: { userId, divisionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    }
  });

  if (!standing) {
    return null;
  }

  return {
    odlayerId: standing.userId || '',
    odlayerName: standing.user?.name || 'Unknown',
    odlayerImage: standing.user?.image || null,
    rank: standing.rank,
    isActive: standing.isActive,
    disbandedAt: standing.disbandedAt,
    wins: standing.wins,
    losses: standing.losses,
    matchesPlayed: standing.matchesPlayed,
    matchesRemaining: standing.matchesScheduled - standing.matchesPlayed,
    winPoints: standing.winPoints,
    setPoints: standing.setPoints,
    completionBonus: standing.completionBonus,
    totalPoints: standing.totalPoints,
    setsWon: standing.setsWon,
    setsLost: standing.setsLost,
    setDifferential: standing.setDifferential,
    previousRank: standing.rank,
    rankChange: 0
  };
}

/**
 * Recalculate all standings for a division from scratch
 */
export async function recalculateDivisionStandings(divisionId: string): Promise<void> {
  logger.info(`Recalculating standings for division ${divisionId}`);

  // Get all completed matches in division
  const matches = await prisma.match.findMany({
    where: {
      divisionId,
      status: MatchStatus.COMPLETED
    },
    include: {
      participants: true,
      scores: true
    },
    orderBy: { matchDate: 'asc' }
  });

  // Reset all standings
  await prisma.divisionStanding.updateMany({
    where: { divisionId },
    data: {
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      setsWon: 0,
      setsLost: 0,
      setDifferential: 0,
      winPoints: 0,
      setPoints: 0,
      completionBonus: 0,
      totalPoints: 0,
      headToHead: {}
    }
  });

  // Replay all matches
  for (const match of matches) {
    await updateMatchStandings(match.id);
  }

  logger.info(`Recalculated standings for ${matches.length} matches in division ${divisionId}`);
}

// Singleton pattern
let standingsServiceInstance: typeof standingsService | null = null;

const standingsService = {
  calculateStandingsPoints,
  updatePlayerStanding,
  updateMatchStandings,
  recalculateDivisionRanks,
  getDivisionStandings,
  getPlayerStanding,
  recalculateDivisionStandings
};

export function getStandingsCalculationService() {
  if (!standingsServiceInstance) {
    standingsServiceInstance = standingsService;
  }
  return standingsServiceInstance;
}

export default standingsService;
