import { Request, Response } from "express";
import {
  getAllWithdrawalRequests,
  getWithdrawalRequestStats,
  getDissolvedPartnerships,
  getDissolvedPartnershipById,
} from "../../services/admin/partnershipAdminService";
import { sendSuccess, sendError } from '../../utils/response';

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

    const filters: {
      status?: "PENDING" | "APPROVED" | "REJECTED";
      seasonId?: string;
      search?: string;
    } = {};

    if (status) filters.status = status as "PENDING" | "APPROVED" | "REJECTED";
    if (seasonId) filters.seasonId = seasonId as string;
    if (search) filters.search = search as string;

    const requests = await getAllWithdrawalRequests(filters);

    return sendSuccess(res, requests);
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    return sendError(res, "Failed to fetch withdrawal requests");
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
    return sendSuccess(res, stats);
  } catch (error) {
    console.error("Error fetching withdrawal request stats:", error);
    return sendError(res, "Failed to fetch stats");
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
    const { seasonId, search, status } = req.query;

    const filters: {
      seasonId?: string;
      search?: string;
      status?: "DISSOLVED" | "EXPIRED";
    } = {};

    if (seasonId) filters.seasonId = seasonId as string;
    if (search) filters.search = search as string;
    if (status) filters.status = status as "DISSOLVED" | "EXPIRED";

    const partnerships = await getDissolvedPartnerships(filters);

    return sendSuccess(res, partnerships);
  } catch (error) {
    console.error("Error fetching dissolved partnerships:", error);
    return sendError(res, "Failed to fetch dissolved partnerships");
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
      return sendError(res, "Partnership ID is required", 400);
    }

    const partnership = await getDissolvedPartnershipById(id);

    if (!partnership) {
      return sendError(res, "Partnership not found", 404);
    }

    return sendSuccess(res, partnership);
  } catch (error) {
    console.error("Error fetching dissolved partnership:", error);
    return sendError(res, "Failed to fetch partnership");
  }
};
