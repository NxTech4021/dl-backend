import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";

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

import { getMembershipsByUserId } from "../services/season/seasonMembershipService";

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
import { waitlistService } from '../services/waitlistService';

import { leagueLifecycleNotifications, notificationTemplates } from '../helpers/notifications';
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
  status?: string;
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
    status,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = req.body as CreateSeasonBody;

  const isRegisterInterest = status === 'REGISTER_INTEREST';

  // Validate required fields
  // Note: entryFee can be 0 (free seasons), so check for undefined/null instead of falsy
  // Dates are not required for REGISTER_INTEREST seasons
  if (!name || entryFee === undefined || entryFee === null || !leagueIds || !categoryId) {
    return sendError(res, "Missing required fields: name, entryFee, leagueIds, and categoryId are required", 400);
  }

  if (!isRegisterInterest && (!startDate || !endDate)) {
    return sendError(res, "Missing required fields: startDate and endDate are required for non-register-interest seasons", 400);
  }

  if (!Array.isArray(leagueIds) || leagueIds.length === 0) {
    return sendError(res, "At least one league ID is required", 400);
  }

  // Date cross-validation (when dates are provided)
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return sendError(res, "Start date must be before end date", 400);
  }
  if (regiDeadline && startDate && new Date(regiDeadline) > new Date(startDate)) {
    return sendError(res, "Registration deadline must be on or before the start date", 400);
  }
  if (entryFee !== undefined && Number(entryFee) < 0) {
    return sendError(res, "Entry fee cannot be negative", 400);
  }

  // Derive effective status and isActive flag
  const validStatuses = ['ACTIVE', 'UPCOMING', 'REGISTER_INTEREST'];
  const effectiveStatus = (status && validStatuses.includes(status))
    ? (status as 'ACTIVE' | 'UPCOMING' | 'REGISTER_INTEREST')
    : (isActive ? 'ACTIVE' : 'UPCOMING');
  const effectiveIsActive = effectiveStatus === 'ACTIVE';

  try {
    const seasonData: Parameters<typeof createSeasonService>[0] = {
      name,
      entryFee,
      leagueIds,
      categoryId,
      status: effectiveStatus,
      isActive: effectiveIsActive,
    };

    if (startDate !== undefined) seasonData.startDate = startDate;
    if (endDate !== undefined) seasonData.endDate = endDate;
    if (regiDeadline !== undefined) seasonData.regiDeadline = regiDeadline;
    if (description !== undefined) seasonData.description = description;
    if (paymentRequired !== undefined) seasonData.paymentRequired = paymentRequired;
    if (promoCodeSupported !== undefined) seasonData.promoCodeSupported = promoCodeSupported;
    if (withdrawalEnabled !== undefined) seasonData.withdrawalEnabled = withdrawalEnabled;

    // Auto-disable payment for free seasons
    if (Number(entryFee) === 0) {
      seasonData.paymentRequired = false;
    }

    const season = await createSeasonService(seasonData);
    let announcementLeagueName = '';

    // 🆕 Send new season announcement to ALL users if season is active
    if (effectiveIsActive) {
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
          if (league && league.name) {
            announcementLeagueName = league.name;
            const notificationData = leagueLifecycleNotifications.newSeasonAnnouncement(
              season.name,
              league.name
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
    if (effectiveIsActive && startDate) {
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
            season.name,
            announcementLeagueName
          );

          await notificationService.createNotification({
            userIds: registeredUsers.map(u => u.userId),
            ...notificationData,
            seasonId: season.id
          });
        }
      }
    }

    return sendSuccess(res, season, "Season created successfully", 201);
  } catch (error: unknown) {
    console.error("Error creating season:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle validation errors
    if (errorMessage.includes("Missing required fields") ||
        errorMessage.includes("At least one league")) {
      return sendError(res, errorMessage, 400);
    }

    // Handle duplicate season name
    if (errorMessage.includes("already exists")) {
      return sendError(res, errorMessage, 409);
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
        return sendError(res, "Season not found.", 404);
      }

      const result = formatSeasonWithRelations(season);
      return sendSuccess(res, result);
    }

    // Get active season
    if (active === "true") {
      const activeSeason = await getActiveSeasonService();
      if (!activeSeason) {
        return sendError(res, "No active season found.", 404);
      }
      return sendSuccess(res, activeSeason);
    }

    // Get all seasons with pagination
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    const result = await getAllSeasonsService(pageNum, limitNum);
    return sendPaginated(res, result.data, result.pagination, `Found ${result.pagination.total} season(s)`);
  } catch (error: unknown) {
    console.error("Error fetching seasons:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return sendError(res, "Invalid query parameters or field selection.", 400);
    }

    return sendError(res, "Failed to fetch seasons. Try again later.", 500);
  }
};

