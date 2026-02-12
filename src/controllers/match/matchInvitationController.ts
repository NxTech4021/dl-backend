/**
 * Match Invitation Controller
 * Handles HTTP requests for match creation, invitations, and scheduling
 */

import { Request, Response } from 'express';
import { getMatchInvitationService } from '../../services/match/matchInvitationService';
import { MatchType, MatchFormat, MatchStatus, MembershipStatus, ParticipantRole, InvitationStatus, JoinRequestStatus, MessageType, UserActionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_TYPES } from '../../types/notificationTypes';
import { matchManagementNotifications } from '../../helpers/notifications/matchManagementNotifications';
import { sendSuccess, sendError } from '../../utils/response';
import { logMatchActivity } from '../../services/userActivityLogService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Helper function to format date for notifications
 */
const formatDate = (date: Date): string => {
  return dayjs(date).format('MMM D, YYYY');
};

/**
 * Helper function to format time for notifications
 */
const formatTime = (date: Date): string => {
  return dayjs(date).format('h:mm A');
};

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
      return sendError(res, 'Authentication required', 401);
    }

    const {
      divisionId,
      matchType,
      format,
      opponentId,
      partnerId,
      opponentPartnerId,
      matchDate,           // Naive datetime string (user's selected time)
      deviceTimezone,      // User's device timezone (e.g., "Asia/Dhaka", "Europe/London")
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      message,
      expiresInHours
    } = req.body;

    if (!divisionId) {
      return sendError(res, 'divisionId is required', 400);
    }

    if (!matchType || !['SINGLES', 'DOUBLES'].includes(matchType)) {
      return sendError(res, 'Valid matchType (SINGLES/DOUBLES) is required', 400);
    }

    // TIMEZONE CONVERSION: Convert from device timezone to Malaysia timezone
    let parsedMatchDate: Date | undefined;
    if (matchDate) {
      if (deviceTimezone && deviceTimezone !== 'Asia/Kuala_Lumpur') {
        // User is NOT in Malaysia - convert their local time to Malaysia time
        const deviceTime = dayjs.tz(matchDate, deviceTimezone);
        const malaysiaTime = deviceTime.tz('Asia/Kuala_Lumpur');
        parsedMatchDate = malaysiaTime.toDate();
        
        console.log('🌏 TIMEZONE CONVERSION - User Outside Malaysia:', {
          userTimezone: deviceTimezone,
          userSelectedTime: deviceTime.format('YYYY-MM-DD HH:mm (GMT Z)'),
          malaysiaEquivalent: malaysiaTime.format('YYYY-MM-DD HH:mm (GMT+8)'),
          storedUTC: parsedMatchDate.toISOString(),
          explanation: `User selected ${deviceTime.format('h:mm A')} in ${deviceTimezone}, stored as ${malaysiaTime.format('h:mm A')} Malaysia time`
        });
      } else {
        // User is in Malaysia OR no timezone provided (fallback to treating as Malaysia time)
        const malaysiaTime = dayjs.tz(matchDate, 'Asia/Kuala_Lumpur');
        parsedMatchDate = malaysiaTime.toDate();
        
        console.log('🕐 TIMEZONE CONVERSION - Malaysia User or Fallback:', {
          receivedString: matchDate,
          interpretedAs: 'Malaysia Time (GMT+8)',
          malaysiaDateTime: malaysiaTime.format('YYYY-MM-DD HH:mm (GMT+8)'),
          storedUTC: parsedMatchDate.toISOString()
        });
      }
    }

    // COMMENTED OUT - Complex time parsing
    // const parsedTimes = proposedTimes?.map((t: string) => {
    //   const malaysiaDayjs = dayjs.tz(t, 'Asia/Kuala_Lumpur');
    //   return malaysiaDayjs.toDate();
    // });

    const match = await matchInvitationService.createMatch({
      createdById: userId,
      divisionId,
      matchType: matchType as MatchType,
      format: format as MatchFormat,
      opponentId,
      partnerId,
      opponentPartnerId,
      ...(parsedMatchDate && { matchDate: parsedMatchDate }),
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      message,
      expiresInHours
    });

    if (!match) {
      return sendError(res, 'Failed to create match');
    }

    console.log('🎯 [Match Creation] Match created, sending division notifications...', {
      matchId: match.id,
      divisionId,
      userId
    });

    // Send notifications to all division members (group chat)
    try {
      if (divisionId && userId) {
        // Get all members in the division (group chat members)
        const divisionAssignments = await prisma.divisionAssignment.findMany({
          where: { 
            divisionId
          },
          select: { userId: true }
        });
        
        // Exclude the creator from notifications
        const divisionMembers = divisionAssignments
          .map(a => a.userId)
          .filter(id => id !== userId);
        
        console.log('🔔 [Match Creation] Division group chat notification:', {
          matchId: match.id,
          divisionId,
          creatorId: userId,
          totalDivisionMembers: divisionAssignments.length,
          notificationRecipients: divisionMembers.length
        });
        
        if (divisionMembers.length > 0) {
          // Get creator name and full match details with date
          const creator = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
          });

          // Get the full match with date to ensure we have the correct data
          const fullMatch = await prisma.match.findUnique({
            where: { id: match.id },
            select: { 
              matchDate: true, 
              venue: true, 
              location: true 
            }
          });

          if (fullMatch && fullMatch.matchDate) {
            const notification = matchManagementNotifications.opponentPostedLeagueMatch(
              creator?.name || 'A player',
              formatDate(fullMatch.matchDate),
              formatTime(fullMatch.matchDate),
              fullMatch.venue || fullMatch.location || 'TBD'
            );
            
            console.log('📤 [Match Creation] Sending push notification to division:', {
              type: notification.type,
              category: notification.category,
              recipientCount: divisionMembers.length,
              message: notification.message
            });
            
            // Don't pass divisionId - notification is linked via match->division relation
            await notificationService.createNotification({
              ...notification,
              userIds: divisionMembers,
              matchId: match.id,
            });
            
            console.log('✅ [Match Creation] Push notification sent to division members');
          } else {
            console.log('⚠️ [Match Creation] Match date not available, skipping notification');
          }
        } else {
          console.log('⚠️ [Match Creation] No other division members to notify (creator is only member)');
        }
      } else {
        console.log('⚠️ [Match Creation] Missing divisionId or userId:', {
          divisionId,
          userId
        });
      }
    } catch (notifError) {
      console.error('❌ [Match Creation] Failed to send division notification:', notifError);
      // Don't fail the request if notification fails
    }


    void logMatchActivity(userId, UserActionType.MATCH_CREATE, match.id, { matchType }, req.ip);

    sendSuccess(res, match, undefined, 201);
  } catch (error) {
    console.error('Create Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create match';
    sendError(res, message, 400);
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

    sendSuccess(res, result);
  } catch (error) {
    console.error('Get Matches Error:', error);
    sendError(res, 'Failed to retrieve matches');
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
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await matchInvitationService.getMatchById(id);
    if (!match) {
      return sendError(res, 'Match not found', 404);
    }

    sendSuccess(res, match);
  } catch (error) {
    console.error('Get Match By ID Error:', error);
    sendError(res, 'Failed to retrieve match');
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
      return sendError(res, 'Authentication required', 401);
    }

    const { divisionId } = req.params;
    if (!divisionId) {
      return sendError(res, 'divisionId is required', 400);
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
    sendSuccess(res, result);
  } catch (error) {
    console.error('Get Available Matches Error:', error);
    sendError(res, 'Failed to retrieve available matches');
  }
};

