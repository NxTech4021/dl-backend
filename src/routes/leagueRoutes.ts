import { Router } from 'express';
import {
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
  getLeaguesBySport,
  addSportToLeague,
  getSportsAtLeague,
  updateLeagueSport,
  removeSportFromLeague
} from '../controllers/leagueController';

const router = Router();

// Public routes for all users
router.get('/', getLeagues);                         // GET /api/league
router.get('/sport/:sportId', getLeaguesBySport);   // GET /api/league/sport/:sportId
router.get('/:id', getLeagueById);                  // GET /api/league/:id

// Public routes - View sports at a league
router.get('/:leagueId/sport', getSportsAtLeague); // GET /api/league/:leagueId/sport

// Admin routes
router.post('/', createLeague);                      // POST /api/league
router.put('/:id', updateLeague);                    // PUT /api/league/:id
router.delete('/:id', deleteLeague);                 // DELETE /api/league/:id

// Admin routes - LeagueSport management
router.post('/:leagueId/sport', addSportToLeague);          // POST /api/league/:leagueId/sport
router.put('/:leagueId/sport/:sportId', updateLeagueSport); // PUT /api/league/:leagueId/sport/:sportId
router.delete('/:leagueId/sport/:sportId', removeSportFromLeague); // DELETE /api/league/:leagueId/sport/:sportId

export default router;
