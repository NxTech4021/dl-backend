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

/**
 * Create a new team change request
 * POST /api/team-change-requests
 */
export const createRequest = async (req: Request, res: Response) => {
  try {
    const { userId, currentDivisionId, requestedDivisionId, seasonId, reason } = req.body;

    if (!userId || !currentDivisionId || !requestedDivisionId || !seasonId) {
      return res.status(400).json({
        error: 'Missing required fields: userId, currentDivisionId, requestedDivisionId, seasonId'
      });
    }

    const request = await createTeamChangeRequest({
      userId,
      currentDivisionId,
      requestedDivisionId,
      seasonId,
      reason
    });

    return res.status(201).json(request);
  } catch (error) {
    console.error('Error creating team change request:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create team change request'
    });
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
      return res.status(400).json({
        error: 'Missing required fields: status, adminId'
      });
    }

    if (status !== 'APPROVED' && status !== 'DENIED') {
      return res.status(400).json({
        error: 'Status must be APPROVED or DENIED'
      });
    }

    const request = await processTeamChangeRequest({
      requestId: id,
      status,
      adminId,
      adminNotes
    });

    return res.status(200).json(request);
  } catch (error) {
    console.error('Error processing team change request:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to process team change request'
    });
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

    return res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching team change requests:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch team change requests'
    });
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
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const request = await getTeamChangeRequestById(id);

    if (!request) {
      return res.status(404).json({ error: 'Team change request not found' });
    }

    return res.status(200).json(request);
  } catch (error) {
    console.error('Error fetching team change request:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch team change request'
    });
  }
};

/**
 * Cancel a pending team change request
 * PATCH /api/team-change-requests/:id/cancel
 */
export const cancelRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id || !userId) {
      return res.status(400).json({ error: 'Request ID and userId are required' });
    }

    const request = await cancelTeamChangeRequest(id, userId);

    return res.status(200).json(request);
  } catch (error) {
    console.error('Error cancelling team change request:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to cancel team change request'
    });
  }
};

/**
 * Get pending team change requests count
 * GET /api/team-change-requests/count/pending
 */
export const getPendingCount = async (_req: Request, res: Response) => {
  try {
    const count = await getPendingTeamChangeRequestsCount();

    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch pending count'
    });
  }
};
