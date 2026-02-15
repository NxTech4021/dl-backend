/**
 * Player Controller - Thin HTTP Wrapper
 * Delegates business logic to service modules
 */

import { Request, Response } from "express";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Import all services
import * as profileService from '../services/player/profileService';
import * as searchService from '../services/player/searchService';
import * as statsService from '../services/player/statsService';
import * as matchHistoryService from '../services/player/matchHistoryService';
import * as competitionHistoryService from '../services/player/competitionHistoryService';
import * as favoritesService from '../services/player/favoritesService';

// Re-export multer config
export { upload } from '../services/player/utils/multerConfig';

interface UpdatePlayerProfileBody {
  name?: string;
  username?: string;
  email?: string;
  location?: string;
  image?: string;
  phoneNumber?: string;
  bio?: string;
  dateOfBirth?: string;
}

interface ChangePlayerPasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Get all players with sports and skill ratings
 * GET /api/player
 * Query params: page (default 1), limit (default 20, max 100)
 */
export const getAllPlayers = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    const result = await searchService.getAllPlayers(pageNum, limitNum);

    if (result.data.length === 0) {
      return sendPaginated(res, result.data, result.pagination, "No players found");
    }

    return sendPaginated(res, result.data, result.pagination, "Players fetched successfully");
  } catch (error) {
    console.error("Error fetching players:", error);
    return sendError(res, "Failed to fetch players");
  }
};

/**
 * Get player statistics
 * GET /api/player/stats
 */
export const getPlayerStats = async (req: Request, res: Response) => {
  try {
    const stats = await statsService.getPlayerStats();
    return sendSuccess(res, stats, "Player stats fetched successfully");
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return sendError(res, "Failed to fetch player stats");
  }
};

/**
 * Get player by ID with skills
 * GET /api/player/:id
 */
export const getPlayerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Player ID is required", 400);
    }

    const player = await statsService.getPlayerById(id);

    if (!player) {
      return sendError(res, "Player not found", 404);
    }

    return sendSuccess(res, player, "Player found successfully");
  } catch (error) {
    console.error("Error fetching player:", error);
    return sendError(res, "Failed to fetch player");
  }
};

/**
 * Get authenticated user's full profile
 * GET /api/player/profile/me
 */
export const getPlayerProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const profileData = await profileService.getPlayerProfile(userId);
    return sendSuccess(res, profileData, "Player profile fetched successfully");
  } catch (error: unknown) {
    console.error("❌ getPlayerProfile: Error fetching player profile:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch player profile";
    return sendError(res, errorMessage);
  }
};

/**
 * Get player rating history for graph display
 * GET /api/player/profile/rating-history
 * Query params: sport, gameType (singles/doubles), limit
 */
export const getPlayerRatingHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const { sport, gameType, limit } = req.query;

    const history = await profileService.getPlayerRatingHistory(
      userId,
      sport as string | undefined,
      gameType as string | undefined,
      limit ? Number(limit) : 20
    );

    return sendSuccess(res, history, "Rating history fetched successfully");
  } catch (error: unknown) {
    console.error("❌ getPlayerRatingHistory: Error fetching rating history:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch rating history";
    return sendError(res, errorMessage);
  }
};

/**
 * Get player match history with pagination
 * GET /api/player/matches
 */
export const getPlayerMatchHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const {
      page,
      limit,
      sport,
      outcome,
      startDate,
      endDate
    } = req.query;

    const options: {
      page?: number;
      limit?: number;
      sport?: string;
      outcome?: string;
      startDate?: string;
      endDate?: string;
    } = {};

    if (page) {
      options.page = Number(page);
    }
    if (limit) {
      options.limit = Number(limit);
    }
    if (sport) {
      options.sport = sport as string;
    }
    if (outcome) {
      options.outcome = outcome as string;
    }
    if (startDate) {
      options.startDate = startDate as string;
    }
    if (endDate) {
      options.endDate = endDate as string;
    }

    const responseData = await matchHistoryService.getPlayerMatchHistory(userId, options);

    return sendSuccess(res, responseData, "Match history fetched successfully");
  } catch (error) {
    console.error("Error fetching match history:", error);
    return sendError(res, "Failed to fetch match history");
  }
};