export const getSeasonById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Season ID is required.", 400);
  }

  try {
    const season = await getSeasonByIdService(id);
    if (!season) {
      return sendError(res, "Season not found.", 404);
    }

    const result = formatSeasonWithRelations(season);
    return sendSuccess(res, result);
  } catch (error: unknown) {
    console.error(`Error fetching season ${id}:`, error);
    return sendError(res, "Failed to retrieve season details.", 500);
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
    return sendError(res, "Season ID is required.", 400);
  }

  // Date cross-validation (when dates are provided)
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return sendError(res, "Start date must be before end date", 400);
  }
  if (regiDeadline && startDate && new Date(regiDeadline) > new Date(startDate)) {
    return sendError(res, "Registration deadline must be on or before the start date", 400);
  }
  if (entryFee !== undefined && Number(entryFee) < 0) {
    return sendError(res, "Entry fee cannot be negative", 400);
  }

  try {
    const currentSeason = await prisma.season.findUnique({
      where: { id },
      select: { status: true, name: true, registeredUserCount: true }
    });

    if (!currentSeason) {
      return sendError(res, "Season not found.", 404);
    }

    const activeMembershipCount = await prisma.seasonMembership.count({
      where: {
        seasonId: id,
        status: { in: ["ACTIVE", "PENDING"] as any },
      },
    });

    const hasRegisteredPlayers = (currentSeason.registeredUserCount || 0) > 0 || activeMembershipCount > 0;

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
      if (status && ["UPCOMING", "ACTIVE", "REGISTER_INTEREST", "FINISHED", "CANCELLED"].includes(status)) {
        seasonData.status = status as "UPCOMING" | "ACTIVE" | "REGISTER_INTEREST" | "FINISHED" | "CANCELLED";
      }
    }
    if (paymentRequired !== undefined) seasonData.paymentRequired = paymentRequired;
    if (promoCodeSupported !== undefined) seasonData.promoCodeSupported = promoCodeSupported;
    if (withdrawalEnabled !== undefined) seasonData.withdrawalEnabled = withdrawalEnabled;

    // Auto-disable payment for free seasons
    if (entryFee !== undefined && Number(entryFee) === 0) {
      seasonData.paymentRequired = false;
    }

    const requestedStatus = seasonData.status ?? (isActive === true ? "ACTIVE" : isActive === false ? "UPCOMING" : undefined);
    // Terminal status transitions (FINISHED, CANCELLED) are always allowed from ACTIVE
    const isTerminalTransition = requestedStatus === "FINISHED" || requestedStatus === "CANCELLED";

    if (currentSeason.status === "ACTIVE" && hasRegisteredPlayers && !isTerminalTransition) {
      if (requestedStatus && (requestedStatus === "UPCOMING" || requestedStatus === "REGISTER_INTEREST")) {
        return sendError(
          res,
          "Cannot change an active season with registered players to Upcoming or Register Interest. Only endDate or terminal status (Finished/Cancelled) can be updated.",
          400
        );
      }

      const hasNonEndDateChanges =
        name !== undefined ||
        startDate !== undefined ||
        regiDeadline !== undefined ||
        description !== undefined ||
        entryFee !== undefined ||
        leagueIds !== undefined ||
        categoryId !== undefined ||
        paymentRequired !== undefined ||
        promoCodeSupported !== undefined ||
        withdrawalEnabled !== undefined ||
        isActive !== undefined ||
        (status !== undefined && status !== "ACTIVE" && status !== "FINISHED" && status !== "CANCELLED");

      if (hasNonEndDateChanges) {
        return sendError(
          res,
          "This active season already has registered players. Only endDate or terminal status (Finished/Cancelled) can be updated.",
          400
        );
      }
    }

    const season = await updateSeasonService(id, seasonData);

    // Determine effective new status (matching service-level inference)
    const effectiveNewStatus = status ?? (isActive ? "ACTIVE" : undefined);

    // BUG 1: Trigger waitlist promotion on UPCOMING -> ACTIVE transition
    if (currentSeason && currentSeason.status === 'UPCOMING' && effectiveNewStatus === 'ACTIVE') {
      try {
        const promotionResult = await waitlistService.promoteAllUsers(id);
        if (promotionResult.promoted > 0) {
          console.log(`Auto-promoted ${promotionResult.promoted} waitlisted users for season ${id}`);

          // BUG 3: Notify promoted users
          const promotionNotification = leagueLifecycleNotifications.waitlistPromoted(season.name);
          await notificationService.createNotification({
            userIds: promotionResult.promotedUserIds,
            ...promotionNotification,
            seasonId: id,
          });
        }
        if (promotionResult.failedUserIds.length > 0) {
          console.warn(`Failed to promote ${promotionResult.failedUserIds.length} users for season ${id}:`, promotionResult.failedUserIds);
        }
      } catch (error) {
        console.error(`Failed to auto-promote waitlisted users for season ${id}:`, error);
        // Don't throw — promotion failure shouldn't block status update
      }
    }

    // Send notifications for status changes
    if (effectiveNewStatus && currentSeason && effectiveNewStatus !== currentSeason.status) {
      try {
        let notificationData;

        // Fetch league name for use across all notification branches
        const seasonLeagueInfo = await prisma.season.findUnique({
          where: { id },
          include: { leagues: { select: { name: true } } }
        });
        const notifLeagueName = seasonLeagueInfo?.leagues?.[0]?.name || '';

        if (effectiveNewStatus === 'FINISHED') {
          const registeredUsers = await prisma.seasonMembership.findMany({
            where: { seasonId: id },
            select: { userId: true }
          });
          if (registeredUsers.length > 0) {
            notificationData = leagueLifecycleNotifications.leagueEndedFinalResults(
              season.name,
              notifLeagueName
            );
            await notificationService.createNotification({
              userIds: registeredUsers.map(u => u.userId),
              ...notificationData,
              seasonId: id
            });
          }
        } else if (effectiveNewStatus === 'CANCELLED') {
          const registeredUsers = await prisma.seasonMembership.findMany({
            where: { seasonId: id },
            select: { userId: true }
          });
          if (registeredUsers.length > 0) {
            notificationData = leagueLifecycleNotifications.leagueCancelled(
              notifLeagueName,
              season.name
            );
            await notificationService.createNotification({
              userIds: registeredUsers.map(u => u.userId),
              ...notificationData,
              seasonId: id
            });
          }
        } else if (effectiveNewStatus === 'ACTIVE') {
          // BUG 2: Send "season is live" announcement to all users
          const seasonWithLeagues = await prisma.season.findUnique({
            where: { id },
            include: { leagues: { select: { name: true, location: true, sportType: true } } }
          });
          if (seasonWithLeagues?.leagues?.[0]) {
            const league = seasonWithLeagues.leagues[0];
            if (league.name) {
              const announcementData = leagueLifecycleNotifications.newSeasonAnnouncement(
                season.name, league.name
              );
              const allUsers = await prisma.user.findMany({ select: { id: true } });
              await notificationService.createNotification({
                userIds: allUsers.map(u => u.id),
                ...announcementData,
                seasonId: id
              });
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending season status change notification:", notificationError);
      }
    }

    return sendSuccess(res, season, "Season updated successfully");
  } catch (error: unknown) {
    console.error("Error updating season:", error);
    return handlePrismaError(error, res, "Failed to update season");
  }
};

/**
 * BUG 9: Dedicated go-live endpoint.
 * POST /:id/go-live
 *
 * Atomically: validates UPCOMING, sets ACTIVE + isActive, promotes waitlisted users,
 * sends notifications, returns promotion results.
 */
export const goLiveSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Season ID is required.", 400);
  }

  try {
    // Fetch season with leagues for notification context
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        leagues: { select: { name: true, location: true, sportType: true } },
      },
    });

    if (!season) {
      return sendError(res, "Season not found.", 404);
    }

    // Validate season is UPCOMING
    if (season.status !== "UPCOMING") {
      return sendError(
        res,
        `Season cannot go live. Current status is ${season.status}. Only UPCOMING seasons can be activated.`,
        400
      );
    }

    // Set status to ACTIVE and isActive to true
    const updatedSeason = await prisma.season.update({
      where: { id },
      data: { status: "ACTIVE", isActive: true },
    });

    // Promote all waitlisted users
    let promotionResult = { promoted: 0, promotedUserIds: [] as string[], failedUserIds: [] as string[], seasonName: season.name };
    try {
      promotionResult = await waitlistService.promoteAllUsers(id);
    } catch (error) {
      console.error(`Failed to promote waitlisted users during go-live for season ${id}:`, error);
    }

    // Send notification to promoted users
    if (promotionResult.promoted > 0) {
      try {
        const promotionNotification = leagueLifecycleNotifications.waitlistPromoted(season.name);
        await notificationService.createNotification({
          userIds: promotionResult.promotedUserIds,
          ...promotionNotification,
          seasonId: id,
        });
      } catch (error) {
        console.error("Failed to send waitlist promotion notifications:", error);
      }
    }

    // Send general "season is live" announcement
    try {
      const league = season.leagues?.[0];
      if (league?.name) {
        const announcementData = leagueLifecycleNotifications.newSeasonAnnouncement(
          season.name, league.name
        );
        const allUsers = await prisma.user.findMany({ select: { id: true } });
        await notificationService.createNotification({
          userIds: allUsers.map(u => u.id),
          ...announcementData,
          seasonId: id,
        });
      }
    } catch (error) {
      console.error("Failed to send season announcement:", error);
    }

    // BUG 24: Emit socket events for promoted users
    if (req.io && promotionResult.promotedUserIds.length > 0) {
      try {
        promotionResult.promotedUserIds.forEach(userId => {
          req.io.to(userId).emit('waitlist_promotion', {
            seasonId: id,
            seasonName: season.name,
          });
        });
      } catch (socketError) {
        console.error("Failed to emit waitlist_promotion socket events:", socketError);
      }
    }

    return sendSuccess(res, {
      season: updatedSeason,
      promotion: {
        promoted: promotionResult.promoted,
        promotedUserIds: promotionResult.promotedUserIds,
        failed: promotionResult.failedUserIds,
      },
    }, "Season is now live!");
  } catch (error: unknown) {
    console.error("Error activating season:", error);
    return handlePrismaError(error, res, "Failed to activate season");
  }
};

