import { Request, Response } from "express";
import {
  getAllWithdrawalRequests,
  getWithdrawalRequestStats,
  getDissolvedPartnerships,
  getDissolvedPartnershipById,
} from "../../services/admin/partnershipAdminService";

/**
 * GET /api/admin/partnerships/withdrawal-requests
 * Get all withdrawal requests with optional filters
 */
export const getWithdrawalRequestsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { status, seasonId, search } = req.query;

    const requests = await getAllWithdrawalRequests({
      status: status as "PENDING" | "APPROVED" | "REJECTED" | undefined,
      seasonId: seasonId as string | undefined,
      search: search as string | undefined,
    });

    return res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    return res.status(500).json({ error: "Failed to fetch withdrawal requests" });
  }
};

/**
 * GET /api/admin/partnerships/withdrawal-requests/stats
 * Get withdrawal request statistics
 */
export const getWithdrawalRequestStatsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const stats = await getWithdrawalRequestStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching withdrawal request stats:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
};

/**
 * GET /api/admin/partnerships/dissolved
 * Get all dissolved partnerships with lifecycle information
 */
export const getDissolvedPartnershipsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { seasonId, search } = req.query;

    const partnerships = await getDissolvedPartnerships({
      seasonId: seasonId as string | undefined,
      search: search as string | undefined,
    });

    return res.status(200).json(partnerships);
  } catch (error) {
    console.error("Error fetching dissolved partnerships:", error);
    return res.status(500).json({ error: "Failed to fetch dissolved partnerships" });
  }
};

/**
 * GET /api/admin/partnerships/dissolved/:id
 * Get a single dissolved partnership by ID with full lifecycle
 */
export const getDissolvedPartnershipByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Partnership ID is required" });
    }

    const partnership = await getDissolvedPartnershipById(id);

    if (!partnership) {
      return res.status(404).json({ error: "Partnership not found" });
    }

    return res.status(200).json(partnership);
  } catch (error) {
    console.error("Error fetching dissolved partnership:", error);
    return res.status(500).json({ error: "Failed to fetch partnership" });
  }
};
