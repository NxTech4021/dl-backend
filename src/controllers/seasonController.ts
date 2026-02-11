import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ApiResponse } from "../utils/ApiResponse";

import {
  getActiveSeasonService,
  getSeasonByIdService,
  getAllSeasonsService,
  createSeasonService,
  updateSeasonStatusService,
  updateSeasonService,
  deleteSeasonService,
  registerMembershipService,
  assignDivisionService,
  updatePaymentStatusService,
} from "../services/seasonService";

import {
  validateUpdateSeasonData,
  validateStatusUpdate,
  validateWithdrawalRequest,
  handlePrismaError,
  handleWithdrawalError
} from "../validators/season";

// Withdrawal Operations
import {
  submitWithdrawalRequest as submitWithdrawalRequestService,
  processWithdrawalRequest as processWithdrawalRequestService
} from "../services/season/seasonWithdrawalService";

// Formatters
import { 
  formatSeasonWithRelations,
  formatMembershipResponse 
} from "../services/season/utils/formatters";

import { notificationService } from '../services/notificationService';

import { leagueLifecycleNotifications } from '../helpers/notifications';
import { NOTIFICATION_TYPES } from '../types/notificationTypes';
import { notifyAdminsWithdrawalRequest } from '../services/notification/adminNotificationService';



interface CreateSeasonBody {
  name?: string;
  startDate?: string;
  endDate?: string;
  regiDeadline?: string;
  description?: string;
  entryFee?: number;
  leagueIds?: string[];
  categoryId?: string;
  isActive?: boolean;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

interface UpdateSeasonBody {
  name?: string;
  startDate?: string;
  endDate?: string;
  regiDeadline?: string;
  description?: string;
  entryFee?: number;
  leagueIds?: string[];
  categoryId?: string;
  isActive?: boolean;
  status?: string;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

interface UpdateSeasonStatusBody {
  status?: string;
  isActive?: boolean;
}

interface RegisterPlayerToSeasonBody {
  userId?: string;
  seasonId?: string;
  payLater?: boolean;
}

interface AssignPlayerToDivisionBody {
  membershipId?: string;
  divisionId?: string;
}

interface UpdatePaymentStatusBody {
  membershipId?: string;
  paymentStatus?: string;
}

interface SubmitWithdrawalRequestBody {
  seasonId?: string;
  reason?: string;
  partnershipId?: string;
}

interface ProcessWithdrawalRequestBody {
  status?: string;
}

export const createSeason = async (req: Request, res: Response) => {
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
  } = req.body as CreateSeasonBody;

