import { PrismaClient, LeagueStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface SeasonCreationData {
  name: string;
  entryFee?: number;
  startDate: Date;
  endDate: Date;
  lastRegistration?: Date;
  status?: LeagueStatus;
  leagueSportId: number;         // NEW: season belongs to a specific sport@league
  leagueTypeId: number;          // Singles/Doubles/Mixed
  createdById: string;
}

interface SeasonUpdateData {
  name?: string;
  entryFee?: number;
  startDate?: Date;
  endDate?: Date;
  lastRegistration?: Date;
  status?: LeagueStatus;
  leagueSportId?: number;        // allow reassigning to another sport@league
  leagueTypeId?: number;
}

interface SeasonFilters {
  name?: string;
  leagueId?: number;
  sportId?: number;
  leagueSportId?: number;
  status?: LeagueStatus;
  startDateFrom?: Date;
  endDateTo?: Date;
}

// BUSINESS LOGIC SERVICES

/**
 * Business Logic: Season creation with validation
 */
export const createSeason = async (data: SeasonCreationData) => {
  const {
    name, entryFee, startDate, endDate, lastRegistration,
    status = LeagueStatus.UPCOMING,
    leagueSportId, leagueTypeId, createdById,
  } = data;

  // Business Rule: Date validation
  if (startDate >= endDate) {
    throw new Error('Start date must be before end date.');
  }
  if (lastRegistration && lastRegistration >= startDate) {
    throw new Error('Registration deadline must be before start date.');
  }

  // Business Rule: Verify LeagueSport exists
  const leagueSport = await prisma.leagueSport.findUnique({
    where: { id: leagueSportId },
    include: {
      league: true,
      sport: true
    }
  });
  if (!leagueSport) {
    throw new Error(`LeagueSport with ID ${leagueSportId} not found.`);
  }

  // Business Rule: Verify league type exists
  const leagueType = await prisma.leagueType.findUnique({
    where: { id: leagueTypeId },
  });
  if (!leagueType) {
    throw new Error(`LeagueType with ID ${leagueTypeId} not found.`);
  }

  // Business Rule: Verify user exists and can create seasons
  const user = await prisma.user.findUnique({
    where: { id: createdById },
  });
  if (!user) {
    throw new Error(`User with ID ${createdById} not found.`);
  }

  // Business Rule: Check for duplicate season names in same league+sport
  const existingSeason = await prisma.season.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      leagueSportId: leagueSportId,
    }
  });
  if (existingSeason) {
    throw new Error(
      `A season named "${name}" already exists for ${leagueSport.sport.name} at ${leagueSport.league.name}.`
    );
  }

  // Business Logic: Create season with proper relationships
  return prisma.season.create({
    data: {
      name,
      entryFee,
      startDate,
      endDate,
      lastRegistration,
      status,
      leagueId: leagueSport.leagueId, // derive from leagueSport for consistency
      leagueSportId,
      leagueTypeId,
      createdById,
    },
    include: {
      league: { select: { id: true, name: true, location: true } },
      leagueSport: { include: { sport: true } },
      leagueType: { select: { id: true, name: true, type: true, gender: true } },
      _count: { select: { registrations: true, divisions: true } },
    },
  });
};

/**
 * Get seasons with filters
 */
export const getSeasons = async (filters: SeasonFilters) => {
  const { name, leagueId, sportId, leagueSportId, status, startDateFrom, endDateTo } = filters;

  const where: any = {};

  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }
  
  if (status) {
    where.status = status;
  }
  
  if (startDateFrom) {
    where.startDate = { gte: startDateFrom };
  }
  
  if (endDateTo) {
    where.endDate = { lte: endDateTo };
  }

  // Filter by leagueSportId directly, or by league+sport combo
  if (leagueSportId) {
    where.leagueSportId = leagueSportId;
  } else if (leagueId && sportId) {
    where.leagueSport = { leagueId, sportId };
  } else if (leagueId) {
    where.leagueId = leagueId;
  }

  return prisma.season.findMany({
    where,
    include: {
      league: { select: { id: true, name: true, location: true } },
      leagueSport: { include: { sport: true } },
      leagueType: true,
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { registrations: true, divisions: true } },
    },
    orderBy: { startDate: 'desc' },
  });
};

/**
 * Get season by ID
 */
export const getSeasonById = async (id: number) => {
  const season = await prisma.season.findUnique({
    where: { id },
    include: {
      league: true,
      leagueSport: { include: { sport: true } },
      leagueType: true,
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { registrations: true, divisions: true } },
    },
  });
  
  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }
  
  return season;
};

