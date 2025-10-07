import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();


interface CreateSeasonData {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  regiDeadline?: string | Date;
  sportType: string;
  seasonType: string;
  description?: string;
  entryFee: string | number;
  leagueId: string;
  categoryId: string;
  isActive?: boolean;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

// interface SeasonUpdateData {
//   name?: string;
//   entryFee?: number;
//   startDate?: Date;
//   endDate?: Date;
//   lastRegistration?: Date;
//   status?: LeagueStatus;
//   leagueSportId?: number;        // allow reassigning to another sport@league
//   leagueTypeId?: number;
// }

// interface SeasonFilters {
//   name?: string;
//   leagueId?: number;
//   sportId?: number;
//   leagueSportId?: number;
//   status?: LeagueStatus;
//   startDateFrom?: Date;
//   endDateTo?: Date;
// }

// BUSINESS LOGIC SERVICES
export const createSeasonService = async (data: CreateSeasonData) => {
  const {
    name,
    startDate,
    endDate,
    regiDeadline,
    sportType,
    seasonType,
    description,
    entryFee,
    leagueId,
    categoryId,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = data;

  // Check for existing season by name + sportType
  const existingSeason = await prisma.season.findFirst({
    where: { name, sportType },
  });
  if (existingSeason) {
    throw new Error("A season with this name and sport type already exists.");
  }

  // Create season
  return prisma.season.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      regiDeadline: regiDeadline ? new Date(regiDeadline) : new Date(endDate),
      entryFee: new Prisma.Decimal(entryFee),
      sportType,
      seasonType,
      description,
      leagueId,
      categoryId,
      isActive: isActive ?? false,
      paymentRequired: paymentRequired ?? false,
      promoCodeSupported: promoCodeSupported ?? false,
      withdrawalEnabled: withdrawalEnabled ?? false,
      status: isActive ? "ACTIVE" : "UPCOMING",
    },
  });
};


/**
 * Business Logic: Season deletion with constraint checking
 */

/**
 * Business Logic: Advanced season operations
 */
// export const closeSeasonRegistration = async (id: number) => {
//   const season = await prisma.season.findUnique({
//     where: { id },
//   });

//   if (!season) {
//     throw new Error(`Season with ID ${id} not found.`);
//   }

//   if (season.status !== 'REGISTRATION_OPEN') {
//     throw new Error('Can only close registration for seasons with open registration.');
//   }

//   return prisma.season.update({
//     where: { id },
//     data: { status: 'REGISTRATION_CLOSED' },
//   });
// };

// export const startSeason = async (id: number) => {
//   const season = await prisma.season.findUnique({
//     where: { id },
//     include: {
//       _count: {
//         select: { registrations: true }
//       }
//     }
//   });

//   if (!season) {
//     throw new Error(`Season with ID ${id} not found.`);
//   }

//   if (season.status !== 'REGISTRATION_CLOSED') {
//     throw new Error('Season must have closed registration before it can start.');
//   }

//   if (season._count.registrations === 0) {
//     throw new Error('Cannot start a season with no registrations.');
//   }

//   const now = new Date();
//   if (now < season.startDate) {
//     throw new Error('Cannot start season before the scheduled start date.');
//   }

//   return prisma.season.update({
//     where: { id },
//     data: { status: 'IN_PROGRESS' },
//   });
// };

// export const completeSeason = async (id: number) => {
//   const season = await prisma.season.findUnique({
//     where: { id },
//   });

//   if (!season) {
//     throw new Error(`Season with ID ${id} not found.`);
//   }

//   if (season.status !== 'IN_PROGRESS') {
//     throw new Error('Can only complete seasons that are in progress.');
//   }

//   return prisma.season.update({
//     where: { id },
//     data: { status: 'COMPLETED' },
//   });
// };

export const getAllSeasonsService = async () => {
  return await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      regiDeadline: true,
      description: true,
      entryFee: true,
      sportType: true,
      seasonType: true,
      isActive: true,
      paymentRequired: true,
      promoCodeSupported: true,
      withdrawalEnabled: true,
      status: true,
      registeredUserCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getSeasonByIdService = async (id: string) => {
  return prisma.season.findUnique({
    where: { id },
    include: {
      divisions: true, 
      promoCodes: true,
      withdrawalRequests: {
        include: {
          processedByAdmin: true, 
        },
      },
      waitlist: {
        include: {
          waitlistedUsers: true, 
        },
      },
      league: true,
      category: true,
    },
  });
};
export const getActiveSeasonService = async () => {
  return await prisma.season.findFirst({
    where: { isActive: true, status: "ACTIVE" },
    include: {
      divisions: { select: { id: true, name: true } },
      league: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
};