/**
 * Get my matches (as participant)
 * GET /api/matches/my
 *
 * Returns matches with an additional `invitationStatus` field indicating
 * the current user's invitation status for each match (useful for DRAFT matches).
 */
export const getMyMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
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

    // Enhance matches with the current user's invitation status
    const matchesWithInvitationStatus = result.matches.map((match: any) => {
      // Find current user's participant entry
      const userParticipant = match.participants?.find(
        (p: any) => p.userId === userId
      );

      const isCreator = match.createdById === userId;

      // Determine invitation status for the current user
      let invitationStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | undefined;

      if (userParticipant) {
        // User is a participant - use their invitation status
        invitationStatus = userParticipant.invitationStatus as any;
      } else if (isCreator) {
        // User is the creator (always accepted)
        invitationStatus = 'ACCEPTED';
      }

      // For DRAFT matches, provide context based on perspective
      if (match.status === 'DRAFT') {
        if (isCreator) {
          // Creator viewing their DRAFT match - check OTHER participants' invitation states
          const otherParticipants = match.participants?.filter(
            (p: any) => p.userId !== userId
          ) || [];

          const pendingInvites = otherParticipants.filter(
            (p: any) => p.invitationStatus === 'PENDING'
          ).length;
          const declinedInvites = otherParticipants.filter(
            (p: any) => p.invitationStatus === 'DECLINED'
          ).length;
          const expiredInvites = otherParticipants.filter(
            (p: any) => p.invitationStatus === 'EXPIRED'
          ).length;
          const acceptedInvites = otherParticipants.filter(
            (p: any) => p.invitationStatus === 'ACCEPTED'
          ).length;

          // Determine the overall invitation status for DRAFT (creator's view)
          if (declinedInvites > 0) {
            invitationStatus = 'DECLINED';
          } else if (expiredInvites > 0) {
            invitationStatus = 'EXPIRED';
          } else if (pendingInvites > 0) {
            invitationStatus = 'PENDING';
          } else if (acceptedInvites === otherParticipants.length && otherParticipants.length > 0) {
            // All other participants accepted
            invitationStatus = 'ACCEPTED';
          }
        }
        // For non-creator viewing DRAFT: keep their own invitationStatus
        // (PENDING means they need to respond - but they should use INVITES tab)
      }

      return {
        ...match,
        invitationStatus
      };
    });

    sendSuccess(res, {
      ...result,
      matches: matchesWithInvitationStatus
    });
  } catch (error) {
    console.error('Get My Matches Error:', error);
    sendError(res, 'Failed to retrieve your matches');
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { asPartner = false, partnerId } = req.body;

    const match = await matchInvitationService.joinMatch(id, userId, asPartner, partnerId);

    void logMatchActivity(userId, UserActionType.MATCH_JOIN, id, {}, req.ip);

    sendSuccess(res, match);
  } catch (error) {
    console.error('Join Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to join match';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Invitation ID is required', 400);
    }

    const { accept, declineReason } = req.body;

    if (typeof accept !== 'boolean') {
      return sendError(res, 'accept (boolean) is required', 400);
    }

    const match = await matchInvitationService.respondToInvitation({
      invitationId: id,
      userId,
      accept,
      declineReason
    });

    void logMatchActivity(userId, accept ? UserActionType.INVITATION_RESPOND_ACCEPT : UserActionType.INVITATION_RESPOND_DECLINE, id, {}, req.ip);

    sendSuccess(res, match);
  } catch (error) {
    console.error('Respond to Invitation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to respond to invitation';
    sendError(res, message, 400);
  }
};

