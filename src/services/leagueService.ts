import { PrismaClient, Statuses, SportType, GameType, TierType } from '@prisma/client';

const prisma = new PrismaClient();

interface LeagueFilters {
  name?: string;
  sportId?: number;      // Filter by sport (via LeagueSport junction)
  location?: string;
  status?: string;
}

interface LeagueData {
  id?: string; // optional, mainly for updates
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
    id?: string;          // optional for new sponsorships
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

export const getAllLeagues = async () => {
  const leagues = await prisma.league.findMany({
    include: {
      sponsorships: true,
      categories: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          game_type: true,
          gender_category: true
        }
      },
      seasons: {
        include: {
          _count: {
            select: {
              memberships: true,
              registrations: true
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

  // Calculate total members from all seasons in all leagues
  const totalMembers = leagues.reduce((sum: number, league: any) => {
    if (!league.seasons) return sum;
    return sum + league.seasons.reduce((seasonSum: number, season: any) => {
      const memberships = season._count?.memberships || 0;
      const registrations = season._count?.registrations || 0;
      return seasonSum + memberships + registrations;
    }, 0);
  }, 0);

  const totalCategories = leagues.reduce((sum: number, league: any) => sum + (league.categories?.length || 0), 0);

  return { leagues, totalMembers, totalCategories };
};


export const getLeagueById = async (id: string) => {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      sponsorships: true,
      // memberships removed - LeagueMembership model no longer exists
      categories: true,
      seasons: {
        include: {
          divisions: true,
          memberships: {
            include: {
              user: true
            }
          },
          registrations: {
            include: {
              player: true
            }
          },
          _count: {
            select: {
              memberships: true,
              registrations: true
            }
          }
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
          categories: true,
          // memberships removed
        },
      },
    },
  });

  if (!league) {
    throw new Error(`League with ID ${id} not found.`);
  }

  return league;
};



export const createLeague = async (data: LeagueData) => {
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

  const existingLeague = await prisma.league.findFirst({
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
          // startDate: s.startDate,
          // endDate: s.endDate ?? null,
          // isActive: s.isActive ?? true,
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

  return prisma.league.create({
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
};



export const updateLeague = async (id: string, data: LeagueData) => {
  
  const league = await prisma.league.findUnique({ where: { id } });
  if (!league) throw new Error(`League with ID ${id} not found.`);

  if (data.name || data.location) {
    const duplicate = await prisma.league.findFirst({
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

  return prisma.league.update({
    where: { id },
    data: updateData,
    include: {
      sponsorships: true,
    },
  });
};


export const deleteLeague = async (id: string) => {
  // Verify league exists
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          seasons: true,
          sponsorships: true, 
          // memberships removed - LeagueMembership model no longer exists
          categories: true, 
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
  return prisma.league.delete({
    where: { id }
  });
};