  // Validate required fields
  // Note: entryFee can be 0 (free seasons), so check for undefined/null instead of falsy
  if (!name || !startDate || !endDate || entryFee === undefined || entryFee === null || !leagueIds || !categoryId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: name, startDate, endDate, entryFee, leagueIds, and categoryId are required"
    });
  }

  if (!Array.isArray(leagueIds) || leagueIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: "At least one league ID is required"
    });
  }

  try {
    const seasonData: Parameters<typeof createSeasonService>[0] = {
      name,
      startDate,
      endDate,
      entryFee,
      leagueIds,
      categoryId,
    };
    
    if (regiDeadline !== undefined) seasonData.regiDeadline = regiDeadline;
    if (description !== undefined) seasonData.description = description;
    if (isActive !== undefined) seasonData.isActive = isActive;
    if (paymentRequired !== undefined) seasonData.paymentRequired = paymentRequired;
    if (promoCodeSupported !== undefined) seasonData.promoCodeSupported = promoCodeSupported;
    if (withdrawalEnabled !== undefined) seasonData.withdrawalEnabled = withdrawalEnabled;

    // Auto-disable payment for free seasons
    if (Number(entryFee) === 0) {
      seasonData.paymentRequired = false;
    }

    const season = await createSeasonService(seasonData);

    // 🆕 Send new season announcement to ALL users if season is active
    if (isActive) {
      try {
        // Get season with leagues to extract location and sport information
        const seasonWithLeagues = await prisma.season.findUnique({
          where: { id: season.id },
          include: {
            leagues: {
              select: {
                name: true,
                location: true,
                sportType: true
              }
            }
          }
        });

        if (seasonWithLeagues && seasonWithLeagues.leagues.length > 0) {
          const league = seasonWithLeagues.leagues[0]; // needs to be updated 
          
          // Only proceed if we have valid league data
          if (league && league.location && league.sportType) {
            const notificationData = leagueLifecycleNotifications.newSeasonAnnouncement(
              season.name,
              league.location,
              league.sportType
            );

            // Get all users to broadcast to everyone
            const allUsers = await prisma.user.findMany({ select: { id: true } });
            const userIds = allUsers.map(u => u.id);

            // Send to all users
            await notificationService.createNotification({
              ...notificationData,
              seasonId: season.id,
              userIds
            });
          }
        }
      } catch (notificationError) {
        console.error("Error sending new season announcement:", notificationError);
        // Don't fail season creation if notification fails
      }
    }

    // 🆕 Send notification if season is starting soon
    if (isActive && startDate) {
      const startDateObj = new Date(startDate);
      const now = new Date();
      const daysDifference = Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 3600 * 24));
      
      if (daysDifference <= 7 && daysDifference > 0) {
        // Get all registered users for this season
        const registeredUsers = await prisma.seasonMembership.findMany({
          where: { seasonId: season.id },
          select: { userId: true }
        });

        if (registeredUsers.length > 0) {
          const notificationData = leagueLifecycleNotifications.seasonStarting3Days(
            season.name
          );

          await notificationService.createNotification({
            userIds: registeredUsers.map(u => u.userId),
            ...notificationData,
            seasonId: season.id
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "Season created successfully",
      data: season,
    });
  } catch (error: unknown) {
    console.error("Error creating season:", error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle validation errors
    if (errorMessage.includes("Missing required fields") ||
        errorMessage.includes("At least one league")) {
      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }

    // Handle duplicate season name
    if (errorMessage.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: errorMessage,
      });
    }

    return handlePrismaError(error, res, "Failed to create season. Please try again later.");
  }
};

export const getSeasons = async (req: Request, res: Response) => {
  const { active, id, page, limit } = req.query;

  try {
    if (id) {
      const season = await getSeasonByIdService(id as string);
      if (!season) {
        return res.status(404).json({ error: "Season not found." });
      }

      const result = formatSeasonWithRelations(season);
      return res.status(200).json(result);
    }

    // Get active season
    if (active === "true") {
      const activeSeason = await getActiveSeasonService();
      if (!activeSeason) {
        return res.status(404).json({ error: "No active season found." });
      }
      return res.status(200).json(activeSeason);
    }

    // Get all seasons with pagination
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    const result = await getAllSeasonsService(pageNum, limitNum);
    return res.status(200).json(
      new ApiResponse(true, 200, result, `Found ${result.pagination.total} season(s)`)
    );
  } catch (error: unknown) {
    console.error("Error fetching seasons:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        error: "Invalid query parameters or field selection."
      });
    }

    return res.status(500).json({
      error: "Failed to fetch seasons. Try again later."
    });
  }
};

export const getSeasonById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  try {
    const season = await getSeasonByIdService(id);
    if (!season) {
      return res.status(404).json({ error: "Season not found." });
    }

    const result = formatSeasonWithRelations(season);
    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error(`Error fetching season ${id}:`, error);
    return res.status(500).json({ error: "Failed to retrieve season details." });
  }
};

