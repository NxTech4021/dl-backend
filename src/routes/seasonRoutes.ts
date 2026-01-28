import { Router, RequestHandler } from 'express';
import {
  getSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  updateSeasonStatus,
  deleteSeason,
  submitWithdrawalRequest,
  processWithdrawalRequest,
  registerPlayerToSeason,
  assignPlayerToDivision,
} from '../controllers/seasonController';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const seasonRoutes = Router();

// Public read operations - seasons can be viewed by anyone
seasonRoutes.get('/', getSeasons);
seasonRoutes.get('/:id', getSeasonById);

// Admin-only season management operations
seasonRoutes.post('/', verifyAuth, requireAdmin, createSeason);

//updates all information (admin only)
seasonRoutes.put('/:id', verifyAuth, requireAdmin, updateSeason);
//updates the status only (admin only)
seasonRoutes.put('/:id/status', verifyAuth, requireAdmin, updateSeasonStatus);

seasonRoutes.delete('/:id', verifyAuth, requireAdmin, deleteSeason);

// Withdrawal/Partner Change Request routes (require authentication)
seasonRoutes.post('/withdrawals', verifyAuth, submitWithdrawalRequest as RequestHandler);
// Processing withdrawals is admin-only
seasonRoutes.put('/withdrawals/:id/process', verifyAuth, requireAdmin, processWithdrawalRequest as RequestHandler);

// Register Player to Season (logged in users can register)
seasonRoutes.post('/player/register', verifyAuth, registerPlayerToSeason);

// Assign player to Division (admin only)
seasonRoutes.post('/player/assign-division', verifyAuth, requireAdmin, assignPlayerToDivision);


export default seasonRoutes;