/**
 * Get detailed match information
 * GET /api/player/matches/:matchId
 */
export const getMatchDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { matchId } = req.params;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    if (!matchId) {
      return sendError(res, "Match ID is required", 400);
    }

    const detailedMatch = await matchHistoryService.getMatchDetails(matchId, userId);
    return sendSuccess(res, detailedMatch, "Match details fetched successfully");
  } catch (error: unknown) {
    console.error("Error fetching match details:", error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'Match not found') {
      return sendError(res, "Match not found", 404);
    }

    if (errorMessage === 'Access denied') {
      return sendError(res, "Access denied", 403);
    }

    return sendError(res, "Failed to fetch match details");
  }
};

/**
 * Update player profile
 * PUT /api/player/profile
 */
export const updatePlayerProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const { name, username, email, location, image, phoneNumber, bio, dateOfBirth } = req.body as UpdatePlayerProfileBody;

    const updateData: Parameters<typeof profileService.updatePlayerProfile>[1] = {};

    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (location !== undefined) updateData.location = location;
    if (image !== undefined) updateData.image = image;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (bio !== undefined) updateData.bio = bio;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

    const updatedUser = await profileService.updatePlayerProfile(userId, updateData);

    return sendSuccess(res, updatedUser, 'Profile updated successfully');
  } catch (error: unknown) {
    console.error('Error updating player profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    const statusCode = errorMessage.includes('already taken') ? 400 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Change player password
 * POST /api/player/password
 */
export const changePlayerPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const { currentPassword, newPassword } = req.body as ChangePlayerPasswordBody;

    if (!currentPassword || !newPassword) {
      return sendError(res, "Current password and new password are required", 400);
    }

    await profileService.changePlayerPassword(userId, currentPassword, newPassword, req.headers);

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (error: unknown) {
    console.error('❌ Error changing password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
    const isClientError = errorMessage.includes('required') || errorMessage.includes('incorrect') || errorMessage.includes('8 characters');
    const statusCode = isClientError ? 400 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get player achievements
 * GET /api/player/achievements
 */
export const getPlayerAchievements = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const result = await profileService.getPlayerAchievements(userId);

    return sendSuccess(res, result, result.completedCount > 0 ? 'Achievements retrieved successfully' : 'No achievements yet');
  } catch (error) {
    console.error('Error fetching player achievements:', error);
    return sendError(res, 'Failed to fetch achievements');
  }
};

/**
 * Get completed achievements only (for profile preview card)
 * GET /api/player/profile/achievements/completed
 */
export const getCompletedAchievements = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, "Authentication required", 401);
    }

    const result = await profileService.getCompletedPlayerAchievements(userId);

    return sendSuccess(res, result);
  } catch (error) {
    console.error('Error fetching completed achievements:', error);
    return sendError(res, 'Failed to fetch completed achievements');
  }
};

/**
 * Upload profile image
 * POST /api/player/profile/upload-image
 * Uses memory storage and uploads directly to Google Cloud Storage
 */
export const uploadProfileImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }

    // Verify file has buffer (from memory storage)
    if (!req.file.buffer) {
      return sendError(res, 'File buffer not available', 400);
    }

    const result = await profileService.uploadProfileImage(userId, {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype
    });

    return sendSuccess(res, result, 'Profile image uploaded successfully');
  } catch (error) {
    console.error('Error uploading profile image:', error);

    return sendError(res, 'Failed to upload profile image');
  }
};

/**
 * Search for players by name or username
 * GET /api/player/search?q=searchTerm&sport=tennis
 */
export const searchPlayers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, sport } = req.query;
    const currentUserId = req.user?.id;

    const filteredPlayers = await searchService.searchPlayers(
      q as string,
      sport as string,
      currentUserId
    );

    return sendSuccess(res, filteredPlayers, 'Players found successfully');
  } catch (error) {
    console.error('Error searching players:', error);
    return sendError(res, 'Failed to search players');
  }
};

