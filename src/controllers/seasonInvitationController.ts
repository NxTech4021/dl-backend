import { Request, Response } from 'express';
import {
  sendSeasonInvitation,
  acceptSeasonInvitation,
  denySeasonInvitation,
  cancelSeasonInvitation,
  getSeasonInvitations,
  getPendingSeasonInvitation
} from '../services/seasonInvitationService';
import { sendSuccess, sendError } from '../utils/response';

/**
 * POST /api/pairing/season/invitation
 * Send a season invitation to a friend
 */
export const sendSeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { recipientId, seasonId, message } = req.body;

    if (!recipientId || !seasonId) {
      return sendError(res, 'Recipient ID and season ID are required', 400);
    }

    const result = await sendSeasonInvitation({
      senderId: userId,
      recipientId,
      seasonId,
      message
    });

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, result.data, result.message, 201);
  } catch (error) {
    console.error('Error in sendSeasonInvitationHandler:', error);
    return sendError(res, 'Internal server error');
  }
};

/**
 * POST /api/pairing/season/invitation/:invitationId/accept
 * Accept a season invitation
 */
export const acceptSeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return sendError(res, 'Invitation ID is required', 400);
    }

    const result = await acceptSeasonInvitation(invitationId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('Error in acceptSeasonInvitationHandler:', error);
    return sendError(res, 'Internal server error');
  }
};

/**
 * POST /api/pairing/season/invitation/:invitationId/deny
 * Deny a season invitation
 */
export const denySeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return sendError(res, 'Invitation ID is required', 400);
    }

    const result = await denySeasonInvitation(invitationId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('Error in denySeasonInvitationHandler:', error);
    return sendError(res, 'Internal server error');
  }
};

/**
 * DELETE /api/pairing/season/invitation/:invitationId
 * Cancel a season invitation
 */
export const cancelSeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return sendError(res, 'Invitation ID is required', 400);
    }

    const result = await cancelSeasonInvitation(invitationId, userId);

    if (!result.success) {
      return sendError(res, result.message, 400);
    }

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('Error in cancelSeasonInvitationHandler:', error);
    return sendError(res, 'Internal server error');
  }
};

/**
 * GET /api/pairing/season/invitations
 * Get all season invitations for a user
 */
export const getSeasonInvitationsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const invitations = await getSeasonInvitations(userId);

    return sendSuccess(res, invitations);
  } catch (error) {
    console.error('Error in getSeasonInvitationsHandler:', error);
    return sendError(res, 'Internal server error');
  }
};

/**
 * GET /api/pairing/season/invitation/pending/:seasonId
 * Get pending season invitation for a specific season
 */
export const getPendingSeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { seasonId } = req.params;

    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    const invitation = await getPendingSeasonInvitation(userId, seasonId);

    return sendSuccess(res, invitation);
  } catch (error) {
    console.error('Error in getPendingSeasonInvitationHandler:', error);
    return sendError(res, 'Internal server error');
  }
};
