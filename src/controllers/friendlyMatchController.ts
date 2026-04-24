/**
 * Friendly Match Controller
 * Handles HTTP requests for friendly match creation, listing, joining, and result submission
 */

import { Request, Response } from 'express';
import { getFriendlyMatchService } from '../services/match/friendlyMatchService';
import { getMatchCommentService } from '../services/match/matchCommentService';
import { sendSuccess, sendError } from '../utils/response';
import { MatchType, MatchFormat, MatchStatus, GenderRestriction, SportType, UserActionType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { notificationService } from '../services/notificationService';
import { matchManagementNotifications } from '../helpers/notifications/matchManagementNotifications';
import { socialCommunityNotifications } from '../helpers/notifications/socialCommunityNotifications';
import { logMatchActivity } from '../services/userActivityLogService';
import { checkAndSendWeeklyStreakNotification } from '../services/notification/playerNotificationService';

dayjs.extend(utc);
dayjs.extend(timezone);

// Date formatting helpers imported from shared timezone utility.
// All user-facing times are shown in venue timezone (Malaysia).
import { formatMatchDate, formatMatchTime, parseDateFromDevice, formatDynamicDate, formatDynamicDateWithOn } from '../utils/timezone';

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
  return participants.map(p => p.userId).filter((id): id is string => id !== null);
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
      return sendError(res, 'Authentication required', 401);
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
      return sendError(res, 'Valid sport (PICKLEBALL/TENNIS/PADEL) is required', 400);
    }

    if (!matchType || !['SINGLES', 'DOUBLES'].includes(matchType)) {
      return sendError(res, 'Valid matchType (SINGLES/DOUBLES) is required', 400);
    }

    // Check for active suspension before allowing match creation
    const activePenalty = await prisma.playerPenalty.findFirst({
      where: {
        userId,
        penaltyType: 'SUSPENSION',
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      select: { id: true, reason: true, expiresAt: true },
    });

    if (activePenalty) {
      const expiryMsg = activePenalty.expiresAt
        ? ` Suspension ends ${formatMatchDate(activePenalty.expiresAt)}.`
        : '';
      return sendError(res, `You are currently suspended and cannot create matches.${expiryMsg}`, 403);
    }

    if (!matchDate) {
      return sendError(res, 'matchDate is required', 400);
    }

    if (!skillLevels || !Array.isArray(skillLevels) || skillLevels.length === 0) {
      return sendError(res, 'At least one skillLevel is required', 400);
    }

    // Timezone conversion: interpret the naive datetime in the device's timezone
    const parsedMatchDate = parseDateFromDevice(matchDate, deviceTimezone);

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

    if (!match) {
      return sendError(res, 'Failed to create friendly match');
    }

    // Note: Notifications are handled by friendlyMatchService.createFriendlyMatch()
    // Do NOT send notifications here to avoid duplicates

    void logMatchActivity(userId, UserActionType.MATCH_CREATE, match.id, { isFriendly: true }, req.ip);
    sendSuccess(res, match, undefined, 201);
  } catch (error) {
    console.error('Create Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create friendly match';
    sendError(res, message, 400);
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

    sendSuccess(res, result);
  } catch (error) {
    console.error('Get Friendly Matches Error:', error);
    sendError(res, 'Failed to retrieve friendly matches');
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
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await friendlyMatchService.getFriendlyMatchById(id);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Get Friendly Match By ID Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve friendly match';
    const status = message.includes('not found') ? 404 : 500;
    sendError(res, message, status);
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
      return sendError(res, 'Match ID is required', 400);
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
      return sendError(res, 'Friendly match not found', 404);
    }

    // Format match date and time in venue timezone (Malaysia)
    const matchDate = match.matchDate || match.scheduledStartTime;
    const formattedDate = matchDate ? formatMatchDate(matchDate) : null;
    const formattedTime = matchDate ? formatMatchTime(matchDate) : null;

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

    sendSuccess(res, response);
  } catch (error) {
    console.error('Get Friendly Match Details Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve friendly match details';
    sendError(res, message);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { asPartner = false, partnerId } = req.body;

    // Check for active suspension before allowing join
    const activePenalty = await prisma.playerPenalty.findFirst({
      where: {
        userId,
        penaltyType: 'SUSPENSION',
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      select: { id: true, reason: true, expiresAt: true },
    });

    if (activePenalty) {
      const expiryMsg = activePenalty.expiresAt
        ? ` Suspension ends ${formatMatchDate(activePenalty.expiresAt)}.`
        : '';
      return sendError(res, `You are currently suspended and cannot join matches.${expiryMsg}`, 403);
    }

    const match = await friendlyMatchService.joinFriendlyMatch(id, userId, asPartner, partnerId);

    // Note: Notifications are handled by friendlyMatchService.joinFriendlyMatch()
    // Do NOT send notifications here to avoid duplicates

    void logMatchActivity(userId, UserActionType.MATCH_JOIN, id, {}, req.ip);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Join Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to join friendly match';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { setScores, gameScores, comment, evidence, isCasualPlay, teamAssignments } = req.body;

    // For casual play, scores are not required
    // For friendly match mode, scores are required
    if (!isCasualPlay) {
      // Validate that at least one score type is provided
      if ((!setScores || !Array.isArray(setScores) || setScores.length === 0) &&
          (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0)) {
        return sendError(res, 'Either setScores (Tennis/Padel) or gameScores (Pickleball) array is required for Friendly Match mode', 400);
      }
    }

    // Validate teamAssignments structure if provided
    if (teamAssignments) {
      if (!teamAssignments.team1 || !teamAssignments.team2 ||
          !Array.isArray(teamAssignments.team1) || !Array.isArray(teamAssignments.team2)) {
        return sendError(res, 'Invalid teamAssignments format. Expected { team1: string[], team2: string[] }', 400);
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

    void logMatchActivity(userId, UserActionType.SCORE_SUBMIT, id, {}, req.ip);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Submit Friendly Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit result';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { confirmed, disputeReason } = req.body;

    if (typeof confirmed !== 'boolean') {
      return sendError(res, 'confirmed (boolean) is required', 400);
    }

    if (!confirmed && !disputeReason) {
      return sendError(res, 'disputeReason is required when not confirming', 400);
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
          // NOTIF-096: Score manually confirmed — notify the submitter
          const confirmedNotif = matchManagementNotifications.scoreConfirmed(
            confirmer?.name || 'Opponent'
          );
          await notificationService.createNotification({
            ...confirmedNotif,
            userIds: otherParticipants,
            matchId: match.id,
          });

          // TODO (2026-04-21, docs/issues/backlog/notification-cron-timing-audit-2026-04-21.md D1):
          // Mirror of matchResultController.ts D1 — NOTIF-122 spec demands a
          // 5-min delay between confirm and share-prompt. Currently immediate.
          // Same fix decision needed (setTimeout vs scheduled-notification table).
          // NOTIF-122: Prompt all participants to share their scorecard (fire-and-forget)
          void (async () => {
            try {
              const allParticipants = await prisma.matchParticipant.findMany({
                where: { matchId: id, invitationStatus: 'ACCEPTED' },
                select: { userId: true },
              });
              const allUserIds = allParticipants
                .map(p => p.userId)
                .filter((uid): uid is string => !!uid);
              if (allUserIds.length > 0) {
                await notificationService.createNotification({
                  ...socialCommunityNotifications.shareScorecardPrompt(),
                  userIds: allUserIds,
                  matchId: match.id,
                });
              }
            } catch (_) { /* non-blocking */ }
          })();

          // NOTIF-014: Weekly streak celebration — fire-and-forget for all participants
          void (async () => {
            try {
              const allParticipants = await prisma.matchParticipant.findMany({
                where: { matchId: id, invitationStatus: 'ACCEPTED' },
                select: { userId: true },
              });
              for (const { userId: participantId } of allParticipants) {
                if (participantId) {
                  await checkAndSendWeeklyStreakNotification(participantId, match.id);
                }
              }
            } catch (_) { /* non-blocking */ }
          })();
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

    void logMatchActivity(userId, confirmed ? UserActionType.SCORE_CONFIRM : UserActionType.SCORE_DISPUTE, id, {}, req.ip);
    sendSuccess(res, match);
  } catch (error) {
    console.error('Confirm Friendly Result Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm result';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await friendlyMatchService.acceptFriendlyMatchRequest(id, userId);

    // Note: Notifications are handled by friendlyMatchService.acceptFriendlyMatchRequest()
    // Do NOT send notifications here to avoid duplicates

    sendSuccess(res, match);
  } catch (error) {
    console.error('Accept Friendly Match Request Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept friendly match request';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await friendlyMatchService.declineFriendlyMatchRequest(id, userId);

    // Note: Notifications are handled by friendlyMatchService.declineFriendlyMatchRequest()
    // Do NOT send notifications here to avoid duplicates

    sendSuccess(res, match);
  } catch (error) {
    console.error('Decline Friendly Match Request Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to decline friendly match request';
    sendError(res, message, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
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
          formatDynamicDateWithOn(match.matchDate),
          (match as any).venue || (match as any).location || ''
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

    sendSuccess(res, match);
  } catch (error) {
    console.error('Cancel Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel friendly match';
    sendError(res, message, 400);
  }
};

/**
 * NOTIF-080: Leave a friendly match (non-host participant removes themselves)
 * POST /api/friendly/:id/leave
 */
export const leaveFriendlyMatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const match = await friendlyMatchService.leaveFriendlyMatch(id, userId);

    // Send NOTIF-080 to host
    try {
      const leaver = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const hostId = (match as any).createdById;
      if (hostId && hostId !== userId) {
        const notification = matchManagementNotifications.playerLeftFriendlyMatch(
          leaver?.name || 'A player',
          formatDynamicDate((match as any).matchDate),
          formatMatchTime((match as any).matchDate)
        );
        await notificationService.createNotification({
          ...notification,
          userIds: [hostId],
          matchId: id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send player-left notification:', notifError);
    }

    sendSuccess(res, match);
  } catch (error) {
    console.error('Leave Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to leave match';
    sendError(res, message, 400);
  }
};

/**
 * PATCH /api/friendly/:id/details
 */
export const updateFriendlyMatchDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'Match ID is required', 400);
    }

    const { matchDate, venue, location } = req.body;
    const updateData: Record<string, any> = {};
    if (matchDate !== undefined) updateData.matchDate = parseDateFromDevice(matchDate);
    if (venue !== undefined) updateData.venue = venue;
    if (location !== undefined) updateData.location = location;

    if (Object.keys(updateData).length === 0) {
      return sendError(res, 'No update fields provided', 400);
    }

    const match = await friendlyMatchService.updateFriendlyMatch(id, userId, updateData);
    // Match Notification
    try {
      const host = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const otherParticipants = await getOtherParticipants(id, userId);
      if (otherParticipants.length > 0) {
        const newDate = formatMatchDate((match as any).matchDate);
        const newTime = formatMatchTime((match as any).matchDate);
        const newVenue = (match as any).venue || (match as any).location || '';
        const notification = matchManagementNotifications.friendlyMatchDetailsChanged(
          host?.name || 'Host',
          newDate,
          newTime,
          newVenue
        );
        await notificationService.createNotification({
          ...notification,
          userIds: otherParticipants,
          matchId: id,
        });
      }
    } catch (notifError) {
      console.error('Failed to send match-updated notification:', notifError);
    }

    sendSuccess(res, match);
  } catch (error) {
    console.error('Update Friendly Match Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update match';
    sendError(res, message, 400);
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

  if (!id) return sendError(res, 'Match ID is required', 400);

  try {
    const commentService = getMatchCommentService();
    const comments = await commentService.getComments(id);
    sendSuccess(res, comments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get comments';
    if (message === 'Match not found') {
      return sendError(res, message, 404);
    }
    sendError(res, message);
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

  if (!userId) return sendError(res, 'Authentication required', 401);
  if (!id) return sendError(res, 'Match ID is required', 400);

  try {
    const commentService = getMatchCommentService();
    const newComment = await commentService.createComment({
      matchId: id,
      userId,
      comment,
    });

    return sendSuccess(res, newComment, undefined, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post comment';

    if (message === 'Match not found') {
      return sendError(res, message, 404);
    }
    if (message === 'Only match participants can comment' ||
        message.includes('You can only')) {
      return sendError(res, message, 403);
    }
    if (message.includes('Cannot comment on matches') ||
        message === 'Comment cannot be empty' ||
        message.includes('exceeds maximum length')) {
      return sendError(res, message, 400);
    }

    sendError(res, message);
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

  if (!userId) return sendError(res, 'Authentication required', 401);
  if (!id) return sendError(res, 'Match ID is required', 400);
  if (!commentId) return sendError(res, 'Comment ID is required', 400);

  try {
    const commentService = getMatchCommentService();
    const updatedComment = await commentService.updateComment({
      commentId,
      userId,
      comment,
    });
    sendSuccess(res, updatedComment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update comment';

    if (message === 'Comment not found') {
      return sendError(res, message, 404);
    }
    if (message === 'You can only edit your own comments') {
      return sendError(res, message, 403);
    }
    if (message === 'Comment cannot be empty' ||
        message.includes('exceeds maximum length')) {
      return sendError(res, message, 400);
    }

    sendError(res, message);
  }
};

/**
 * Delete a comment on a friendly match (owner only)
 * DELETE /api/friendly/:id/comment/:commentId
 */
export const deleteFriendlyMatchComment = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id, commentId } = req.params;

  if (!userId) return sendError(res, 'Authentication required', 401);
  if (!id) return sendError(res, 'Match ID is required', 400);
  if (!commentId) return sendError(res, 'Comment ID is required', 400);

  try {
    const commentService = getMatchCommentService();
    await commentService.deleteComment({
      commentId,
      userId,
    });
    sendSuccess(res, null, 'Comment deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment';

    if (message === 'Comment not found') {
      return sendError(res, message, 404);
    }
    if (message === 'You can only delete your own comments') {
      return sendError(res, message, 403);
    }

    sendError(res, message);
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

    sendSuccess(res, {
      count: countResult,
      latestUpdatedAt: latestMatch?.updatedAt?.toISOString() || null
    });
  } catch (error) {
    console.error('Get Friendly Matches Summary Error:', error);
    sendError(res, 'Failed to retrieve friendly matches summary');
  }
};
