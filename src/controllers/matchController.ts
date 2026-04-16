import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { Prisma, MatchType, MatchStatus } from "@prisma/client";
import { getMatchCommentService } from "../services/match/matchCommentService";
import { sendSuccess, sendError } from '../utils/response';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import { parseDateFromDevice, formatMatchDate, formatMatchTime } from '../utils/timezone';

type MatchFeeType = 'FREE' | 'SPLIT' | 'FIXED';

interface UpdateMatchBody {
  divisionId?: string;
  sport?: string;
  matchType?: MatchType;
  playerScore?: number;
  opponentScore?: number;
  outcome?: string;
  matchDate?: string;
  deviceTimezone?: string;
  location?: string;
  notes?: string;
  duration?: number;
  courtBooked?: boolean;
  fee?: MatchFeeType;
  feeAmount?: number;
}

// Legacy createMatch removed — matchRoutes.ts imports createMatch from matchInvitationController
// (see docs/issues/dissections/111-singles-match-deep-stress.md §5 D-1)

export const getMatches = async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      include: { division: true, participants: { include: { user: true } } },
      orderBy: { matchDate: "desc" },
    });
    sendSuccess(res, matches);
  } catch (err: unknown) {
    console.error("Get Matches Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve matches.";
    sendError(res, errorMessage);
  }
};

