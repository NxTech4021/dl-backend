/**
 * Standings Routes
 * API endpoints for division standings/leaderboard
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getDivisionStandingsHandler,
  getMyStanding,
  getPlayerStandingHandler
} from '../controllers/ratingController';

const router = Router();

// Division leaderboard (public)
router.get('/division/:divisionId', getDivisionStandingsHandler);

// Authenticated user's standing
router.get('/me', authenticate, getMyStanding);

// Player's standing in division (public)
router.get('/:userId/division/:divisionId', getPlayerStandingHandler);

export default router;
