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

export const getAllLeagues = async () => {
  const leagues = await prisma.league.findMany({
    include: {
      sponsorships: { include: { company: true } },
      _count: {
        select: { seasons: true, memberships: true, categories: true },
      },
      createdBy: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalMembers = leagues.reduce((sum, league) => sum + (league._count.memberships || 0), 0);
  const totalCategories = leagues.reduce((sum, league) => sum + (league._count.categories || 0), 0);

  return { leagues, totalMembers, totalCategories };
};


export const getLeagueById = async (id: string) => {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      // Include sponsorships and their company info
      sponsorships: {
        include: { company: true },
      },

      // Include memberships and their related users (players/admins)
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
      },
      categories: true,
      seasons: {
        include: {
          divisions: true,
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
          memberships: true,
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
