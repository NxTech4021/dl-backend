import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { Prisma, MatchType } from "@prisma/client";
import { getMatchCommentService } from "../services/match/matchCommentService";

type MatchFeeType = 'FREE' | 'SPLIT' | 'FIXED';

interface CreateMatchBody {
  divisionId?: string;
  sport?: string;
  matchType?: MatchType;
  playerScore?: number;
  opponentScore?: number;
  outcome?: string;
  matchDate?: string;
  location?: string;
  notes?: string;
  duration?: number;
  courtBooked?: boolean;
  fee?: MatchFeeType;
  feeAmount?: number;
}

interface UpdateMatchBody {
  divisionId?: string;
  sport?: string;
  matchType?: MatchType;
  playerScore?: number;
  opponentScore?: number;
  outcome?: string;
  matchDate?: string;
  location?: string;
  notes?: string;
  duration?: number;
  courtBooked?: boolean;
  fee?: MatchFeeType;
  feeAmount?: number;
}

export const createMatch = async (req: Request, res: Response) => {
  const { divisionId, sport, matchType, playerScore, opponentScore, outcome, matchDate, location, notes, duration, courtBooked, fee, feeAmount } = req.body as CreateMatchBody;

  if (!divisionId || !sport || !matchType) {
    return res.status(400).json({ error: "divisionId, sport, and matchType are required." });
  }

  try {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) return res.status(404).json({ error: "Division not found." });

    const matchData: Prisma.MatchCreateInput = {
      division: { connect: { id: divisionId } },
      sport,
      matchType,
      ...(playerScore !== undefined && { playerScore: playerScore ?? null }),
      ...(opponentScore !== undefined && { opponentScore: opponentScore ?? null }),
      ...(outcome !== undefined && { outcome: outcome ?? null }),
      ...(matchDate !== undefined && { matchDate: new Date(matchDate) }),
      ...(location !== undefined && { location: location ?? null }),
      ...(notes !== undefined && { notes: notes ?? null }),
      ...(duration !== undefined && { duration: duration ?? null }),
      ...(courtBooked !== undefined && { courtBooked: courtBooked ?? null }),
      ...(fee !== undefined && { fee: fee ?? null }),
      ...(feeAmount !== undefined && { feeAmount: feeAmount ?? null }),
    };

    const match = await prisma.match.create({
      data: matchData,
      include: { participants: true },
    });
    res.status(201).json(match);
  } catch (err: unknown) {
    console.error("Create Match Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to create match.";
    res.status(500).json({ error: errorMessage });
  }
};

export const getMatches = async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      include: { division: true, participants: { include: { user: true } } },
      orderBy: { matchDate: "desc" },
    });
    res.json(matches);
  } catch (err: unknown) {
    console.error("Get Matches Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve matches.";
    res.status(500).json({ error: errorMessage });
  }
};

export const getMatchById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        division: true,
        participants: { include: { user: true } },
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
    if (!match) return res.status(404).json({ error: "Match not found." });

    // Transform disputes array to single dispute object for frontend convenience
    const response = {
      ...match,
      dispute: match.disputes?.[0] || null,
    };

    res.json(response);
  } catch (err: unknown) {
    console.error("Get Match By ID Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve match.";
    res.status(500).json({ error: errorMessage });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { divisionId, sport, matchType, playerScore, opponentScore, outcome, matchDate, location, notes, duration, courtBooked, fee, feeAmount } = req.body as UpdateMatchBody;

  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const existingMatch = await prisma.match.findUnique({ where: { id } });
    if (!existingMatch) return res.status(404).json({ error: "Match not found." });

    const updateData: Prisma.MatchUpdateInput = {};
    
    if (divisionId !== undefined) {
      updateData.division = divisionId ? { connect: { id: divisionId } } : { disconnect: true };
    }
    if (sport !== undefined) updateData.sport = sport;
    if (matchType !== undefined) updateData.matchType = matchType;
    if (playerScore !== undefined) updateData.playerScore = playerScore ?? null;
    if (opponentScore !== undefined) updateData.opponentScore = opponentScore ?? null;
    if (outcome !== undefined) updateData.outcome = outcome ?? null;
    if (matchDate !== undefined) updateData.matchDate = new Date(matchDate);
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
    res.json(match);
  } catch (err: unknown) {
    console.error("Update Match Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to update match.";
    res.status(500).json({ error: errorMessage });
  }
};

export const deleteMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const existingMatch = await prisma.match.findUnique({ where: { id } });
    if (!existingMatch) return res.status(404).json({ error: "Match not found." });

    await prisma.match.delete({ where: { id } });
    res.json({ message: "Match deleted successfully." });
  } catch (err: unknown) {
    console.error("Delete Match Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to delete match.";
    res.status(500).json({ error: errorMessage });
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
 * Create a comment on a match (requires participant status)
 */
export const postMatchComment = async (req: Request, res: Response) => {
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
 * Update a comment (owner only)
 */
export const updateMatchComment = async (req: Request, res: Response) => {
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
 * Delete a comment (owner only)
 */
export const deleteMatchComment = async (req: Request, res: Response) => {
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
