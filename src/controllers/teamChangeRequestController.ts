/**
 * Team Change Request Controller
 * Handles HTTP requests for team change request operations
 */

import { Request, Response } from 'express';
import {
  createTeamChangeRequest,
  processTeamChangeRequest,
  getTeamChangeRequests,
  getTeamChangeRequestById,
  cancelTeamChangeRequest,
  getPendingTeamChangeRequestsCount
} from '../services/teamChangeRequestService';
import { TeamChangeRequestStatus } from '@prisma/client';
import { isAdmin } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Create a new team change request
 * POST /api/team-change-requests
 */
export const createRequest = async (req: Request, res: Response) => {
  try {
    const { userId, currentDivisionId, requestedDivisionId, seasonId, reason } = req.body;

    if (!userId || !currentDivisionId || !requestedDivisionId || !seasonId) {
      return sendError(res, 'Missing required fields: userId, currentDivisionId, requestedDivisionId, seasonId', 400);
    }

    const request = await createTeamChangeRequest({
      userId,
      currentDivisionId,
      requestedDivisionId,
      seasonId,
      reason
    });

    return sendSuccess(res, request, undefined, 201);
  } catch (error) {
    console.error('Error creating team change request:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to create team change request', 400);
  }
};

/**
 * Process a team change request (approve/deny)
 * PATCH /api/team-change-requests/:id/process
 */
export const processRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminId, adminNotes } = req.body;

    if (!id || !status || !adminId) {
      return sendError(res, 'Missing required fields: status, adminId', 400);
    }

    if (status !== 'APPROVED' && status !== 'DENIED') {
      return sendError(res, 'Status must be APPROVED or DENIED', 400);
    }

    const request = await processTeamChangeRequest({
      requestId: id,
      status,
      adminId,
      adminNotes
    });

    return sendSuccess(res, request);
  } catch (error) {
    console.error('Error processing team change request:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to process team change request', 400);
  }
};

/**
 * Get all team change requests with optional filters
 * GET /api/team-change-requests
 */
export const getRequests = async (req: Request, res: Response) => {
  try {
    const { seasonId, status, userId } = req.query;

    const filters: {
      seasonId?: string;
      status?: TeamChangeRequestStatus;
      userId?: string;
    } = {};

    if (seasonId && typeof seasonId === 'string') {
      filters.seasonId = seasonId;
    }

    if (status && typeof status === 'string') {
      filters.status = status as TeamChangeRequestStatus;
    }

    if (userId && typeof userId === 'string') {
      filters.userId = userId;
    }

    const requests = await getTeamChangeRequests(filters);

    return sendSuccess(res, requests);
  } catch (error) {
    console.error('Error fetching team change requests:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch team change requests');
  }
};

/**
 * Get a single team change request by ID
 * GET /api/team-change-requests/:id
 */
export const getRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Request ID is required', 400);
    }

    const request = await getTeamChangeRequestById(id);

    if (!request) {
      return sendError(res, 'Team change request not found', 404);
    }

    return sendSuccess(res, request);
  } catch (error) {
    console.error('Error fetching team change request:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch team change request');
  }
};

/**
 * Cancel a pending team change request
 * PATCH /api/team-change-requests/:id/cancel
 * User can cancel their own request, admin can cancel any request
 */
export const cancelRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user?.id;

    if (!id) {
      return sendError(res, 'Request ID is required', 400);
    }

    if (!authenticatedUserId) {
      return sendError(res, 'Authentication required', 401);
    }

    // Admin can cancel any request, users can only cancel their own
    const request = await cancelTeamChangeRequest(id, authenticatedUserId, isAdmin(req.user));

    return sendSuccess(res, request);
  } catch (error) {
    console.error('Error cancelling team change request:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to cancel team change request', 400);
  }
};

/**
 * Get pending team change requests count
 * GET /api/team-change-requests/count/pending
 */
export const getPendingCount = async (_req: Request, res: Response) => {
  try {
    const count = await getPendingTeamChangeRequestsCount();

    return sendSuccess(res, { count });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    return sendError(res, error instanceof Error ? error.message : 'Failed to fetch pending count');
  }
};
