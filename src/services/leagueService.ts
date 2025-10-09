import { PrismaClient, Statuses, SportType, LeagueType, GameType, TierType } from '@prisma/client';

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
  joinType?: LeagueType;
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

// LeagueSport operations
// export const addSportToLeague = async ({ leagueId, sportId, isActive, sortOrder }:{
//   leagueId: number; sportId: number; isActive?: boolean; sortOrder?: number;
// }) => {
//   const league = await prisma.league.findUnique({ where: { id: leagueId } });
//   if (!league) throw new Error(`League with ID ${leagueId} not found.`);
//   const sport = await prisma.sport.findUnique({ where: { id: sportId } });
//   if (!sport) throw new Error(`Sport with ID ${sportId} not found.`);

//   const exists = await prisma.leagueSport.findUnique({
//     where: { leagueId_sportId: { leagueId, sportId } }
//   });
//   if (exists) throw new Error(`Sport "${sport.name}" already added to "${league.name}".`);

//   return prisma.leagueSport.create({
//     data: { leagueId, sportId, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 },
//     include: { sport: true }
//   });
// };

// export const getSportsAtLeague = async (leagueId: number, includeInactive = false) => {
//   return prisma.leagueSport.findMany({
//     where: { leagueId, ...(includeInactive ? {} : { isActive: true }) },
//     include: {
//       sport: { select: { id: true, name: true, description: true, pic_url: true, isActive: true } },
//       _count: { select: { seasons: true } }
//     },
//     orderBy: { sortOrder: 'asc' }
//   });
// };

// export const updateLeagueSport = async (
//   leagueId: number,
//   sportId: number,
//   data: { isActive?: boolean; sortOrder?: number }
// ) => {
//   const ls = await prisma.leagueSport.findUnique({
//     where: { leagueId_sportId: { leagueId, sportId } },
//     include: { league: { select: { name: true } }, sport: { select: { name: true } } }
//   });
//   if (!ls) throw new Error(`Sport ${sportId} not offered at league ${leagueId}.`);

//   if (data.isActive === false) {
//     const activeSeasons = await prisma.season.count({
//       where: { leagueSportId: ls.id, status: { in: ['UPCOMING','REGISTRATION_OPEN','IN_PROGRESS'] } }
//     });
//     if (activeSeasons > 0) {
//       throw new Error(`Cannot deactivate ${ls.sport.name} at ${ls.league.name}; ${activeSeasons} active season(s).`);
//     }
//   }

//   return prisma.leagueSport.update({
//     where: { leagueId_sportId: { leagueId, sportId } },
//     data,
//     include: { sport: true }
//   });
// };

// export const removeSportFromLeague = async (leagueId: number, sportId: number) => {
//   const ls = await prisma.leagueSport.findUnique({
//     where: { leagueId_sportId: { leagueId, sportId } },
//     include: { _count: { select: { seasons: true } }, sport: true, league: true }
//   });
//   if (!ls) throw new Error(`Sport ${sportId} not offered at league ${leagueId}.`);
//   if (ls._count.seasons > 0) {
//     throw new Error(`Cannot remove ${ls.sport.name} from ${ls.league.name}; ${ls._count.seasons} season(s) exist.`);
//   }
//   return prisma.leagueSport.delete({ where: { leagueId_sportId: { leagueId, sportId } } });
// };


export const getAllLeagues = async () => {
  return prisma.league.findMany({
    include: {
      sponsorships: {
        include: { company: true }
      },
      _count: {
        select: { seasons: true }
      },
      createdBy: {
        select: { id: true}
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};


export const getLeagueById = async (id: string) => {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      // Include sponsorships and their company info
      sponsorships: {
        include: { company: true }
      },
      // Include admin info
      createdBy: {
        select: {
          id: true,
          // name: true,
        }
      },
      // Count total seasons and sponsorships
      _count: {
        select: {
          seasons: true,
          sponsorships: true
        }
      }
    }
  });

  if (!league) {
    throw new Error(`League with ID ${id} not found.`);
  }

  return league;
};


export const createLeague = async (data: LeagueData) => {
  const { name, location, description, status, sportType, joinType, gameType, sponsorships, existingSponsorshipIds } = data;

  const existingLeague = await prisma.league.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      location: { equals: location, mode: "insensitive" },
    },
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
      location,
      description,
      status,
      sportType,
      joinType,
      gameType,
      createdById: data.createdById, 
      sponsorships: sponsorshipData
    },
    include: {
      sponsorships: { include: { company: true } },
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

  return prisma.league.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      location: data.location?.trim(),
      description: data.description?.trim(),
      status: data.status,
      sponsorships: data.sponsorships?.length
        ? {
            upsert: data.sponsorships.map((s: any) => ({
              where: { id: s.id || '' }, 
              update: {
                companyId: s.companyId,
                packageTier: s.packageTier,
                contractAmount: s.contractAmount,
                sponsoredName: s.sponsoredName,
                startDate: s.startDate,
                endDate: s.endDate,
                isActive: s.isActive ?? true,
                createdById: s.createdById,
              },
              create: {
                companyId: s.companyId,
                packageTier: s.packageTier,
                contractAmount: s.contractAmount,
                sponsoredName: s.sponsoredName,
                startDate: s.startDate,
                endDate: s.endDate,
                isActive: s.isActive ?? true,
                createdById: s.createdById,
              },
            })),
          }
        : undefined,
    },
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
          memberships: true, 
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

  // Prevent deletion if players are joined
  if (league._count.memberships > 0) {
    throw new Error(
      `Cannot delete league "${league.name}". It has ${league._count.memberships} joined player(s). Please remove all memberships first.`
    );
  }

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


/**
 * Get leagues offering a specific sport
 * Public endpoint - user searches by sport
 */
// export const getLeaguesBySport = async (sportId: number, location?: string) => {
//   const where: any = {
//     leagueSports: {
//       some: {
//         sportId: sportId,
//         isActive: true
//       }
//     }
//   };

//   // Optionally filter by location
//   if (location) {
//     where.location = { contains: location, mode: 'insensitive' };
//   }

//   return prisma.league.findMany({
//     where,
//     include: {
//       leagueSports: {
//         where: {
//           sportId: sportId,
//           isActive: true
//         },
//         include: {
//           sport: true,
//           _count: {
//             select: { seasons: true }
//           }
//         }
//       },
//       _count: {
//         select: { seasons: true }
//       }
//     },
//     orderBy: {
//       // Later add smart sorting - user's location first (maybe)
//       createdAt: 'desc'
//     }
//   });
// };
