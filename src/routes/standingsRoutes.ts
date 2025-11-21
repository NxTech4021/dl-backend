/**
 * Standings Routes
 * API endpoints for division standings/leaderboard
 */

import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';
import {
  getDivisionStandingsHandler,
  getMyStanding,
  getPlayerStandingHandler
} from '../controllers/ratingController';

const router = Router();

// Division leaderboard (public)
router.get('/division/:divisionId', getDivisionStandingsHandler);

// Authenticated user's standing
router.get('/me', verifyAuth, getMyStanding);

// Player's standing in division (public)
router.get('/:userId/division/:divisionId', getPlayerStandingHandler);

export default router;