/**
 * Propose a time slot
 * POST /api/matches/:id/timeslots
 * COMMENTED OUT - timeSlots model doesn't exist in schema
 */
export const proposeTimeSlot = async (req: Request, res: Response) => {
  return sendError(res, 'Time slot feature not yet implemented', 400);

  // try {
  //   const userId = req.user?.id;
  //   if (!userId) {
  //     return res.status(401).json({ error: 'Authentication required' });
  //   }

  //   const { id } = req.params;
  //   if (!id) {
  //     return res.status(400).json({ error: 'Match ID is required' });
  //   }

  //   const { proposedTime, location, notes } = req.body;

  //   if (!proposedTime) {
  //     return res.status(400).json({ error: 'proposedTime is required' });
  //   }

  //   const timeSlot = await matchInvitationService.proposeTimeSlot({
  //     matchId: id,
  //     proposedById: userId,
  //     proposedTime: new Date(proposedTime),
  //     location,
  //     notes
  //   });

  //   res.status(201).json(timeSlot);
  // } catch (error) {
  //   console.error('Propose Time Slot Error:', error);
  //   const message = error instanceof Error ? error.message : 'Failed to propose time slot';
  //   res.status(400).json({ error: message });
  // }
};

/**
 * Vote for a time slot
 * POST /api/matches/timeslots/:id/vote
 * COMMENTED OUT - timeSlots model doesn't exist in schema
 */
