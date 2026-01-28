import { Router } from 'express';
import {
  getLeagues,
  getLeagueById,
  getLeagueSeasons,
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
leagueRoutes.get('/:id/seasons', getLeagueSeasons);
// Public routes - View sports at a league
// leagueRoutes.get('/:leagueId/sport', getSportsAtLeague); 

// Admin routes
leagueRoutes.post("/create", verifyAuth, requireAdmin, createLeague);
leagueRoutes.put("/:id", verifyAuth, requireAdmin, updateLeague);
leagueRoutes.delete("/:id", verifyAuth, requireAdmin, deleteLeague);            

export default leagueRoutes;
