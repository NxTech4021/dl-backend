import { Router } from 'express';
import { 
  getSeasons, 
  getSeasonById, 
  createSeason, 
  updateSeason, 
  deleteSeason 
} from '../controllers/seasonController';

const router = Router();

router.get('/', getSeasons);
router.get('/:id', getSeasonById);
router.post('/', createSeason);
router.put('/:id', updateSeason);
router.delete('/:id', deleteSeason);

export default router;


