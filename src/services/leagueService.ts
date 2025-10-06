import { PrismaClient, LeagueStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface LeagueFilters {
  name?: string;
  sportId?: number;      // Filter by sport (via LeagueSport junction)
  location?: string;
  status?: string;
}

interface LeagueCreationData {
  name: string;
  location: string;
  description?: string;
  status?: LeagueStatus;
}

interface LeagueUpdateData {
  name?: string;
  location?: string;
  description?: string;
  status?: LeagueStatus;
}

// LeagueSport operations
export const addSportToLeague = async ({ leagueId, sportId, isActive, sortOrder }:{
  leagueId: number; sportId: number; isActive?: boolean; sortOrder?: number;
}) => {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) throw new Error(`League with ID ${leagueId} not found.`);
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) throw new Error(`Sport with ID ${sportId} not found.`);

  const exists = await prisma.leagueSport.findUnique({
    where: { leagueId_sportId: { leagueId, sportId } }
  });
  if (exists) throw new Error(`Sport "${sport.name}" already added to "${league.name}".`);

  return prisma.leagueSport.create({
    data: { leagueId, sportId, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 },
    include: { sport: true }
  });
};

export const getSportsAtLeague = async (leagueId: number, includeInactive = false) => {
  return prisma.leagueSport.findMany({
    where: { leagueId, ...(includeInactive ? {} : { isActive: true }) },
    include: {
      sport: { select: { id: true, name: true, description: true, pic_url: true, isActive: true } },
      _count: { select: { seasons: true } }
    },
    orderBy: { sortOrder: 'asc' }
  });
};

export const updateLeagueSport = async (
  leagueId: number,
  sportId: number,
  data: { isActive?: boolean; sortOrder?: number }
) => {
  const ls = await prisma.leagueSport.findUnique({
    where: { leagueId_sportId: { leagueId, sportId } },
    include: { league: { select: { name: true } }, sport: { select: { name: true } } }
  });
  if (!ls) throw new Error(`Sport ${sportId} not offered at league ${leagueId}.`);

  if (data.isActive === false) {
    const activeSeasons = await prisma.season.count({
      where: { leagueSportId: ls.id, status: { in: ['UPCOMING','REGISTRATION_OPEN','IN_PROGRESS'] } }
    });
    if (activeSeasons > 0) {
      throw new Error(`Cannot deactivate ${ls.sport.name} at ${ls.league.name}; ${activeSeasons} active season(s).`);
    }
  }

  return prisma.leagueSport.update({
    where: { leagueId_sportId: { leagueId, sportId } },
    data,
    include: { sport: true }
  });
};

export const removeSportFromLeague = async (leagueId: number, sportId: number) => {
  const ls = await prisma.leagueSport.findUnique({
    where: { leagueId_sportId: { leagueId, sportId } },
    include: { _count: { select: { seasons: true } }, sport: true, league: true }
  });
  if (!ls) throw new Error(`Sport ${sportId} not offered at league ${leagueId}.`);
  if (ls._count.seasons > 0) {
    throw new Error(`Cannot remove ${ls.sport.name} from ${ls.league.name}; ${ls._count.seasons} season(s) exist.`);
  }
  return prisma.leagueSport.delete({ where: { leagueId_sportId: { leagueId, sportId } } });
};

/**
 * Get all leagues with optional filters
 * Public endpoint - users browse leagues
 */
