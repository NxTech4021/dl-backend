/**
 * Player Favorites Service
 * Handles favorite players functionality
 */

import { prisma } from '../../lib/prisma';
import { Role } from "@prisma/client";
import { enrichPlayersWithSkills } from './utils/playerTransformer';

/**
 * Get user's favorites list with sports and ratings
 * Original: playerController.ts lines 1378-1446
 */
export async function getFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      favorited: {
        select: {
          id: true,
          name: true,
          username: true,
          displayUsername: true,
          image: true,
          bio: true,
          area: true,
          gender: true,
          createdAt: true,
          lastLogin: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Extract favorited users and enrich with sports/skills
  // Filter out null/undefined and preserve the original favorite for timestamp
  const validFavorites = favorites.filter(fav => fav.favorited !== null);
  const favoritedUsers = validFavorites.map(fav => fav.favorited);
  const enrichedUsers = await enrichPlayersWithSkills(favoritedUsers);

  // Add favoritedAt timestamp to each user
  const favoritesWithDetails = enrichedUsers.map((user, index) => ({
    ...user,
    favoritedAt: validFavorites[index]!.createdAt,
  }));

  return favoritesWithDetails;
}

/**
 * Add a user to favorites
 * Original: playerController.ts lines 1452-1530
 */
export async function addFavorite(userId: string, targetUserId: string) {
  if (!targetUserId) {
    throw new Error('User ID is required');
  }

  if (userId === targetUserId) {
    throw new Error('Cannot favorite yourself');
  }

  // Check if user exists
  const userToFavorite = await prisma.user.findUnique({
    where: { id: targetUserId, role: Role.USER, status: 'active' },
  });

  if (!userToFavorite) {
    throw new Error('User not found');
  }

  // Check if already favorited
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_favoritedId: {
        userId,
        favoritedId: targetUserId,
      },
    },
  });

  if (existingFavorite) {
    throw new Error('User already in favorites');
  }

  // Create favorite
  const favorite = await prisma.favorite.create({
    data: {
      userId,
      favoritedId: targetUserId,
    },
    include: {
      favorited: {
        select: {
          id: true,
          name: true,
          username: true,
          displayUsername: true,
          image: true,
        },
      },
    },
  });

  return favorite;
}

/**
 * Remove a user from favorites
 * Original: playerController.ts lines 1536-1588
 */
export async function removeFavorite(userId: string, targetUserId: string) {
  if (!targetUserId) {
    throw new Error('User ID is required');
  }

  // Check if favorite exists
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_favoritedId: {
        userId,
        favoritedId: targetUserId,
      },
    },
  });

  if (!existingFavorite) {
    throw new Error('Favorite not found');
  }

  // Delete favorite
  await prisma.favorite.delete({
    where: {
      userId_favoritedId: {
        userId,
        favoritedId: targetUserId,
      },
    },
  });

  return { success: true };
}
