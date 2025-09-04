import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';

import { 
  getAllPlayers, 
  getPlayerById, 
  getPlayerStats, 
  getPlayerProfile,
  getPlayerMatchHistory,
  getMatchDetails
} from '../controllers/playerController';

const playerRouter = Router();

// Admin routes
playerRouter.get('/', getAllPlayers);
playerRouter.get('/stats', getPlayerStats);
playerRouter.get('/:id', getPlayerById);

// Player profile routes (authenticated user)
playerRouter.get('/profile/me', verifyAuth, getPlayerProfile);
playerRouter.get('/profile/matches', verifyAuth, getPlayerMatchHistory);
playerRouter.get('/matches/:matchId', verifyAuth, getMatchDetails);

export default playerRouter;


