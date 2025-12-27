/**
 * Friendly Match Controller
 * Handles HTTP requests for friendly match creation, listing, joining, and result submission
 */

import { Request, Response } from 'express';
import { getFriendlyMatchService } from '../services/match/friendlyMatchService';
import { getMatchCommentService } from '../services/match/matchCommentService';
import { MatchType, MatchFormat, MatchStatus, GenderRestriction, SportType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { notificationService } from '../services/notificationService';
import { matchManagementNotifications } from '../helpers/notifications/matchManagementNotifications';

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

/**
 * Helper function to get participant user IDs excluding a specific user
 */
const getOtherParticipants = async (matchId: string, excludeUserId?: string): Promise<string[]> => {
  const participants = await prisma.matchParticipant.findMany({
    where: { 
      matchId,
      ...(excludeUserId && { userId: { not: excludeUserId } })
    },
    select: { userId: true },
  });
  return participants.map(p => p.userId);
};

const friendlyMatchService = getFriendlyMatchService();

/**
 * Create a friendly match
 * POST /api/friendly/create
 */
export const createFriendlyMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      sport,
      matchType,
      format,
      matchDate,
      deviceTimezone,
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      genderRestriction,
      skillLevels,
      opponentId,
      partnerId,
      opponentPartnerId,
      message,
      expiresInHours,
      isRequest,
      requestRecipientId
    } = req.body;

    if (!sport || !['PICKLEBALL', 'TENNIS', 'PADEL'].includes(sport)) {
      return res.status(400).json({ error: 'Valid sport (PICKLEBALL/TENNIS/PADEL) is required' });
    }

    if (!matchType || !['SINGLES', 'DOUBLES'].includes(matchType)) {
      return res.status(400).json({ error: 'Valid matchType (SINGLES/DOUBLES) is required' });
    }

    if (!matchDate) {
      return res.status(400).json({ error: 'matchDate is required' });
    }

    if (!skillLevels || !Array.isArray(skillLevels) || skillLevels.length === 0) {
      return res.status(400).json({ error: 'At least one skillLevel is required' });
    }

    // Timezone conversion
    let parsedMatchDate: Date;
    if (deviceTimezone && deviceTimezone !== 'Asia/Kuala_Lumpur') {
      const deviceTime = dayjs.tz(matchDate, deviceTimezone);
      const malaysiaTime = deviceTime.tz('Asia/Kuala_Lumpur');
      parsedMatchDate = malaysiaTime.toDate();
    } else {
      const malaysiaTime = dayjs.tz(matchDate, 'Asia/Kuala_Lumpur');
      parsedMatchDate = malaysiaTime.toDate();
    }

    const match = await friendlyMatchService.createFriendlyMatch({
      createdById: userId,
      sport: sport as SportType,
      matchType: matchType as MatchType,
      format: format as MatchFormat,
      matchDate: parsedMatchDate,
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee,
      feeAmount,
      genderRestriction: genderRestriction as GenderRestriction,
      skillLevels,
      opponentId,
      partnerId,
      opponentPartnerId,
      message,
      expiresInHours,
      isRequest: isRequest === true,
      requestRecipientId
    });

    // Send notification for friendly match creation
    try {
      if (isRequest && requestRecipientId) {
        // Get requester name
        const requester = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true }
        });

        const notification = matchManagementNotifications.friendlyMatchJoinRequest(
          requester?.name || 'A player',
          formatDate(parsedMatchDate),
          formatTime(parsedMatchDate)
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: requestRecipientId,
          matchId: match.id,
        });
      } else {
        // Regular friendly match posted notification
        const notification = matchManagementNotifications.friendlyMatchPosted(
          formatDate(parsedMatchDate),
          formatTime(parsedMatchDate),
          venue || location || 'TBD'
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: userId,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send match creation notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json(match);
  } catch (error) {
    console.error('Create Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create friendly match';
    res.status(400).json({ error: message });
  }
};

/**
 * Get friendly matches with filters
 * GET /api/friendly
 */
export const getFriendlyMatches = async (req: Request, res: Response) => {
  try {
    const {
      sport,
      matchType,
      status,
      fromDate,
      toDate,
      hasOpenSlots,
      genderRestriction,
      skillLevels,
      userId,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {};

    if (sport) filters.sport = sport as SportType;
    if (matchType) filters.matchType = matchType as MatchType;
    if (status) filters.status = status as MatchStatus;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);
    if (hasOpenSlots === 'true') filters.hasOpenSlots = true;
    if (genderRestriction) filters.genderRestriction = genderRestriction as GenderRestriction;
    if (skillLevels) {
      const levels = Array.isArray(skillLevels) ? skillLevels : [skillLevels];
      filters.skillLevels = levels as string[];
    }
    if (userId) filters.userId = userId as string;

    const result = await friendlyMatchService.getFriendlyMatches(
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error) {
    console.error('Get Friendly Matches Error:', error);
    res.status(500).json({ error: 'Failed to retrieve friendly matches' });
  }
};

/**
 * Get friendly match by ID
 * GET /api/friendly/:id
 */
export const getFriendlyMatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await friendlyMatchService.getFriendlyMatchById(id);
    res.json(match);
  } catch (error) {
    console.error('Get Friendly Match By ID Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve friendly match';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
};

/**
 * Get full friendly match details formatted for the match-details page
 * Returns ALL data needed to display the match details UI
 * GET /api/friendly/:id/details
 */
export const getFriendlyMatchDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await prisma.match.findFirst({
      where: { id, isFriendly: true } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } },
        pickleballScores: { orderBy: { gameNumber: 'asc' } },
        comments: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        disputes: {
          include: {
            raisedByUser: {
              select: { id: true, name: true, image: true }
            }
          }
        }
      }
    }) as any;

    if (!match) {
      return res.status(404).json({ error: 'Friendly match not found' });
    }

    // Format match date and time
    const matchDate = match.matchDate || match.scheduledStartTime;
    const matchDateTime = matchDate ? new Date(matchDate) : null;
    const formattedDate = matchDateTime
      ? matchDateTime.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        })
      : null;
    const formattedTime = matchDateTime
      ? matchDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : null;

    // Format participants for the frontend
    // Sort by team and role for consistent display
    const sortedParticipants = [...(match.participants || [])].sort((a: any, b: any) => {
      // team1 before team2
      if (a.team !== b.team) {
        return a.team === 'team1' ? -1 : 1;
      }
      // CAPTAIN before PARTNER within same team
      if (a.role !== b.role) {
        return a.role === 'CAPTAIN' ? -1 : 1;
      }
      return 0;
    });

    const formattedParticipants = sortedParticipants.map((p: any) => ({
      id: p.id,
      odix: p.odix,
      userId: p.userId,
      name: p.user?.name || p.user?.username || 'Unknown Player',
      image: p.user?.image || null,
      role: p.role,
      team: p.team,
      invitationStatus: p.invitationStatus
    }));

    // Determine if match is disputed
    const isDisputed = match.disputes && match.disputes.length > 0;

    // Build the comprehensive response
    const response = {
      // Core identifiers
      matchId: match.id,
      matchType: match.matchType,
      status: match.status,

      // Date/time (formatted for display)
      date: formattedDate,
      time: formattedTime,
      matchDate: matchDate, // ISO string for calculations
      duration: match.duration || 2,

      // Location
      location: match.location || match.venue || null,
      venue: match.venue || null,
      description: match.notes || match.description || null,

      // Sport info (friendly matches don't have league/season/division)
      sportType: match.sport || 'PICKLEBALL',
      leagueName: null,
      season: null,
      division: null,
      divisionId: null,
      seasonId: null,
      leagueId: null,

      // Participants
      participants: formattedParticipants,

      // Match booking details
      courtBooked: match.courtBooked || false,
      fee: match.fee || 'FREE',
      feeAmount: match.feeAmount?.toString() || '0',

      // Scores (if completed or submitted)
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      playerScore: match.playerScore,
      opponentScore: match.opponentScore,
      scores: match.scores || [],
      pickleballScores: match.pickleballScores || [],

      // Result submission info
      createdById: match.createdById,
      resultSubmittedById: match.resultSubmittedById || null,
      resultSubmittedAt: match.resultSubmittedAt || null,

      // Dispute info
      isDisputed,
      dispute: isDisputed ? match.disputes[0] : null,

      // Friendly match specific info
      isFriendly: true,
      isFriendlyRequest: match.isFriendlyRequest || false,
      requestStatus: match.requestStatus || null,
      genderRestriction: match.genderRestriction || null,
      skillLevels: match.skillLevels || [],

      // Comments
      comments: match.comments || [],

      // Creator info
      createdBy: match.createdBy,
    };

    res.json({ data: response });
  } catch (error) {
    console.error('Get Friendly Match Details Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve friendly match details';
    res.status(500).json({ error: message });
  }
};

