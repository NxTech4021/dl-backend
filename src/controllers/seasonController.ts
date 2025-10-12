import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  getActiveSeasonService,
  getSeasonByIdService,
  getAllSeasonsService,
  createSeasonService,
  updateSeasonStatusService,
  updateSeasonService,
  deleteSeasonService,
} from "../services/seasonService";


const prisma = new PrismaClient();

export const createSeason = async (req: Request, res: Response) => {
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
  } = req.body;

  // Basic validation for required fields
  if (!name || !startDate || !endDate || !entryFee || !leagueId || !categoryId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
  }

  try {
    const newSeason = await createSeasonService({
      name,
      startDate,
      endDate,
      regiDeadline,
      description,
      entryFee,
      leagueId,
      categoryId,
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

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle unique constraint violations
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "A season with this name already exists",
        });
      }

      // Handle foreign key constraints
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid leagueId or categoryId provided",
        });
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        success: false,
        error: "Invalid data format for season creation",
      });
    }

    // Generic error handler
    return res.status(500).json({
      success: false,
      error: "Failed to create season. Please try again later.",
    });
  }
};

export const getSeasons = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active } = req.query;

  try {
    if (id) {
      const season = await getSeasonByIdService(id);
      if (!season) return res.status(404).json({ error: "Season not found." });
      
      const result = {
        ...season,
        league: season.league
          ? { id: season.league.id, name: season.league.name }
          : null,
      };

      return res.status(200).json(result);

    }

    if (active === "true") {
      const activeSeason = await getActiveSeasonService();
      if (!activeSeason)
        return res.status(404).json({ error: "No active season found." });
      return res.status(200).json(activeSeason);
    }

    const seasons = await getAllSeasonsService();
    res.status(200).json(seasons);
  } catch (error: any) {
    console.error("Error fetching seasons:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res
        .status(400)
        .json({ error: "Invalid query parameters or field selection." });
    }

    res
      .status(500)
      .json({ error: "Failed to fetch seasons. Try again later." });
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

    res.status(200).json(season);
  } catch (error: any) {
    console.error(`Error fetching season ${id}:`, error);
    res.status(500).json({ error: "Failed to retrieve season details." });
  }
};

// Only Updates the status of season - Lightweight api call
export const updateSeasonStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, isActive } = req.body;

  if (!id) {
  return res.status(400).json({ error: "Season ID is required." });
  } 

  if (!status && typeof isActive === "undefined") {
    return res
      .status(400)
      .json({ error: "Provide either status or isActive." });
  }

  try {
    const season = await updateSeasonStatusService(id, { status, isActive });
    return res
      .status(200)
      .json({ message: "Season updated successfully", season });
  } catch (error: any) {
    console.error("Error updating season status:", error);
    return res.status(500).json({ error: "Failed to update season status." });
  }
};

// Updates All information of a seaon - api contains all fields
export const updateSeason = async (req: Request, res: Response) => {
  const { id } = req.params;
  const seasonData = req.body;

  if (!id) {
  return res.status(400).json({ error: "Season ID is required." });
  }

  try {
    const season = await updateSeasonService(id, seasonData);
    return res
      .status(200)
      .json({ message: "Season updated successfully", season });
  } catch (error: any) {
    console.error("Error updating season:", error);
    return res.status(500).json({ error: "Failed to update season." });
  }
};

export const deleteSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ error: "Season ID is required for deletion." });
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

// POST /api/withdrawals (User submits a request)
export const submitWithdrawalRequest = async (req: any, res: any) => {
  // NOTE: Replace req.user.id with your actual authenticated user retrieval method
  const userId = req.body.userId || "placeholder-user-id"; // MUST be obtained from auth
  const { seasonId, reason } = req.body;

  if (!seasonId || !reason || !userId) {
    return res
      .status(400)
      .json({
        error:
          "Missing required fields: seasonId, reason, and authenticated userId.",
      });
  }

  try {
    const season = await prisma.season.findUnique({ where: { id: seasonId } });

    if (!season || !season.withdrawalEnabled) {
      return res
        .status(400)
        .json({ error: "Withdrawal is not enabled for this season." });
    }

    const newRequest = await prisma.withdrawalRequest.create({
      data: {
        seasonId,
        userId,
        reason,
        status: "PENDING", // Uses the WithdrawalStatus enum
      },
    });
    res.status(201).json(newRequest);
  } catch (error: any) {
    console.error("Error submitting withdrawal request:", error);
    if (error instanceof Prisma.PrismaClientValidationError) {
      return res
        .status(400)
        .json({ error: "Invalid data format or type for withdrawal request." });
    }
    res.status(500).json({ error: "Failed to submit withdrawal request." });
  }
};

// PUT /api/withdrawals/:id/process (Admin processes the request)
export const processWithdrawalRequest = async (req: any, res: any) => {
  const { id } = req.params;
  // NOTE: Replace req.admin.id with your actual authenticated admin ID retrieval method
  const processedByAdminId = req.body.adminId || "placeholder-admin-id"; // MUST be obtained from auth
  const { status } = req.body; // Expects 'APPROVED' or 'REJECTED'

  if (!["APPROVED", "REJECTED"].includes(status) || !processedByAdminId) {
    return res
      .status(400)
      .json({ error: "Invalid status or missing admin ID." });
  }

  try {
    const updatedRequest = await prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: status,
        processedByAdminId: processedByAdminId,
      },
      include: {
        processedByAdmin: { select: { name: true, role: true } },
      },
    });

    // NOTE: Here you would add business logic for refunds/waitlist promotion, etc.

    res.status(200).json(updatedRequest);
  } catch (error: any) {
    console.error(`Error processing withdrawal request ${id}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: Record to update not found
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Withdrawal request not found." });
      }
    }
    res.status(500).json({ error: "Failed to process withdrawal request." });
  }
};
