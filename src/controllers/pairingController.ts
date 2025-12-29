import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
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
export const acceptPairRequest = async (req: Request, res: Response) => {
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
export const denyPairRequest = async (req: Request, res: Response) => {
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
export const cancelPairRequest = async (req: Request, res: Response) => {
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
export const getPairRequests = async (req: Request, res: Response) => {
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
export const getUserPartnerships = async (req: Request, res: Response) => {
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

/**
 * Dissolve a partnership
 * POST /api/pairing/partnership/:partnershipId/dissolve
 */
export const dissolvePartnership = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { partnershipId } = req.params;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!partnershipId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'partnershipId is required')
      );
    }

    const result = await dissolvePartnershipService(partnershipId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in dissolvePartnership controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to dissolve partnership')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!partnershipId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'partnershipId is required')
      );
    }

    const result = await getPartnershipStatusService(partnershipId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    // Disable caching to ensure fresh status data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, 'Partnership status retrieved successfully')
    );
  } catch (error) {
    console.error('Error in getPartnershipStatus controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get partnership status')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'seasonId is required')
      );
    }

    const partnership = await getActivePartnershipService(userId, seasonId);

    // Disable caching to ensure fresh partnership data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(
      new ApiResponse(true, 200, partnership, 'Active partnership retrieved successfully')
    );
  } catch (error) {
    console.error('Error in getActivePartnership controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get active partnership')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!partnershipId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'partnershipId is required')
      );
    }

    if (!recipientId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'recipientId is required')
      );
    }

    const result = await inviteReplacementPartnerService(
      partnershipId,
      userId,
      recipientId,
      message
    );

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(201).json(
      new ApiResponse(true, 201, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in inviteReplacementPartner controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to invite replacement partner')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!requestId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'requestId is required')
      );
    }

    const result = await acceptReplacementInviteService(requestId, userId);

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in acceptReplacementInvite controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to accept replacement invitation')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    if (!partnershipId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'partnershipId is required')
      );
    }

    const result = await getEligibleReplacementPartnersService(
      userId,
      partnershipId,
      searchQuery
    );

    if (!result.success) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, result.message)
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result.data, result.message)
    );
  } catch (error) {
    console.error('Error in getEligibleReplacementPartners controller:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get eligible partners')
    );
  }
};
