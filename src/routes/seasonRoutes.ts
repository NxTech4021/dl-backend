import { Router } from 'express';
import { 
  getSeasons, 
  getSeasonById, 
  createSeason, 
  updateSeason, 
  updateSeasonStatus,
  deleteSeason 
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

export default seasonRoutes;


