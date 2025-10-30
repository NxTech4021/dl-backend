import { Request, Response } from "express";
import { PrismaClient, Prisma, PaymentStatus } from "@prisma/client";
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
  validateWithdrawalRequest
} from "../validators/season";
import { formatSeasonResponse } from "../utils/responseFormatter";

const prisma = new PrismaClient();

export const createSeason = async (req: Request, res: Response) => {
  const validation = validateCreateSeasonData(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
    });
  }

  const {
    name, startDate, endDate, regiDeadline, description, entryFee,
    leagueIds, categoryId, isActive, paymentRequired,
    promoCodeSupported, withdrawalEnabled,
  } = req.body;

  try {
    const newSeason = await createSeasonService({
      name, startDate, endDate, regiDeadline, description, entryFee,
      leagueIds, categoryIds: [categoryId],
      isActive: isActive ?? false,
      paymentRequired: paymentRequired ?? false,
      promoCodeSupported: promoCodeSupported ?? false,
      withdrawalEnabled: withdrawalEnabled ?? false,
    });

    return res.status(201).json({
      success: true,
      message: "Season created successfully",
      data: newSeason,
    });
  } catch (error: any) {
    console.error("Error creating season:", error);
    return handlePrismaError(error, res, "Failed to create season");
  }
};

export const getSeasons = async (req: Request, res: Response) => {
  const { active } = req.query;

  try {
    if (active === "true") {
      const activeSeason = await getActiveSeasonService();
      if (!activeSeason) {
        return res.status(404).json({ error: "No active season found." });
      }
      return res.status(200).json(formatSeasonResponse(activeSeason));
    }

    const seasons = await getAllSeasonsService();
    const formattedSeasons = seasons.map(formatSeasonResponse);
    res.status(200).json(formattedSeasons);
  } catch (error: any) {
    console.error("Error fetching seasons:", error);
    return handlePrismaError(error, res, "Failed to fetch seasons");
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

    res.status(200).json(formatSeasonResponse(season));
  } catch (error: any) {
    console.error(`Error fetching season ${id}:`, error);
    res.status(500).json({ error: "Failed to retrieve season details." });
  }
};

export const updateSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  const validation = validateUpdateSeasonData(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const season = await updateSeasonService(id, req.body);
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

// Update Season Status Handler
export const updateSeasonStatus = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  const validation = validateStatusUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
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
    res.status(200).json({
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

    res.status(500).json({ error: "Failed to delete season." });
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
    if (partnershipId) {
      const isValidPartnership = await validatePartnership(partnershipId, userId);
      if (!isValidPartnership.isValid) {
        return res.status(isValidPartnership.statusCode).json({ 
          error: isValidPartnership.error 
        });
      }
    }

    const newRequest = await createWithdrawalRequest(seasonId, userId, reason, partnershipId);
    res.status(201).json(newRequest);
  } catch (error: any) {
    console.error("Error submitting withdrawal request:", error);
    handleWithdrawalError(error, res);
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
    const result = await processWithdrawal(id, processedByAdminId, status);
    if (!result.success) {
      return res.status(result.statusCode).json({ error: result.error });
    }

    res.status(200).json(result.data);
  } catch (error: any) {
    console.error(`Error processing withdrawal request ${id}:`, error);
    handleWithdrawalError(error, res);
  }
};

// Player Management Handlers
export const registerPlayerToSeason = async (req: Request, res: Response) => {
  const { userId, seasonId } = req.body;

  if (!userId || !seasonId) {
    return res.status(400).json({ error: "userId and seasonId are required." });
  }

  try {
    const membership = await registerMembershipService({ userId, seasonId });
    const result = formatMembershipResponse(membership);
    res.status(201).json({ 
      message: "User registered successfully", 
      membership: result 
    });
  } catch (error: any) {
    console.error("Error registering to season:", error);
    res.status(400).json({ error: error.message });
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
    const result = formatMembershipResponse(membership);
    res.status(200).json({ 
      message: "Player assigned to division successfully", 
      membership: result 
    });
  } catch (error: any) {
    console.error("Error assigning player to division:", error);
    res.status(400).json({ error: error.message });
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
    const result = formatMembershipResponse(membership);
    res.status(200).json({ 
      message: "Payment status updated", 
      membership: result 
    });
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    res.status(400).json({ error: error.message });
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

  if (partnership.player1Id !== userId && partnership.player2Id !== userId) {
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

  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.withdrawalRequest.update({
      where: { id },
      data: { status, processedByAdminId },
      include: {
        processedByAdmin: { select: { name: true, role: true } },
        partnership: {
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (status === "APPROVED" && withdrawalRequest.partnershipId) {
      await tx.partnership.update({
        where: { id: withdrawalRequest.partnershipId },
        data: { status: "DISSOLVED", dissolvedAt: new Date() },
      });
    }

    return updatedRequest;
  });

  return { success: true, data: result };
};

const formatMembershipResponse = (membership: any) => {
  return {
    ...membership,
    user: { id: membership.user.id, name: membership.user.name },
    season: { id: membership.season.id, name: membership.season.name },
    division: membership.division
      ? { id: membership.division.id, name: membership.division.name }
      : null,
  };
};

const handlePrismaError = (error: any, res: Response, defaultMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return res.status(409).json({
          success: false,
          error: "A season with this name already exists",
        });
      case "P2003":
        return res.status(400).json({
          success: false,
          error: "One or more league IDs or category IDs are invalid",
        });
      case "P2025":
        return res.status(404).json({
          success: false,
          error: "Season not found",
        });
      default:
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: "Invalid data format",
    });
  }

  return res.status(500).json({
    success: false,
    error: defaultMessage,
  });
};

const handleWithdrawalError = (error: any, res: Response) => {
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ 
      error: "Invalid data format or type for withdrawal request." 
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ error: "Withdrawal request not found." });
  }

  res.status(500).json({ error: "Failed to process withdrawal request." });
};