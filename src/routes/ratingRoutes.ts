/**
 * Rating Routes
 * API endpoints for player ratings
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
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
router.get('/me', authenticate, getMyRating);
router.get('/me/summary', authenticate, getMyRatingSummary);
router.get('/me/history', authenticate, getMyRatingHistory);
router.get('/me/stats', authenticate, getMyRatingStats);

// Public player ratings
router.get('/:userId', getPlayerRatingById);
router.get('/:userId/all', getAllPlayerRatings);
router.get('/:userId/history', getPlayerRatingHistoryById);

export default router;