/**
 * Business Logic: Season update with validation
 */
export const updateSeason = async (id: number, data: SeasonUpdateData) => {
  // Business Rule: Verify season exists
  const season = await prisma.season.findUnique({
    where: { id },
  });
  
  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }

  // Business Rule: Cannot update season if it's completed or cancelled
  if (season.status === 'COMPLETED' || season.status === 'CANCELLED') {
    throw new Error('Cannot update a completed or cancelled season.');
  }

  // Business Rule: Date validation
  if (data.startDate && data.endDate && data.startDate >= data.endDate) {
    throw new Error('Start date must be before end date.');
  }
  
  if (data.lastRegistration) {
    const compareStart = data.startDate || season.startDate;
    if (data.lastRegistration >= compareStart) {
      throw new Error('Registration deadline must be before start date.');
    }
  }

  // Business Rule: If changing leagueSportId, verify it exists and derive leagueId
  let leagueIdUpdate: number | undefined = undefined;
  if (data.leagueSportId) {
    const ls = await prisma.leagueSport.findUnique({ 
      where: { id: data.leagueSportId } 
    });
    if (!ls) {
      throw new Error(`LeagueSport with ID ${data.leagueSportId} not found.`);
    }
    leagueIdUpdate = ls.leagueId;
  }

  // Business Rule: If updating name, check for duplicates
  if (data.name && data.name !== season.name) {
    const existingSeason = await prisma.season.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        leagueSportId: data.leagueSportId ?? season.leagueSportId,
        id: { not: id },
      }
    });
    if (existingSeason) {
      throw new Error(`A season with name "${data.name}" already exists for this league and sport.`);
    }
  }

  // Business Logic: Update season
  return prisma.season.update({
    where: { id },
    data: {
      name: data.name,
      entryFee: data.entryFee,
      startDate: data.startDate,
      endDate: data.endDate,
      lastRegistration: data.lastRegistration,
      status: data.status,
      leagueSportId: data.leagueSportId,
      leagueId: leagueIdUpdate, // keep in sync with leagueSport
      leagueTypeId: data.leagueTypeId,
    },
    include: {
      league: true,
      leagueSport: { include: { sport: true } },
      leagueType: true,
      _count: { select: { registrations: true, divisions: true } },
    },
  });
};

/**
 * Business Logic: Season deletion with constraint checking
 */
export const deleteSeason = async (id: number) => {
  // Business Rule: Verify season exists
  const season = await prisma.season.findUnique({
    where: { id },
    include: {
      _count: { select: { registrations: true, divisions: true } },
    },
  });
  
  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }

  // Business Rule: Check if season has registrations
  if (season._count.registrations > 0) {
    throw new Error('Cannot delete a season that has registrations.');
  }

  // Business Rule: Check if season has divisions
  if (season._count.divisions > 0) {
    throw new Error('Cannot delete a season that has divisions.');
  }

  // Business Logic: Safe to delete
  return prisma.season.delete({
    where: { id },
  });
};

/**
 * Business Logic: Advanced season operations
 */
export const closeSeasonRegistration = async (id: number) => {
  const season = await prisma.season.findUnique({
    where: { id },
  });

  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }

  if (season.status !== 'REGISTRATION_OPEN') {
    throw new Error('Can only close registration for seasons with open registration.');
  }

  return prisma.season.update({
    where: { id },
    data: { status: 'REGISTRATION_CLOSED' },
  });
};

export const startSeason = async (id: number) => {
  const season = await prisma.season.findUnique({
    where: { id },
    include: {
      _count: {
        select: { registrations: true }
      }
    }
  });

  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }

  if (season.status !== 'REGISTRATION_CLOSED') {
    throw new Error('Season must have closed registration before it can start.');
  }

  if (season._count.registrations === 0) {
    throw new Error('Cannot start a season with no registrations.');
  }

  const now = new Date();
  if (now < season.startDate) {
    throw new Error('Cannot start season before the scheduled start date.');
  }

  return prisma.season.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
  });
};

export const completeSeason = async (id: number) => {
  const season = await prisma.season.findUnique({
    where: { id },
  });

  if (!season) {
    throw new Error(`Season with ID ${id} not found.`);
  }

  if (season.status !== 'IN_PROGRESS') {
    throw new Error('Can only complete seasons that are in progress.');
  }

  return prisma.season.update({
    where: { id },
    data: { status: 'COMPLETED' },
  });
};
