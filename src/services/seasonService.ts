import { prisma, PrismaClient } from "../lib/prisma";
import { Prisma, PaymentStatus } from '@prisma/client';
import { CreateSeasonData, UpdateSeasonData } from "../types/seasonTypes";
import { getEndOfDayMalaysia } from "../utils/timezone";
import { waitlistService } from "./waitlistService";

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

/**
 * SeasonService class with dependency injection support
 * Allows injecting a custom Prisma client for testing
 */
export class SeasonService {
  private prisma: PrismaClient;

  /**
   * Create a new SeasonService instance
   * @param prismaClient - Optional Prisma client for dependency injection (useful for testing)
   */
  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  async createSeason(data: CreateSeasonData) {
    const {
      name,
      startDate,
      endDate,
      regiDeadline,
      description,
      entryFee,
      leagueIds,
      categoryId,
      status,
      isActive,
      paymentRequired,
      promoCodeSupported,
      withdrawalEnabled,
    } = data;

    // Derive the canonical status to store in DB
    const effectiveStatus = status ?? (isActive ? "ACTIVE" : "UPCOMING");
    const effectiveIsActive = effectiveStatus === "ACTIVE";

    // Categories can be reused across multiple seasons (one-to-many relationship)
    // No validation check needed - a category can be linked to multiple seasons

    return this.prisma.season.create({
      data: {
        name,
        ...(startDate ? { startDate: new Date(startDate as string | Date) } : {}),
        ...(endDate ? { endDate: new Date(endDate as string | Date) } : {}),
        ...(regiDeadline
          ? { regiDeadline: getEndOfDayMalaysia(regiDeadline) }
          : endDate
          ? { regiDeadline: getEndOfDayMalaysia(endDate) }
          : {}),
        entryFee: new Prisma.Decimal(entryFee),
        description: description ?? null,
        isActive: effectiveIsActive,
        paymentRequired: paymentRequired ?? false,
        promoCodeSupported: promoCodeSupported ?? false,
        withdrawalEnabled: withdrawalEnabled ?? false,
        status: effectiveStatus as any,
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
  }

  async getAllSeasons(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100); // Max 100 items

    const [seasons, total] = await Promise.all([
      this.prisma.season.findMany({
        skip,
        take,
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
            // Removed take: 6 - frontend needs all memberships to check if current user is registered
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
      }),
      this.prisma.season.count(),
    ]);

    const data = seasons.map((season: any) => ({
      ...season,
      // registeredUserCount: season.memberships.length, // Commented out: memberships not included
      registeredUserCount: season._count?.memberships || 0,
    }));

    return {
      data,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getSeasonById(id: string) {
    return this.prisma.season.findUnique({
      where: { id },
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
        divisions: {
          select: {
            id: true,
            name: true,
            level: true,
            maxSinglesPlayers: true,
            maxDoublesTeams: true,
            isActiveDivision: true,
          }
        },
        promoCodes: {
          select: {
            id: true,
            code: true,
            discountValue: true,
            isPercentage: true,
            isActive: true,
            expiresAt: true,
          }
        },
        withdrawalRequests: {
          select: {
            id: true,
            status: true,
            reason: true,
            requestDate: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            processedByAdmin: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        waitlist: {
          select: {
            id: true,
            maxParticipants: true,
            enabled: true,
            waitlistedUsers: {
              select: {
                id: true,
                userId: true,
                waitlistDate: true,
              }
            },
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
        // Memberships preview - lightweight query without expensive questionnaireResponses
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
                // questionnaireResponses removed - too expensive for preview, fetch separately when needed
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
          // Removed take: 6 limit - frontend needs ALL memberships to check if current user is registered
          orderBy: {
            joinedAt: 'asc'
          }
        },
        partnerships: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            status: true,
            createdAt: true,
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
  }

  async getActiveSeason() {
    return await this.prisma.season.findFirst({
      where: { isActive: true, status: "ACTIVE" },
      include: {
        divisions: { select: { id: true, name: true } },
        leagues: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  async updateSeasonStatus(id: string, data: StatusUpdate) {
    const { status, isActive } = data;

    // Get current season to check previous status
    const currentSeason = await this.prisma.season.findUnique({
      where: { id },
      select: { status: true },
    });

    const previousStatus = currentSeason?.status;
    const finalStatus = status ?? (isActive ? "ACTIVE" : undefined);

    const updateData: any = {};
    if (typeof isActive !== "undefined") {
      updateData.isActive = isActive;
    }
    if (finalStatus) {
      updateData.status = finalStatus;
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id },
      data: updateData,
    });

    // Auto-promote waitlisted users when season changes from UPCOMING to ACTIVE
    if (previousStatus === "UPCOMING" && finalStatus === "ACTIVE") {
      try {
        const promotionResult = await waitlistService.promoteAllUsers(id);
        console.log(`Auto-promoted ${promotionResult.promoted} waitlisted users for season ${id}`);
      } catch (error) {
        console.error(`Failed to auto-promote waitlisted users for season ${id}:`, error);
        // Don't throw - promotion failure shouldn't block status update
      }
    }

    return updatedSeason;
  }

  async updateSeason(id: string, data: UpdateSeasonData) {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.regiDeadline !== undefined) updateData.regiDeadline = getEndOfDayMalaysia(data.regiDeadline);
    if (data.entryFee !== undefined) updateData.entryFee = new Prisma.Decimal(data.entryFee);
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.leagueIds !== undefined) updateData.leagues = { set: data.leagueIds.map(id => ({ id })) };
    if (data.categoryId !== undefined) {
      (updateData).categoryId = data.categoryId;
    }
    // BUG 6+8: Sync isActive and status — infer one from the other
    // Matches the inference logic in updateSeasonStatus (line 374)
    const finalStatus = data.status ?? (data.isActive ? "ACTIVE" : undefined);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (finalStatus) {
      updateData.status = finalStatus;
      updateData.isActive = (finalStatus === "ACTIVE");
    }
    if (data.paymentRequired !== undefined) updateData.paymentRequired = data.paymentRequired;
    if (data.promoCodeSupported !== undefined) updateData.promoCodeSupported = data.promoCodeSupported;
    if (data.withdrawalEnabled !== undefined) updateData.withdrawalEnabled = data.withdrawalEnabled;

    const updatedSeason = await this.prisma.season.update({
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
  }

  async deleteSeason(seasonId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, registeredUserCount: true },
    });

    if (!season) {
      throw new Error("Season not found.");
    }

    // Use real membership count — registeredUserCount is denormalized and can drift
    // (multiple code paths create memberships without incrementing the counter)
    const actualMembershipCount = await this.prisma.seasonMembership.count({
      where: {
        seasonId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (actualMembershipCount > 0) {
      throw new Error(
        `Cannot delete season: ${actualMembershipCount} active/pending member(s) exist. Remove or withdraw them first.`
      );
    }

    // Also check for active partnerships (could exist without memberships in edge cases)
    const activePartnershipCount = await this.prisma.partnership.count({
      where: {
        seasonId,
        status: { in: ['ACTIVE', 'INCOMPLETE'] },
      },
    });

    if (activePartnershipCount > 0) {
      throw new Error(
        `Cannot delete season: ${activePartnershipCount} active partnership(s) exist. Dissolve them first.`
      );
    }

    // Also check for non-terminal matches
    const activeMatchCount = await this.prisma.match.count({
      where: {
        division: { seasonId },
        status: { notIn: ['COMPLETED', 'CANCELLED', 'VOID'] },
      },
    });

    if (activeMatchCount > 0) {
      throw new Error(
        `Cannot delete season: ${activeMatchCount} active match(es) exist. Complete, cancel, or void them first.`
      );
    }

    // Safe to delete — Prisma cascades handle remaining relations
    return this.prisma.season.delete({
      where: { id: seasonId },
    });
  }

  async registerMembership(data: RegisterSeasonMembershipData) {
    const { userId, seasonId, divisionId, payLater } = data;

    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });

    if (!season) throw new Error("Season not found");

    if (!season.isActive) throw new Error("Season is not active for registration");

    // Allow registration as long as the registration deadline hasn't passed
    // Players can join even after the season has started, as long as regiDeadline allows it
    if (season.regiDeadline && new Date() > season.regiDeadline)
      throw new Error("Season registration deadline has passed");

    const existingMembership = await this.prisma.seasonMembership.findFirst({
      where: { userId, seasonId },
    });
    if (existingMembership) throw new Error("User already registered for this season");

    // payLater=true: "Register now, pay before deadline" flow — membership immediately ACTIVE.
    // payLater=false: if season requires payment → PENDING until FIUU confirms; if free → COMPLETED.
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

    // Use transaction to ensure atomicity of membership creation and counter increment
    const [membership] = await this.prisma.$transaction([
      this.prisma.seasonMembership.create({
        data: membershipData as Prisma.SeasonMembershipCreateInput,
        include: {
          user: true,
          season: true,
          // division: true,
        },
      }),
      this.prisma.season.update({
        where: { id: seasonId },
        data: { registeredUserCount: { increment: 1 } },
      }),
    ]);

    return membership;
  }

  async updatePaymentStatus(data: UpdatePaymentStatusData) {
    const { membershipId, paymentStatus } = data;

    // Update both payment status and membership status
    // If payment is COMPLETED, membership should be ACTIVE
    const updateData: any = { paymentStatus };
    if (paymentStatus === PaymentStatus.COMPLETED) {
      updateData.status = "ACTIVE";
    }

    const membership = await this.prisma.seasonMembership.update({
      where: { id: membershipId },
      data: updateData,
      include: {
        user: true,
        season: true,
        division: true,
      },
    });

    return membership;
  }

  async assignDivision(data: AssignDivisionData) {
    const { membershipId, divisionId } = data;

    const membership = await this.prisma.seasonMembership.update({
      where: { id: membershipId },
      data: { divisionId },
      include: { user: true, season: true, division: true },
    });

    return membership;
  }
}

// Create a default instance for backward compatibility
const defaultSeasonService = new SeasonService();

// Export functions that delegate to the default instance for backward compatibility
export const createSeasonService = (data: CreateSeasonData) =>
  defaultSeasonService.createSeason(data);

export const getAllSeasonsService = (page?: number, limit?: number) =>
  defaultSeasonService.getAllSeasons(page, limit);

export const getSeasonByIdService = (id: string) =>
  defaultSeasonService.getSeasonById(id);

export const getActiveSeasonService = () =>
  defaultSeasonService.getActiveSeason();

export const updateSeasonStatusService = (id: string, data: StatusUpdate) =>
  defaultSeasonService.updateSeasonStatus(id, data);

export const updateSeasonService = (id: string, data: UpdateSeasonData) =>
  defaultSeasonService.updateSeason(id, data);

export const deleteSeasonService = (seasonId: string) =>
  defaultSeasonService.deleteSeason(seasonId);

export const registerMembershipService = (data: RegisterSeasonMembershipData) =>
  defaultSeasonService.registerMembership(data);

export const updatePaymentStatusService = (data: UpdatePaymentStatusData) =>
  defaultSeasonService.updatePaymentStatus(data);

export const assignDivisionService = (data: AssignDivisionData) =>
  defaultSeasonService.assignDivision(data);
