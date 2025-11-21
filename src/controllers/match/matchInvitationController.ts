/**
 * Match Invitation Controller
 * Handles HTTP requests for match creation, invitations, and scheduling
 */

import { Request, Response } from 'express';
import { getMatchInvitationService } from '../../services/match/matchInvitationService';
import { MatchType, MatchFormat, MatchStatus } from '@prisma/client';

const matchInvitationService = getMatchInvitationService();

/**
 * Create a new match with optional challenge
 * POST /api/matches/create
 */
export const createMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      divisionId,
      matchType,
      format,
      opponentId,
      partnerId,
      opponentPartnerId,
      proposedTimes,
      location,
      venue,
      notes,
      message,
      expiresInHours
    } = req.body;

    if (!divisionId) {
      return res.status(400).json({ error: 'divisionId is required' });
    }

    if (!matchType || !['SINGLES', 'DOUBLES'].includes(matchType)) {
      return res.status(400).json({ error: 'Valid matchType (SINGLES/DOUBLES) is required' });
    }

    const match = await matchInvitationService.createMatch({
      createdById: userId,
      divisionId,
      matchType: matchType as MatchType,
      format: format as MatchFormat,
      opponentId,
      partnerId,
      opponentPartnerId,
      proposedTimes: proposedTimes?.map((t: string) => new Date(t)),
      location,
      venue,
      notes,
      message,
      expiresInHours
    });

    res.status(201).json(match);
  } catch (error) {
    console.error('Create Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create match';
    res.status(400).json({ error: message });
  }
};

/**
 * Get matches with filters
 * GET /api/matches
 */
export const getMatches = async (req: Request, res: Response) => {
  try {
    const {
      divisionId,
      seasonId,
      status,
      matchType,
      userId,
      excludeUserId,
      fromDate,
      toDate,
      hasOpenSlots,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      hasOpenSlots: hasOpenSlots === 'true'
    };
    if (divisionId) filters.divisionId = divisionId as string;
    if (seasonId) filters.seasonId = seasonId as string;
    if (status) filters.status = status as MatchStatus;
    if (matchType) filters.matchType = matchType as MatchType;
    if (userId) filters.userId = userId as string;
    if (excludeUserId) filters.excludeUserId = excludeUserId as string;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);

    const result = await matchInvitationService.getMatches(
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error) {
    console.error('Get Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve matches' });
  }
};

/**
 * Get match by ID
 * GET /api/matches/:id
 */
export const getMatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await matchInvitationService.getMatchById(id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(match);
  } catch (error) {
    console.error('Get Match By ID Error:', error);
    res.status(500).json({ error: 'Failed to retrieve match' });
  }
};

/**
 * Get available matches to join in a division
 * GET /api/matches/available/:divisionId
 */
export const getAvailableMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { divisionId } = req.params;
    if (!divisionId) {
      return res.status(400).json({ error: 'divisionId is required' });
    }

    const matches = await matchInvitationService.getAvailableMatches(userId, divisionId);
    res.json(matches);
  } catch (error) {
    console.error('Get Available Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve available matches' });
  }
};

/**
 * Get my matches (as participant)
 * GET /api/matches/my
 */
export const getMyMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { status, page = '1', limit = '20' } = req.query;

    const result = await matchInvitationService.getMatches(
      {
        userId,
        status: status as MatchStatus
      },
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error) {
    console.error('Get My Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve your matches' });
  }
};

/**
 * Join an available match
 * POST /api/matches/:id/join
 */
export const joinMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { asPartner = false } = req.body;

    const match = await matchInvitationService.joinMatch(id, userId, asPartner);
    res.json(match);
  } catch (error) {
    console.error('Join Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to join match';
    res.status(400).json({ error: message });
  }
};

/**
 * Respond to match invitation
 * POST /api/matches/invitations/:id/respond
 */
export const respondToInvitation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Invitation ID is required' });
    }

    const { accept, declineReason } = req.body;

    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'accept (boolean) is required' });
    }

    const match = await matchInvitationService.respondToInvitation({
      invitationId: id,
      userId,
      accept,
      declineReason
    });

    res.json(match);
  } catch (error) {
    console.error('Respond to Invitation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to respond to invitation';
    res.status(400).json({ error: message });
  }
};

/**
 * Propose a time slot
 * POST /api/matches/:id/timeslots
 */
export const proposeTimeSlot = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { proposedTime, location, notes } = req.body;

    if (!proposedTime) {
      return res.status(400).json({ error: 'proposedTime is required' });
    }

    const timeSlot = await matchInvitationService.proposeTimeSlot({
      matchId: id,
      proposedById: userId,
      proposedTime: new Date(proposedTime),
      location,
      notes
    });

    res.status(201).json(timeSlot);
  } catch (error) {
    console.error('Propose Time Slot Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to propose time slot';
    res.status(400).json({ error: message });
  }
};

/**
 * Vote for a time slot
 * POST /api/matches/timeslots/:id/vote
 */
export const voteForTimeSlot = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Time slot ID is required' });
    }

    const timeSlot = await matchInvitationService.voteForTimeSlot({
      timeSlotId: id,
      userId
    });

    res.json(timeSlot);
  } catch (error) {
    console.error('Vote Time Slot Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to vote for time slot';
    res.status(400).json({ error: message });
  }
};

/**
 * Confirm a time slot (manual confirmation)
 * POST /api/matches/timeslots/:id/confirm
 */
export const confirmTimeSlot = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Time slot ID is required' });
    }

    const match = await matchInvitationService.confirmTimeSlot(id);
    res.json(match);
  } catch (error) {
    console.error('Confirm Time Slot Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm time slot';
    res.status(400).json({ error: message });
  }
};
