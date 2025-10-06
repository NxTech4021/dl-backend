import { Router } from 'express';
import {
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
} from '../controllers/leagueController';

const leagueRoutes = Router();

// Public routes for all users
leagueRoutes.get('/', getLeagues);                         
// leagueRoutes.get('/sport/:sportId', getLeaguesBySport);  
// leagueRoutes.get('/:id', getLeagueById);               

// Public routes - View sports at a league
// leagueRoutes.get('/:leagueId/sport', getSportsAtLeague); 

// Admin routes
leagueRoutes.post('/create', createLeague);                     
leagueRoutes.put('/:id', updateLeague);                  
leagueRoutes.delete('/:id', deleteLeague);               

// Admin routes - LeagueSport management
// leagueRoutes.post('/:leagueId/sport', addSportToLeague);          // POST /api/league/:leagueId/sport
// leagueRoutes.put('/:leagueId/sport/:sportId', updateLeagueSport); // PUT /api/league/:leagueId/sport/:sportId
// leagueRoutes.delete('/:leagueId/sport/:sportId', removeSportFromLeague); // DELETE /api/league/:leagueId/sport/:sportId

export default leagueRoutes;
