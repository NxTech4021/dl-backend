import { Request, Response } from 'express';
import {
  sendGeneralPairRequest,
  acceptGeneralPairRequest,
  denyGeneralPairRequest,
  cancelGeneralPairRequest,
  getGeneralPairRequests,
  getGeneralPartnerships,
  dissolveGeneralPartnership
} from '../services/generalPairingService';

/**
 * POST /api/pairing/general/request
 * Send a general pair request
 */
export const sendGeneralPairRequestHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { recipientId, message } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }

    const result = await sendGeneralPairRequest({
      requesterId: userId,
      recipientId,
      message
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(201).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in sendGeneralPairRequestHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/pairing/general/request/:requestId/accept
 * Accept a general pair request
 */
export const acceptGeneralPairRequestHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const result = await acceptGeneralPairRequest(requestId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in acceptGeneralPairRequestHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/pairing/general/request/:requestId/deny
 * Deny a general pair request
 */
export const denyGeneralPairRequestHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const result = await denyGeneralPairRequest(requestId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error in denyGeneralPairRequestHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/pairing/general/request/:requestId
 * Cancel a general pair request
 */
export const cancelGeneralPairRequestHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const result = await cancelGeneralPairRequest(requestId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error in cancelGeneralPairRequestHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/pairing/general/requests
 * Get all general pair requests for a user
 */
export const getGeneralPairRequestsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await getGeneralPairRequests(userId);

    return res.status(200).json({ data: requests });
  } catch (error) {
    console.error('Error in getGeneralPairRequestsHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/pairing/general/partnerships
 * Get user's general partnerships
 */
export const getGeneralPartnershipsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const partnerships = await getGeneralPartnerships(userId);

    return res.status(200).json({ data: partnerships });
  } catch (error) {
    console.error('Error in getGeneralPartnershipsHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/pairing/general/partnership/:partnershipId/dissolve
 * Dissolve a general partnership
 */
export const dissolveGeneralPartnershipHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { partnershipId } = req.params;

    if (!partnershipId) {
      return res.status(400).json({ error: 'Partnership ID is required' });
    }

    const result = await dissolveGeneralPartnership(partnershipId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error in dissolveGeneralPartnershipHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
