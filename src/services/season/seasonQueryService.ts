/**
 * Season Query Service
 * Handles all read-only season queries
 * Extracted from: seasonService.ts lines 122-258
 */

import { prisma } from '../../lib/prisma';
import { FormattedSeason } from './utils/types';
import { formatSeasonWithRelations } from './utils/formatters';

/**
 * Get all seasons with basic information
 * Extracted from: seasonService.ts lines 122-175
 *
 * @returns Array of seasons with basic info and recent memberships
 */
export async function getAllSeasons(): Promise<any[]> {
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      regiDeadline: true,
      description: true,
      entryFee: true,
      isActive: true,
      paymentRequired: true,
      promoCodeSupported: true,
      withdrawalEnabled: true,
      status: true,
      registeredUserCount: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          genderCategory: true,
          gameType: true,
          matchFormat: true,
          isActive: true,
          categoryOrder: true
        }
      },
      leagues: {
        select: { id: true, name: true, sportType: true, gameType: true }
      },
      memberships: {
        select: {
          id: true,
          userId: true,
          seasonId: true,
          divisionId: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            }
          }
        },
        take: 6,
        orderBy: {
          joinedAt: 'asc'
        }
      },
      _count: {
        select: { memberships: true }
      },
      divisions: {
        select: { id: true, name: true }
      },
    },
  });

  return seasons.map(season => ({
    ...season,
    registeredUserCount: season.memberships?.length || 0,
  }));
}

/**
 * Get season by ID with full relations
 * Extracted from: seasonService.ts lines 177-247
 *
 * @param id - Season ID
 * @returns Season with all relations or null
 */
export async function getSeasonById(id: string): Promise<any | null> {
  return prisma.season.findUnique({
    where: { id },
    include: {
      divisions: true,
      promoCodes: true,
      withdrawalRequests: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          processedByAdmin: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      waitlist: {
        include: {
          waitlistedUsers: true,
        },
      },
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      category: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          genderCategory: true,
          gameType: true,
          matchFormat: true,
          isActive: true,
          categoryOrder: true
        }
      },
      memberships: {
        include: {
          user: {
            include: {
              questionnaireResponses: {
                include: {
                  result: true
                },
                where: {
                  completedAt: { not: null }
                }
              }
            }
          },
        },
      },
    },
  });
}

/**
 * Get active season
 * Extracted from: seasonService.ts lines 249-258
 *
 * @returns Active season or null
 */
export async function getActiveSeason(): Promise<any | null> {
  return await prisma.season.findFirst({
    where: { isActive: true, status: "ACTIVE" },
    include: {
      divisions: { select: { id: true, name: true } },
      leagues: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

/**
 * Check if a season exists
 *
 * @param seasonId - Season ID to check
 * @returns True if season exists, false otherwise
 */
export async function seasonExists(seasonId: string): Promise<boolean> {
  const count = await prisma.season.count({
    where: { id: seasonId }
  });
  return count > 0;
}

/**
 * Get seasons by status
 *
 * @param status - Season status to filter by
 * @returns Array of seasons with the given status
 */
export async function getSeasonsByStatus(
  status: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED"
): Promise<any[]> {
  return await prisma.season.findMany({
    where: { status },
    orderBy: { startDate: 'desc' },
    include: {
      divisions: { select: { id: true, name: true } },
      leagues: { select: { id: true, name: true, sportType: true, gameType: true } },
      category: { select: { id: true, name: true } },
    }
  });
}

/**
 * Get seasons by league ID
 *
 * @param leagueId - League ID to filter by
 * @returns Array of seasons that include this league
 */
export async function getSeasonsByLeagueId(leagueId: string): Promise<any[]> {
  return await prisma.season.findMany({
    where: {
      leagues: {
        some: { id: leagueId }
      }
    },
    orderBy: { startDate: 'desc' },
    include: {
      leagues: { select: { id: true, name: true, sportType: true, gameType: true } },
      category: { select: { id: true, name: true } },
    }
  });
}

/**
 * Get user's season memberships
 *
 * @param userId - User ID
 * @returns Array of seasons the user is a member of
 */
export async function getUserSeasons(userId: string): Promise<any[]> {
  return await prisma.season.findMany({
    where: {
      memberships: {
        some: { userId }
      }
    },
    orderBy: { startDate: 'desc' },
    include: {
      leagues: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      memberships: {
        where: { userId },
        include: {
          division: true
        }
      }
    }
  });
}
