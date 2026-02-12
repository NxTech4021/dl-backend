import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { logPairingActivity } from '../services/userActivityLogService';
import { UserActionType } from '@prisma/client';
import {
  sendPairRequest as sendPairRequestService,
  acceptPairRequest as acceptPairRequestService,
  denyPairRequest as denyPairRequestService,
  cancelPairRequest as cancelPairRequestService,
  getPairRequests as getPairRequestsService,
  getUserPartnerships as getUserPartnershipsService,
  dissolvePartnership as dissolvePartnershipService,
  getActivePartnership as getActivePartnershipService,
  getPartnershipStatus as getPartnershipStatusService,
  inviteReplacementPartner as inviteReplacementPartnerService,
  acceptReplacementInvite as acceptReplacementInviteService,
  getEligibleReplacementPartners as getEligibleReplacementPartnersService,
} from '../services/pairingService';

/**
 * Send a pair request to another player
 * POST /api/pairing/request
 * Body: { recipientId: string, seasonId: string, message?: string }
 */
export const sendPairRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recipientId, seasonId, message } = req.body;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!recipientId || !seasonId) {
      return sendError(res, 'recipientId and seasonId are required', 400);
    }

    const result = await sendPairRequestService({
      requesterId: userId,
      recipientId,
      seasonId,
      message,
    });

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    void logPairingActivity(userId, UserActionType.PAIR_REQUEST_SEND, result.data?.id ?? '', { recipientId, seasonId }, req.ip);

    return sendSuccess(res, result.data, result.message, 201);
  } catch (error) {
    console.error('Error in sendPairRequest controller:', error);
    return sendError(res, 'Failed to send pair request', 500);
  }
};

/**
 * Accept a pair request
 * POST /api/pairing/request/:requestId/accept
 */
export const acceptPairRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    const result = await acceptPairRequestService(requestId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    void logPairingActivity(userId, UserActionType.PAIR_REQUEST_ACCEPT, requestId, {}, req.ip);

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in acceptPairRequest controller:', error);
    return sendError(res, 'Failed to accept pair request', 500);
  }
};

/**
 * Deny a pair request
 * POST /api/pairing/request/:requestId/deny
 */
export const denyPairRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    const result = await denyPairRequestService(requestId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    void logPairingActivity(userId, UserActionType.PAIR_REQUEST_DENY, requestId, {}, req.ip);

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in denyPairRequest controller:', error);
    return sendError(res, 'Failed to deny pair request', 500);
  }
};

/**
 * Cancel a pair request (by requester)
 * DELETE /api/pairing/request/:requestId
 */
export const cancelPairRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    const result = await cancelPairRequestService(requestId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in cancelPairRequest controller:', error);
    return sendError(res, 'Failed to cancel pair request', 500);
  }
};

/**
 * Get all pair requests for the authenticated user
 * GET /api/pairing/requests
 */
export const getPairRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const requests = await getPairRequestsService(userId);

    return sendSuccess(res, requests, 'Pair requests retrieved successfully');
  } catch (error) {
    console.error('Error in getPairRequests controller:', error);
    return sendError(res, 'Failed to get pair requests', 500);
  }
};

/**
 * Get user's partnerships
 * GET /api/pairing/partnerships
 */
export const getUserPartnerships = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const partnerships = await getUserPartnershipsService(userId);

    return sendSuccess(res, partnerships, 'Partnerships retrieved successfully');
  } catch (error) {
    console.error('Error in getUserPartnerships controller:', error);
    return sendError(res, 'Failed to get partnerships', 500);
  }
};

/**
 * Dissolve a partnership
 * POST /api/pairing/partnership/:partnershipId/dissolve
 */
export const dissolvePartnership = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partnershipId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!partnershipId) {
      return sendError(res, 'partnershipId is required', 400);
    }

    const result = await dissolvePartnershipService(partnershipId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in dissolvePartnership controller:', error);
    return sendError(res, 'Failed to dissolve partnership', 500);
  }
};

/**
 * Get partnership status (pending requests from both partners)
 * GET /api/pairing/partnership/:partnershipId/status
 */
export const getPartnershipStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partnershipId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!partnershipId) {
      return sendError(res, 'partnershipId is required', 400);
    }

    const result = await getPartnershipStatusService(partnershipId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    // Disable caching to ensure fresh status data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return sendSuccess(res, result.data, 'Partnership status retrieved successfully');
  } catch (error) {
    console.error('Error in getPartnershipStatus controller:', error);
    return sendError(res, 'Failed to get partnership status', 500);
  }
};

/**
 * Get active partnership for a season
 * GET /api/pairing/partnership/active/:seasonId
 */
export const getActivePartnership = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { seasonId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!seasonId) {
      return sendError(res, 'seasonId is required', 400);
    }

    const partnership = await getActivePartnershipService(userId, seasonId);

    // Disable caching to ensure fresh partnership data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return sendSuccess(res, partnership, 'Active partnership retrieved successfully');
  } catch (error) {
    console.error('Error in getActivePartnership controller:', error);
    return sendError(res, 'Failed to get active partnership', 500);
  }
};

// ==========================================
// PARTNER REPLACEMENT CONTROLLERS
// ==========================================

/**
 * Invite a replacement partner for INCOMPLETE partnership
 * POST /api/pairing/partnership/:partnershipId/invite-replacement
 * Body: { recipientId: string, message?: string }
 */
export const inviteReplacementPartner = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partnershipId } = req.params;
    const { recipientId, message } = req.body;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!partnershipId) {
      return sendError(res, 'partnershipId is required', 400);
    }

    if (!recipientId) {
      return sendError(res, 'recipientId is required', 400);
    }

    const result = await inviteReplacementPartnerService(
      partnershipId,
      userId,
      recipientId,
      message
    );

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    void logPairingActivity(userId, UserActionType.PAIR_REQUEST_SEND, partnershipId, { isReplacement: true }, req.ip);

    return sendSuccess(res, result.data, result.message, 201);
  } catch (error) {
    console.error('Error in inviteReplacementPartner controller:', error);
    return sendError(res, 'Failed to invite replacement partner', 500);
  }
};

/**
 * Accept a replacement partner invitation
 * POST /api/pairing/partnership/:partnershipId/accept-replacement/:requestId
 */
export const acceptReplacementInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { requestId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    const result = await acceptReplacementInviteService(requestId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    void logPairingActivity(userId, UserActionType.PAIR_REQUEST_ACCEPT, requestId, {}, req.ip);

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in acceptReplacementInvite controller:', error);
    return sendError(res, 'Failed to accept replacement invitation', 500);
  }
};

/**
 * Get eligible replacement partners for INCOMPLETE partnership
 * GET /api/pairing/partnership/:partnershipId/eligible-partners?q=searchQuery
 */
export const getEligibleReplacementPartners = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partnershipId } = req.params;
    const searchQuery = req.query.q as string | undefined;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!partnershipId) {
      return sendError(res, 'partnershipId is required', 400);
    }

    const result = await getEligibleReplacementPartnersService(
      userId,
      partnershipId,
      searchQuery
    );

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in getEligibleReplacementPartners controller:', error);
    return sendError(res, 'Failed to get eligible partners', 500);
  }
};
