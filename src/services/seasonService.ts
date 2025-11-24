import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from '@prisma/client';
import { CreateSeasonData, UpdateSeasonData } from "../types/seasonTypes";

interface StatusUpdate {
  status?: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  isActive?: boolean;
}

interface RegisterSeasonMembershipData {
  userId: string;
  seasonId: string;
  divisionId?: string;
  payLater?: boolean;
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
    categoryId,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = data;

  // Categories can be reused across multiple seasons (one-to-many relationship)
  // No validation check needed - a category can be linked to multiple seasons

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
      // category: categoryId ? { // Commented out: TypeScript doesn't recognize category relation
      //   connect: { id: categoryId }
      // } : undefined
      // categoryId: categoryId || undefined // Commented out: TypeScript doesn't recognize categoryId in SeasonCreateInput
      ...(categoryId ? { categoryId } : {}), // Use spread to add categoryId if provided - may need Prisma client regeneration
    } as any, // Type assertion needed because categoryId may not be recognized in SeasonCreateInput
    include: {
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      category: {
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
      } as any,
      _count: {
        select: { memberships: true }
      },
      divisions: {
        select: { id: true, name: true }
      },
    } as any,
  });

  return seasons.map((season: any) => ({
    ...season,
    // registeredUserCount: season.memberships.length, // Commented out: memberships not included
    registeredUserCount: season._count?.memberships || 0,
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
        select: {
          id: true,
          userId: true,
          seasonId: true,
          divisionId: true,
          status: true,
          paymentStatus: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              displayUsername: true,
              image: true,
              gender: true,
              area: true,
              questionnaireResponses: {
                select: {
                  id: true,
                  sport: true,
                  completedAt: true,
                  result: {
                    select: {
                      id: true,
                      singles: true,
                      doubles: true,
                      rd: true,
                      confidence: true,
                      source: true
                    }
                  }
                },
                where: {
                  completedAt: { not: null }
                },
                orderBy: {
                  completedAt: 'desc'
                }
                // Removed take: 1 to get all questionnaire responses so frontend can filter by sport type
              }
            }
          },
          division: {
            select: {
              id: true,
              name: true,
              level: true,
            }
          }
        },
        take: 6,
        orderBy: {
          joinedAt: 'asc'
        }
      },
      partnerships: {
        where: { status: 'ACTIVE' },
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              displayUsername: true,
              image: true
            }
          },
          partner: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              displayUsername: true,
              image: true
            }
          }
        }
      },
    } as any, 
  });
};

export const getActiveSeasonService = async () => {
  return await prisma.season.findFirst({
    where: { isActive: true, status: "ACTIVE" },
    include: {
      divisions: { select: { id: true, name: true } },
      leagues: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
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

export const updateSeasonService = async (id: string, data: UpdateSeasonData) => {
  const updateData: any = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.regiDeadline !== undefined) updateData.regiDeadline = new Date(data.regiDeadline);
  if (data.entryFee !== undefined) updateData.entryFee = new Prisma.Decimal(data.entryFee);
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.leagueIds !== undefined) updateData.leagues = { set: data.leagueIds.map(id => ({ id })) };
  if (data.categoryId !== undefined) {
    (updateData).categoryId = data.categoryId;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
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
      category: {
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
  const { userId, seasonId, divisionId, payLater } = data;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
 
  if (!season) throw new Error("Season not found");
 
  if (!season.isActive) throw new Error("Season is not active for registration");
 
  if (season.regiDeadline && (new Date() > season.regiDeadline || (season.startDate && new Date() > season.startDate)))
    throw new Error("Season registration is not currently open");

  const existingMembership = await prisma.seasonMembership.findFirst({
    where: { userId, seasonId },
  });
  if (existingMembership) throw new Error("User already registered for this season");

  // If payLater is true (development only), set payment status to COMPLETED
  // Otherwise, use the season's paymentRequired flag
  const paymentStatus = payLater 
    ? PaymentStatus.COMPLETED 
    : (season.paymentRequired ? PaymentStatus.PENDING : PaymentStatus.COMPLETED);

  // If payment is completed, membership should be ACTIVE; otherwise PENDING
  const membershipStatus = paymentStatus === PaymentStatus.COMPLETED ? "ACTIVE" : "PENDING";

   const membershipData: any = { 
    status: membershipStatus,
    paymentStatus,
    
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

  // Update both payment status and membership status
  // If payment is COMPLETED, membership should be ACTIVE
  const updateData: any = { paymentStatus };
  if (paymentStatus === PaymentStatus.COMPLETED) {
    updateData.status = "ACTIVE";
  }

  const membership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: updateData,
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