export const updateSeason = async (req: Request, res: Response) => {
  const { id } = req.params;
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
    status,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = req.body as UpdateSeasonBody;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  try {
    const currentSeason = await prisma.season.findUnique({
      where: { id },
      select: { status: true, name: true }
    });

    const seasonData: Parameters<typeof updateSeasonService>[1] = {};
    
    if (name !== undefined) seasonData.name = name;
    if (startDate !== undefined) seasonData.startDate = startDate;
    if (endDate !== undefined) seasonData.endDate = endDate;
    if (regiDeadline !== undefined) seasonData.regiDeadline = regiDeadline;
    if (description !== undefined) seasonData.description = description;
    if (entryFee !== undefined) seasonData.entryFee = entryFee;
    if (leagueIds !== undefined) seasonData.leagueIds = leagueIds;
    if (categoryId !== undefined) seasonData.categoryId = categoryId;
    if (isActive !== undefined) seasonData.isActive = isActive;
    if (status !== undefined) {
      if (status && ["UPCOMING", "ACTIVE", "FINISHED", "CANCELLED"].includes(status)) {
        seasonData.status = status as "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
      }
    }
    if (paymentRequired !== undefined) seasonData.paymentRequired = paymentRequired;
    if (promoCodeSupported !== undefined) seasonData.promoCodeSupported = promoCodeSupported;
    if (withdrawalEnabled !== undefined) seasonData.withdrawalEnabled = withdrawalEnabled;

    // Auto-disable payment for free seasons
    if (entryFee !== undefined && Number(entryFee) === 0) {
      seasonData.paymentRequired = false;
    }

    const season = await updateSeasonService(id, seasonData);

    // 🆕 Send notifications for status changes
    if (status && currentSeason && status !== currentSeason.status) {
      const registeredUsers = await prisma.seasonMembership.findMany({
        where: { seasonId: id },
        select: { userId: true }
      });

      if (registeredUsers.length > 0) {
        let notificationData;

        if (status === 'FINISHED') {
          notificationData = leagueLifecycleNotifications.leagueEndedFinalResults(
            season.name
          );
        } else if (status === 'CANCELLED') {
          notificationData = leagueLifecycleNotifications.leagueCancelled(
            season.name
          );
        }

        if (notificationData) {
          await notificationService.createNotification({
            userIds: registeredUsers.map(u => u.userId),
            ...notificationData,
            seasonId: id
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Season updated successfully",
      data: season
    });
  } catch (error: unknown) {
    console.error("Error updating season:", error);
    return handlePrismaError(error, res, "Failed to update season");
  }
};

export const updateSeasonStatus = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  try {
    const { status, isActive } = req.body as UpdateSeasonStatusBody;
    
    const statusUpdate: Parameters<typeof updateSeasonStatusService>[1] = {};
    if (status !== undefined) {
      if (status && ["UPCOMING", "ACTIVE", "FINISHED", "CANCELLED"].includes(status)) {
        statusUpdate.status = status as "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
      }
    }
    if (isActive !== undefined) statusUpdate.isActive = isActive;
    
    const season = await updateSeasonStatusService(id, statusUpdate);
    return res.status(200).json({
      success: true,
      message: "Season status updated successfully",
      data: season
    });
  } catch (error: unknown) {
    console.error("Error updating season status:", error);
    return handlePrismaError(error, res, "Failed to update season status");
  }
};

export const deleteSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ 
      error: "Season ID is required for deletion." 
    });
  }

  try {
    const deletedSeason = await deleteSeasonService(id);
    return res.status(200).json({
      success: true,
      message: `Season "${deletedSeason.name}" deleted successfully.`,
      data: deletedSeason,
    });
  } catch (error: unknown) {
    console.error("Error deleting season:", error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("Cannot delete season")) {
      return res.status(400).json({ error: errorMessage });
    }

    if (errorMessage.includes("not found")) {
      return res.status(404).json({ error: errorMessage });
    }

    return res.status(500).json({ error: "Failed to delete season." });
  }
};

export const submitWithdrawalRequest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validation = validateWithdrawalRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  const { seasonId, reason, partnershipId } = req.body as SubmitWithdrawalRequestBody;

  if (!seasonId || !reason) {
    return res.status(400).json({ error: "seasonId and reason are required" });
  }

  try {
    const withdrawalData: Parameters<typeof submitWithdrawalRequestService>[0] = {
      userId,
      seasonId,
      reason,
    };
    
    if (partnershipId !== undefined) {
      withdrawalData.partnershipId = partnershipId;
    }

    const withdrawalRequest = await submitWithdrawalRequestService(withdrawalData);

    // 🆕 Send notification to user confirming withdrawal request
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { name: true }
    });

    if (season) {
      // Notify user
      await notificationService.createNotification({
        userIds: userId,
        type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED,
        category: 'GENERAL',
        title: 'Withdrawal Request Received',
        message: `Your withdrawal request for ${season.name} has been received and is being processed.`,
        seasonId: seasonId,
        withdrawalRequestId: withdrawalRequest.id
      });

      // Get user name for admin notification
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      // Notify admins
      await notifyAdminsWithdrawalRequest(notificationService, {
        playerName: user?.name || 'Unknown Player',
        seasonName: season.name,
        reason: reason,
        seasonId: seasonId,
        withdrawalRequestId: withdrawalRequest.id
      });
    }

    return res.status(201).json(withdrawalRequest);
  } catch (error: unknown) {
    console.error("Error submitting withdrawal request:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("not found") ||
        errorMessage.includes("not part of this partnership") ||
        errorMessage.includes("not active")) {
      return res.status(400).json({ error: errorMessage });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({ error: "Invalid data format or type for withdrawal request." });
    }

    return res.status(500).json({ error: "Failed to submit withdrawal request." });
  }
};

