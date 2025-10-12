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
  getPlayerAchievements,
  changePlayerPassword,
  uploadProfileImage,
  upload,
  // Phase 2: Player Discovery & Social Features
  searchPlayers,
  getAvailablePlayersForSeason,
  getFavorites,
  addFavorite,
  removeFavorite,
  getPublicPlayerProfile,
} from '../controllers/playerController';

const playerRouter = Router();

// Admin routes
playerRouter.get('/', getAllPlayers);
playerRouter.get('/stats', getPlayerStats);
playerRouter.get('/:id', getPlayerById);

// Player profile routes (authenticated user)
playerRouter.get('/profile/me', verifyAuth, getPlayerProfile);
playerRouter.put('/profile/me', verifyAuth, updatePlayerProfile);
playerRouter.put('/profile/password', verifyAuth, changePlayerPassword);
playerRouter.get('/profile/matches', verifyAuth, getPlayerMatchHistory);
playerRouter.get('/profile/achievements', verifyAuth, getPlayerAchievements);
playerRouter.post('/profile/upload-image', verifyAuth, upload.single('image'), uploadProfileImage);
playerRouter.get('/matches/:matchId', verifyAuth, getMatchDetails);

// Phase 2: Player Discovery & Social Features
playerRouter.get('/search', verifyAuth, searchPlayers);
playerRouter.get('/discover/:seasonId', verifyAuth, getAvailablePlayersForSeason);
playerRouter.get('/favorites', verifyAuth, getFavorites);
playerRouter.post('/favorites/:userId', verifyAuth, addFavorite);
playerRouter.delete('/favorites/:userId', verifyAuth, removeFavorite);
playerRouter.get('/profile/public/:userId', verifyAuth, getPublicPlayerProfile);

export default playerRouter;


