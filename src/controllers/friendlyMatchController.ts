/**
 * Friendly Match Controller
 * Handles HTTP requests for friendly match creation, listing, joining, and result submission
 */

import { Request, Response } from 'express';
import { getFriendlyMatchService } from '../services/match/friendlyMatchService';
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
      expiresInHours
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
      expiresInHours
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

    const { setScores, gameScores, comment, evidence } = req.body;

    // Validate that at least one score type is provided
    if ((!setScores || !Array.isArray(setScores) || setScores.length === 0) &&
        (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0)) {
      return res.status(400).json({
        error: 'Either setScores (Tennis/Padel) or gameScores (Pickleball) array is required'
      });
    }

    const match = await friendlyMatchService.submitFriendlyResult({
      matchId: id,
      submittedById: userId,
      setScores,
      gameScores,
      comment,
      evidence
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