export const voteForTimeSlot = async (req: Request, res: Response) => {
  return sendError(res, 'Time slot feature not yet implemented', 400);

  // try {
  //   const userId = req.user?.id;
  //   if (!userId) {
  //     return res.status(401).json({ error: 'Authentication required' });
  //   }

  //   const { id } = req.params;
  //   if (!id) {
  //     return res.status(400).json({ error: 'Time slot ID is required' });
  //   }

  //   const timeSlot = await matchInvitationService.voteForTimeSlot({
  //     timeSlotId: id,
  //     userId
  //   });

  //   res.json(timeSlot);
  // } catch (error) {
  //   console.error('Vote Time Slot Error:', error);
  //   const message = error instanceof Error ? error.message : 'Failed to vote for time slot';
  //   res.status(400).json({ error: message });
  // }
};

/**
 * Edit a match (only for DRAFT status matches)
 * PUT /api/matches/:id/edit
 */
export const editMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const {
      matchType,
      format,
      opponentId,
      partnerId,
      opponentPartnerId,
      matchDate,           // Using matchDate
      // proposedTimes,    // COMMENTED OUT
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      message,
      expiresInHours
    } = req.body;

    const match = await matchInvitationService.editMatch(id, userId, {
      matchType: matchType as MatchType,
      format: format as MatchFormat,
      opponentId,
      partnerId,
      opponentPartnerId,
      ...(matchDate && { matchDate: new Date(matchDate) }),
      // proposedTimes: proposedTimes?.map((t: string) => new Date(t)),  // COMMENTED OUT
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      message,
      expiresInHours
    });

    sendSuccess(res, match);
  } catch (error) {
    console.error('Edit Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit match';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id: matchId } = req.params;

    if (!matchId) {
      return sendError(res, 'Match ID is required', 400);
    }

    // 1. Get match details
    const match = await matchInvitationService.getMatchById(matchId);
    if (!match) {
      return sendError(res, 'Match not found', 404);
    }

    // 2. Verify user is match creator
    if (match.createdById !== userId) {
      return sendError(res, 'Only match creator can post to chat', 403);
    }

    // 3. Get division thread
    const thread = await prisma.thread.findFirst({
      where: { divisionId: match.divisionId, isGroup: true }
    });

    if (!thread) {
      return sendError(res, 'Division chat not found', 404);
    }


    // 4. Create match post message
    const matchData = {
      matchId: match.id,
      matchType: match.matchType,
      format: match.format,
      location: match.location,
      venue: match.venue,
      date: match.matchDate || new Date().toISOString(),
      time: match.matchDate ? new Date(match.matchDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD',
      matchDate: match.matchDate,
      duration: match.duration || 2,
      numberOfPlayers: match.matchType === 'DOUBLES' ? '4' : '2',
      sportType: match.division?.league?.sportType || 'PICKLEBALL',
      leagueName: match.division?.league?.name || 'League Match',
      courtBooked: match.courtBooked || false,
      fee: (match as any).fee || 'FREE',
      feeAmount: (match as any).feeAmount?.toString() || '0.00',
      description: match.notes || '',
      notes: match.notes,
      participants: match.participants?.map(p => ({
        userId: p.userId,
        role: p.role,
        team: p.team,
        invitationStatus: p.invitationStatus
      })) || []
    };

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        messageType: MessageType.MATCH,
        matchId: matchId || null,
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

    // 6. Notify division members (via SeasonMembership which has status field)
    const divisionMembers = await prisma.seasonMembership.findMany({
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
        divisionId: match.divisionId || undefined,
        threadId: thread.id
      });
    }

    sendSuccess(res, { message, threadId: thread.id });
  } catch (error) {
    console.error('Post Match to Chat Error:', error);
    sendError(res, 'Failed to post match to chat');
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id: matchId } = req.params;
    const { message } = req.body;

    if (!matchId) {
      return sendError(res, 'Match ID is required', 400);
    }

    // 1. Get match
    const match = await matchInvitationService.getMatchById(matchId);
    if (!match) {
      return sendError(res, 'Match not found', 404);
    }

    // 2. Verify user is in same division (via SeasonMembership which has status field)
    const divisionMember = await prisma.seasonMembership.findFirst({
      where: {
        divisionId: match.divisionId!,
        userId,
        status: MembershipStatus.ACTIVE
      }
    });

    if (!divisionMember) {
      return sendError(res, 'You are not a member of this division', 403);
    }

    // 3. Check if already requested
    // COMMENTED OUT - matchJoinRequest model doesn't exist in schema
    // const existingRequest = await prisma.matchJoinRequest.findUnique({
    //   where: {
    //     matchId_requesterId: { matchId, requesterId: userId }
    //   }
    // });

    // if (existingRequest) {
    //   return res.status(400).json({ error: 'You already requested to join this match' });
    // }

    // 4. Create join request
    // COMMENTED OUT - matchJoinRequest model doesn't exist in schema
    // const joinRequest = await prisma.matchJoinRequest.create({
    //   data: {
    //     matchId,
    //     requesterId: userId,
    //     message
    //   },
    //   include: {
    //     requester: {
    //       select: { id: true, name: true, username: true, image: true }
    //     }
    //   }
    // });

    return sendError(res, 'Join request feature not yet implemented', 400);

    // 5. Notify match creator
    // COMMENTED OUT - depends on joinRequest which doesn't exist
    // if (match.createdById) {
    //   await notificationService.createNotification({
    //     type: NOTIFICATION_TYPES.FRIENDLY_MATCH_JOIN_REQUEST,
    //     category: 'MATCH',
    //     title: 'Join Request Received',
    //     message: `${joinRequest.requester.name} wants to join your match`,
    //     userIds: [match.createdById],
    //     matchId
    //   });
    // }

    // res.status(201).json(joinRequest);
  } catch (error) {
    console.error('Request to Join Match Error:', error);
    sendError(res, 'Failed to request join');
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
      return sendError(res, 'Authentication required', 401);
    }

    const { requestId } = req.params;
    const { approve, declineReason } = req.body;

    if (typeof approve !== 'boolean') {
      return sendError(res, 'approve (boolean) is required', 400);
    }

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    // COMMENTED OUT - matchJoinRequest model doesn't exist in schema
    return sendError(res, 'Join request feature not yet implemented', 400);

    // // 1. Get join request
    // const joinRequest = await prisma.matchJoinRequest.findUnique({
    //   where: { id: requestId },
    //   include: {
    //     match: {
    //       include: {
    //         participants: true
    //       }
    //     },
    //     requester: {
    //       select: { id: true, name: true }
    //     }
    //   }
    // });

    // if (!joinRequest) {
    //   return res.status(404).json({ error: 'Join request not found' });
    // }

    // // 2. Verify user is match creator
    // if (joinRequest.match.createdById !== userId) {
    //   return res.status(403).json({ error: 'Only match creator can respond to join requests' });
    // }

    // // 3. Check if request already responded
    // if (joinRequest.status !== JoinRequestStatus.PENDING) {
    //   return res.status(400).json({ error: 'Request already responded to' });
    // }

    // // 4. Update join request
    // await prisma.matchJoinRequest.update({
    //   where: { id: requestId },
    //   data: {
    //     status: approve ? JoinRequestStatus.APPROVED : JoinRequestStatus.DENIED,
    //     respondedAt: new Date(),
    //     respondedBy: userId,
    //     declineReason: approve ? null : declineReason
    //   }
    // });

    // if (approve) {
    //   // 5. Add player as opponent/partner
    //   const role = joinRequest.match.matchType === MatchType.SINGLES
    //     ? ParticipantRole.OPPONENT
    //     : ParticipantRole.PARTNER;

    //   await prisma.matchParticipant.create({
    //     data: {
    //       matchId: joinRequest.matchId,
    //       userId: joinRequest.requesterId,
    //       role,
    //       invitationStatus: InvitationStatus.ACCEPTED,
    //       acceptedAt: new Date(),
    //       team: role === ParticipantRole.OPPONENT ? 'team2' : 'team1'
    //     }
    //   });

    //   // Notify requester - approved
    //   await notificationService.createNotification({
    //     type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_ACCEPTED,
    //     category: 'MATCH',
    //     title: 'Join Request Approved',
    //     message: `Your request to join the match has been approved!`,
    //     userIds: [joinRequest.requesterId],
    //     matchId: joinRequest.matchId
    //   });
    // } else {
    //   // Notify requester - denied
    //   await notificationService.createNotification({
    //     type: NOTIFICATION_TYPES.FRIENDLY_MATCH_REQUEST_DECLINED,
    //     category: 'MATCH',
    //     title: 'Join Request Declined',
    //     message: declineReason || 'Your request to join the match was declined',
    //     userIds: [joinRequest.requesterId],
    //     matchId: joinRequest.matchId
    //   });
    // }

    // res.json({ success: true, approved: approve });
  } catch (error) {
    console.error('Respond to Join Request Error:', error);
    sendError(res, 'Failed to respond to join request');
  }
};

