import { Router } from 'express';
import { 
  getSeasons, 
  getSeasonById, 
  createSeason, 
  updateSeason, 
  updateSeasonStatus,
  deleteSeason, 
  registerPlayerToSeason,
  assignPlayerToDivision,
} from '../controllers/seasonController';

const seasonRoutes = Router();

seasonRoutes.get('/', getSeasons);
seasonRoutes.get('/:id', getSeasonById);
seasonRoutes.post('/', createSeason);

//updates all information
seasonRoutes.put('/:id', updateSeason);
//updates the status only
seasonRoutes.put('/:id/status', updateSeasonStatus);

seasonRoutes.delete('/:id', deleteSeason);

// Register Player to Season
seasonRoutes.post('/player/register', registerPlayerToSeason);

// Assign player to Division
seasonRoutes.post('/player/assign-division', assignPlayerToDivision);


export default seasonRoutes;