export const processWithdrawalRequest = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const processedByAdminId = req.user?.id;
  const { status } = req.body as ProcessWithdrawalRequestBody;

  if (!processedByAdminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!id) {
    return res.status(400).json({ error: "Withdrawal request ID is required." });
  }

  if (!status || !["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be 'APPROVED' or 'REJECTED'." });
  }

  try {
    const result = await processWithdrawalRequestService(
      id,
      status as "APPROVED" | "REJECTED",
      processedByAdminId
    );

    // 🆕 Send notification to user about withdrawal decision
    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        season: { select: { name: true } }
      }
    });

    if (withdrawalRequest) {
      let notificationData;

      if (status === 'APPROVED') {
        notificationData = {
          type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
          category: 'GENERAL' as const,
          title: 'Withdrawal Request Approved',
          message: `Your withdrawal request for ${withdrawalRequest.season.name} has been approved. Your refund will be processed within 5-7 business days.`
        };
      } else {
        notificationData = {
          type: NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_REJECTED,
          category: 'GENERAL' as const,
          title: 'Withdrawal Request Rejected',
          message: `Your withdrawal request for ${withdrawalRequest.season.name} has been rejected. Please contact support for more information.`
        };
      }

      await notificationService.createNotification({
        userIds: withdrawalRequest.userId,
        ...notificationData,
        seasonId: withdrawalRequest.seasonId,
        withdrawalRequestId: id
      });
    }

    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error(`Error processing withdrawal request ${id}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("not found") ||
        errorMessage.includes("already processed")) {
      return res.status(400).json({ error: errorMessage });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Withdrawal request not found." });
      }
    }

    return res.status(500).json({ error: "Failed to process withdrawal request." });
  }
};

export const registerPlayerToSeason = async (req: Request, res: Response) => {
  const { userId, seasonId, payLater } = req.body as RegisterPlayerToSeasonBody;

  if (!userId || !seasonId) {
    return res.status(400).json({ error: "userId and seasonId are required." });
  }

  try {
    // ✅ Check if user has an active partnership for this season FIRST
    const partnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        OR: [
          { captainId: userId },
          { partnerId: userId }
        ],
        status: 'ACTIVE'
      },
      include: {
        captain: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } }
      }
    });

    if (partnership) {
      // ✅ DOUBLES REGISTRATION: Create or update memberships for both players
      console.log(`🎾 Doubles registration detected for partnership ${partnership.id}`);
      const captainId = partnership.captainId;
      const partnerId = partnership.partnerId;

      if (!partnerId) {
        return res.status(400).json(
          new ApiResponse(false, 400, null, 'Partnership has no partner assigned')
        );
      }

      // If payLater is true (development only), set payment status to COMPLETED
      const paymentStatus = payLater === true ? PaymentStatus.COMPLETED : undefined;

      const result = await prisma.$transaction(async (tx) => {
        // Check if memberships exist for both captain and partner
        const existingMemberships = await tx.seasonMembership.findMany({
          where: {
            seasonId,
            userId: { in: [captainId, partnerId] }
          }
        });

        const existingCaptainMembership = existingMemberships.find(m => m.userId === captainId);
        const existingPartnerMembership = existingMemberships.find(m => m.userId === partnerId);

        let newMembershipCount = 0;

        // Create or update captain membership
        if (!existingCaptainMembership) {
          await tx.seasonMembership.create({
            data: {
              userId: captainId,
              seasonId,
              status: 'ACTIVE',
              paymentStatus: paymentStatus || PaymentStatus.PENDING,
            }
          });
          newMembershipCount++;
        } else {
          const updateData: any = {
            status: 'ACTIVE',
          };
          if (paymentStatus) {
            updateData.paymentStatus = paymentStatus;
          }
          await tx.seasonMembership.update({
            where: { id: existingCaptainMembership.id },
            data: updateData,
          });
        }

        // Create or update partner membership
        if (!existingPartnerMembership) {
          await tx.seasonMembership.create({
            data: {
              userId: partnerId,
              seasonId,
              status: 'ACTIVE',
              paymentStatus: paymentStatus || PaymentStatus.PENDING,
            }
          });
          newMembershipCount++;
        } else {
          const updateData: any = {
            status: 'ACTIVE',
          };
          if (paymentStatus) {
            updateData.paymentStatus = paymentStatus;
          }
          await tx.seasonMembership.update({
            where: { id: existingPartnerMembership.id },
            data: updateData,
          });
        }

        // Increment season registeredUserCount if new memberships were created
        if (newMembershipCount > 0) {
          await tx.season.update({
            where: { id: seasonId },
            data: { registeredUserCount: { increment: newMembershipCount } },
          });
        }

        console.log(`✅ Created/updated memberships for partnership`);

        // Fetch the updated memberships
        const memberships = await tx.seasonMembership.findMany({
          where: {
            seasonId,
            userId: { in: [captainId, partnerId] }
          },
          include: {
            user: { select: { id: true, name: true } },
            season: { select: { id: true, name: true, entryFee: true } }
          }
        });

        return { partnership, memberships };
      });

      // 🆕 Send registration confirmation notifications for both players
      const seasonData = (result.memberships[0] as any)?.season;
      if (seasonData) {
        try {
          const notificationData = leagueLifecycleNotifications.registrationConfirmed(
            seasonData.name,
            `$${seasonData.entryFee}`
          );

          await notificationService.createNotification({
            userIds: [captainId, partnerId],
            ...notificationData,
            seasonId: seasonId
          });
        } catch (notificationError) {
          console.error('Error sending registration notification for doubles:', notificationError);
          // Don't fail the registration if notification fails
        }
      }

      // ✅ Emit Socket.IO events to notify both captain and partner about team registration completion
      if (req.io && seasonData) {
        try {
          // Notify both captain and partner about successful team registration
          const registrationData = {
            partnership: {
              id: result.partnership.id,
              captainId: captainId,
              partnerId: partnerId,
              season: {
                id: seasonId,
                name: seasonData.name
              }
            },
            memberships: result.memberships,
            message: "Team registration completed successfully"
          };

          req.io.to(captainId).emit('team_registration_completed', registrationData);
          req.io.to(partnerId).emit('team_registration_completed', registrationData);
          console.log(`📨 Socket.IO: Notified captain ${captainId} and partner ${partnerId} of team registration completion`);
        } catch (socketError) {
          console.error('Error emitting team registration socket event:', socketError);
          // Don't fail the whole operation if socket fails
        }
      }

      return res.status(201).json({
        message: "Team registered successfully",
        partnership: result.partnership,
        memberships: result.memberships
      });

    } else {
      // ✅ SINGLES REGISTRATION: Create new membership
      console.log(`🎾 Singles registration for user ${userId}`);
      
      const membership = await registerMembershipService({ userId, seasonId, payLater: payLater === true });
      
      // 🆕 Send registration confirmation notification
      const season = await prisma.season.findUnique({
        where: { id: seasonId },
        select: { name: true, entryFee: true }
      });

      if (season) {
        try {
          const notificationData = leagueLifecycleNotifications.registrationConfirmed(
            season.name,
            `$${season.entryFee}`
          );

          await notificationService.createNotification({
            userIds: userId,
            ...notificationData,
            seasonId: seasonId
          });
        } catch (notificationError) {
          console.error('Error sending registration notification for singles:', notificationError);
          // Don't fail the registration if notification fails
        }
      }

      const result = {
        ...membership,
        user: { id: membership.user.id, name: membership.user.name },
        season: { id: membership.season.id, name: membership.season.name },
        division: null,
      };

      return res.status(201).json({
        message: "User registered successfully",
        membership: result
      });
    }
  } catch (error: unknown) {
    console.error("Error registering to season:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: errorMessage });
  }
};

export const assignPlayerToDivision = async (req: Request, res: Response) => {
  const { membershipId, divisionId } = req.body as AssignPlayerToDivisionBody;

  if (!membershipId || !divisionId) {
    return res.status(400).json({ 
      error: "membershipId and divisionId are required." 
    });
  }

  try {
    const membership = await assignDivisionService({ membershipId, divisionId });

    const result = {
      ...membership,
      user: {
        id: membership.user.id,
        name: membership.user.name
      },
      season: {
        id: membership.season.id,
        name: membership.season.name
      },
      division: membership.division
        ? {
            id: membership.division.id,
            name: membership.division.name
          }
        : null
    };

    return res.status(200).json({ 
      message: "Player assigned to division successfully", 
      membership: result 
    });
  } catch (error: unknown) {
    console.error("Error assigning player to division:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: errorMessage });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  const { membershipId, paymentStatus } = req.body as UpdatePaymentStatusBody;

  if (!membershipId || !paymentStatus) {
    return res.status(400).json({ 
      error: "membershipId and paymentStatus are required." 
    });
  }

  if (!Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
    return res.status(400).json({ error: "Invalid paymentStatus value." });
  }

  try {
    const membership = await updatePaymentStatusService({ membershipId, paymentStatus: paymentStatus as PaymentStatus });

    // 🆕 Send payment status notification
    const membershipWithSeason = await prisma.seasonMembership.findUnique({
      where: { id: membershipId },
      include: {
        season: { select: { name: true, entryFee: true } }
      }
    });

    if (membershipWithSeason) {
      let notificationData;

      if (paymentStatus === 'COMPLETED') {
        notificationData = leagueLifecycleNotifications.paymentConfirmed(
          membershipWithSeason.season.name,
          `$${membershipWithSeason.season.entryFee}`
        );
      } else if (paymentStatus === 'FAILED') {
        notificationData = leagueLifecycleNotifications.paymentFailed(
          membershipWithSeason.season.name,
          `$${membershipWithSeason.season.entryFee}`
        );
      } else if (paymentStatus === 'PENDING') {
        // Use payment confirmed notification for pending status
        notificationData = leagueLifecycleNotifications.paymentConfirmed(
          membershipWithSeason.season.name,
          `$${membershipWithSeason.season.entryFee}`
        );
      }

      if (notificationData) {
        await notificationService.createNotification({
          userIds: membership.userId,
          ...notificationData,
          seasonId: membershipWithSeason.seasonId
        });
      }
    }

    const result = formatMembershipResponse(membership);
    return res.status(200).json({ 
      message: "Payment status updated", 
      membership: result 
    });
  } catch (error: unknown) {
    console.error("Error updating payment status:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ error: errorMessage });
  }
};


// Helper Functions
const validatePartnership = async (partnershipId: string, userId: string) => {
  const partnership = await prisma.partnership.findUnique({
    where: { id: partnershipId },
  });

  if (!partnership) {
    return { isValid: false, statusCode: 404, error: "Partnership not found." };
  }

  if (partnership.captainId !== userId && partnership.partnerId !== userId) {
    return { isValid: false, statusCode: 403, error: "You are not part of this partnership." };
  }

  if (partnership.status !== "ACTIVE") {
    return { isValid: false, statusCode: 400, error: "Partnership is not active." };
  }

  return { isValid: true };
};

const createWithdrawalRequest = async (seasonId: string, userId: string, reason: string, partnershipId?: string) => {
  const data: Prisma.WithdrawalRequestUncheckedCreateInput = {
    seasonId,
    userId,
    reason,
    partnershipId: partnershipId || null,
    status: "PENDING",
  };

  return await prisma.withdrawalRequest.create({
    data,
    include: {
      season: { select: { id: true, name: true } },
      partnership: {
        include: {
          captain: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
      },
    },
  });
};

const processWithdrawal = async (id: string, processedByAdminId: string, status: string) => {
  const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
    where: { id },
    include: {
      partnership: true,
      season: { select: { id: true, name: true } },
    },
  });

  if (!withdrawalRequest) {
    return { success: false, statusCode: 404, error: "Withdrawal request not found." };
  }

  if (withdrawalRequest.status !== "PENDING") {
    return { success: false, statusCode: 400, error: "This request has already been processed." };
  }

};