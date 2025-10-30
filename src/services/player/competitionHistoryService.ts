/**
 * Player Competition History Service
 * Handles player's participation history in leagues, seasons, and divisions
 */

import { prisma } from '../../lib/prisma';

/**
 * Get player's league participation history
 * Original: playerController.ts lines 1722-1821
 */
export async function getPlayerLeagueHistory(playerId: string) {
  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get leagues where player has participated
  const playerLeagues = await prisma.league.findMany({
    where: {
      memberships: {
        some: {
          userId: playerId
        }
      }
    },
    include: {
      memberships: {
        where: { userId: playerId },
        select: {
          joinedAt: true,
          id: true
        }
      },
      seasons: {
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true
        },
        orderBy: { startDate: 'desc' }
      },
      categories: {
        select: {
          id: true,
          name: true,
          game_type: true,
          gender_category: true
        }
      },
      createdBy: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      },
      _count: {
        select: {
          memberships: true,
          seasons: true,
          categories: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Transform data for better frontend consumption
  const transformedLeagues = playerLeagues.map(league => ({
    ...league,
    membership: league.memberships[0], // Player's membership details
    memberships: undefined // Remove the array since we only need the player's membership
  }));

  return {
    player: {
      id: player.id,
      name: player.name
    },
    leagues: transformedLeagues,
    count: transformedLeagues.length
  };
}

/**
 * Get player's season participation history
 * Original: playerController.ts lines 1824-1937
 */
export async function getPlayerSeasonHistory(playerId: string) {
  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get seasons where player has participated
  const playerSeasons = await prisma.season.findMany({
    where: {
      memberships: {
        some: {
          userId: playerId
        }
      }
    },
    include: {
      memberships: {
        where: { userId: playerId },
        select: {
          joinedAt: true,
          status: true,
          division: {
            select: {
              id: true,
              name: true,
              gameType: true,
              genderCategory: true,
              level: true
            }
          }
        }
      },
      categories: {
        select: {
          id: true,
          name: true,
          game_type: true,
          gender_category: true,
          leagues: {
            select: {
              id: true,
              name: true,
              sportType: true,
              location: true
            }
          }
        }
      },
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          location: true,
          status: true
        }
      },
      divisions: {
        select: {
          id: true,
          name: true,
          gameType: true,
          genderCategory: true,
          level: true,
          isActiveDivision: true
        }
      },
      _count: {
        select: {
          memberships: true,
          divisions: true
        }
      }
    },
    orderBy: {
      startDate: 'desc'
    }
  });

  // Transform data for better frontend consumption
  const transformedSeasons = playerSeasons.map(season => ({
    ...season,
    membership: season.memberships[0], // Player's membership details
    memberships: undefined // Remove the array since we only need the player's membership
  }));

  return {
    player: {
      id: player.id,
      name: player.name
    },
    seasons: transformedSeasons,
    count: transformedSeasons.length
  };
}

/**
 * Get player's division participation history
 * Original: playerController.ts lines 1940-2047
 */
export async function getPlayerDivisionHistory(playerId: string) {
  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get divisions where player has been assigned
  const playerDivisions = await prisma.division.findMany({
    where: {
      assignments: {
        some: {
          userId: playerId
        }
      }
    },
    include: {
      assignments: {
        where: { userId: playerId },
        select: {
          assignedAt: true,
          reassignmentCount: true,
          notes: true,
          assignedByAdmin: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      },
      season: {
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true
        }
      },
      league: {
        select: {
          id: true,
          name: true,
          sportType: true,
          location: true,
          status: true
        }
      },
      divisionSponsor: {
        select: {
          id: true,
          sponsoredName: true,
          packageTier: true,
          prizePoolTotal: true
        }
      },
      _count: {
        select: {
          assignments: true,
          matches: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Transform data for better frontend consumption
  const transformedDivisions = playerDivisions.map(division => ({
    ...division,
    assignment: division.assignments[0], // Player's assignment details
    assignments: undefined // Remove the array since we only need the player's assignment
  }));

  return {
    player: {
      id: player.id,
      name: player.name
    },
    divisions: transformedDivisions,
    count: transformedDivisions.length
  };
}
