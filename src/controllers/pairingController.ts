import { Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  sendPairRequest as sendPairRequestService,
  acceptPairRequest as acceptPairRequestService,
  denyPairRequest as denyPairRequestService,
  cancelPairRequest as cancelPairRequestService,
  getPairRequests as getPairRequestsService,
  getUserPartnerships as getUserPartnershipsService,
} from '../services/pairingService';

/**
 * Send a pair request to another player
 * POST /api/pairing/request
 * Body: { recipientId: string, seasonId: string, message?: string }
 */
export const sendPairRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recipientId, seasonId, message } = req.body;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!recipientId || !seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'recipientId and seasonId are required')
      );
    }

    const result = await sendPairRequestService({
      requesterId: userId,
      recipientId,
      seasonId,
      message,
    });

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(201).json(
      new ApiResponse(true, 201, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in sendPairRequest controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to send pair request')
    );
  }
};

/**
 * Accept a pair request
 * POST /api/pairing/request/:requestId/accept
 */
export const acceptPairRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!requestId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'requestId is required')
      );
    }

    const result = await acceptPairRequestService(requestId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in acceptPairRequest controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to accept pair request')
    );
  }
};

/**
 * Deny a pair request
 * POST /api/pairing/request/:requestId/deny
 */
export const denyPairRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!requestId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'requestId is required')
      );
    }

    const result = await denyPairRequestService(requestId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in denyPairRequest controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to deny pair request')
    );
  }
};

/**
 * Cancel a pair request (by requester)
 * DELETE /api/pairing/request/:requestId
 */
export const cancelPairRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!requestId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'requestId is required')
      );
    }

    const result = await cancelPairRequestService(requestId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in cancelPairRequest controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to cancel pair request')
    );
  }
};

/**
 * Get all pair requests for the authenticated user
 * GET /api/pairing/requests
 */
export const getPairRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    const requests = await getPairRequestsService(userId);

    return res.status(200).json(
      new ApiResponse(true, 200, requests, 'Pair requests retrieved successfully')
    );
  } catch (error) {
    console.error('Error in getPairRequests controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get pair requests')
    );
  }
};

/**
 * Get user's partnerships
 * GET /api/pairing/partnerships
 */
export const getUserPartnerships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    const partnerships = await getUserPartnershipsService(userId);

    return res.status(200).json(
      new ApiResponse(true, 200, partnerships, 'Partnerships retrieved successfully')
    );
  } catch (error) {
    console.error('Error in getUserPartnerships controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get partnerships')
    );
  }
};
