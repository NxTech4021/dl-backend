import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";

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
  validateCreateSeasonData,
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

// import { notificationService } from '../services/notificationService';
// import {
//   notificationSeasonRegistrationConfirmed,
//   notificationSeasonStartingSoon,
//   notificationSeasonEnded,
//   notificationSeasonCancelled,
//   notificationPaymentConfirmed,
//   notificationPaymentFailed,
//   notificationWithdrawalRequestReceived,
//   notificationWithdrawalRequestApproved,
//   notificationWithdrawalRequestRejected,
//   reminderRegistrationDeadline,
//   reminderPaymentDue
// } from '../utils/notificationHelpers';



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
  } = req.body;

  try {
    const categoryIds = categoryId ? [categoryId] : [];

    const season = await createSeasonService({
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
    });

    // 🆕 Send notification if season is starting soon
    // if (isActive && startDate) {
    //   const startDateObj = new Date(startDate);
    //   const now = new Date();
    //   const daysDifference = Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 3600 * 24));
      
    //   if (daysDifference <= 7 && daysDifference > 0) {
    //     // Get all registered users for this season
    //     const registeredUsers = await prisma.seasonMembership.findMany({
    //       where: { seasonId: season.id },
    //       select: { userId: true }
    //     });

    //     if (registeredUsers.length > 0) {
    //       const notificationData = notificationSeasonStartingSoon(
    //         season.name,
    //         startDateObj.toLocaleDateString()
    //       );

    //       await notificationService.createNotification({
    //         userIds: registeredUsers.map(u => u.userId),
    //         ...notificationData,
    //         seasonId: season.id
    //       });
    //     }
    //   }
    // }

    return res.status(201).json({
      success: true,
      message: "Season created successfully",
      data: season,
    });
  } catch (error: any) {
    console.error("Error creating season:", error);

    // Handle validation errors
    if (error.message?.includes("Missing required fields") ||
        error.message?.includes("At least one league")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    // Handle duplicate season name
    if (error.message?.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    return handlePrismaError(error, res, "Failed to create season. Please try again later.");
  }
};

export const getSeasons = async (req: Request, res: Response) => {
  const { active, id } = req.query;

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

    // Get all seasons
    const seasons = await getAllSeasonsService();
    return res.status(200).json(seasons);
  } catch (error: any) {
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
  } catch (error: any) {
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
    categoryIds,
    isActive,
    status,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  try {
    const seasonData = {
      name,
      startDate,
      endDate,
      regiDeadline,
      description,
      entryFee,
      leagueIds,
      categoryIds,
      isActive,
      status,
      paymentRequired,
      promoCodeSupported,
      withdrawalEnabled,
    };

    const season = await updateSeasonService(id, seasonData);

    // 🆕 Send notifications for status changes
    if (status && status !== season.status) {
      const registeredUsers = await prisma.seasonMembership.findMany({
        where: { seasonId: id },
        select: { userId: true }
      });

      // if (registeredUsers.length > 0) {
      //   let notificationData;

      //   if (status === 'FINISHED') {
      //     notificationData = notificationSeasonEnded(
      //       season.name,
      //       'Your Division', // You may need to get division info per user
      //       undefined // finalPosition - could be calculated
      //     );
      //   } else if (status === 'CANCELLED') {
      //     notificationData = notificationSeasonCancelled(
      //       season.name,
      //       'Season has been cancelled by administration'
      //     );
      //   }

      //   if (notificationData) {
      //     await notificationService.createNotification({
      //       userIds: registeredUsers.map(u => u.userId),
      //       ...notificationData,
      //       seasonId: id
      //     });
      //   }
      // }
    }

    return res.status(200).json({
      success: true,
      message: "Season updated successfully",
      data: season
    });
  } catch (error: any) {
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
    const { status, isActive } = req.body;
    const season = await updateSeasonStatusService(id, { status, isActive });
    return res.status(200).json({
      success: true,
      message: "Season status updated successfully",
      data: season
    });
  } catch (error: any) {
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
  } catch (error: any) {
    console.error("Error deleting season:", error.message);

    if (error.message.includes("Cannot delete season")) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to delete season." });
  }
};

export const submitWithdrawalRequest = async (req: any, res: any) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validation = validateWithdrawalRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  const { seasonId, reason, partnershipId } = req.body;

  try {
    const withdrawalRequest = await submitWithdrawalRequestService({
      userId,
      seasonId,
      reason,
      partnershipId,
    });

    // 🆕 Send notification to user confirming withdrawal request
    // const season = await prisma.season.findUnique({
    //   where: { id: seasonId },
    //   select: { name: true }
    // });

    // if (season) {
    //   const notificationData = notificationWithdrawalRequestReceived(season.name);

    //   await notificationService.createNotification({
    //     userIds: userId,
    //     ...notificationData,
    //     seasonId: seasonId,
    //     withdrawalRequestId: withdrawalRequest.id
    //   });
    // }

    return res.status(201).json(withdrawalRequest);
  } catch (error: any) {
    console.error("Error submitting withdrawal request:", error);

    if (error.message?.includes("not found") ||
        error.message?.includes("not part of this partnership") ||
        error.message?.includes("not active")) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({ error: "Invalid data format or type for withdrawal request." });
    }

    return res.status(500).json({ error: "Failed to submit withdrawal request." });
  }
};

