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
    leagueIds, 
    categoryId,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = req.body;

  // Updated validation for required fields
  if (!name || !startDate || !endDate || !entryFee || !leagueIds || !categoryId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
  }

  if (!Array.isArray(leagueIds) || leagueIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: "At least one league must be specified",
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
      leagueIds, // Pass array of league IDs
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
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "A season with this name already exists",
        });
      }

      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "One or more league IDs or category ID is invalid",
        });
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        success: false,
        error: "Invalid data format for season creation",
      });
    }

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
        leagues: season.leagues?.map(league => ({
          id: league.id,
          name: league.name
        })) ?? []
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
      return res.status(400).json({ 
        error: "Invalid query parameters or field selection." 
      });
    }

    res.status(500).json({ 
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


export const submitWithdrawalRequest = async (req: any, res: any) => {
  const userId = req.user?.id;
  const { seasonId, reason, partnershipId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!seasonId || !reason) {
    return res.status(400).json({
      error: "Missing required fields: seasonId and reason.",
    });
  }

  try {
    // If partnershipId is provided, verify the user is part of the partnership
    if (partnershipId) {
      const partnership = await prisma.partnership.findUnique({
        where: { id: partnershipId },
      });

      if (!partnership) {
        return res.status(404).json({ error: "Partnership not found." });
      }

      if (partnership.player1Id !== userId && partnership.player2Id !== userId) {
        return res.status(403).json({ error: "You are not part of this partnership." });
      }

      if (partnership.status !== "ACTIVE") {
        return res.status(400).json({ error: "Partnership is not active." });
      }
    }

    const newRequest = await prisma.withdrawalRequest.create({
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
    res.status(201).json(newRequest);
  } catch (error: any) {
    console.error("Error submitting withdrawal request:", error);
    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({ error: "Invalid data format or type for withdrawal request." });
    }
    res.status(500).json({ error: "Failed to submit withdrawal request." });
  }
};


export const processWithdrawalRequest = async (req: any, res: any) => {
  const { id } = req.params;
  const processedByAdminId = req.user?.id;
  const { status } = req.body; // Expects 'APPROVED' or 'REJECTED'

  if (!processedByAdminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        partnership: true,
        season: { select: { id: true, name: true } },
      },
    });

    if (!withdrawalRequest) {
      return res.status(404).json({ error: "Withdrawal request not found." });
    }

    if (withdrawalRequest.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: "This request has already been processed." });
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: status,
          processedByAdminId: processedByAdminId,
        },
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

      // If approved and has partnership, dissolve it
      if (status === "APPROVED" && withdrawalRequest.partnershipId) {
        await tx.partnership.update({
          where: { id: withdrawalRequest.partnershipId },
          data: {
            status: "DISSOLVED",
            dissolvedAt: new Date(),
          },
        });
      }

      return updatedRequest;
    });

    res.status(200).json(result);
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
