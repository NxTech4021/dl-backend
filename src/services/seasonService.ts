import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();


interface CreateSeasonData {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  regiDeadline?: string | Date;
  description?: string;
  entryFee: string | number;
  leagueId: string;
  categoryId: string;
  isActive?: boolean;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}


interface SeasonUpdateData {
  name?: string;
  startDate?: string;
  endDate?: string;
  regiDeadline?: string;
  entryFee?: number;
  description?: string;
  leagueId?: string;
  categoryId?: string;
  isActive?: boolean;
  status?: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

interface StatusUpdate {
  status?: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  isActive?: boolean;
}

export const createSeasonService = async (data: CreateSeasonData) => {
  const {
    name,
    startDate,
    endDate,
    regiDeadline,
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
    where: { name},
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
      isActive: true,
      paymentRequired: true,
      promoCodeSupported: true,
      withdrawalEnabled: true,
      status: true,
      registeredUserCount: true,
      createdAt: true,
      updatedAt: true,
      leagueId: true,
      categoryId: true,
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

export const updateSeasonStatusService = async (id: string, data: StatusUpdate) => {
  const { status, isActive } = data;

  // If isActive is true and no explicit status provided, set status = ACTIVE
  const finalStatus = status ?? (isActive ? "ACTIVE" : undefined);

  const updatedSeason = await prisma.season.update({
    where: { id },
    data: {
      isActive: typeof isActive !== "undefined" ? isActive : undefined,
      status: finalStatus,
    },
  });

  return updatedSeason;
};

export const updateSeasonService = async (id: string, data: SeasonUpdateData) => {
  const updatedSeason = await prisma.season.update({
    where: { id },
    data: {
      name: data.name,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      regiDeadline: data.regiDeadline ? new Date(data.regiDeadline) : undefined,
      entryFee: typeof data.entryFee === "number" ? new Prisma.Decimal(data.entryFee) : undefined,
      // sportType: data.sportType,
      // seasonType: data.seasonType,
      description: data.description,
      leagueId: data.leagueId,
      categoryId: data.categoryId,
      isActive: typeof data.isActive !== "undefined" ? data.isActive : undefined,
      status: data.status ?? (data.isActive ? "ACTIVE" : undefined),
      paymentRequired: data.paymentRequired,
      promoCodeSupported: data.promoCodeSupported,
      withdrawalEnabled: data.withdrawalEnabled,
    },
  });

  return updatedSeason;
};


export const deleteSeasonService = async (seasonId: string) => {
  
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, registeredUserCount: true },
  });

  if (!season) {
    throw new Error("Season not found.");
  }

  if (season.registeredUserCount > 0) {
    throw new Error(
      "Cannot delete season: there are registered users."
    );
  }

  // Safe to delete
  return prisma.season.delete({
    where: { id: seasonId },
  });
};
