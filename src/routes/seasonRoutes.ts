import { Router } from 'express';
import {
  getSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  updateSeasonStatus,
  deleteSeason,
  submitWithdrawalRequest,
  processWithdrawalRequest
} from '../controllers/seasonController';
import { verifyAuth } from '../middlewares/auth.middleware';

const seasonRoutes = Router();

seasonRoutes.get('/', getSeasons);
seasonRoutes.get('/:id', getSeasonById);
seasonRoutes.post('/', createSeason);

//updates all information
seasonRoutes.put('/:id', updateSeason);
//updates the status only
seasonRoutes.put('/:id/status', updateSeasonStatus);

seasonRoutes.delete('/:id', deleteSeason);

// Withdrawal/Partner Change Request routes (require authentication)
seasonRoutes.post('/withdrawals', verifyAuth, submitWithdrawalRequest);
seasonRoutes.put('/withdrawals/:id/process', verifyAuth, processWithdrawalRequest);

export default seasonRoutes;


