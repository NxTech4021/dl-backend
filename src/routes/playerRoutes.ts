import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';

import { 
  getAllPlayers, 
  getPlayerById, 
  getPlayerStats, 
  getPlayerProfile,
  updatePlayerProfile,
  getPlayerMatchHistory,
  getMatchDetails,
  getPlayerAchievements
} from '../controllers/playerController';

const playerRouter = Router();

// Admin routes
playerRouter.get('/', getAllPlayers);
playerRouter.get('/stats', getPlayerStats);
playerRouter.get('/:id', getPlayerById);

// Player profile routes (authenticated user)
playerRouter.get('/profile/me', verifyAuth, getPlayerProfile);
playerRouter.put('/profile/me', verifyAuth, updatePlayerProfile);
playerRouter.get('/profile/matches', verifyAuth, getPlayerMatchHistory);
playerRouter.get('/profile/achievements', verifyAuth, getPlayerAchievements);
playerRouter.get('/matches/:matchId', verifyAuth, getMatchDetails);

export default playerRouter;


