/**
 * Player Controller - Thin HTTP Wrapper
 * Delegates business logic to service modules
 */

import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
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

/**
 * Get all players with sports and skill ratings
 * GET /api/player
 */
export const getAllPlayers = async (req: Request, res: Response) => {
  try {
    const players = await searchService.getAllPlayers();

    if (players.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(true, 200, [], "No players found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(true, 200, players, "Players fetched successfully"));
  } catch (error) {
    console.error("Error fetching players:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch players"));
  }
};

/**
 * Get player statistics
 * GET /api/player/stats
 */
export const getPlayerStats = async (req: Request, res: Response) => {
  try {
    const stats = await statsService.getPlayerStats();
    return res
      .status(200)
      .json(new ApiResponse(true, 200, stats, "Player stats fetched successfully"));
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch player stats"));
  }
};

/**
 * Get player by ID with skills
 * GET /api/player/:id
 */
export const getPlayerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const player = await statsService.getPlayerById(id);

    if (!player) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "Player not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(true, 200, player, "Player found successfully"));
  } catch (error) {
    console.error("Error fetching player:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch player"));
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
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const profileData = await profileService.getPlayerProfile(userId);
    return res
      .status(200)
      .json(new ApiResponse(true, 200, profileData, "Player profile fetched successfully"));
  } catch (error: any) {
    console.error("❌ getPlayerProfile: Error fetching player profile:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, error.message || "Failed to fetch player profile"));
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
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const {
      page,
      limit,
      sport,
      outcome,
      startDate,
      endDate
    } = req.query;

    const responseData = await matchHistoryService.getPlayerMatchHistory(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sport: sport as string,
      outcome: outcome as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    return res
      .status(200)
      .json(new ApiResponse(true, 200, responseData, "Match history fetched successfully"));
  } catch (error) {
    console.error("Error fetching match history:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch match history"));
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
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const detailedMatch = await matchHistoryService.getMatchDetails(matchId, userId);
    return res
      .status(200)
      .json(new ApiResponse(true, 200, detailedMatch, "Match details fetched successfully"));
  } catch (error: any) {
    console.error("Error fetching match details:", error);

    if (error.message === 'Match not found') {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "Match not found"));
    }

    if (error.message === 'Access denied') {
      return res
        .status(403)
        .json(new ApiResponse(false, 403, null, "Access denied"));
    }

    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch match details"));
  }
};

/**
 * Update player profile
 * PUT /api/player/profile
 */
export const updatePlayerProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { name, username, email, location, image, phoneNumber, bio } = req.body;

    const updatedUser = await profileService.updatePlayerProfile(userId, {
      name,
      username,
      email,
      location,
      image,
      phoneNumber,
      bio
    });

    return res.json({
      success: true,
      status: 200,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating player profile:', error);
    return res.status(error.message.includes('already taken') ? 400 : 500).json({
      success: false,
      status: error.message.includes('already taken') ? 400 : 500,
      data: null,
      message: error.message || 'Failed to update profile'
    });
  }
};

/**
 * Change player password
 * POST /api/player/password
 */
export const changePlayerPassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    await profileService.changePlayerPassword(userId, currentPassword, newPassword, req.headers);

    return res.json({
      success: true,
      status: 200,
      data: null,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('❌ Error changing password:', error);
    return res.status(error.message.includes('required') || error.message.includes('incorrect') || error.message.includes('8 characters') ? 400 : 500).json({
      success: false,
      status: error.message.includes('required') || error.message.includes('incorrect') || error.message.includes('8 characters') ? 400 : 500,
      data: null,
      message: error.message || 'Failed to change password'
    });
  }
};

/**
 * Get player achievements
 * GET /api/player/achievements
 */
export const getPlayerAchievements = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const result = await profileService.getPlayerAchievements(userId);

    return res.json({
      data: result,
      success: true,
      status: 200,
      message: result.count > 0 ? 'Achievements retrieved successfully' : 'No achievements yet'
    });
  } catch (error) {
    console.error('Error fetching player achievements:', error);
    return res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to fetch achievements'
    });
  }
};

/**
 * Upload profile image
 * POST /api/player/profile/image
 */
