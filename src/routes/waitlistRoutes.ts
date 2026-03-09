import { Router, RequestHandler } from 'express';
import { waitlistService } from '../services/waitlistService';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const waitlistRoutes = Router();

// Join waitlist (authenticated user)
waitlistRoutes.post('/:seasonId/join', verifyAuth, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await waitlistService.joinWaitlist(seasonId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Leave waitlist (authenticated user)
waitlistRoutes.delete('/:seasonId/leave', verifyAuth, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await waitlistService.leaveWaitlist(seasonId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Get user's waitlist status (authenticated user)
waitlistRoutes.get('/:seasonId/status', verifyAuth, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await waitlistService.getStatus(seasonId, userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Admin: Get all waitlisted users for a season
waitlistRoutes.get('/:seasonId', verifyAuth, requireAdmin, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const users = await waitlistService.getWaitlistedUsers(seasonId);
    res.json(users);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Admin: Update waitlist settings
waitlistRoutes.patch('/:seasonId/settings', verifyAuth, requireAdmin, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const { enabled, maxParticipants } = req.body;

    const result = await waitlistService.updateSettings(seasonId, { enabled, maxParticipants });
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Admin: Manually promote all waitlisted users
waitlistRoutes.post('/:seasonId/promote', verifyAuth, requireAdmin, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const result = await waitlistService.promoteAllUsers(seasonId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

// Admin: Remove a user from waitlist
waitlistRoutes.delete('/:seasonId/users/:userId', verifyAuth, requireAdmin, (async (req, res, next) => {
  try {
    const seasonId = req.params.seasonId!;
    const userId = req.params.userId!;
    const result = await waitlistService.removeUser(seasonId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

export default waitlistRoutes;