export const getAllLeagues = async (filters: LeagueFilters) => {
  const { name, sportId, location, status } = filters;

  const where: any = {};
  
  // Filter by league name
  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }
  
  // Filter by location
  if (location) {
    where.location = { contains: location, mode: 'insensitive' };
  }
  
  // Filter by status
  if (status) {
    where.status = status;
  }
  
  // Filter by sport (via LeagueSport junction)
  if (sportId) {
    where.leagueSports = {
      some: {
        sportId: sportId,
        isActive: true
      }
    };
  }

  return prisma.league.findMany({
    where,
    include: {
      leagueSports: {
        where: { isActive: true },
        include: {
          sport: {
            select: {
              id: true,
              name: true,
              pic_url: true
            }
          }
        },
        orderBy: {
          sortOrder: 'asc'
        }
      },
      _count: {
        select: { 
          seasons: true,
          leagueSports: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

/**
 * Get league by ID
 * Public endpoint - view league details
 */
export const getLeagueById = async (id: number) => {
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      leagueSports: {
        where: { isActive: true },
        include: {
          sport: {
            select: {
              id: true,
              name: true,
              pic_url: true
            }
          },
          _count: {
            select: { seasons: true }
          }
        },
        orderBy: {
          sortOrder: 'asc'
        }
      },
      seasons: {
        where: {
          status: {
            in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS']
          }
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          _count: {
            select: { registrations: true }
          }
        },
        orderBy: {
          startDate: 'asc'
        },
        take: 5  // Show next 5 upcoming/active seasons
      },
      _count: {
        select: { 
          seasons: true,
          leagueSports: true
        }
      }
    }
  });

  if (!league) {
    throw new Error(`League with ID ${id} not found.`);
  }

  return league;
};

/**
 * Create new league
 * Admin only - creates basic league info
 */
export const createLeague = async (data: LeagueCreationData) => {
  const { name, location, description, status } = data;

  // Business Rule: Check for duplicate league name in same location
  const existingLeague = await prisma.league.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      location: { equals: location, mode: 'insensitive' }
    }
  });

  if (existingLeague) {
    throw new Error(`A league with name "${name}" already exists in "${location}".`);
  }

  // Create league
  return prisma.league.create({
    data: {
      name: name.trim(),
      location: location.trim(),
      description: description?.trim(),
      status: status || LeagueStatus.UPCOMING
    },
    include: {
      leagueSports: {
        include: {
          sport: true
        }
      }
    }
  });
};

/**
 * Update league
 * Admin only - updates basic league info
 */
export const updateLeague = async (id: number, data: LeagueUpdateData) => {
  // Business Rule: Verify league exists
  const league = await prisma.league.findUnique({
    where: { id }
  });

  if (!league) {
    throw new Error(`League with ID ${id} not found.`);
  }

  // Business Rule: If changing name/location, check for duplicates
  if (data.name || data.location) {
    const checkName = data.name || league.name;
    const checkLocation = data.location || league.location;

    const duplicate = await prisma.league.findFirst({
      where: {
        id: { not: id },
        name: { equals: checkName, mode: 'insensitive' },
        location: { equals: checkLocation, mode: 'insensitive' }
      }
    });

    if (duplicate) {
      throw new Error(`A league with name "${checkName}" already exists in "${checkLocation}".`);
    }
  }

  // Update league
  return prisma.league.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      location: data.location?.trim(),
      description: data.description?.trim(),
      status: data.status
    },
    include: {
      leagueSports: {
        where: { isActive: true },
        include: {
          sport: true
        }
      }
    }
  });
};

/**
 * Delete league
 * Admin only - with validation
 */
export const deleteLeague = async (id: number) => {
  // Business Rule: Verify league exists
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          seasons: true,
          leagueSports: true
        }
      }
    }
  });

  if (!league) {
    throw new Error(`League with ID ${id} not found.`);
  }

  // Business Rule: Can't delete league with seasons
  if (league._count.seasons > 0) {
    throw new Error(
      `Cannot delete league "${league.name}". It has ${league._count.seasons} season(s). Please delete all seasons first.`
    );
  }

  // Business Rule: Can't delete league with active sports
  // (This will cascade delete LeagueSport records due to onDelete: Cascade)
  if (league._count.leagueSports > 0) {
    throw new Error(
      `Cannot delete league "${league.name}". It has ${league._count.leagueSports} sport(s) assigned. Please remove all sports first.`
    );
  }

  // Delete league
  return prisma.league.delete({
    where: { id }
  });
};

/**
 * Get leagues offering a specific sport
 * Public endpoint - user searches by sport
 */
export const getLeaguesBySport = async (sportId: number, location?: string) => {
  const where: any = {
    leagueSports: {
      some: {
        sportId: sportId,
        isActive: true
      }
    }
  };

  // Optionally filter by location
  if (location) {
    where.location = { contains: location, mode: 'insensitive' };
  }

  return prisma.league.findMany({
    where,
    include: {
      leagueSports: {
        where: {
          sportId: sportId,
          isActive: true
        },
        include: {
          sport: true,
          _count: {
            select: { seasons: true }
          }
        }
      },
      _count: {
        select: { seasons: true }
      }
    },
    orderBy: {
      // Later add smart sorting - user's location first (maybe)
      createdAt: 'desc'
    }
  });
};