export const getMatchById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return sendError(res, "Match ID is required.", 400);

  try {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        division: true,
        participants: { include: { user: true } },
        invitations: {
          include: {
            inviter: { select: { id: true, name: true, username: true } },
            invitee: { select: { id: true, name: true, username: true } }
          }
        },
        //Easier to differentiate in the backend via game/set scores
        scores: {
          orderBy: { setNumber: 'asc' }
        },
        pickleballScores: {
          orderBy: { gameNumber: 'asc' }
        },
        disputes: {
          include: {
            raisedByUser: {
              select: {
                id: true,
                name: true,
                image: true,
              }
            }
          }
        },
        comments: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
    });
    if (!match) return sendError(res, "Match not found.", 404);

    // Transform disputes array to single dispute object for frontend convenience
    const response = {
      ...match,
      dispute: match.disputes?.[0] || null,
    };

    sendSuccess(res, response);
  } catch (err: unknown) {
    console.error("Get Match By ID Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve match.";
    sendError(res, errorMessage);
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { divisionId, sport, matchType, playerScore, opponentScore, outcome, matchDate, deviceTimezone, location, notes, duration, courtBooked, fee, feeAmount } = req.body as UpdateMatchBody;

  if (!id) return sendError(res, "Match ID is required.", 400);

  try {
    const existingMatch = await prisma.match.findUnique({ where: { id } });
    if (!existingMatch) return sendError(res, "Match not found.", 404);

    const userId = (req as any).user?.id;
    if (!userId) return sendError(res, "Authentication required.", 401);
    if (existingMatch.createdById !== userId) {
      return sendError(res, "Only the match creator can edit this match.", 403);
    }

    const updateData: Prisma.MatchUpdateInput = {};
    
    if (divisionId !== undefined) {
      updateData.division = divisionId ? { connect: { id: divisionId } } : { disconnect: true };
    }
    if (sport !== undefined) updateData.sport = sport;
    if (matchType !== undefined) updateData.matchType = matchType;
    if (playerScore !== undefined) updateData.playerScore = playerScore ?? null;
    if (opponentScore !== undefined) updateData.opponentScore = opponentScore ?? null;
    if (outcome !== undefined) updateData.outcome = outcome ?? null;
    if (matchDate !== undefined) {
      updateData.matchDate = parseDateFromDevice(matchDate, deviceTimezone);
    }
    if (location !== undefined) updateData.location = location ?? null;
    if (notes !== undefined) updateData.notes = notes ?? null;
    if (duration !== undefined) updateData.duration = duration ?? null;
    if (courtBooked !== undefined) updateData.courtBooked = courtBooked ?? null;
    if (fee !== undefined) (updateData as any).fee = fee ?? null;
    if (feeAmount !== undefined) (updateData as any).feeAmount = feeAmount ?? null;

    const match = await prisma.match.update({
      where: { id },
      data: updateData,
      include: { participants: true },
    });
    sendSuccess(res, match);
  } catch (err: unknown) {
    console.error("Update Match Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to update match.";
    sendError(res, errorMessage);
  }
};

export const deleteMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return sendError(res, "Match ID is required.", 400);

  const userId = (req as any).user?.id;
  if (!userId) return sendError(res, "Authentication required.", 401);

  try {
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existingMatch) return sendError(res, "Match not found.", 404);

    // F-1: Only the match creator can delete — mirrors updateMatch (line 174)
    if (existingMatch.createdById !== userId) {
      return sendError(res, "Only the match creator can delete this match.", 403);
    }

    // Only allow delete on non-impactful states. Completed/void/walkover/ongoing/unfinished
    // matches have ratings, standings, walkover records, or dispute history. Those must be
    // handled via voidMatch (admin path) which properly reverses ratings and recalculates
    // standings. Hard-deleting a completed match would leave stale PlayerRating deltas
    // (RatingHistory.matchId cascades to NULL but deltas stay applied) and stale
    // DivisionStanding rows.
    const deletableStatuses: MatchStatus[] = [
      MatchStatus.DRAFT,
      MatchStatus.SCHEDULED,
      MatchStatus.CANCELLED,
    ];
    if (!deletableStatuses.includes(existingMatch.status as MatchStatus)) {
      return sendError(
        res,
        `Cannot delete a match in ${existingMatch.status} state. Completed matches must be voided by an admin.`,
        400
      );
    }

    await prisma.match.delete({ where: { id } });
    sendSuccess(res, null, "Match deleted successfully.");
  } catch (err: unknown) {
    console.error("Delete Match Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to delete match.";
    sendError(res, errorMessage);
  }
};

// ==========================================
// MATCH COMMENT ENDPOINTS
// ==========================================

/**
 * Get all comments for a match
 */
export const getMatchComments = async (req: Request, res: Response) => {
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
 * Create a comment on a match (requires participant status)
 */
export const postMatchComment = async (req: Request, res: Response) => {
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
    sendSuccess(res, newComment, undefined, 201);
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
 * Update a comment (owner only)
 */
export const updateMatchComment = async (req: Request, res: Response) => {
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
 * Delete a comment (owner only)
 */
export const deleteMatchComment = async (req: Request, res: Response) => {
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
 * Get full match details formatted for the match-details page
 * Returns ALL data needed to display the match details UI
 * GET /api/match/:id/details
 */
export const getMatchDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return sendError(res, "Match ID is required.", 400);

  try {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        division: {
          include: {
            season: true,
            league: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        },
        scores: {
          orderBy: { setNumber: 'asc' }
        },
        //Easier to differentiate in the backend via game/set scores 
        pickleballScores: {
          orderBy: { gameNumber: 'asc' }
        },
        disputes: {
          include: {
            raisedByUser: {
              select: {
                id: true,
                name: true,
                image: true,
              }
            }
          }
        },
        comments: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
    });

    // Reject friendly matches — they must use the friendly endpoint
    if (!match || match.isFriendly) return sendError(res, "Match not found.", 404);

    // Format match date and time in venue timezone (Malaysia)
    const formattedDate = match.matchDate ? formatMatchDate(match.matchDate) : null;
    const formattedTime = match.matchDate ? formatMatchTime(match.matchDate) : null;

    // Format participants for the frontend
    // Sort by team and role for consistent display
    const sortedParticipants = [...match.participants].sort((a, b) => {
      // team1 before team2
      if (a.team !== b.team) {
        return a.team === 'team1' ? -1 : 1;
      }
      // CREATOR before others within same team
      if (a.role !== b.role) {
        return a.role === 'CREATOR' ? -1 : 1;
      }
      return 0;
    });

    const formattedParticipants = sortedParticipants.map(p => ({
      id: p.id,
      odix: (p as any).odix || null,
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
      matchDate: match.matchDate, // ISO string for calculations
      duration: match.duration || 2,

      // Location
      location: match.location || match.venue || null,
      venue: match.venue || null,
      description: match.notes || null,

      // Sport and league info
      sportType: match.division?.league?.sportType || match.sport || 'PICKLEBALL',
      leagueName: match.division?.league?.name || null,
      season: match.division?.season?.name || null,
      division: match.division?.name || null,
      divisionId: match.divisionId || null,
      seasonId: match.division?.seasonId || null,
      leagueId: match.division?.leagueId || null,

      // Participants
      participants: formattedParticipants,

      // Match booking details
      courtBooked: match.courtBooked || false,
      fee: (match as any).fee || 'FREE',
      feeAmount: (match as any).feeAmount?.toString() || '0',

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

      // League endpoint — friendly matches are rejected on line 404 above
      isFriendly: false,
      genderRestriction: match.genderRestriction ?? null,
      skillLevels: match.skillLevels ?? [],

      // Comments
      comments: match.comments || [],

      // Creator info
      createdBy: match.createdBy,
    };

    sendSuccess(res, response);
  } catch (err: unknown) {
    console.error("Get Match Details Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve match details.";
    sendError(res, errorMessage);
  }
};
