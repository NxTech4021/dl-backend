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

// Withdrawal requests
playerRouter.get('/withdrawal-requests', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const requests = await prisma.withdrawalRequest.findMany({
      where: { userId },
      include: {
        season: { select: { id: true, name: true } },
        partnership: {
          include: {
            season: { select: { id: true, name: true } },
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ data: requests });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal requests' });
  }
});

export default playerRouter;


