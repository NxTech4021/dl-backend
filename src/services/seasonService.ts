import { prisma } from "../lib/prisma";
import { PrismaClient, Prisma, PaymentStatus } from '@prisma/client';



interface CreateSeasonData {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  regiDeadline?: string | Date;
  description?: string;
  entryFee: string | number;
  leagueIds: string[];
  categoryIds: string[];
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
  leagueIds?: string[];
  categoryIds?: string[];
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

interface RegisterSeasonMembershipData {
  userId: string;
  seasonId: string;
  divisionId?: string;
}

interface UpdatePaymentStatusData {
  membershipId: string;
  paymentStatus: PaymentStatus;
}

interface AssignDivisionData {
  membershipId: string;
  divisionId: string;
}

export const createSeasonService = async (data: CreateSeasonData) => {
  const {
    name,
    startDate,
    endDate,
    regiDeadline,
    description,
    entryFee,
    leagueIds,
    categoryIds,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = data;

  const existingSeason = await prisma.season.findFirst({
    where: { name },
  });
  if (existingSeason) {
    throw new Error("A season with this name already exists.");
  }

  return prisma.season.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      regiDeadline: regiDeadline ? new Date(regiDeadline) : new Date(endDate),
      entryFee: new Prisma.Decimal(entryFee),
      description: description ?? null,
      isActive: isActive ?? false,
      paymentRequired: paymentRequired ?? false,
      promoCodeSupported: promoCodeSupported ?? false,
      withdrawalEnabled: withdrawalEnabled ?? false,
      status: isActive ? "ACTIVE" : "UPCOMING",
      leagues: {
        connect: leagueIds.map(id => ({ id }))
      },
      categories: {
        connect: categoryIds.map(id => ({ id }))
      }
    },
    include: {
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      categories: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          matchFormat: true
        }
      }
    }
  });
};

export const getAllSeasonsService = async () => {
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
      categories: {
        select: { id: true, name: true }
      },
      leagues: { 
        select: { id: true, name: true, sportType: true, gameType: true } 
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
        select: { memberships: true }
      },
      divisions: {
        select: { id: true, name: true }
      },
    },
  });

  return seasons.map(season => ({
    ...season,
    registeredUserCount: season.memberships.length,
  }));
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
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      categories: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          matchFormat: true
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
          division: true
        },
      },
    },
  });
};

export const getActiveSeasonService = async () => {
  return await prisma.season.findFirst({
    where: { isActive: true, status: "ACTIVE" },
    include: {
      divisions: { select: { id: true, name: true } },
      leagues: { select: { id: true, name: true } },
      categories: { select: { id: true, name: true } },
    },
  });
};

export const updateSeasonStatusService = async (id: string, data: StatusUpdate) => {
  const { status, isActive } = data;

  const finalStatus = status ?? (isActive ? "ACTIVE" : undefined);

  const updateData: any = {};
  if (typeof isActive !== "undefined") {
    updateData.isActive = isActive;
  }
  if (finalStatus) {
    updateData.status = finalStatus;
  }

  const updatedSeason = await prisma.season.update({
    where: { id },
    data: updateData,
  });

  return updatedSeason;
};

export const updateSeasonService = async (id: string, data: SeasonUpdateData) => {
  const updateData: any = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.regiDeadline !== undefined) updateData.regiDeadline = new Date(data.regiDeadline);
  if (data.entryFee !== undefined) updateData.entryFee = new Prisma.Decimal(data.entryFee);
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.leagueIds !== undefined) updateData.leagues = { set: data.leagueIds.map(id => ({ id })) };
  if (data.categoryIds !== undefined) updateData.categories = { set: data.categoryIds.map(id => ({ id })) };
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.paymentRequired !== undefined) updateData.paymentRequired = data.paymentRequired;
  if (data.promoCodeSupported !== undefined) updateData.promoCodeSupported = data.promoCodeSupported;
  if (data.withdrawalEnabled !== undefined) updateData.withdrawalEnabled = data.withdrawalEnabled;

  const updatedSeason = await prisma.season.update({
    where: { id },
    data: updateData,
    include: {
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      categories: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          matchFormat: true
        }
      }
    }
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

export const registerMembershipService = async (data: RegisterSeasonMembershipData) => {
  const { userId, seasonId, divisionId } = data;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
 
  if (!season) throw new Error("Season not found");
 
  if (!season.isActive) throw new Error("Season is not active for registration");
 
  if (season.regiDeadline && (new Date() > season.regiDeadline || (season.startDate && new Date() > season.startDate)))
    throw new Error("Season registration is not currently open");

  const existingMembership = await prisma.seasonMembership.findFirst({
    where: { userId, seasonId },
  });
  if (existingMembership) throw new Error("User already registered for this season");

   const membershipData: any = { 
    status: "PENDING",
    paymentStatus: season.paymentRequired ? PaymentStatus.PENDING : PaymentStatus.COMPLETED,
    
    user: {
      connect: { id: userId }, 
    },
    season: {
      connect: { id: seasonId },
    },
  };

  const membership = await prisma.seasonMembership.create({
    data: membershipData as Prisma.SeasonMembershipCreateInput,
    include: {
      user: true,
      season: true,
      // division: true,
    },
  });

  // Increment registeredUserCount
  await prisma.season.update({
    where: { id: seasonId },
    data: { registeredUserCount: { increment: 1 } },
  });

  return membership;
};

export const updatePaymentStatusService = async (data: UpdatePaymentStatusData) => {
  const { membershipId, paymentStatus } = data;

  const membership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: { paymentStatus },
    include: {
      user: true,
      season: true,
      division: true,
    },
  });

  return membership;
};

export const assignDivisionService = async (data: AssignDivisionData) => {
  const { membershipId, divisionId } = data;

  const membership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: { divisionId },
    include: { user: true, season: true, division: true },
  });

  return membership;
};