export const updateSeasonStatus = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Season ID is required.", 400);
  }

  try {
    const { status, isActive } = req.body as UpdateSeasonStatusBody;

    const currentSeason = await prisma.season.findUnique({
      where: { id },
      select: { status: true, registeredUserCount: true },
    });

    if (!currentSeason) {
      return sendError(res, "Season not found.", 404);
    }

    const activeMembershipCount = await prisma.seasonMembership.count({
      where: {
        seasonId: id,
        status: { in: ["ACTIVE", "PENDING"] as any },
      },
    });
    const hasRegisteredPlayers = (currentSeason.registeredUserCount || 0) > 0 || activeMembershipCount > 0;

    const requestedStatus = status ?? (isActive === true ? "ACTIVE" : isActive === false ? "UPCOMING" : undefined);
    if (currentSeason.status === "ACTIVE" && hasRegisteredPlayers && (requestedStatus === "UPCOMING" || requestedStatus === "REGISTER_INTEREST")) {
      return sendError(
        res,
        "Cannot change an active season with registered players to Upcoming or Register Interest.",
        400
      );
    }

    const statusUpdate: Parameters<typeof updateSeasonStatusService>[1] = {};
    if (status !== undefined) {
      if (status && ["UPCOMING", "ACTIVE", "FINISHED", "CANCELLED"].includes(status)) {
        statusUpdate.status = status as "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
      }
    }
    if (isActive !== undefined) statusUpdate.isActive = isActive;

    const season = await updateSeasonStatusService(id, statusUpdate);
    return sendSuccess(res, season, "Season status updated successfully");
  } catch (error: unknown) {
    console.error("Error updating season status:", error);
    return handlePrismaError(error, res, "Failed to update season status");
  }
};

