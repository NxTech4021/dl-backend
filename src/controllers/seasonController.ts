/**
 * Season Controller
 * Thin HTTP wrapper for season-related endpoints
 * Refactored from 702 lines to clean service-based architecture
 */

import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { Prisma, PaymentStatus } from "@prisma/client";

// CRUD Operations
import {
  createSeason as createSeasonService,
  updateSeason as updateSeasonService,
  updateSeasonStatus as updateSeasonStatusService,
  deleteSeason as deleteSeasonService
} from "../services/season/seasonCrudService";

// Query Operations
import {
  getAllSeasons as getAllSeasonsService,
  getSeasonById as getSeasonByIdService,
  getActiveSeason as getActiveSeasonService
} from "../services/season/seasonQueryService";

// Membership Operations
import {
  registerMembership as registerMembershipService,
  assignDivision as assignDivisionService,
  updatePaymentStatus as updatePaymentStatusService
} from "../services/season/seasonMembershipService";

// Withdrawal Operations
import {
  submitWithdrawalRequest as submitWithdrawalRequestService,
  processWithdrawalRequest as processWithdrawalRequestService
} from "../services/season/seasonWithdrawalService";

// Formatters
import { formatSeasonWithRelations } from "../services/season/utils/formatters";

/**
 * POST /api/seasons
 * Create a new season
 */
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
    // Handle single categoryId from request, convert to array for service
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

    // Handle Prisma errors
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
          error: "One or more league IDs or category IDs are invalid",
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

/**
 * GET /api/seasons
 * GET /api/seasons/:id (when id is in params)
 * GET /api/seasons?active=true
 * Get seasons with optional filtering
 */
export const getSeasons = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active } = req.query;

  try {
    // Get single season by ID
    if (id) {
      const season = await getSeasonByIdService(id);
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

/**
 * GET /api/seasons/:id
 * Get season by ID with full relations
 */
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

/**
 * PUT /api/seasons/:id
 * Update season details
 */
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
    return res.status(200).json({
      success: true,
      message: "Season updated successfully",
      data: season
    });
  } catch (error: any) {
    console.error("Error updating season:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Season not found for update." });
      }
      if (error.code === "P2003") {
        return res.status(400).json({ error: "One or more league or category IDs are invalid." });
      }
    }

    return res.status(500).json({ error: "Failed to update season." });
  }
};

/**
 * PATCH /api/seasons/:id/status
 * Update season status
 */
export const updateSeasonStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, isActive } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Season ID is required." });
  }

  if (!status && typeof isActive === "undefined") {
    return res.status(400).json({
      error: "Provide either status or isActive."
    });
  }

  try {
    const season = await updateSeasonStatusService(id, { status, isActive });
    return res.status(200).json({
      success: true,
      message: "Season status updated successfully",
      data: season
    });
  } catch (error: any) {
    console.error("Error updating season status:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Season not found." });
      }
    }

    return res.status(500).json({ error: "Failed to update season status." });
  }
};

/**
 * DELETE /api/seasons/:id
 * Delete a season
 */
export const deleteSeason = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ error: "Season ID is required for deletion." });
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

/**
 * POST /api/seasons/withdrawal-requests
 * Submit a withdrawal request
 */
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
    const withdrawalRequest = await submitWithdrawalRequestService({
      userId,
      seasonId,
      reason,
      partnershipId,
    });

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

/**
 * PATCH /api/seasons/withdrawal-requests/:id
 * Process a withdrawal request (APPROVE or REJECT)
 */
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

/**
 * POST /api/seasons/:id/register
 * Register user for a season
 */
export const registerPlayerToSeason = async (req: Request, res: Response) => {
  const { userId, seasonId } = req.body;

  console.log("DEBUG: Incoming request body:", req.body);

  try {
    if (!userId || !seasonId) {
      return res.status(400).json({ error: "userId and seasonId are required." });
    }

    const membership = await registerMembershipService({ userId, seasonId });

    const result = {
      ...membership,
      user: { id: membership.user.id, name: membership.user.name },
      season: { id: membership.season.id, name: membership.season.name },
      division: membership.division
        ? { id: membership.division.id, name: membership.division.name }
        : null,
    };

    return res.status(201).json({ message: "User registered successfully", membership: result });
  } catch (error: any) {
    console.error("Error registering to season:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * PATCH /api/seasons/memberships/:membershipId/assign-division
 * Assign division to a membership
 */
export const assignPlayerToDivision = async (req: Request, res: Response) => {
  const { membershipId, divisionId } = req.body;

  try {
    if (!membershipId || !divisionId) {
      return res.status(400).json({ error: "membershipId and divisionId are required." });
    }

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

    return res.status(200).json({ message: "Player assigned to division successfully", membership: result });
  } catch (error: any) {
    console.error("Error assigning player to division:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * PATCH /api/seasons/memberships/:membershipId/payment-status
 * Update payment status for a membership
 */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  const { membershipId, paymentStatus } = req.body;

  try {
    if (!membershipId || !paymentStatus) {
      return res.status(400).json({ error: "membershipId and paymentStatus are required." });
    }

    if (!Object.values(PaymentStatus).includes(paymentStatus)) {
      return res.status(400).json({ error: "Invalid paymentStatus value." });
    }

    const membership = await updatePaymentStatusService({ membershipId, paymentStatus });

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

    return res.status(200).json({ message: "Payment status updated", membership: result });
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    return res.status(400).json({ error: error.message });
  }
};
