/**
 * Division Query Service
 * Handles complex queries, filtering, and reporting for divisions
 * DEPENDS ON: formatters (formatting)
 */

import { prisma } from '../../lib/prisma';
import { GameType, DivisionLevel, GenderType, Prisma } from "@prisma/client";
import { formatDivision } from './utils/formatters';
import { toEnum } from './utils/enums';

/**
 * Query parameters for getDivisionsBySeasonId
 */
export interface DivisionQueryParams {
  seasonId: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
  gameType?: string;
  level?: string;
  genderCategory?: string;
  includeAssignments?: boolean;
}

/**
 * Get divisions by season with filtering and pagination
 * @param params - Query parameters
 * @returns Paginated divisions with metadata
 */
export async function getDivisionsBySeasonId(params: DivisionQueryParams) {
  const {
    seasonId,
    page = 1,
    limit = 10,
    isActive,
    gameType,
    level,
    genderCategory,
    includeAssignments = false
  } = params;

  console.log(`📋 Fetching divisions for season ${seasonId} with filters:`, {
    isActive,
    gameType,
    level,
    genderCategory,
    page,
    limit
  });

  // Verify season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true, isActive: true }
  });

  if (!season) {
    throw new Error("Season not found");
  }

  // Build where conditions
  const whereConditions: any = {
    seasonId
  };

  if (isActive !== undefined) {
    whereConditions.isActiveDivision = isActive;
  }

  if (gameType) {
    const gameTypeEnum = toEnum(gameType, GameType);
    if (gameTypeEnum) {
      whereConditions.gameType = gameTypeEnum;
    }
  }

  if (level) {
    const levelEnum = toEnum(level, DivisionLevel);
    if (levelEnum) {
      whereConditions.level = levelEnum;
    }
  }

  if (genderCategory) {
    const genderEnum = toEnum(genderCategory, GenderType);
    if (genderEnum) {
      whereConditions.genderCategory = genderEnum;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Define include type based on whether assignments are included
  type IncludeOptions = {
    season: {
      select: {
        id: true;
        name: true;
        isActive: true;
        startDate: true;
        endDate: true;
      };
    };
    divisionSponsor: {
      select: {
        id: true;
        sponsoredName: true;
        packageTier: true;
      };
    };
    _count: {
      select: {
        assignments: true;
        seasonMemberships: true;
        matches: true;
      };
    };
  } & (typeof includeAssignments extends true
    ? {
        assignments: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                username: true;
                image: true;
              };
            };
          };
          orderBy: {
            assignedAt: 'desc';
          };
        };
      }
    : {});

  // Build include object based on query parameters
  const includeOptions: IncludeOptions = {
    season: {
      select: {
        id: true,
        name: true,
        isActive: true,
        startDate: true,
        endDate: true
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
        seasonMemberships: true,
        matches: true
      }
    },
    ...(includeAssignments ? {
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true
            }
          }
        },
        orderBy: {
          assignedAt: 'desc' as const
        }
      }
    } : {})
  } as IncludeOptions;

  const [divisions, totalCount] = await Promise.all([
    prisma.division.findMany({
      where: whereConditions,
      include: includeOptions,
      orderBy: [
        { level: 'asc' },
        { name: 'asc' }
      ],
      skip,
      take: Number(limit)
    }),
    prisma.division.count({ where: whereConditions })
  ]);

  console.log(`✅ Found ${divisions.length} divisions for season ${seasonId}`);

  // Type the division result properly
  type DivisionWithIncludes = Prisma.DivisionGetPayload<{
    include: IncludeOptions;
  }>;

  // Format the response data
  const formattedDivisions = divisions.map((division: DivisionWithIncludes) => ({
    ...formatDivision(division),
    assignmentCount: division._count?.assignments || 0,
    membershipCount: division._count?.seasonMemberships || 0,
    matchCount: division._count?.matches || 0,
    sponsor: division.divisionSponsor ? {
      id: division.divisionSponsor.id,
      name: division.divisionSponsor.sponsoredName,
      tier: division.divisionSponsor.packageTier
    } : null,
    assignments: includeAssignments && 'assignments' in division ? division.assignments : undefined
  }));

  return {
    divisions: formattedDivisions,
    season: {
      id: season.id,
      name: season.name,
      isActive: season.isActive
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / Number(limit))
    },
    filters: {
      isActive: isActive !== undefined ? isActive : undefined,
      gameType: gameType || undefined,
      level: level || undefined,
      genderCategory: genderCategory || undefined
    }
  };
}

