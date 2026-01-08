/**
 * Player Profile Service
 * Handles profile retrieval, updates, achievements, and image uploads
 */

import { prisma } from '../../lib/prisma';
import { Role, GameType, SportType } from "@prisma/client";
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
 * DMR Rating data structure for profile
 */
interface DMRRating {
  singles: number | null;
  doubles: number | null;
  singlesRD: number | null;
  doublesRD: number | null;
  singlesMatches: number;
  doublesMatches: number;
  singlesProvisional: boolean;
  doublesProvisional: boolean;
  lastUpdated: Date | null;
}

/**
 * Rating history entry for graphs
 */
interface RatingHistoryEntry {
  date: string;
  rating: number;
  ratingChange: number;
  matchId: string;
  opponent: string | null;
  opponentImage: string | null;
  result: 'W' | 'L';
  score: string;
  gameType: string;
}

/**
 * Fetch actual DMR ratings from PlayerRating table
 */
async function fetchDMRRatings(userId: string): Promise<Record<string, DMRRating>> {
  const ratings = await prisma.playerRating.findMany({
    where: { userId },
    orderBy: { lastUpdatedAt: 'desc' },
  });

  // Group by sport
  const dmrRatings: Record<string, DMRRating> = {};

  for (const rating of ratings) {
    const sport = rating.sport.toLowerCase();
    if (!dmrRatings[sport]) {
      dmrRatings[sport] = {
        singles: null,
        doubles: null,
        singlesRD: null,
        doublesRD: null,
        singlesMatches: 0,
        doublesMatches: 0,
        singlesProvisional: true,
        doublesProvisional: true,
        lastUpdated: null,
      };
    }

    if (rating.gameType === GameType.SINGLES) {
      dmrRatings[sport].singles = rating.currentRating;
      dmrRatings[sport].singlesRD = rating.ratingDeviation;
      dmrRatings[sport].singlesMatches = rating.matchesPlayed;
      dmrRatings[sport].singlesProvisional = rating.isProvisional;
      if (!dmrRatings[sport].lastUpdated || rating.lastUpdatedAt > dmrRatings[sport].lastUpdated!) {
        dmrRatings[sport].lastUpdated = rating.lastUpdatedAt;
      }
    } else if (rating.gameType === GameType.DOUBLES) {
      dmrRatings[sport].doubles = rating.currentRating;
      dmrRatings[sport].doublesRD = rating.ratingDeviation;
      dmrRatings[sport].doublesMatches = rating.matchesPlayed;
      dmrRatings[sport].doublesProvisional = rating.isProvisional;
      if (!dmrRatings[sport].lastUpdated || rating.lastUpdatedAt > dmrRatings[sport].lastUpdated!) {
        dmrRatings[sport].lastUpdated = rating.lastUpdatedAt;
      }
    }
  }

  return dmrRatings;
}

/**
 * Fetch rating history for graph display
 */
async function fetchRatingHistory(
  userId: string,
  sport?: string,
  gameType?: GameType,
  limit: number = 20
): Promise<RatingHistoryEntry[]> {
  // Find relevant PlayerRating records
  const whereClause: any = { userId };
  if (sport) {
    whereClause.sport = sport.toUpperCase() as SportType;
  }
  if (gameType) {
    whereClause.gameType = gameType;
  }

  const playerRatings = await prisma.playerRating.findMany({
    where: whereClause,
    select: { id: true },
  });

  if (playerRatings.length === 0) {
    return [];
  }

  const playerRatingIds = playerRatings.map(pr => pr.id);

  // Fetch rating history with match details
  const history = await prisma.ratingHistory.findMany({
    where: {
      playerRatingId: { in: playerRatingIds },
      matchId: { not: null }, // Only entries from matches
      reason: 'MATCH_RESULT' as any, // RatingChangeReason enum
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Fetch match details for each history entry
  const matchIds = history.map(h => h.matchId).filter(Boolean) as string[];
  const matches = matchIds.length > 0
    ? await prisma.match.findMany({
        where: { id: { in: matchIds } },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
            },
          },
          pickleballScores: true,
          scores: true,
        },
      })
    : [];

  const matchMap = new Map(matches.map(m => [m.id, m]));

  // Fetch player rating game types
  const playerRatingMap = new Map<string, GameType>();
  const prIds = [...new Set(history.map(h => h.playerRatingId))];
  if (prIds.length > 0) {
    const prs = await prisma.playerRating.findMany({
      where: { id: { in: prIds } },
      select: { id: true, gameType: true },
    });
    prs.forEach(pr => playerRatingMap.set(pr.id, pr.gameType));
  }

  return history.map(h => {
    const match = h.matchId ? matchMap.get(h.matchId) : null;
    const opponent = match?.participants.find((p: any) => p.userId !== userId)?.user;

    // Determine result (positive delta = win)
    const result: 'W' | 'L' = h.delta >= 0 ? 'W' : 'L';

    // Build score string
    let score = '-';
    if (match?.pickleballScores && match.pickleballScores.length > 0) {
      score = match.pickleballScores
        .map((s: any) => `${s.player1Points}-${s.player2Points}`)
        .join(', ');
    } else if (match?.scores && match.scores.length > 0) {
      score = match.scores
        .map((s: any) => `${s.player1Games}-${s.player2Games}`)
        .join(', ');
    }

    return {
      date: h.createdAt.toISOString(),
      rating: h.ratingAfter,
      ratingChange: h.delta,
      matchId: h.matchId || '',
      opponent: opponent?.name || null,
      opponentImage: opponent?.image || null,
      result,
      score,
      gameType: playerRatingMap.get(h.playerRatingId) || 'SINGLES',
    };
  }).reverse(); // Oldest first for graph
}