export const deleteSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Season ID is required for deletion.", 400);
  }

  try {
    const deletedSeason = await deleteSeasonService(id);
    return sendSuccess(res, deletedSeason, `Season "${deletedSeason.name}" deleted successfully.`);
  } catch (error: unknown) {
    console.error("Error deleting season:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("Cannot delete season")) {
      return sendError(res, errorMessage, 409);
    }

    if (errorMessage.includes("not found")) {
      return sendError(res, errorMessage, 404);
    }

    return sendError(res, "Failed to delete season.", 500);
  }
};

export const submitWithdrawalRequest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, "Unauthorized", 401);
  }

  const validation = validateWithdrawalRequest(req.body);
  if (!validation.isValid) {
    return sendError(res, validation.error!, 400);
  }

  const { seasonId, reason, partnershipId } = req.body as SubmitWithdrawalRequestBody;

  if (!seasonId || !reason) {
    return sendError(res, "seasonId and reason are required", 400);
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

    return sendSuccess(res, withdrawalRequest, undefined, 201);
  } catch (error: unknown) {
    console.error("Error submitting withdrawal request:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("not found") ||
        errorMessage.includes("not part of this partnership") ||
        errorMessage.includes("not active")) {
      return sendError(res, errorMessage, 400);
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return sendError(res, "Invalid data format or type for withdrawal request.", 400);
    }

    return sendError(res, "Failed to submit withdrawal request.", 500);
  }
};

