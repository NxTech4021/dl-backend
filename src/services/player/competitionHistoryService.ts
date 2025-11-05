/**
 * Player Competition History Service
 * Handles player's participation history in leagues, seasons, and divisions
 */

import { prisma } from '../../lib/prisma';

export async function getPlayerLeagueHistory(playerId: string) {
  // Validate player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get leagues where player has participated through SeasonMemberships
  // Relationship: League -> seasons -> SeasonMembership -> userId
  const playerLeagues = await prisma.league.findMany({
    where: {
      seasons: {
        some: {
          memberships: {
            some: {
              userId: playerId
            }
          }
        }
      }
    },
    select: {
      id: true,
      name: true,
      location: true,
      description: true,
      status: true,
      sportType: true,
      gameType: true,
      createdAt: true,
      updatedAt: true,
      seasons: {
        where: {
          memberships: {
            some: {
              userId: playerId
            }
          }
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          memberships: {
            where: { userId: playerId },
            select: {
              id: true,
              joinedAt: true,
              status: true,
              paymentStatus: true,
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
          }
        },
        orderBy: { startDate: 'desc' }
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
          seasons: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Transform data for better frontend consumption
  // Each league will have seasons the player participated in
  const transformedLeagues = playerLeagues.map(league => {
    // Get all season memberships across all seasons in this league
    const allMemberships = league.seasons.flatMap(season => 
      season.memberships.map(membership => ({
        ...membership,
        seasonId: season.id,
        seasonName: season.name,
        seasonStartDate: season.startDate,
        seasonEndDate: season.endDate,
        seasonStatus: season.status
      }))
    );

    // Get the most recent membership (based on joinedAt)
    const mostRecentMembership = allMemberships.length > 0
      ? allMemberships.sort((a, b) => 
          new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
        )[0]
      : null;

    return {
      ...league,
      seasonMemberships: allMemberships, // All season memberships for this league
      membership: mostRecentMembership, // Most recent membership for backward compatibility
      // Keep seasons array with filtered memberships for reference
    };
  });

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
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      regiDeadline: true,
      entryFee: true,
      isActive: true,
      paymentRequired: true,
      promoCodeSupported: true,
      withdrawalEnabled: true,
      registeredUserCount: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        where: { userId: playerId },
        select: {
          id: true,
          joinedAt: true,
          status: true,
          paymentStatus: true,
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
      category: {
        select: {
          id: true,
          name: true,
          game_type: true,
          gender_category: true
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
  } as any);

  // Transform data for better frontend consumption
  const transformedSeasons = playerSeasons.map((season: any) => ({
    ...season,
    membership: season.memberships?.[0] || null, // Player's membership details
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
          packageTier: true
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
