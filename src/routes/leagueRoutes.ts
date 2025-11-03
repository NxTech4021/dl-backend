import { Router } from 'express';
import {
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
  // joinLeague, // LeagueMembership model has been removed
  // sendLeagueInvite,
} from '../controllers/leagueController';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const leagueRoutes = Router();

// Public routes for all users
leagueRoutes.get('/', getLeagues);                         
// leagueRoutes.post('/join', joinLeague); // LeagueMembership model has been removed
// leagueRoutes.post('/invite', sendLeagueInvite);  
leagueRoutes.get('/:id', getLeagueById);               
// Public routes - View sports at a league
// leagueRoutes.get('/:leagueId/sport', getSportsAtLeague); 

// Admin routes
leagueRoutes.post("/create", verifyAuth, requireAdmin, createLeague);
leagueRoutes.put("/:id", verifyAuth, requireAdmin, updateLeague);
leagueRoutes.delete("/:id", verifyAuth, requireAdmin, deleteLeague);            

// Admin routes - LeagueSport management
// leagueRoutes.post('/:leagueId/sport', addSportToLeague);          // POST /api/league/:leagueId/sport
// leagueRoutes.put('/:leagueId/sport/:sportId', updateLeagueSport); // PUT /api/league/:leagueId/sport/:sportId
// leagueRoutes.delete('/:leagueId/sport/:sportId', removeSportFromLeague); // DELETE /api/league/:leagueId/sport/:sportId

export default leagueRoutes;