export const processWithdrawalRequest = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const processedByAdminId = req.user?.id;
  const { status, adminNotes } = req.body as ProcessWithdrawalRequestBody & { adminNotes?: string };

  if (!processedByAdminId) {
    return sendError(res, "Unauthorized", 401);
  }

  if (!id) {
    return sendError(res, "Withdrawal request ID is required.", 400);
  }

  if (!status || !["APPROVED", "REJECTED"].includes(status)) {
    return sendError(res, "Invalid status. Must be 'APPROVED' or 'REJECTED'.", 400);
  }

  try {
    const result = await processWithdrawalRequestService(
      id,
      status as "APPROVED" | "REJECTED",
      processedByAdminId,
      adminNotes?.trim()
    );

    // Send notification to user about withdrawal decision
    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        season: { select: { name: true } },
        partnership: {
          select: { captainId: true, partnerId: true }
        },
        user: { select: { name: true } }
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

      // Notify the requesting player
      await notificationService.createNotification({
        userIds: withdrawalRequest.userId,
        ...notificationData,
        seasonId: withdrawalRequest.seasonId,
        withdrawalRequestId: id
      });

      // Notify the remaining partner when a doubles withdrawal is approved
      if (status === 'APPROVED' && withdrawalRequest.partnership) {
        const remainingPartnerId = withdrawalRequest.partnership.captainId === withdrawalRequest.userId
          ? withdrawalRequest.partnership.partnerId
          : withdrawalRequest.partnership.captainId;

        if (remainingPartnerId) {
          try {
            const withdrawingPlayerName = withdrawalRequest.user?.name || 'Your partner';
            await notificationService.createNotification({
              userIds: remainingPartnerId,
              type: NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED,
              category: 'GENERAL' as const,
              title: 'Partnership Dissolved',
              message: `${withdrawingPlayerName} has withdrawn from ${withdrawalRequest.season.name}. Your partnership has been dissolved. You can find a new partner in Team Pairing.`,
              seasonId: withdrawalRequest.seasonId,
            });
          } catch (partnerNotifError) {
            console.warn('Failed to notify remaining partner:', partnerNotifError);
          }
        }
      }
    }

    return sendSuccess(res, result);
  } catch (error: unknown) {
    console.error(`Error processing withdrawal request ${id}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes("not found") ||
        errorMessage.includes("already processed")) {
      return sendError(res, errorMessage, 400);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return sendError(res, "Withdrawal request not found.", 404);
      }
    }

    return sendError(res, "Failed to process withdrawal request.", 500);
  }
};

export const registerPlayerToSeason = async (req: Request, res: Response) => {
  const { userId, seasonId, payLater } = req.body as RegisterPlayerToSeasonBody;

  if (!userId || !seasonId) {
    return sendError(res, "userId and seasonId are required.", 400);
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
      // TODO(captain-gate): Captain-only registration is currently UI-enforced only.
      // The frontend disables the Register button for non-captains (DoublesTeamPairingScreen line 1040).
      // Backend does NOT verify userId === partnership.captainId. Either partner can register both.
      // This is idempotent and non-destructive, but add backend check if stricter control needed:
      //   if (userId !== partnership.captainId) return sendError(res, "Only the team captain can register", 403);
      console.log(`🎾 Doubles registration detected for partnership ${partnership.id}`);
      const captainId = partnership.captainId;
      const partnerId = partnership.partnerId;

      if (!partnerId) {
        return sendError(res, "Partnership has no partner assigned", 400);
      }

      // payLater=true: "Register now, pay before deadline" flow.
      // Sets payment to COMPLETED immediately so membership is ACTIVE.
      // Player must still pay before regiDeadline — admin tracks payment status separately.
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
            season: {
              select: {
                id: true,
                name: true,
                entryFee: true,
                startDate: true,
                leagues: { select: { name: true } },
                category: { select: { name: true } }
              }
            }
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
            seasonData.leagues?.[0]?.name || '',
            seasonData.category?.name || '',
            seasonData.startDate ? new Date(seasonData.startDate).toLocaleDateString() : 'TBD',
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

      // NOTIF-032: Push to partner — captain completed registration
      if (seasonData && partnerId) {
        try {
          const captainName = partnership.captain?.name || 'Your captain';
          const partnerNotif = notificationTemplates.doubles.doublesTeamRegisteredPartner(
            captainName,
            seasonData.name,
          );
          await notificationService.createNotification({
            userIds: partnerId,
            ...partnerNotif,
            seasonId,
          });
          console.log('✅ [NOTIF-032] Partner registration notification sent to', partnerId);
        } catch (notifErr) {
          console.error('❌ [NOTIF-032] Failed to send partner registration notification:', notifErr);
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

      return sendSuccess(res, { partnership: result.partnership, memberships: result.memberships }, "Team registered successfully", 201);

    } else {
      // ✅ SINGLES REGISTRATION: Create new membership
      console.log(`🎾 Singles registration for user ${userId}`);

      const membership = await registerMembershipService({ userId, seasonId, payLater: payLater === true });

      // 🆕 Send registration confirmation notification
      const season = await prisma.season.findUnique({
        where: { id: seasonId },
        select: {
          name: true,
          entryFee: true,
          startDate: true,
          leagues: { select: { name: true } },
          category: { select: { name: true } }
        }
      });

      if (season) {
        try {
          const notificationData = leagueLifecycleNotifications.registrationConfirmed(
            season.name,
            season.leagues?.[0]?.name || '',
            season.category?.name || '',
            season.startDate ? new Date(season.startDate).toLocaleDateString() : 'TBD',
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

      return sendSuccess(res, { membership: result }, "User registered successfully", 201);
    }
  } catch (error: unknown) {
    console.error("Error registering to season:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return sendError(res, errorMessage, 400);
  }
};

export const assignPlayerToDivision = async (req: Request, res: Response) => {
  const { membershipId, divisionId } = req.body as AssignPlayerToDivisionBody;

  if (!membershipId || !divisionId) {
    return sendError(res, "membershipId and divisionId are required.", 400);
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

    return sendSuccess(res, { membership: result }, "Player assigned to division successfully");
  } catch (error: unknown) {
    console.error("Error assigning player to division:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return sendError(res, errorMessage, 400);
  }
};

/**
 * Get current user's season memberships
 * Returns all seasons the authenticated user is registered for
 */
export const getMyMemberships = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return sendError(res, "Authentication required.", 401);
  }

  try {
    const memberships = await getMembershipsByUserId(userId);
    return sendSuccess(res, memberships, `Found ${memberships.length} membership(s)`);
  } catch (error: unknown) {
    console.error("Error fetching user memberships:", error);
    return sendError(res, "Failed to fetch memberships.", 500);
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  const { membershipId, paymentStatus } = req.body as UpdatePaymentStatusBody;

  if (!membershipId || !paymentStatus) {
    return sendError(res, "membershipId and paymentStatus are required.", 400);
  }

  if (!Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
    return sendError(res, "Invalid paymentStatus value.", 400);
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
    return sendSuccess(res, { membership: result }, "Payment status updated");
  } catch (error: unknown) {
    console.error("Error updating payment status:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return sendError(res, errorMessage, 400);
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
