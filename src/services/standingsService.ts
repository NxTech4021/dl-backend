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
  const standings = await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      seasonId,
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

export async function getDivisionStandings(divisionId: string, seasonId: string) {
  return await prisma.divisionStanding.findMany({
    where: {
      divisionId,
      seasonId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      partnership: {
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      },
    },
    orderBy: [
      { rank: 'asc' },
    ],
  });
}