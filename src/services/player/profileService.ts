/**
 * Player Profile Service
 * Handles profile retrieval, updates, achievements, and image uploads
 */

import { prisma } from '../../lib/prisma';
import { Role } from "@prisma/client";
import { auth } from '../../lib/auth';
import * as bcrypt from "bcryptjs";
import {
  uploadProfileImage as uploadToStorage,
  deleteProfileImage
} from '../../config/cloudStorage.config';
import {
  fetchPlayerQuestionnairesDetailed,
  extractSports,
  buildSkillRatings,
  fetchPlayerQuestionnaires
} from './utils/playerTransformer';

/**
 * Get authenticated user's full profile (Pattern B with questionnaireStatus)
 * Original: playerController.ts lines 269-438
 */
export async function getPlayerProfile(userId: string) {
  const player = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get all questionnaire responses (including placeholder entries for skipped questionnaires)
  const responses = await prisma.questionnaireResponse.findMany({
    where: { userId },
    orderBy: [
      { completedAt: 'desc' }, // Completed responses first
      { startedAt: 'desc' }, // Then by start date for placeholder entries
    ],
  });

  // Get results for completed responses
  const completedResponseIds = responses
    .filter(r => r.completedAt)
    .map(r => r.id);

  const results = completedResponseIds.length > 0
    ? await prisma.initialRatingResult.findMany({
        where: {
          responseId: { in: completedResponseIds }
        }
      })
    : [];

  // Create a map of responseId to result
  const resultMap = new Map(results.map(r => [r.responseId, r]));

  // Get recent match history (commented out until schema is fixed)
  const recentMatches: any[] = [];

  // Extract all sports (including those from placeholder entries)
  const allSports = Array.from(new Set(responses.map(r => r.sport.toLowerCase())));

  // Create questionnaire completion status map
  const questionnaireStatus = responses.reduce((acc, res) => {
    acc[res.sport.toLowerCase()] = {
      isCompleted: !!res.completedAt,
      startedAt: res.startedAt,
      completedAt: res.completedAt,
    };
    return acc;
  }, {} as Record<string, { isCompleted: boolean; startedAt: Date; completedAt: Date | null }>);

  // Process ratings (only from completed questionnaires)
  const skillRatings = responses.reduce((acc, res) => {
    const result = resultMap.get(res.id);
    if (result && res.completedAt) {
      acc[res.sport.toLowerCase()] = {
        singles: result.singles ? result.singles / 1000 : null,
        doubles: result.doubles ? result.doubles / 1000 : null,
        rating: (result.doubles ?? result.singles ?? 0) / 1000,
        confidence: result.confidence ?? 'N/A',
        rd: result.rd ?? 0,
        lastUpdated: res.completedAt,
      };
    }
    return acc;
  }, {} as Record<string, { singles: number | null; doubles: number | null; rating: number; confidence: string; rd: number; lastUpdated: Date | null }>);

  // Process recent matches
  const processedMatches = recentMatches.map(match => {
    const currentUserParticipant = match.participants.find(p => p.userId === userId);
    const opponentParticipant = match.participants.find(p => p.userId !== userId);

    return {
      id: match.id,
      sport: match.sport,
      date: match.matchDate,
      playerId: currentUserParticipant?.userId,
      opponentId: opponentParticipant?.userId,
      playerScore: match.playerScore,
      opponentScore: match.opponentScore,
      outcome: match.outcome,
      location: match.location,
      opponent: opponentParticipant?.user ? {
        name: opponentParticipant.user.name,
        username: opponentParticipant.user.username,
        image: opponentParticipant.user.image,
      } : null,
    };
  });

  const activityStatus = 'active'; // TODO: Fix checkPlayerActivityStatus

  return {
    id: player.id,
    name: player.name,
    username: player.username,
    displayUsername: player.displayUsername,
    email: player.email,
    image: player.image || null,
    gender: player.gender,
    dateOfBirth: player.dateOfBirth,
    area: player.area,
    phoneNumber: player.phoneNumber,
    bio: player.bio,
    status: activityStatus,
    lastLogin: player.lastLogin,
    registeredDate: player.createdAt,
    sports: allSports,
    skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
    questionnaireStatus: questionnaireStatus,
    recentMatches: processedMatches,
    totalMatches: 0, // TODO: Fix match count query
  };
}

/**
 * Get public player profile with friendship status (Pattern A)
 * Original: playerController.ts lines 1594-1719
 */
export async function getPublicPlayerProfile(userId: string, viewerId?: string) {
  // Get player basic info (exclude sensitive data)
  const player = await prisma.user.findUnique({
    where: { id: userId, role: Role.USER },
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
    },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get sports and ratings
  const responses = await fetchPlayerQuestionnaires(userId);
  const completedResponses = responses.filter(r => r.completedAt);

  const sports = extractSports(completedResponses);
  const skillRatings = buildSkillRatings(completedResponses);

  // Get recent matches (last 5)
  const recentMatches = await prisma.match.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { name: true, username: true, image: true },
          },
        },
      },
    },
    orderBy: { matchDate: 'desc' },
    take: 5,
  });

  // Count total matches
  const totalMatches = await prisma.match.count({
    where: {
      participants: {
        some: { userId },
      },
    },
  });

  // Check if current user is friends with this player
  const isFriend = viewerId
    ? await prisma.friendship.findFirst({
        where: {
          OR: [
            {
              requesterId: viewerId,
              recipientId: userId,
              status: 'ACCEPTED',
            },
            {
              requesterId: userId,
              recipientId: viewerId,
              status: 'ACCEPTED',
            },
          ],
        },
      })
    : null;

  return {
    ...player,
    sports,
    skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
    recentMatches,
    totalMatches,
    isFriend: !!isFriend,
  };
}

