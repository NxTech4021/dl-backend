/**
 * Player Match History Service
 * Handles match history, details, and statistics
 */

import { prisma } from '../../lib/prisma';

/**
 * Get player match history with pagination and filters
 * Original: playerController.ts lines 440-550
 */
export async function getPlayerMatchHistory(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    sport?: string;
    outcome?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const {
    page = 1,
    limit = 10,
    sport,
    outcome,
    startDate,
    endDate
  } = options;

  const skip = (Number(page) - 1) * Number(limit);

  // Build where clause with filters
  const whereClause: any = {
    OR: [{ playerId: userId }, { opponentId: userId }],
  };

  if (sport) {
    whereClause.sport = sport;
  }

  if (startDate || endDate) {
    whereClause.matchDate = {};
    if (startDate) whereClause.matchDate.gte = new Date(startDate);
    if (endDate) whereClause.matchDate.lte = new Date(endDate);
  }

  // Get matches with pagination
  const [matches, totalCount] = await prisma.$transaction([
    prisma.match.findMany({
      where: whereClause,
      include: {
        player: {
          select: { name: true, username: true, image: true }
        },
        opponent: {
          select: { name: true, username: true, image: true }
        },
        stats: true,
      },
      orderBy: { matchDate: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.match.count({ where: whereClause }),
  ]);

  // Process matches with outcome filtering if needed
  let processedMatches = matches.map(match => {
    const isPlayer = match.playerId === userId;
    const matchOutcome = isPlayer
      ? match.outcome
      : (match.outcome === 'win' ? 'loss' : match.outcome === 'loss' ? 'win' : 'draw');

    return {
      id: match.id,
      sport: match.sport,
      matchType: match.matchType,
      date: match.matchDate,
      opponent: isPlayer ? match.opponent : match.player,
      playerScore: isPlayer ? match.playerScore : match.opponentScore,
      opponentScore: isPlayer ? match.opponentScore : match.playerScore,
      outcome: matchOutcome,
      location: match.location,
      duration: match.duration,
      notes: match.notes,
      stats: match.stats,
    };
  });

  // Apply outcome filter if specified
  if (outcome && outcome !== 'all') {
    processedMatches = processedMatches.filter(match => match.outcome === outcome);
  }

  const totalPages = Math.ceil(totalCount / Number(limit));
  const hasNextPage = Number(page) < totalPages;
  const hasPrevPage = Number(page) > 1;

  return {
    matches: processedMatches,
    pagination: {
      currentPage: Number(page),
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      limit: Number(limit),
    },
  };
}

/**
 * Get detailed match information
 * Original: playerController.ts lines 552-640
 */
export async function getMatchDetails(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      player: {
        select: { name: true, username: true, image: true, id: true }
      },
      opponent: {
        select: { name: true, username: true, image: true, id: true }
      },
      stats: true,
    },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  // Check if user is part of this match
  if (match.playerId !== userId && match.opponentId !== userId) {
    throw new Error('Access denied');
  }

  const isPlayer = match.playerId === userId;
  const matchOutcome = isPlayer
    ? match.outcome
    : (match.outcome === 'win' ? 'loss' : match.outcome === 'loss' ? 'win' : 'draw');

  const detailedMatch = {
    id: match.id,
    sport: match.sport,
    matchType: match.matchType,
    date: match.matchDate,
    player: isPlayer ? match.player : match.opponent,
    opponent: isPlayer ? match.opponent : match.player,
    playerScore: isPlayer ? match.playerScore : match.opponentScore,
    opponentScore: isPlayer ? match.opponentScore : match.playerScore,
    outcome: matchOutcome,
    location: match.location,
    duration: match.duration,
    notes: match.notes,
    createdAt: match.createdAt,
    stats: match.stats ? {
      playerStats: {
        aces: isPlayer ? match.stats.playerAces : match.stats.opponentAces,
        unforcedErrors: isPlayer ? match.stats.playerUnforcedErrors : match.stats.opponentUnforcedErrors,
        winners: isPlayer ? match.stats.playerWinners : match.stats.opponentWinners,
        doubleFaults: isPlayer ? match.stats.playerDoubleFaults : match.stats.opponentDoubleFaults,
      },
      opponentStats: {
        aces: isPlayer ? match.stats.opponentAces : match.stats.playerAces,
        unforcedErrors: isPlayer ? match.stats.opponentUnforcedErrors : match.stats.playerUnforcedErrors,
        winners: isPlayer ? match.stats.opponentWinners : match.stats.playerWinners,
        doubleFaults: isPlayer ? match.stats.opponentDoubleFaults : match.stats.playerDoubleFaults,
      },
      matchStats: {
        rallyCount: match.stats.rallyCount,
        longestRally: match.stats.longestRally,
        breakPointsConverted: match.stats.breakPointsConverted,
        breakPointsTotal: match.stats.breakPointsTotal,
      }
    } : null,
  };

  return detailedMatch;
}

/**
 * Get player match history for admin view
 * Original: playerController.ts lines 2050-2158
 */
export async function getPlayerMatchHistoryAdmin(playerId: string) {
  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get matches where player has participated
  const playerMatches = await prisma.match.findMany({
    where: {
      participants: {
        some: {
          userId: playerId
        }
      }
    },
    include: {
      participants: {
        where: { userId: playerId },
        select: {
          isStarter: true,
          team: true
        }
      },
      division: {
        select: {
          id: true,
          name: true,
          gameType: true,
          genderCategory: true,
          level: true,
          season: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          league: {
            select: {
              id: true,
              name: true,
              sportType: true,
              location: true
            }
          }
        }
      },
      stats: {
        select: {
          playerAces: true,
          playerUnforcedErrors: true,
          playerWinners: true,
          playerDoubleFaults: true,
          opponentAces: true,
          opponentUnforcedErrors: true,
          opponentWinners: true,
          opponentDoubleFaults: true,
          rallyCount: true,
          longestRally: true,
          breakPointsConverted: true,
          breakPointsTotal: true
        }
      },
      _count: {
        select: {
          participants: true
        }
      }
    },
    orderBy: {
      matchDate: 'desc'
    }
  });

  // Transform data for better frontend consumption
  const transformedMatches = playerMatches.map(match => ({
    ...match,
    participation: match.participants[0], // Player's participation details
    participants: undefined // Remove the array since we only need the player's participation
  }));

  return {
    player: {
      id: player.id,
      name: player.name
    },
    matches: transformedMatches,
    count: transformedMatches.length
  };
}