/**
 * Confirm a time slot (manual confirmation)
 * POST /api/matches/timeslots/:id/confirm
 * COMMENTED OUT - timeSlots model doesn't exist in schema
 */
export const confirmTimeSlot = async (req: Request, res: Response) => {
  return sendError(res, 'Time slot feature not yet implemented', 400);

  // try {
  //   const userId = req.user?.id;
  //   if (!userId) {
  //     return res.status(401).json({ error: 'Authentication required' });
  //   }

  //   const { id } = req.params;
  //   if (!id) {
  //     return res.status(400).json({ error: 'Time slot ID is required' });
  //   }

  //   const match = await matchInvitationService.confirmTimeSlot(id);
  //   res.json(match);
  // } catch (error) {
  //   console.error('Confirm Time Slot Error:', error);
  //   const message = error instanceof Error ? error.message : 'Failed to confirm time slot';
  //   res.status(400).json({ error: message });
  // }
};

/**
 * Get invitation by ID
 * GET /api/matches/invitations/:id
 */
export const getInvitationById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Invitation ID is required', 400);
    }

    const invitation = await matchInvitationService.getInvitationById(id, userId);
    sendSuccess(res, invitation);
  } catch (error) {
    console.error('Get Invitation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get invitation';
    const status = error instanceof Error && error.message.includes('not authorized') ? 403 : 404;
    sendError(res, message, status);
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
      return sendError(res, 'Authentication required', 401);
    }

    const invitations = await matchInvitationService.getPendingInvitations(userId);
    sendSuccess(res, invitations);
  } catch (error) {
    console.error('Get Pending Invitations Error:', error);
    sendError(res, 'Failed to get pending invitations');
  }
};

/**
 * Get lightweight summary of user's matches for change detection
 * GET /api/matches/my/summary
 * Returns count and latest updatedAt to enable smart skeleton loading
 */
export const getMyMatchesSummary = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    // Get count and latest updatedAt for matches where user is a participant
    const [countResult, latestMatch] = await Promise.all([
      prisma.matchParticipant.count({
        where: { userId }
      }),
      prisma.match.findFirst({
        where: {
          participants: {
            some: { userId }
          }
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })
    ]);

    sendSuccess(res, {
      count: countResult,
      latestUpdatedAt: latestMatch?.updatedAt?.toISOString() || null
    });
  } catch (error) {
    console.error('Get My Matches Summary Error:', error);
    sendError(res, 'Failed to retrieve matches summary');
  }
};
