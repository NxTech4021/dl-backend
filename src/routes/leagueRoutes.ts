import { Router } from 'express';
import {
  getLeagues,
  getLeague,
  getLeagueSeasons,
  getSeason,
  getUserRegistrations
} from '../controllers/leagueController';
import { verifyAuth } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', getLeagues);
router.get('/:id', getLeague);
router.get('/:leagueId/seasons', getLeagueSeasons);
router.get('/seasons/:id', getSeason);

// Protected routes (require authentication)
router.get('/user/registrations', verifyAuth, getUserRegistrations);

export default router;