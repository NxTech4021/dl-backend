import { Request, Response } from 'express';
import {
  sendSeasonInvitation,
  acceptSeasonInvitation,
  denySeasonInvitation,
  cancelSeasonInvitation,
  getSeasonInvitations,
  getPendingSeasonInvitation
} from '../services/seasonInvitationService';

/**
 * POST /api/pairing/season/invitation
 * Send a season invitation to a friend
 */
export const sendSeasonInvitationHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { recipientId, seasonId, message } = req.body;

    if (!recipientId || !seasonId) {
      return res.status(400).json({
        error: 'Recipient ID and season ID are required'
      });
    }

    const result = await sendSeasonInvitation({
      senderId: userId,
      recipientId,
      seasonId,
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
    console.error('Error in sendSeasonInvitationHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID is required' });
    }

    const result = await acceptSeasonInvitation(invitationId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in acceptSeasonInvitationHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID is required' });
    }

    const result = await denySeasonInvitation(invitationId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error in denySeasonInvitationHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId } = req.params;

    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID is required' });
    }

    const result = await cancelSeasonInvitation(invitationId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error in cancelSeasonInvitationHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invitations = await getSeasonInvitations(userId);

    return res.status(200).json({ data: invitations });
  } catch (error) {
    console.error('Error in getSeasonInvitationsHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { seasonId } = req.params;

    if (!seasonId) {
      return res.status(400).json({ error: 'Season ID is required' });
    }

    const invitation = await getPendingSeasonInvitation(userId, seasonId);

    return res.status(200).json({ data: invitation });
  } catch (error) {
    console.error('Error in getPendingSeasonInvitationHandler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
