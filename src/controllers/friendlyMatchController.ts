/**
 * Friendly Match Controller
 * Handles HTTP requests for friendly match creation, listing, joining, and result submission
 */

import { Request, Response } from 'express';
import { getFriendlyMatchService } from '../services/match/friendlyMatchService';
import { getMatchCommentService } from '../services/match/matchCommentService';
import { MatchType, MatchFormat, MatchStatus, GenderRestriction, SportType } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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
    res.json(match);
  } catch (error) {
    console.error('Decline Friendly Match Request Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to decline friendly match request';
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