export const processWithdrawalRequest = async (req: any, res: any) => {
  const { id } = req.params;
  const processedByAdminId = req.user?.id;
  const { status } = req.body;

  if (!processedByAdminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    const result = await processWithdrawalRequestService(
      id,
      status,
      processedByAdminId
    );

    // 🆕 Send notification to user about withdrawal decision
    // const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
    //   where: { id },
    //   include: {
    //     season: { select: { name: true } }
    //   }
    // });

    // if (withdrawalRequest) {
    //   let notificationData;

    //   if (status === 'APPROVED') {
    //     notificationData = notificationWithdrawalRequestApproved(
    //       withdrawalRequest.season.name,
    //       'Your refund will be processed within 5-7 business days'
    //     );
    //   } else {
    //     notificationData = notificationWithdrawalRequestRejected(
    //       withdrawalRequest.season.name,
    //       'Please contact support for more information'
    //     );
    //   }

    //   await notificationService.createNotification({
    //     userIds: withdrawalRequest.userId,
    //     ...notificationData,
    //     seasonId: withdrawalRequest.seasonId,
    //     withdrawalRequestId: id
    //   });
    // }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error(`Error processing withdrawal request ${id}:`, error);

    if (error.message?.includes("not found") ||
        error.message?.includes("already processed")) {
      return res.status(400).json({ error: error.message });
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
  const { userId, seasonId } = req.body;

  if (!userId || !seasonId) {
    return res.status(400).json({ error: "userId and seasonId are required." });
  }

  try {
    // ✅ Check if user has an active partnership for this season
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
      // ✅ DOUBLES REGISTRATION: Update existing memberships
      console.log(`🎾 Doubles registration detected for partnership ${partnership.id}`);
      const captainId = partnership.captainId;
      const partnerId = partnership.partnerId;

      const result = await prisma.$transaction(async (tx) => {
        // Update both memberships to ACTIVE
        const updatedCount = await tx.seasonMembership.updateMany({
          where: {
            seasonId,
            userId: { in: [captainId, partnerId] },
            status: 'PENDING'  // Only update if still pending
          },
          data: {
            status: 'ACTIVE',
            // Keep paymentStatus as PENDING for "Pay Later"
          }
        });

        if (updatedCount.count === 0) {
          throw new Error('No pending memberships found for this partnership. They may have already been registered.');
        }

        console.log(`✅ Updated ${updatedCount.count} memberships to ACTIVE for partnership`);

        // Fetch the updated memberships
        const memberships = await tx.seasonMembership.findMany({
          where: {
            seasonId,
            userId: { in: [captainId, partnerId] }
          },
          include: {
            user: { select: { id: true, name: true } },
            season: { select: { id: true, name: true } }
          }
        });

        return { partnership, memberships };
      });

      return res.status(201).json({
        message: "Team registered successfully",
        partnership: result.partnership,
        memberships: result.memberships
      });

    } else {
      // ✅ SINGLES REGISTRATION: Create new membership (existing behavior)
      console.log(`🎾 Singles registration for user ${userId}`);
      const membership = await registerMembershipService({ userId, seasonId });

      // 🆕 Send registration confirmation notification
      // const season = await prisma.season.findUnique({
      //   where: { id: seasonId },
      //   select: { name: true, entryFee: true }
      // });

      // if (season) {
      //   const notificationData = notificationSeasonRegistrationConfirmed(
      //     season.name,
      //     `$${season.entryFee}`
      //   );

      //   await notificationService.createNotification({
      //     userIds: userId,
      //     ...notificationData,
      //     seasonId: seasonId
      //   });
      // }

      const result = {
        ...membership,
        user: { id: membership.user.id, name: membership.user.name },
        season: { id: membership.season.id, name: membership.season.name },
        division: membership.division
          ? { id: membership.division.id, name: membership.division.name }
          : null,
      };

      return res.status(201).json({
        message: "User registered successfully",
        membership: result
      });
    }
  } catch (error: any) {
    console.error("Error registering to season:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const assignPlayerToDivision = async (req: Request, res: Response) => {
  const { membershipId, divisionId } = req.body;

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
      division: {
        id: membership.division.id,
        name: membership.division.name
      }
    };

    return res.status(200).json({ 
      message: "Player assigned to division successfully", 
      membership: result 
    });
  } catch (error: any) {
    console.error("Error assigning player to division:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  const { membershipId, paymentStatus } = req.body;

  if (!membershipId || !paymentStatus) {
    return res.status(400).json({ 
      error: "membershipId and paymentStatus are required." 
    });
  }

  if (!Object.values(PaymentStatus).includes(paymentStatus)) {
    return res.status(400).json({ error: "Invalid paymentStatus value." });
  }

  try {
    const membership = await updatePaymentStatusService({ membershipId, paymentStatus });

    // 🆕 Send payment status notification
    // const membershipWithSeason = await prisma.seasonMembership.findUnique({
    //   where: { id: membershipId },
    //   include: {
    //     season: { select: { name: true, entryFee: true } }
    //   }
    // });

    // if (membershipWithSeason) {
    //   let notificationData;

    //   if (paymentStatus === 'COMPLETED') {
    //     notificationData = notificationPaymentConfirmed(
    //       membershipWithSeason.season.name,
    //       `$${membershipWithSeason.season.entryFee}`,
    //       'Credit Card' // You might want to store payment method
    //     );
    //   } else if (paymentStatus === 'FAILED') {
    //     notificationData = notificationPaymentFailed(
    //       membershipWithSeason.season.name,
    //       `$${membershipWithSeason.season.entryFee}`,
    //       'Payment processing failed'
    //     );
    //   }

    //   if (notificationData) {
    //     await notificationService.createNotification({
    //       userIds: membership.userId,
    //       ...notificationData,
    //       seasonId: membershipWithSeason.seasonId
    //     });
    //   }
    // }

    const result = formatMembershipResponse(membership);
    return res.status(200).json({ 
      message: "Payment status updated", 
      membership: result 
    });
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    return res.status(400).json({ error: error.message });
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
  return await prisma.withdrawalRequest.create({
    data: {
      seasonId,
      userId,
      reason,
      partnershipId,
      status: "PENDING",
    },
    include: {
      season: { select: { id: true, name: true } },
      partnership: {
        include: {
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } },
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

