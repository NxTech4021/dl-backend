import { prisma } from "../lib/prisma";
import type { MatchResult, Match } from '@prisma/client';


interface StandingsUpdate {
  userId?: string;
  partnershipId?: string;
  divisionId: string;
  seasonId: string;
}

export async function updateDivisionStandings(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      matchResults: {
        include: {
          player: true,
          opponent: true,
        },
      },
      participants: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!match || !match.divisionId || !match.seasonId) {
    console.log('Match missing division or season:', matchId);
    return;
  }

  // Extract validated IDs for use in transaction (TypeScript narrowing)
  const divisionId = match.divisionId;
  const seasonId = match.seasonId;

  // Get all match results for this division/season
  const allResults = await prisma.matchResult.findMany({
    where: {
      match: {
        divisionId: divisionId,
        seasonId: seasonId,
        status: 'COMPLETED',
      },
      countsForStandings: true,
    },
    include: {
      player: true,
      match: true,
    },
  });

  // Group results by player
  const playerStats = new Map<string, {
    matchesPlayed: number;
    wins: number;
    losses: number;
    totalPoints: number;
    countedWins: number;
    countedLosses: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    best6SetsWon: number;
    best6SetsTotal: number;
    best6GamesWon: number;
    best6GamesTotal: number;
    headToHead: Record<string, { wins: number; losses: number }>;
  }>();

  // Calculate stats for each player
  for (const result of allResults) {
    const playerId = result.playerId;
    
    if (!playerStats.has(playerId)) {
      playerStats.set(playerId, {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
        countedWins: 0,
        countedLosses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        best6SetsWon: 0,
        best6SetsTotal: 0,
        best6GamesWon: 0,
        best6GamesTotal: 0,
        headToHead: {},
      });
    }

    const stats = playerStats.get(playerId)!;
    stats.matchesPlayed++;
    
    if (result.isWin) {
      stats.wins++;
    } else {
      stats.losses++;
    }

    stats.setsWon += result.setsWon;
    stats.setsLost += result.setsLost;
    stats.gamesWon += result.gamesWon;
    stats.gamesLost += result.gamesLost;

    // Best 6 specific stats
    if (result.countsForStandings) {
      stats.totalPoints += result.matchPoints + result.participationPoints + result.setsWonPoints + result.winBonusPoints;
      
      if (result.isWin) {
        stats.countedWins++;
      } else {
        stats.countedLosses++;
      }

      stats.best6SetsWon += result.setsWon;
      stats.best6SetsTotal += (result.setsWon + result.setsLost);
      stats.best6GamesWon += result.gamesWon;
      stats.best6GamesTotal += (result.gamesWon + result.gamesLost);
    }

    // Head to head tracking (for all matches, not just best 6)
    const opponentId = result.opponentId;
    if (!stats.headToHead[opponentId]) {
      stats.headToHead[opponentId] = { wins: 0, losses: 0 };
    }
    
    if (result.isWin) {
      stats.headToHead[opponentId].wins++;
    } else {
      stats.headToHead[opponentId].losses++;
    }
  }

  // Update or create standings for each player in a single transaction
  await prisma.$transaction(
    Array.from(playerStats.entries()).map(([userId, stats]) =>
      prisma.divisionStanding.upsert({
        where: {
          divisionId_seasonId_userId: {
            divisionId: divisionId,
            seasonId: seasonId,
            userId: userId,
          },
        },
        create: {
          divisionId: divisionId,
          seasonId: seasonId,
          userId: userId,
          rank: 0, // Will be calculated after all updates
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          losses: stats.losses,
          totalPoints: stats.totalPoints,
          countedWins: stats.countedWins,
          countedLosses: stats.countedLosses,
          setsWon: stats.setsWon,
          setsLost: stats.setsLost,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          best6SetsWon: stats.best6SetsWon,
          best6SetsTotal: stats.best6SetsTotal,
          best6GamesWon: stats.best6GamesWon,
          best6GamesTotal: stats.best6GamesTotal,
          headToHead: stats.headToHead,
        },
        update: {
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          losses: stats.losses,
          totalPoints: stats.totalPoints,
          countedWins: stats.countedWins,
          countedLosses: stats.countedLosses,
          setsWon: stats.setsWon,
          setsLost: stats.setsLost,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          best6SetsWon: stats.best6SetsWon,
          best6SetsTotal: stats.best6SetsTotal,
          best6GamesWon: stats.best6GamesWon,
          best6GamesTotal: stats.best6GamesTotal,
          headToHead: stats.headToHead,
          lastCalculatedAt: new Date(),
        },
      })
    )
  );

  // Calculate ranks based on total points (Best 6)
  await recalculateRanks(divisionId, seasonId);
}

async function recalculateRanks(divisionId: string, seasonId: string) {
  // Only rank active standings — disbanded/moved standings should not occupy rank slots
  const standings = await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      seasonId,
      isActive: true,
    },
    orderBy: [
      { totalPoints: 'desc' },
      { best6SetsWon: 'desc' },
      { best6GamesWon: 'desc' },
    ],
  });

  // Update ranks in a single transaction
  await prisma.$transaction(
    standings
      .filter((standing): standing is NonNullable<typeof standing> => standing !== null && standing !== undefined)
      .map((standing, i) =>
        prisma.divisionStanding.update({
          where: { id: standing.id },
          data: { rank: i + 1 },
        })
      )
  );
}