/**
 * Get authenticated user's full profile (Pattern B with questionnaireStatus)
 * Now includes actual DMR ratings from PlayerRating table
 */
export async function getPlayerProfile(userId: string) {
  const player = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  // Get user settings (includes self-assessed skill levels from onboarding)
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      tennisSkillLevel: true,
      pickleballSkillLevel: true,
      padelSkillLevel: true,
    },
  });

  // Get all questionnaire responses (including placeholder entries for skipped questionnaires)
  const responses = await prisma.questionnaireResponse.findMany({
    where: { userId },
    orderBy: [
      { completedAt: 'desc' }, // Completed responses first
      { startedAt: 'desc' }, // Then by start date for placeholder entries
    ],
  });

  // Get results for completed responses (initial ratings from questionnaire)
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

  // Get initial ratings from questionnaire (for reference/fallback)
  const initialRatings = responses.reduce((acc, res) => {
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

  // Fetch actual DMR ratings from PlayerRating table
  const dmrRatings = await fetchDMRRatings(userId);

  // Merge DMR ratings with initial ratings (DMR takes precedence)
  // Format for frontend: ratings in whole numbers (e.g., 1500, not 1.5)
  const skillRatings: Record<string, any> = {};

  for (const sport of allSports) {
    const initial = initialRatings[sport];
    const dmr = dmrRatings[sport];

    if (dmr) {
      // Use actual DMR ratings
      skillRatings[sport] = {
        // Divide by 1000 for frontend compatibility (frontend multiplies by 1000)
        singles: dmr.singles ? dmr.singles / 1000 : (initial?.singles || null),
        doubles: dmr.doubles ? dmr.doubles / 1000 : (initial?.doubles || null),
        rating: (dmr.doubles || dmr.singles || initial?.rating || 0) / 1000,
        // Additional DMR-specific data
        singlesRD: dmr.singlesRD,
        doublesRD: dmr.doublesRD,
        singlesMatches: dmr.singlesMatches,
        doublesMatches: dmr.doublesMatches,
        singlesProvisional: dmr.singlesProvisional,
        doublesProvisional: dmr.doublesProvisional,
        confidence: initial?.confidence || 'N/A',
        lastUpdated: dmr.lastUpdated || initial?.lastUpdated,
      };
    } else if (initial) {
      // Fall back to initial questionnaire ratings
      skillRatings[sport] = {
        ...initial,
        singlesRD: initial.rd,
        doublesRD: initial.rd,
        singlesMatches: 0,
        doublesMatches: 0,
        singlesProvisional: true,
        doublesProvisional: true,
      };
    }
  }

  // Get recent matches count
  const totalMatches = await prisma.match.count({
    where: {
      participants: { some: { userId } },
      status: 'COMPLETED',
    },
  });

  // Get recent completed matches for profile display
  const recentMatches = await prisma.match.findMany({
    where: {
      participants: { some: { userId } },
      status: 'COMPLETED',
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
    },
    orderBy: { matchDate: 'desc' },
    take: 5,
  });

  // Process recent matches
  const processedMatches = recentMatches.map(match => {
    const currentUserParticipant = match.participants.find((p) => p.userId === userId);
    const opponentParticipant = match.participants.find((p) => p.userId !== userId);

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

  // Build self-assessed skill levels object (from onboarding)
  const selfAssessedSkillLevels: Record<string, string | null> = {};
  if (userSettings) {
    if (userSettings.tennisSkillLevel) {
      selfAssessedSkillLevels.tennis = userSettings.tennisSkillLevel;
    }
    if (userSettings.pickleballSkillLevel) {
      selfAssessedSkillLevels.pickleball = userSettings.pickleballSkillLevel;
    }
    if (userSettings.padelSkillLevel) {
      selfAssessedSkillLevels.padel = userSettings.padelSkillLevel;
    }
  }

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
    selfAssessedSkillLevels: Object.keys(selfAssessedSkillLevels).length > 0 ? selfAssessedSkillLevels : null,
    questionnaireStatus: questionnaireStatus,
    recentMatches: processedMatches,
    totalMatches,
  };
}

/**
 * Get rating history for a player (for graph display)
 * Exported for use by controller
 */
export async function getPlayerRatingHistory(
  userId: string,
  sport?: string,
  gameType?: string,
  limit: number = 20
): Promise<RatingHistoryEntry[]> {
  const gt = gameType === 'doubles' ? GameType.DOUBLES :
             gameType === 'singles' ? GameType.SINGLES : undefined;
  return fetchRatingHistory(userId, sport, gt, limit);
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

  // Get user settings for self-assessed skill levels
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      tennisSkillLevel: true,
      pickleballSkillLevel: true,
      padelSkillLevel: true,
    },
  });

  // Build selfAssessedSkillLevels object (same pattern as private profile)
  const selfAssessedSkillLevels: Record<string, string> = {};
  if (userSettings) {
    if (userSettings.tennisSkillLevel) {
      selfAssessedSkillLevels.tennis = userSettings.tennisSkillLevel;
    }
    if (userSettings.pickleballSkillLevel) {
      selfAssessedSkillLevels.pickleball = userSettings.pickleballSkillLevel;
    }
    if (userSettings.padelSkillLevel) {
      selfAssessedSkillLevels.padel = userSettings.padelSkillLevel;
    }
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
    selfAssessedSkillLevels: Object.keys(selfAssessedSkillLevels).length > 0 ? selfAssessedSkillLevels : null,
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
    image?: string | null;
    phoneNumber?: string;
    bio?: string;
    dateOfBirth?: string;
  }
) {
  const { name, username, email, location, image, phoneNumber, bio, dateOfBirth } = data;

  // Validate fields only if they are being updated (not undefined)
  // This allows partial updates without requiring all fields
  if (name !== undefined && !name.trim()) {
    throw new Error('Name cannot be empty');
  }

  if (username !== undefined && !username.trim()) {
    throw new Error('Username cannot be empty');
  }

  if (email !== undefined && !email.trim()) {
    throw new Error('Email cannot be empty');
  }

  // Check if username is already taken by another user (only if being updated)
  if (username !== undefined) {
    const existingUser = await prisma.user.findFirst({
      where: {
        username: username.trim(),
        id: { not: userId }
      }
    });

    if (existingUser) {
      throw new Error('Username is already taken');
    }
  }

  // Check if email is already taken by another user (only if being updated)
  if (email !== undefined) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        id: { not: userId }
      }
    });

    if (existingEmail) {
      throw new Error('Email is already taken');
    }
  }

  // Build update data object dynamically based on what's provided
  const updateData: {
    name?: string;
    username?: string;
    email?: string;
    area?: string;
    image?: string | null;
    phoneNumber?: string;
    bio?: string;
    dateOfBirth?: Date;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (name !== undefined) {
    updateData.name = name.trim();
  }
  if (username !== undefined) {
    updateData.username = username.trim();
  }
  if (email !== undefined) {
    updateData.email = email.trim().toLowerCase();
  }
  if (location !== undefined) {
    updateData.area = location.trim();
  }
  if (image !== undefined) {
    // If setting image to null, delete the old image from cloud storage
    if (image === null) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { image: true }
      });

      if (currentUser?.image) {
        try {
          await deleteProfileImage(currentUser.image);
          console.log('✅ Deleted old profile image from cloud storage:', currentUser.image);
        } catch (error) {
          console.error('⚠️ Could not delete old profile image from cloud storage:', error);
          // Continue with update even if deletion fails
        }
      }
    }
    updateData.image = image || null;
  }
  if (phoneNumber !== undefined) {
    updateData.phoneNumber = phoneNumber?.trim() ?? null;
  }
  if (bio !== undefined) {
    updateData.bio = bio?.trim() ?? null;
  }
  if (dateOfBirth !== undefined) {
    // Store date at noon UTC to prevent timezone shifts from changing the calendar date
    // When frontend sends "2000-01-01", we store as "2000-01-01T12:00:00Z" instead of midnight
    // This ensures the date displays correctly in any timezone (UTC-12 to UTC+14)
    if (dateOfBirth) {
      const [year, month, day] = dateOfBirth.split('-').map(Number) as [number, number, number];
      updateData.dateOfBirth = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    } else {
      (updateData as any).dateOfBirth = null;
    }
  }

  // Update user profile
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      area: true,
      phoneNumber: true,
      bio: true,
      dateOfBirth: true,
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

  try {
    // Use better-auth's built-in password change functionality
    const result = await auth.api.changePassword({
      body: {
        newPassword,
        currentPassword,
      },
      headers: requestHeaders,
    });

    // console.log(`🔑 Better-auth result:`, result);

    // Check if result indicates failure (better-auth may return error differently)
    if (!result || !result.user) {
      console.log(`❌ Better-auth password change failed`);
      throw new Error('Failed to change password');
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

      if (!emailAccount.password) {
        throw new Error('No password found for email account');
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
