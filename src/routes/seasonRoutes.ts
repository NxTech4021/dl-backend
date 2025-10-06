import { Router } from 'express';
import { 
  getSeasons, 
  getSeasonById, 
  createSeason, 
  updateSeason, 
  deleteSeason 
} from '../controllers/seasonController';

const seasonRoutes = Router();

seasonRoutes.get('/', getSeasons);
seasonRoutes.get('/:id', getSeasonById);
seasonRoutes.post('/', createSeason);
seasonRoutes.put('/:id', updateSeason);
seasonRoutes.delete('/:id', deleteSeason);

export default seasonRoutes;