/**
 * Get formatted standings for a division.
 *
 * For DOUBLES divisions the response is one row per partnership (team),
 * with both player names/images embedded.  Active standings come first,
 * inactive (disbanded or moved) standings come last.
 *
 * For SINGLES divisions the response is one row per player, ordered the
 * same way (active first, inactive last).
 *
 * The `seasonId` parameter is optional.  When omitted the function looks it
 * up from the division record.
 */
export async function getDivisionStandings(divisionId: string, seasonId?: string) {
  // Resolve seasonId from the division if not provided (fixes missing-seasonId bug in handler)
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { seasonId: true, gameType: true },
  });

  if (!division) return [];

  const resolvedSeasonId = seasonId ?? division.seasonId;
  const isDoubles = division.gameType?.includes('DOUBLES');

  if (isDoubles) {
    return getDoublesStandings(divisionId, resolvedSeasonId);
  }

  return getSinglesStandings(divisionId, resolvedSeasonId);
}

/**
 * Doubles standings — one row per partnership.
 *
 * Live stats come from the captain's userId-based DivisionStanding (both
 * partners earn equal stats in doubles).  Disbanded partnership standings
 * use the snapshot stored at dissolution time.
 *
 * Ordering: active rows by rank ASC, then inactive rows by rank ASC.
 */
async function getDoublesStandings(divisionId: string, seasonId: string) {
  // 1. Fetch all partnership-based standings for this division/season
  const partnershipStandings = await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      seasonId,
      partnershipId: { not: null },
      userId: null,
    },
    include: {
      partnership: {
        include: {
          captain: {
            select: { id: true, name: true, username: true, image: true },
          },
          partner: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { rank: 'asc' }],
  });

  if (partnershipStandings.length === 0) return [];

  // 2. For active standings, fetch captain's userId-based stats (live)
  const activeStandings = partnershipStandings.filter((s) => s.isActive);
  const captainIds = activeStandings
    .map((s) => s.partnership?.captainId)
    .filter(Boolean) as string[];

  const captainStandings = captainIds.length > 0
    ? await prisma.divisionStanding.findMany({
        where: {
          divisionId,
          seasonId,
          userId: { in: captainIds },
          isActive: true,
        },
        select: {
          userId: true,
          matchesPlayed: true,
          wins: true,
          losses: true,
          totalPoints: true,
          rank: true,
        },
      })
    : [];

  const captainStatsMap = new Map(captainStandings.map((s) => [s.userId!, s]));

  // 3. Build the flattened response rows
  const rows = partnershipStandings.map((standing) => {
    const p = standing.partnership;
    const captain = p?.captain;
    const partner = p?.partner;

    // For active standings: use live captain stats; for inactive: use snapshot stats
    const liveStats = standing.isActive && captain
      ? captainStatsMap.get(captain.id)
      : null;

    const stats = liveStats ?? standing;

    return {
      id: standing.id,
      partnershipId: standing.partnershipId,
      partnershipStatus: p?.status ?? null,
      rank: standing.isActive ? (liveStats?.rank ?? standing.rank) : standing.rank,
      isActive: standing.isActive,
      disbandedAt: standing.disbandedAt,

      // Captain = primary player
      playerId: captain?.id ?? null,
      name: captain?.name ?? captain?.username ?? 'Unknown',
      image: captain?.image ?? null,

      // Partner
      partnerId: partner?.id ?? null,
      partnerName: partner?.name ?? partner?.username ?? null,
      partnerImage: partner?.image ?? null,

      played: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      points: stats.totalPoints,
    };
  });

  return rows;
}

/**
 * Singles standings — one row per player.
 * Active rows first (by rank), inactive rows last (by rank).
 */
async function getSinglesStandings(divisionId: string, seasonId: string) {
  const standings = await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      seasonId,
      userId: { not: null },
      partnershipId: null,
    },
    include: {
      user: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: [{ isActive: 'desc' }, { rank: 'asc' }],
  });

  return standings.map((standing) => ({
    id: standing.id,
    rank: standing.rank,
    isActive: standing.isActive,
    disbandedAt: standing.disbandedAt,

    playerId: standing.user?.id ?? null,
    name: standing.user?.name ?? standing.user?.username ?? 'Unknown',
    image: standing.user?.image ?? null,

    partnerId: null,
    partnerName: null,
    partnerImage: null,

    played: standing.matchesPlayed,
    wins: standing.wins,
    losses: standing.losses,
    points: standing.totalPoints,
  }));
}

export async function getPlayerStanding(userId: string, divisionId: string) {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { seasonId: true },
  });
  if (!division) return null;

  return prisma.divisionStanding.findFirst({
    where: { userId, divisionId, seasonId: division.seasonId, isActive: true },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });
}