/**
 * Match Invitation Controller
 * Handles HTTP requests for match creation, invitations, and scheduling
 */

import { Request, Response } from 'express';
import { getMatchInvitationService } from '../../services/match/matchInvitationService';
import { MatchType, MatchFormat, MatchStatus, MembershipStatus, ParticipantRole, InvitationStatus, JoinRequestStatus, MessageType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_TYPES } from '../../types/notificationTypes';

const matchInvitationService = getMatchInvitationService();
const notificationService = new NotificationService();

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
      courtBooked,
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
      courtBooked,
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
      format,
      venue,
      location,
      userId,
      excludeUserId,
      fromDate,
      toDate,
      hasOpenSlots,
      friendsOnly,
      favoritesOnly,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      hasOpenSlots: hasOpenSlots === 'true',
      friendsOnly: friendsOnly === 'true',
      favoritesOnly: favoritesOnly === 'true'
    };
    if (divisionId) filters.divisionId = divisionId as string;
    if (seasonId) filters.seasonId = seasonId as string;
    if (status) filters.status = status as MatchStatus;
    if (matchType) filters.matchType = matchType as MatchType;
    if (format) filters.format = format as MatchFormat;
    if (venue) filters.venue = venue as string;
    if (location) filters.location = location as string;
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
 * Supports optional query filters: format, venue, location, fromDate, toDate, friendsOnly, favoritesOnly, page, limit
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

    const {
      format,
      venue,
      location,
      fromDate,
      toDate,
      friendsOnly,
      favoritesOnly,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {};
    if (format) filters.format = format as MatchFormat;
    if (venue) filters.venue = venue as string;
    if (location) filters.location = location as string;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);
    if (friendsOnly === 'true') filters.friendsOnly = true;
    if (favoritesOnly === 'true') filters.favoritesOnly = true;

    const result = await matchInvitationService.getAvailableMatches(
      userId,
      divisionId,
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json(result);
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
 * Edit a match (only for DRAFT status matches)
 * PUT /api/matches/:id/edit
 */
export const editMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const {
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

    const match = await matchInvitationService.editMatch(id, userId, {
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

    res.json(match);
  } catch (error) {
    console.error('Edit Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit match';
    res.status(400).json({ error: message });
  }
};

/**
 * Post a match to division group chat
 * POST /api/matches/:id/post-to-chat
 */
export const postMatchToChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: matchId } = req.params;

    // 1. Get match details
    const match = await matchInvitationService.getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // 2. Verify user is match creator
    if (match.createdById !== userId) {
      return res.status(403).json({ error: 'Only match creator can post to chat' });
    }

    // 3. Get division thread
    const thread = await prisma.thread.findFirst({
      where: { divisionId: match.divisionId, isGroup: true }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Division chat not found' });
    }

    // 4. Create match post message
    const matchData = {
      matchType: match.matchType,
      format: match.format,
      location: match.location,
      venue: match.venue,
      proposedTimes: match.timeSlots?.map(ts => ts.proposedTime),
      notes: match.notes
    };

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        messageType: MessageType.MATCH_POST,
        matchId,
        matchData,
        content: `🎾 New ${match.matchType.toLowerCase()} match available! Tap to join.`
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, image: true }
        },
        match: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      }
    });

    // 5. Emit Socket.IO event to division chat
    const io = req.app.get('io');
    if (io) {
      io.to(thread.id).emit('new_message', {
        threadId: thread.id,
        message
      });
    }

    // 6. Notify division members
    const divisionMembers = await prisma.divisionAssignment.findMany({
      where: {
        divisionId: match.divisionId!,
        status: MembershipStatus.ACTIVE,
        userId: { not: userId }
      },
      select: { userId: true }
    });

    if (divisionMembers.length > 0) {
      await notificationService.createNotification({
        type: NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
        category: 'MATCH',
        title: 'New Match Available',
        message: `${match.createdBy?.name} posted a ${match.matchType.toLowerCase()} match in your division`,
        userIds: divisionMembers.map(m => m.userId),
        matchId,
        divisionId: match.divisionId,
        threadId: thread.id
      });
    }

    res.json({ message, threadId: thread.id });
  } catch (error) {
    console.error('Post Match to Chat Error:', error);
    res.status(500).json({ error: 'Failed to post match to chat' });
  }
};

/**
 * Request to join a match
 * POST /api/matches/:id/join-request
 */