/**
 * Get available players for doubles pairing in a season
 * GET /api/player/discover/:seasonId
 */
export const getAvailablePlayersForSeason = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { seasonId } = req.params;
    const { q: searchQuery } = req.query;
    const currentUserId = req.user?.id;

    if (!seasonId) {
      return sendError(res, 'Season ID is required', 400);
    }

    if (!currentUserId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const result = await searchService.getAvailablePlayersForSeason(
      seasonId,
      currentUserId,
      searchQuery as string | undefined
    );

    return sendSuccess(res, result, result.usedFallback
      ? (searchQuery ? 'Showing search results' : 'No friends available')
      : 'Available friends retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting available players:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'User not found' || errorMessage === 'Season not found') {
      return sendError(res, errorMessage, 404);
    }

    return sendError(res, 'Failed to get available players');
  }
};

/**
 * Get user's favorites list
 * GET /api/player/favorites
 */
export const getFavorites = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const favoritesWithDetails = await favoritesService.getFavorites(userId);

    return sendSuccess(res, favoritesWithDetails, 'Favorites retrieved successfully');
  } catch (error) {
    console.error('Error getting favorites:', error);
    return sendError(res, 'Failed to get favorites');
  }
};

/**
 * Add a user to favorites
 * POST /api/player/favorites/:userId
 */
export const addFavorite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { userId: favoritedId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!favoritedId) {
      return sendError(res, 'User ID is required', 400);
    }

    const favorite = await favoritesService.addFavorite(userId, favoritedId);

    return sendSuccess(res, favorite, 'User added to favorites successfully', 201);
  } catch (error: unknown) {
    console.error('Error adding favorite:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to add favorite';
    const statusCode = errorMessage === 'User not found' ? 404 : 400;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Remove a user from favorites
 * DELETE /api/player/favorites/:userId
 */
export const removeFavorite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { userId: favoritedId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!favoritedId) {
      return sendError(res, 'User ID is required', 400);
    }

    await favoritesService.removeFavorite(userId, favoritedId);

    return sendSuccess(res, null, 'User removed from favorites successfully');
  } catch (error: unknown) {
    console.error('Error removing favorite:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to remove favorite';
    const statusCode = errorMessage === 'Favorite not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get public player profile (for viewing other users)
 * GET /api/player/profile/public/:userId
 */
export const getPublicPlayerProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID is required', 400);
    }

    const profileData = await profileService.getPublicPlayerProfile(userId, currentUserId);

    return sendSuccess(res, profileData, 'Player profile retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting public player profile:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get player profile';
    const statusCode = errorMessage === 'Player not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get player's league participation history
 * GET /api/player/:id/leagues
 */
export const getPlayerLeagueHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Player ID is required', 400);
    }

    const result = await competitionHistoryService.getPlayerLeagueHistory(id);

    return sendSuccess(res, result, 'Player league history retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting player league history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player league history';
    const statusCode = errorMessage === 'Player not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get player's season participation history
 * GET /api/player/:id/seasons
 */
export const getPlayerSeasonHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Player ID is required', 400);
    }

    const result = await competitionHistoryService.getPlayerSeasonHistory(id);

    return sendSuccess(res, result, 'Player season history retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting player season history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player season history';
    const statusCode = errorMessage === 'Player not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get player's division participation history
 * GET /api/player/:id/divisions
 */
export const getPlayerDivisionHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Player ID is required', 400);
    }

    const result = await competitionHistoryService.getPlayerDivisionHistory(id);

    return sendSuccess(res, result, 'Player division history retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting player division history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player division history';
    const statusCode = errorMessage === 'Player not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};

/**
 * Get player's match participation history (admin access)
 * GET /api/player/:id/matches/admin
 */
export const getPlayerMatchHistoryAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 'Player ID is required', 400);
    }

    const result = await matchHistoryService.getPlayerMatchHistoryAdmin(id);

    return sendSuccess(res, result, 'Player match history retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting player match history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player match history';
    const statusCode = errorMessage === 'Player not found' ? 404 : 500;
    return sendError(res, errorMessage, statusCode);
  }
};
