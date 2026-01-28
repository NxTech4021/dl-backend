import { prisma } from "../lib/prisma";
import { Router } from 'express';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

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
  getPlayerRatingHistory,
  // Phase 2: Player Discovery & Social Features
  searchPlayers,
  getAvailablePlayersForSeason,
  getFavorites,
  addFavorite,
  removeFavorite,
  getPublicPlayerProfile,
  // Player History endpoints
  getPlayerLeagueHistory,
  getPlayerSeasonHistory,
  getPlayerDivisionHistory,
  getPlayerMatchHistoryAdmin,
} from '../controllers/playerController';
import { getSettings, updateSettings, updateSkillLevels } from '../controllers/settingsController';

const playerRouter = Router();

// Admin routes
playerRouter.get('/', verifyAuth, requireAdmin, getAllPlayers);
playerRouter.get('/stats', verifyAuth, requireAdmin, getPlayerStats);

// Player history routes (authenticated user viewing own or admin)
playerRouter.get('/:id/leagues', verifyAuth, getPlayerLeagueHistory);
playerRouter.get('/:id/seasons', verifyAuth, getPlayerSeasonHistory);
playerRouter.get('/:id/divisions', verifyAuth, getPlayerDivisionHistory);
// Admin match history - requires admin access
playerRouter.get('/:id/matches', verifyAuth, requireAdmin, getPlayerMatchHistoryAdmin);

// Player profile routes (authenticated user)
playerRouter.get('/profile/me', verifyAuth, getPlayerProfile as any);
playerRouter.put('/profile/me', verifyAuth, updatePlayerProfile as any);
playerRouter.put('/profile/password', verifyAuth, changePlayerPassword as any);
playerRouter.get('/profile/matches', verifyAuth, getPlayerMatchHistory as any);
playerRouter.get('/profile/achievements', verifyAuth, getPlayerAchievements as any);
playerRouter.get('/profile/rating-history', verifyAuth, getPlayerRatingHistory as any);
playerRouter.post('/profile/upload-image', verifyAuth, upload.single('image'), uploadProfileImage as any);
playerRouter.get('/matches/:matchId', verifyAuth, getMatchDetails as any);

// Settings routes
playerRouter.get('/settings', verifyAuth, getSettings as any);
playerRouter.put('/settings', verifyAuth, updateSettings as any);
playerRouter.put('/settings/skill-levels', verifyAuth, updateSkillLevels as any);

// Track login activity (for regular users)
playerRouter.put('/track-login', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
        lastActivityCheck: new Date(),
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Failed updating login time:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Activity status route
playerRouter.get('/activity-status/:playerId', verifyAuth, async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    const { getInactivityService } = await import('../services/inactivityService');
    const { NotificationService } = await import('../services/notificationService');

    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);

    const status = await inactivityService.getPlayerActivityStatus(playerId);

    res.json({
      success: true,
      data: {
        ...status,
        thresholds: {
          warning: 21,
          inactive: 30,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch activity status',
    });
  }
});

// Phase 2: Player Discovery & Social Features
playerRouter.get('/search', verifyAuth, searchPlayers as any);
playerRouter.get('/discover/:seasonId', verifyAuth, getAvailablePlayersForSeason as any);
playerRouter.get('/favorites', verifyAuth, getFavorites as any);
playerRouter.post('/favorites/:userId', verifyAuth, addFavorite as any);
playerRouter.delete('/favorites/:userId', verifyAuth, removeFavorite as any);
playerRouter.get('/profile/public/:userId', verifyAuth, getPublicPlayerProfile as any);

// Withdrawal requests
playerRouter.get('/withdrawal-requests', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await prisma.withdrawalRequest.findMany({
      where: { userId },
      include: {
        season: { select: { id: true, name: true } },
        partnership: {
          include: {
            season: { select: { id: true, name: true } },
            captain: { select: { id: true, name: true } },
            partner: { select: { id: true, name: true } },
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

// Parameterized routes - MUST BE LAST to avoid catching specific routes
playerRouter.get('/:id', verifyAuth, getPlayerById);

export default playerRouter;


