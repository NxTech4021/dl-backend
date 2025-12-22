import { prisma, PrismaClient } from "../lib/prisma";
import { Statuses, SportType, GameType, TierType } from '@prisma/client';


interface LeagueFilters {
  name?: string;
  sportId?: number;
  location?: string;
  status?: string;
}

interface LeagueData {
  id?: string;
  name?: string;
  location?: string;
  description?: string;
  status?: Statuses;
  sportType?: SportType;
  gameType?: GameType;
  createCompany?: boolean;
  createdById?: string;
  company?: {
    name: string;
    contactEmail?: string;
    website?: string;
    logoUrl?: string;
    createdById?: string;
  };
  sponsorships?: {
    id?: string;
    companyId: string;
    packageTier: TierType;
    contractAmount: number;
    sponsoredName?: string;
    startDate: Date | string;
    endDate?: Date | string;
    isActive?: boolean;
    createdById?: string;
  }[];
  existingSponsorshipIds?: string[];
}

/**
 * LeagueService class with dependency injection support
 * Allows injecting a custom Prisma client for testing
 */
export class LeagueService {
  private prisma: PrismaClient;

  /**
   * Create a new LeagueService instance
   * @param prismaClient - Optional Prisma client for dependency injection (useful for testing)
   */
  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  async getAllLeagues() {
    const leagues = await this.prisma.league.findMany({
      include: {
        sponsorships: true,
        seasons: {
          include: {
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
              select: {
                memberships: true
              }
            }
          }
        },
        _count: {
          select: { seasons: true },
        },
        createdBy: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total season memberships and flatten memberships for each league
    const leaguesWithMemberships = leagues.map((league: any) => {
      const totalSeasonMemberships = league.seasons?.reduce((sum: number, season: any) => {
        const memberships = season._count?.memberships || 0;
        return sum + memberships;
      }, 0) || 0;

      // Flatten memberships from all seasons into a single array for the frontend
      // Get up to 6 unique memberships across all seasons
      const allMemberships: any[] = [];
      const seenUserIds = new Set<string>();

      if (league.seasons) {
        for (const season of league.seasons) {
          if (season.memberships) {
            for (const membership of season.memberships) {
              if (membership.user && !seenUserIds.has(membership.user.id)) {
                allMemberships.push(membership);
                seenUserIds.add(membership.user.id);
                if (allMemberships.length >= 6) break;
              }
            }
          }
          if (allMemberships.length >= 6) break;
        }
      }

      // Extract unique categories from all seasons
      const categoryMap = new Map<string, any>();
      if (league.seasons) {
        for (const season of league.seasons) {
          if (season.category && season.category.isActive) {
            // Use category id as key to avoid duplicates
            if (!categoryMap.has(season.category.id)) {
              categoryMap.set(season.category.id, {
                id: season.category.id,
                name: season.category.name,
                genderRestriction: season.category.genderRestriction,
                game_type: season.category.game_type,
                gender_category: season.category.gender_category
              });
            }
          }
        }
      }
      const categories = Array.from(categoryMap.values());

      return {
        ...league,
        totalSeasonMemberships,
        memberships: allMemberships,
        categories
      };
    });

    // Calculate total members across all leagues
    const totalMembers = leaguesWithMemberships.reduce((sum: number, league: any) => {
      return sum + (league.totalSeasonMemberships || 0);
    }, 0);

    return { leagues: leaguesWithMemberships, totalMembers };
  }

  async getLeagueById(id: string) {
    const league = await this.prisma.league.findUnique({
      where: { id },
      include: {
        sponsorships: true,
        seasons: {
          include: {
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
            divisions: true,
            memberships: {
              include: {
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
              select: {
                memberships: true
              }
            },
          },
        },
        createdBy: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            seasons: true,
            sponsorships: true,
          },
        },
      },
    });

    if (!league) {
      throw new Error(`League with ID ${id} not found.`);
    }

    // Calculate total season memberships for this league
    const totalSeasonMemberships = league.seasons?.reduce((sum: number, season: any) => {
      const memberships = season._count?.memberships || 0;
      return sum + memberships;
    }, 0) || 0;

    // Flatten memberships from all seasons into a single array for the frontend
    // Get up to 6 unique memberships across all seasons
    const allMemberships: any[] = [];
    const seenUserIds = new Set<string>();

    if (league.seasons) {
      for (const season of league.seasons) {
        if (season.memberships) {
          for (const membership of season.memberships) {
            if (membership.user && !seenUserIds.has(membership.user.id)) {
              allMemberships.push(membership);
              seenUserIds.add(membership.user.id);
              if (allMemberships.length >= 6) break;
            }
          }
        }
        if (allMemberships.length >= 6) break;
      }
    }

    // Extract unique categories from all seasons
    const categoryMap = new Map<string, any>();
    if (league.seasons) {
      for (const season of league.seasons) {
        if (season.category && season.category.isActive) {
          // Use category id as key to avoid duplicates
          if (!categoryMap.has(season.category.id)) {
            categoryMap.set(season.category.id, {
              id: season.category.id,
              name: season.category.name,
              genderRestriction: season.category.genderRestriction,
              game_type: season.category.gameType,
              gender_category: season.category.genderCategory
            });
          }
        }
      }
    }
    const categories = Array.from(categoryMap.values());

    return {
      ...league,
      totalSeasonMemberships,
      memberships: allMemberships,
      categories,
      _count: {
        ...league._count,
        memberships: totalSeasonMemberships
      }
    };
  }

  async createLeague(data: LeagueData) {
    const { name, location, description, status, sportType, gameType, sponsorships, existingSponsorshipIds } = data;

    // Validate required fields
    if (!name) {
      throw new Error("League name is required");
    }
    if (!sportType) {
      throw new Error("Sport type is required");
    }
    if (!gameType) {
      throw new Error("Game type is required");
    }

    const whereClause: any = {
      name: { equals: name, mode: "insensitive" },
    };

    if (location) {
      whereClause.location = { equals: location, mode: "insensitive" };
    }

    const existingLeague = await this.prisma.league.findFirst({
      where: whereClause,
    });

    if (existingLeague) {
      throw new Error(`A league with name "${name}" already exists in "${location}".`);
    }

     // Prepare create object for new sponsorships
    const sponsorshipCreate = sponsorships?.length
      ? {
          create: sponsorships.map((s: any) => ({
            packageTier: s.packageTier,
            contractAmount: s.contractAmount ?? null,
            sponsorRevenue: s.sponsorRevenue ?? null,
            sponsoredName: s.sponsoredName ?? null,
            createdById: s.createdById ?? null
          })),
        }
      : undefined;

    // Prepare connect object for existing sponsorships
    const sponsorshipConnect = existingSponsorshipIds?.length
      ? {
          connect: existingSponsorshipIds.map((id: string) => ({ id })),
        }
      : undefined;

    // Combine create and connect
    const sponsorshipData =
      sponsorshipCreate && sponsorshipConnect
        ? { ...sponsorshipCreate, ...sponsorshipConnect }
        : sponsorshipCreate ?? sponsorshipConnect;

    console.log("Sponsorship data being sent to Prisma:", JSON.stringify(sponsorshipData, null, 2));

    return this.prisma.league.create({
      data: {
        name,
        location: location || null,
        description: description || null,
        status: status || Statuses.UPCOMING,
        sportType,
        gameType,
        createdById: data.createdById || null,
        ...(sponsorshipData ? { sponsorships: sponsorshipData } : {}),
      },
      include: {
        sponsorships: true,
      },
    });
  }

  async updateLeague(id: string, data: LeagueData) {
    const league = await this.prisma.league.findUnique({ where: { id } });
    if (!league) throw new Error(`League with ID ${id} not found.`);

    if (data.name || data.location) {
      const duplicate = await this.prisma.league.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name || league.name, mode: 'insensitive' },
          location: { equals: data.location || league.location, mode: 'insensitive' },
        },
      });
      if (duplicate) throw new Error(`A league with this name and location already exists.`);
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.location !== undefined) updateData.location = data.location.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.league.update({
      where: { id },
      data: updateData,
      include: {
        sponsorships: true,
      },
    });
  }

  async deleteLeague(id: string) {
    // Verify league exists
    const league = await this.prisma.league.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            seasons: true,
            sponsorships: true,
          }
        }
      }
    });

    if (!league) {
      throw new Error(`League with ID ${id} not found.`);
    }

    // Can't delete league with seasons
    if (league._count.seasons > 0) {
      throw new Error(
        `Cannot delete league "${league.name}". It has ${league._count.seasons} season(s). Please delete all seasons first.`
      );
    }

    // memberships check removed - LeagueMembership model no longer exists

    // Optional: warn if league has sponsorships
    if (league._count.sponsorships > 0) {
      console.warn(
        `League "${league.name}" has ${league._count.sponsorships} sponsorship(s). These will be deleted due to cascade.`
      );
    }

    // Delete league (sponsorships will be deleted if cascade is set)
    return this.prisma.league.delete({
      where: { id }
    });
  }
}

// Create a default instance for backward compatibility
const defaultLeagueService = new LeagueService();

// Export functions that delegate to the default instance for backward compatibility
export const getAllLeagues = () =>
  defaultLeagueService.getAllLeagues();

export const getLeagueById = (id: string) =>
  defaultLeagueService.getLeagueById(id);

export const createLeague = (data: LeagueData) =>
  defaultLeagueService.createLeague(data);

export const updateLeague = (id: string, data: LeagueData) =>
  defaultLeagueService.updateLeague(id, data);

export const deleteLeague = (id: string) =>
  defaultLeagueService.deleteLeague(id);