export const requestToJoinMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: matchId } = req.params;
    const { message } = req.body;

    // 1. Get match
    const match = await matchInvitationService.getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // 2. Verify user is in same division
    const divisionMember = await prisma.divisionAssignment.findFirst({
      where: {
        divisionId: match.divisionId!,
        userId,
        status: MembershipStatus.ACTIVE
      }
    });

    if (!divisionMember) {
      return res.status(403).json({ error: 'You are not a member of this division' });
    }

    // 3. Check if already requested
    const existingRequest = await prisma.matchJoinRequest.findUnique({
      where: {
        matchId_requesterId: { matchId, requesterId: userId }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'You already requested to join this match' });
    }

    // 4. Create join request
    const joinRequest = await prisma.matchJoinRequest.create({
      data: {
        matchId,
        requesterId: userId,
        message
      },
      include: {
        requester: {
          select: { id: true, name: true, username: true, image: true }
        }
      }
    });

    // 5. Notify match creator
    if (match.createdById) {
      await notificationService.createNotification({
        type: NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST,
        category: 'MATCH',
        title: 'Join Request Received',
        message: `${joinRequest.requester.name} wants to join your match`,
        userIds: [match.createdById],
        matchId
      });
    }

    res.status(201).json(joinRequest);
  } catch (error) {
    console.error('Request to Join Match Error:', error);
    res.status(500).json({ error: 'Failed to request join' });
  }
};

/**
 * Approve or deny a join request
 * POST /api/matches/join-requests/:requestId/respond
 */
export const respondToJoinRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { requestId } = req.params;
    const { approve, declineReason } = req.body;

    if (typeof approve !== 'boolean') {
      return res.status(400).json({ error: 'approve (boolean) is required' });
    }

    // 1. Get join request
    const joinRequest = await prisma.matchJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        match: {
          include: {
            participants: true
          }
        },
        requester: {
          select: { id: true, name: true }
        }
      }
    });

    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    // 2. Verify user is match creator
    if (joinRequest.match.createdById !== userId) {
      return res.status(403).json({ error: 'Only match creator can respond to join requests' });
    }

    // 3. Check if request already responded
    if (joinRequest.status !== JoinRequestStatus.PENDING) {
      return res.status(400).json({ error: 'Request already responded to' });
    }

    // 4. Update join request
    await prisma.matchJoinRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? JoinRequestStatus.APPROVED : JoinRequestStatus.DENIED,
        respondedAt: new Date(),
        respondedBy: userId,
        declineReason: approve ? undefined : declineReason
      }
    });

    if (approve) {
      // 5. Add player as opponent/partner
      const role = joinRequest.match.matchType === MatchType.SINGLES
        ? ParticipantRole.OPPONENT
        : ParticipantRole.PARTNER;

      await prisma.matchParticipant.create({
        data: {
          matchId: joinRequest.matchId,
          userId: joinRequest.requesterId,
          role,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          team: role === ParticipantRole.OPPONENT ? 'team2' : 'team1'
        }
      });

      // Notify requester - approved
      await notificationService.createNotification({
        type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED,
        category: 'MATCH',
        title: 'Join Request Approved',
        message: `Your request to join the match has been approved!`,
        userIds: [joinRequest.requesterId],
        matchId: joinRequest.matchId
      });
    } else {
      // Notify requester - denied
      await notificationService.createNotification({
        type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED,
        category: 'MATCH',
        title: 'Join Request Declined',
        message: declineReason || 'Your request to join the match was declined',
        userIds: [joinRequest.requesterId],
        matchId: joinRequest.matchId
      });
    }

    res.json({ success: true, approved: approve });
  } catch (error) {
    console.error('Respond to Join Request Error:', error);
    res.status(500).json({ error: 'Failed to respond to join request' });
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

/**
 * Get invitation by ID
 * GET /api/matches/invitations/:id
 */
export const getInvitationById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Invitation ID is required' });
    }

    const invitation = await matchInvitationService.getInvitationById(id, userId);
    res.json(invitation);
  } catch (error) {
    console.error('Get Invitation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get invitation';
    const status = error instanceof Error && error.message.includes('not authorized') ? 403 : 404;
    res.status(status).json({ error: message });
  }
};

/**
 * Get pending invitations for current user
 * GET /api/matches/invitations/pending
 */
export const getPendingInvitations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const invitations = await matchInvitationService.getPendingInvitations(userId);
    res.json(invitations);
  } catch (error) {
    console.error('Get Pending Invitations Error:', error);
    res.status(500).json({ error: 'Failed to get pending invitations' });
  }
};