/**
 * Join a friendly match
 * POST /api/friendly/:id/join
 */
export const joinFriendlyMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { asPartner = false, partnerId } = req.body;

    const match = await friendlyMatchService.joinFriendlyMatch(id, userId, asPartner, partnerId);

    // Send notification to match creator
    try {
      const joiner = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      if (match.createdById && match.createdById !== userId) {
        const notification = matchManagementNotifications.friendlyMatchPlayerJoined(
          joiner?.name || 'A player',
          formatDate(match.matchDate),
          formatTime(match.matchDate),
          match.venue || match.location || 'TBD'
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: match.createdById,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send join notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Join Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to join friendly match';
    res.status(400).json({ error: message });
  }
};

/**
 * Submit friendly match result
 * POST /api/friendly/:id/result
 */
export const submitFriendlyResult = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { setScores, gameScores, comment, evidence, isCasualPlay, teamAssignments } = req.body;

    // For casual play, scores are not required
    // For friendly match mode, scores are required
    if (!isCasualPlay) {
      // Validate that at least one score type is provided
      if ((!setScores || !Array.isArray(setScores) || setScores.length === 0) &&
          (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0)) {
        return res.status(400).json({
          error: 'Either setScores (Tennis/Padel) or gameScores (Pickleball) array is required for Friendly Match mode'
        });
      }
    }

    // Validate teamAssignments structure if provided
    if (teamAssignments) {
      if (!teamAssignments.team1 || !teamAssignments.team2 ||
          !Array.isArray(teamAssignments.team1) || !Array.isArray(teamAssignments.team2)) {
        return res.status(400).json({ error: 'Invalid teamAssignments format. Expected { team1: string[], team2: string[] }' });
      }
    }

    const match = await friendlyMatchService.submitFriendlyResult({
      matchId: id,
      submittedById: userId,
      setScores,
      gameScores,
      comment,
      evidence,
      isCasualPlay: isCasualPlay ?? false,
      teamAssignments
    });

    // Send notification to other participants
    try {
      const submitter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      const otherParticipants = await getOtherParticipants(id, userId);
      
      if (otherParticipants.length > 0) {
        const notification = matchManagementNotifications.opponentSubmittedScore(
          submitter?.name || 'Opponent'
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: otherParticipants,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send result submission notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Submit Friendly Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit result';
    res.status(400).json({ error: message });
  }
};

/**
 * Confirm friendly match result
 * POST /api/friendly/:id/confirm
 */
export const confirmFriendlyResult = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { confirmed, disputeReason } = req.body;

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'confirmed (boolean) is required' });
    }

    if (!confirmed && !disputeReason) {
      return res.status(400).json({ error: 'disputeReason is required when not confirming' });
    }

    const match = await friendlyMatchService.confirmFriendlyResult({
      matchId: id,
      userId,
      confirmed,
      disputeReason
    });

    // Send notification based on confirmation status
    try {
      const confirmer = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      const otherParticipants = await getOtherParticipants(id, userId);
      
      if (otherParticipants.length > 0) {
        if (confirmed) {
          // Score confirmed - calculate score display
          let scoreDisplay = 'Final';
          if (match.team1Score !== null && match.team2Score !== null) {
            scoreDisplay = `${match.team1Score}-${match.team2Score}`;
          }

          const notification = matchManagementNotifications.scoreAutoConfirmed(
            confirmer?.name || 'Opponent',
            scoreDisplay
          );
          
          await notificationService.createNotification({
            ...notification,
            userIds: otherParticipants,
            matchId: match.id,
          });
        } else {
          // Score disputed
          const notification = matchManagementNotifications.scoreDisputeAlert(
            confirmer?.name || 'Opponent'
          );
          
          await notificationService.createNotification({
            ...notification,
            userIds: otherParticipants,
            matchId: match.id,
          });
        }
      }
    } catch (notifError) {
      console.error('Failed to send confirmation notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Confirm Friendly Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm result';
    res.status(400).json({ error: message });
  }
};