/**
 * Get division summary statistics for a season
 * @param seasonId - Season ID
 * @returns Comprehensive division statistics
 */
export async function getDivisionSummaryBySeasonId(seasonId: string) {
  console.log(`📊 Fetching division summary for season ${seasonId}`);

  const [season, divisionStats] = await Promise.all([
    prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, isActive: true }
    }),
    prisma.division.findMany({
      where: { seasonId },
      select: {
        id: true,
        name: true,
        level: true,
        gameType: true,
        genderCategory: true,
        isActiveDivision: true,
        maxSinglesPlayers: true,
        maxDoublesTeams: true,
        currentSinglesCount: true,
        currentDoublesCount: true,
        _count: {
          select: {
            assignments: true,
            seasonMemberships: true,
            matches: true
          }
        }
      }
    })
  ]);

  if (!season) {
    throw new Error("Season not found");
  }

  // Calculate summary statistics
  const summary = {
    totalDivisions: divisionStats.length,
    activeDivisions: divisionStats.filter(d => d.isActiveDivision).length,
    inactiveDivisions: divisionStats.filter(d => !d.isActiveDivision).length,
    totalAssignments: divisionStats.reduce((sum, d) => sum + (d._count?.assignments || 0), 0),
    totalMemberships: divisionStats.reduce((sum, d) => sum + (d._count?.seasonMemberships || 0), 0),
    totalMatches: divisionStats.reduce((sum, d) => sum + (d._count?.matches || 0), 0),
    byGameType: {
      singles: divisionStats.filter(d => d.gameType === GameType.SINGLES).length,
      doubles: divisionStats.filter(d => d.gameType === GameType.DOUBLES).length
    },
    byLevel: {
      beginner: divisionStats.filter(d => d.level === DivisionLevel.BEGINNER).length,
      intermediate: divisionStats.filter(d => d.level === DivisionLevel.INTERMEDIATE).length,
      advanced: divisionStats.filter(d => d.level === DivisionLevel.ADVANCED).length,
    },
    byGender: {
      male: divisionStats.filter(d => d.genderCategory === GenderType.MALE).length,
      female: divisionStats.filter(d => d.genderCategory === GenderType.FEMALE).length,
      mixed: divisionStats.filter(d => d.genderCategory === GenderType.MIXED).length,
      open: divisionStats.filter(d => !d.genderCategory).length
    },
    capacityUtilization: divisionStats.map(d => {
      const isSingles = d.gameType === GameType.SINGLES;
      const maxCapacity = isSingles ? d.maxSinglesPlayers : d.maxDoublesTeams;
      const currentCount = isSingles ? (d.currentSinglesCount || 0) : (d.currentDoublesCount || 0);
      const utilizationRate = maxCapacity ? (currentCount / maxCapacity) * 100 : 0;

      return {
        divisionId: d.id,
        divisionName: d.name,
        maxCapacity: maxCapacity || 0,
        currentCount: currentCount || 0,
        utilizationRate: Math.round(utilizationRate * 100) / 100
      };
    })
  };

  console.log(`✅ Generated summary for season ${seasonId}: ${summary.totalDivisions} divisions`);

  // Get full division data for detailed list
  const divisions = await prisma.division.findMany({
    where: { seasonId },
    include: { season: true }
  });

  return {
    season: {
      id: season.id,
      name: season.name,
      isActive: season.isActive
    },
    summary,
    divisions: divisions.map(formatDivision)
  };
}