/**
 * Update player profile
 * Original: playerController.ts lines 676-771
 */
export async function updatePlayerProfile(
  userId: string,
  data: {
    name?: string;
    username?: string;
    email?: string;
    location?: string;
    image?: string;
    phoneNumber?: string;
    bio?: string;
  }
) {
  const { name, username, email, location, image, phoneNumber, bio } = data;

  // Validate required fields
  if (!name || !username || !email) {
    throw new Error('Name, username, and email are required');
  }

  // Check if username is already taken by another user
  if (username) {
    const existingUser = await prisma.user.findFirst({
      where: {
        username: username,
        id: { not: userId }
      }
    });

    if (existingUser) {
      throw new Error('Username is already taken');
    }
  }

  // Check if email is already taken by another user
  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email,
        id: { not: userId }
      }
    });

    if (existingEmail) {
      throw new Error('Email is already taken');
    }
  }

  // Update user profile
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: name.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      area: location ? location.trim() : undefined,
      image: image || undefined,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      bio: bio ? bio.trim() : undefined,
      updatedAt: new Date()
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      area: true,
      phoneNumber: true,
      bio: true,
      updatedAt: true
    }
  });

  return updatedUser;
}

/**
 * Upload profile image
 * Uses memory storage and uploads directly to Google Cloud Storage
 */
export async function uploadProfileImage(userId: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
  // Get current user to check for existing image
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true }
  });

  // Delete old profile image if it exists
  if (currentUser?.image) {
    try {
      await deleteProfileImage(currentUser.image);
    } catch (error) {
      console.log('Could not delete old profile image:', error);
      // Continue with upload even if deletion fails
    }
  }

  // Upload new image to cloud storage directly from buffer
  const imageUrl = await uploadToStorage(
    file.buffer,
    userId,
    file.originalname,
    file.mimetype
  );

  // Update user's image URL in database
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      username: true,
      displayUsername: true
    }
  });

  return {
    user: updatedUser,
    imageUrl: imageUrl
  };
}

/**
 * Change player password
 * Original: playerController.ts lines 773-912
 */
export async function changePlayerPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  requestHeaders: any
) {
  console.log(`🔑 Password change request for user: ${userId}`);

  // Validate required fields
  if (!currentPassword || !newPassword) {
    throw new Error('Current password and new password are required');
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  console.log(`🔑 Attempting to change password via better-auth API...`);

  try {
    // Use better-auth's built-in password change functionality
    const result = await auth.api.changePassword({
      body: {
        newPassword,
        currentPassword,
      },
      headers: requestHeaders,
    });

    console.log(`🔑 Better-auth result:`, result);

    if (result.error) {
      console.log(`❌ Better-auth password change failed:`, result.error);
      throw new Error(result.error.message || 'Failed to change password');
    }
  } catch (apiError: any) {
    console.log(`❌ Better-auth API error:`, apiError);

    // If better-auth changePassword doesn't exist, let's try a different approach
    if (apiError.message && apiError.message.includes('changePassword')) {
      console.log(`🔑 Falling back to manual password update...`);

      // Get the user from the session
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { accounts: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Find the email account
      const emailAccount = user.accounts.find(account => account.providerId === 'credential');

      if (!emailAccount) {
        throw new Error('No email account found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, emailAccount.password);

      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password in database
      await prisma.account.update({
        where: { id: emailAccount.id },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Password manually updated for user: ${userId}`);
    } else {
      throw apiError;
    }
  }

  console.log(`✅ Password changed successfully for user: ${userId}`);
  return { success: true };
}

/**
 * Get player achievements
 * Original: playerController.ts lines 914-972
 */
export async function getPlayerAchievements(userId: string) {
  // Get user's achievements with achievement details
  const userAchievements = await prisma.userAchievement.findMany({
    where: {
      userId: userId,
    },
    include: {
      achievement: {
        select: {
          id: true,
          title: true,
          description: true,
          icon: true,
          category: true,
          points: true,
        }
      }
    },
    orderBy: {
      unlockedAt: 'desc'
    }
  });

  // Format the response
  const achievements = userAchievements.map(userAchievement => ({
    id: userAchievement.achievement.id,
    title: userAchievement.achievement.title,
    description: userAchievement.achievement.description,
    icon: userAchievement.achievement.icon,
    category: userAchievement.achievement.category,
    points: userAchievement.achievement.points,
    unlockedAt: userAchievement.unlockedAt,
    isCompleted: userAchievement.isCompleted,
  }));

  return {
    achievements,
    totalPoints: achievements.reduce((sum, achievement) => sum + achievement.points, 0),
    count: achievements.length
  };
}
