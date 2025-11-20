/**
 * Rating Routes
 * API endpoints for player ratings
 */

import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';
import {
  getMyRating,
  getMyRatingSummary,
  getMyRatingHistory,
  getMyRatingStats,
  getPlayerRatingById,
  getAllPlayerRatings,
  getPlayerRatingHistoryById
} from '../controllers/ratingController';

const router = Router();

// Authenticated user's ratings
router.get('/me', verifyAuth, getMyRating);
router.get('/me/summary', verifyAuth, getMyRatingSummary);
router.get('/me/history', verifyAuth, getMyRatingHistory);
router.get('/me/stats', verifyAuth, getMyRatingStats);

// Public player ratings
router.get('/:userId', getPlayerRatingById);
router.get('/:userId/all', getAllPlayerRatings);
router.get('/:userId/history', getPlayerRatingHistoryById);

export default router;