export const uploadProfileImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        data: null,
        message: 'User not authenticated'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: 400,
        data: null,
        message: 'No image file provided'
      });
    }

    const result = await profileService.uploadProfileImage(userId, req.file);

    return res.status(200).json({
      success: true,
      status: 200,
      data: result,
      message: 'Profile image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);

    // Clean up temporary file on error
    if (req.file?.path) {
      try {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.log('Could not delete temporary file:', cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to upload profile image'
    });
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

    return res.status(200).json(
      new ApiResponse(true, 200, filteredPlayers, 'Players found successfully')
    );
  } catch (error) {
    console.error('Error searching players:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to search players')
    );
  }
};

/**
 * Get available players for doubles pairing in a season
 * GET /api/player/discover/:seasonId
 */
export const getAvailablePlayersForSeason = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { seasonId } = req.params;
    const currentUserId = req.user?.id;

    if (!seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Season ID is required')
      );
    }

    if (!currentUserId) {
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'User not authenticated')
      );
    }

    const result = await searchService.getAvailablePlayersForSeason(seasonId, currentUserId);

    return res.status(200).json(
      new ApiResponse(true, 200, result, result.usedFallback
        ? 'No friends available. Showing all eligible players.'
        : 'Available friends retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting available players:', error);

    if (error.message === 'User not found' || error.message === 'Season not found') {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get available players')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    const favoritesWithDetails = await favoritesService.getFavorites(userId);

    return res.status(200).json(
      new ApiResponse(true, 200, favoritesWithDetails, 'Favorites retrieved successfully')
    );
  } catch (error) {
    console.error('Error getting favorites:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get favorites')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    const favorite = await favoritesService.addFavorite(userId, favoritedId);

    return res.status(201).json(
      new ApiResponse(true, 201, favorite, 'User added to favorites successfully')
    );
  } catch (error: any) {
    console.error('Error adding favorite:', error);

    const statusCode = error.message === 'User not found' ? 404 : 400;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to add favorite')
    );
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
      return res.status(401).json(
        new ApiResponse(false, 401, null, 'Unauthorized')
      );
    }

    await favoritesService.removeFavorite(userId, favoritedId);

    return res.status(200).json(
      new ApiResponse(true, 200, null, 'User removed from favorites successfully')
    );
  } catch (error: any) {
    console.error('Error removing favorite:', error);

    const statusCode = error.message === 'Favorite not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to remove favorite')
    );
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
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'User ID is required')
      );
    }

    const profileData = await profileService.getPublicPlayerProfile(userId, currentUserId);

    return res.status(200).json(
      new ApiResponse(true, 200, profileData, 'Player profile retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting public player profile:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to get player profile')
    );
  }
};

/**
 * Get player's league participation history
 * GET /api/player/:id/leagues
 */
export const getPlayerLeagueHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await competitionHistoryService.getPlayerLeagueHistory(id);

    return res.status(200).json(
      new ApiResponse(true, 200, result, 'Player league history retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting player league history:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to fetch player league history')
    );
  }
};

/**
 * Get player's season participation history
 * GET /api/player/:id/seasons
 */
export const getPlayerSeasonHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await competitionHistoryService.getPlayerSeasonHistory(id);

    return res.status(200).json(
      new ApiResponse(true, 200, result, 'Player season history retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting player season history:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to fetch player season history')
    );
  }
};

/**
 * Get player's division participation history
 * GET /api/player/:id/divisions
 */
export const getPlayerDivisionHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await competitionHistoryService.getPlayerDivisionHistory(id);

    return res.status(200).json(
      new ApiResponse(true, 200, result, 'Player division history retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting player division history:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to fetch player division history')
    );
  }
};

/**
 * Get player's match participation history (admin access)
 * GET /api/player/:id/matches/admin
 */
export const getPlayerMatchHistoryAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await matchHistoryService.getPlayerMatchHistoryAdmin(id);

    return res.status(200).json(
      new ApiResponse(true, 200, result, 'Player match history retrieved successfully')
    );
  } catch (error: any) {
    console.error('Error getting player match history:', error);

    const statusCode = error.message === 'Player not found' ? 404 : 500;
    return res.status(statusCode).json(
      new ApiResponse(false, statusCode, null, error.message || 'Failed to fetch player match history')
    );
  }
};