/**
 * Accept a friendly match request
 * POST /api/friendly/:id/accept
 */
export const acceptFriendlyMatchRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await friendlyMatchService.acceptFriendlyMatchRequest(id, userId);

    // Send notification to requester
    try {
      const accepter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      if (match.createdById && match.createdById !== userId) {
        const notification = matchManagementNotifications.friendlyMatchRequestAccepted(
          accepter?.name || 'Host',
          formatDate(match.matchDate),
          formatTime(match.matchDate),
          match.venue || match.location || 'TBD'
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: match.createdById,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send accept notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Accept Friendly Match Request Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept friendly match request';
    res.status(400).json({ error: message });
  }
};

/**
 * Decline a friendly match request
 * POST /api/friendly/:id/decline
 */
export const declineFriendlyMatchRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const match = await friendlyMatchService.declineFriendlyMatchRequest(id, userId);

    // Send notification to requester
    try {
      const decliner = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      if (match.createdById && match.createdById !== userId) {
        const notification = matchManagementNotifications.friendlyMatchRequestDeclined(
          decliner?.name || 'Host'
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: match.createdById,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send decline notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Decline Friendly Match Request Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to decline friendly match request';
    res.status(400).json({ error: message });
  }
};

/**
 * Cancel a friendly match (didn't play)
 * POST /api/friendly/:id/cancel
 */
export const cancelFriendlyMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Match ID is required' });
    }

    const { comment } = req.body;

    const match = await friendlyMatchService.cancelFriendlyMatch(id, userId, comment);

    // Send cancellation notification to other participants
    try {
      const canceller = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      const otherParticipants = await getOtherParticipants(id, userId);
      
      if (otherParticipants.length > 0) {
        const notification = matchManagementNotifications.friendlyMatchCancelled(
          canceller?.name || 'Host',
          formatDate(match.matchDate),
          formatTime(match.matchDate)
        );
        
        await notificationService.createNotification({
          ...notification,
          userIds: otherParticipants,
          matchId: match.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send cancellation notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json(match);
  } catch (error) {
    console.error('Cancel Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel friendly match';
    res.status(400).json({ error: message });
  }
};

// ==========================================
// FRIENDLY MATCH COMMENT ENDPOINTS
// ==========================================

/**
 * Get all comments for a friendly match
 * GET /api/friendly/:id/comments
 */
export const getFriendlyMatchComments = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Match ID is required' });

  try {
    const commentService = getMatchCommentService();
    const comments = await commentService.getComments(id);
    res.json(comments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get comments';
    if (message === 'Match not found') {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
};

/**
 * Create a comment on a friendly match (requires participant status)
 * POST /api/friendly/:id/comment
 */
export const postFriendlyMatchComment = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { comment } = req.body;

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!id) return res.status(400).json({ error: 'Match ID is required' });

  try {
    const commentService = getMatchCommentService();
    const newComment = await commentService.createComment({
      matchId: id,
      userId,
      comment,
    });

    // Notify other participants about the new comment
    try {
      const commenter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      const otherParticipants = await getOtherParticipants(id, userId);
      
      if (otherParticipants.length > 0) {
        await notificationService.createNotification({
          type: 'NEW_MATCH_COMMENT',
          category: 'MATCH',
          title: 'New Comment',
          message: `${commenter?.name || 'A player'} commented on your match`,
          userIds: otherParticipants,
          matchId: id,
          metadata: {
            commentId: newComment.id,
            commenterName: commenter?.name || 'A player',
          }
        });
      }
    } catch (notifError) {
      console.error('Failed to send comment notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json(newComment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post comment';

    if (message === 'Match not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Only match participants can comment' ||
        message.includes('You can only')) {
      return res.status(403).json({ error: message });
    }
    if (message.includes('Cannot comment on matches') ||
        message === 'Comment cannot be empty' ||
        message.includes('exceeds maximum length')) {
      return res.status(400).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
};

/**
 * Update a comment on a friendly match (owner only)
 * PUT /api/friendly/:id/comment/:commentId
 */
export const updateFriendlyMatchComment = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id, commentId } = req.params;
  const { comment } = req.body;

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!id) return res.status(400).json({ error: 'Match ID is required' });
  if (!commentId) return res.status(400).json({ error: 'Comment ID is required' });

  try {
    const commentService = getMatchCommentService();
    const updatedComment = await commentService.updateComment({
      commentId,
      userId,
      comment,
    });
    res.json(updatedComment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update comment';

    if (message === 'Comment not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'You can only edit your own comments') {
      return res.status(403).json({ error: message });
    }
    if (message === 'Comment cannot be empty' ||
        message.includes('exceeds maximum length')) {
      return res.status(400).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
};

/**
 * Delete a comment on a friendly match (owner only)
 * DELETE /api/friendly/:id/comment/:commentId
 */
export const deleteFriendlyMatchComment = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id, commentId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!id) return res.status(400).json({ error: 'Match ID is required' });
  if (!commentId) return res.status(400).json({ error: 'Comment ID is required' });

  try {
    const commentService = getMatchCommentService();
    await commentService.deleteComment({
      commentId,
      userId,
    });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment';

    if (message === 'Comment not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'You can only delete your own comments') {
      return res.status(403).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
};

/**
 * Get lightweight summary of friendly matches for change detection
 * GET /api/friendly/summary
 * Returns count and latest updatedAt to enable smart skeleton loading
 */
export const getFriendlyMatchesSummary = async (req: Request, res: Response) => {
  try {
    const { sport } = req.query;

    const whereClause: any = {
      isFriendly: true,
    };

    if (sport) {
      whereClause.sport = sport as SportType;
    }

    // Get count and latest updatedAt for friendly matches
    const [countResult, latestMatch] = await Promise.all([
      prisma.match.count({
        where: whereClause
      }),
      prisma.match.findFirst({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })
    ]);

    res.json({
      count: countResult,
      latestUpdatedAt: latestMatch?.updatedAt?.toISOString() || null
    });
  } catch (error) {
    console.error('Get Friendly Matches Summary Error:', error);
    res.status(500).json({ error: 'Failed to retrieve friendly matches summary' });
  }
};
