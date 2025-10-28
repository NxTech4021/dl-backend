import { Request, Response } from "express";
import { Role, UserStatus } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { auth } from "../lib/auth";
import * as bcrypt from "bcryptjs";
import multer from "multer";
import { uploadProfileImage as uploadToStorage, deleteProfileImage } from "../config/cloudStorage.config";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export const getAllPlayers = async (req: Request, res: Response) => {
  try {
    const players = await prisma.user.findMany({
      where: {
        role: Role.USER,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (players.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(true, 200, [], "No players found"));
    }

    const playerIds = players.map((p) => p.id);

    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        userId: { in: playerIds },
      },
      include: {
        result: true,
      },
    });

    const responsesByUserId = responses.reduce((acc, res) => {
      (acc[res.userId] = acc[res.userId] || []).push(res);
      return acc;
    }, {} as Record<string, typeof responses>);

    const transformedPlayers = players.map((player) => {
      const userResponses = responsesByUserId[player.id] || [];

      // Extract sports from ALL questionnaires (both completed and incomplete)
      const sports = [
        ...new Set(userResponses.map((r) => r.sport.toLowerCase())),
      ];

      // Only create skill ratings from COMPLETED questionnaires with results
      const skillRatings = userResponses.reduce((acc, res) => {
        if (res.result && res.completedAt) {
          const rating = res.result.doubles ?? res.result.singles ?? 0;
          acc[res.sport.toLowerCase()] = {
            rating: rating / 1000,
            confidence: res.result.confidence ?? "N/A",
            rd: res.result.rd ?? 0,
          };
        }
        return acc;
      }, {} as Record<string, { rating: number; confidence: string; rd: number }>);

      return {
        id: player.id,
        name: player.name,
        displayUsername: player.displayUsername,
        email: player.email,
        emailVerified: player.emailVerified,
        image: player.image,
        area: player.area,
        gender: player.gender,
        dateOfBirth: player.dateOfBirth,
        registeredDate: player.createdAt,
        lastLoginDate: player.lastLogin,
        sports: sports,
        skillRatings:
          Object.keys(skillRatings).length > 0 ? skillRatings : null,
        status: player.status,
        completedOnboarding: player.completedOnboarding,
      };
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          true,
          200,
          transformedPlayers,
          "Players fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching players:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch players"));
  }
};

export const getPlayerStats = async (req: Request, res: Response) => {
  try {
    const totalPlayers = prisma.user.count({
      where: { role: Role.USER },
    });

    const activePlayers = prisma.user.count({
      where: { role: Role.USER, status: UserStatus.ACTIVE },
    });

    const inactivePlayers = prisma.user.count({
      where: { role: Role.USER, status: UserStatus.INACTIVE },
    });

    const verifiedPlayers = prisma.user.count({
      where: { role: Role.USER, emailVerified: true },
    });

    const [total, active, inactive, verified] = await prisma.$transaction([
      totalPlayers,
      activePlayers,
      inactivePlayers,
      verifiedPlayers,
    ]);

    const stats = {
      total,
      active,
      inactive,
      verified,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(true, 200, stats, "Player stats fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch player stats"));
  }
};

export const getPlayerById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const player = await prisma.user.findUnique({
      where: {
        id,
        role: Role.USER,
      },
      include: {
        accounts: {
          select: {
            providerId: true,
            createdAt: true,
          },
        },
        sessions: {
          select: {
            ipAddress: true,
            userAgent: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!player) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "Player not found"));
    }

    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        userId: id,
      },
      include: {
        result: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    const sports = [...new Set(responses.map((r) => r.sport.toLowerCase()))];
    const skillRatings = responses.reduce((acc, res) => {
      if (res.result) {
        const rating = res.result.doubles ?? res.result.singles ?? 0;
        acc[res.sport.toLowerCase()] = {
          rating: rating / 1000,
          confidence: res.result.confidence ?? "N/A",
          rd: res.result.rd ?? 0,
          lastUpdated: res.completedAt,
        };
      }
      return acc;
    }, {} as Record<string, { rating: number; confidence: string; rd: number; lastUpdated: Date | null }>);

    const profileData = {
      ...player,
      registeredDate: player.createdAt,
      lastLoginDate: player.lastLogin,
      sports,
      skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
      questionnaires: responses,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          true,
          200,
          profileData,
          "Player profile fetched successfully"
        )
      );
  } catch (error) {
    console.error(`Error fetching profile for player ${id}:`, error);
    return res
      .status(500)
      .json(
        new ApiResponse(false, 500, null, "Failed to fetch player profile")
      );
  }
};
export const getPlayerProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const player = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!player) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "Player not found"));
    }
    // Get all questionnaire responses (including placeholder entries for skipped questionnaires)
    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        userId: userId,
      },
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
    // Get recent match history using MatchParticipant
    // TODO: Fix this query to work with the current schema
    const recentMatches: any[] = []; // Commented out until schema is fixed
    // const recentMatches = await prisma.match.findMany({
    //   where: {
    //     participants: {
    //       some: {
    //         userId: userId,
    //       },
    //     },
    //   },
    //   include: {
    //     participants: {
    //       include: {
    //         user: {
    //           select: { name: true, username: true, image: true }
    //         }
    //       }
    //     },
    //   },
    //   orderBy: {
    //     matchDate: 'desc',
    //   },
    //   take: 5,
    // });

    // Extract all sports (including those from placeholder entries)
    const allSports = [...new Set(responses.map(r => r.sport.toLowerCase()))];
    
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
      if (result && res.completedAt) { // Only include completed questionnaires with results
        acc[res.sport.toLowerCase()] = {
          singles: result.singles ? result.singles / 1000 : null,
          doubles: result.doubles ? result.doubles / 1000 : null,
          rating: (result.doubles ?? result.singles ?? 0) / 1000, // Keep general rating for backward compatibility
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

    // Check activity status
    // TODO: Fix this function to work with the current schema
    const activityStatus = 'active'; // Commented out until schema is fixed
    // const activityStatus = await checkPlayerActivityStatus(userId);

    const profileData = {
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
      sports: allSports, // Include all sports (both completed and placeholder)
      skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
      questionnaireStatus: questionnaireStatus, // Include questionnaire completion status for each sport
      recentMatches: processedMatches,
      totalMatches: 0, // TODO: Fix this query to work with the current schema
      // totalMatches: await prisma.match.count({
      //   where: {
      //     participants: {
      //       some: {
      //         userId: userId,
      //       },
      //     },
      //   },
      // }),
    };

    return res
      .status(200)
      .json(new ApiResponse(true, 200, profileData, "Player profile fetched successfully"));

  } catch (error) {
    console.error("❌ getPlayerProfile: Error fetching player profile:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch player profile"));
  }
};

export const getPlayerMatchHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const { 
      page = 1, 
      limit = 10, 
      sport, 
      outcome, 
      startDate, 
      endDate 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Build where clause with filters
    const whereClause: any = {
      OR: [{ playerId: userId }, { opponentId: userId }],
    };

    if (sport) {
      whereClause.sport = sport;
    }

    if (startDate || endDate) {
      whereClause.matchDate = {};
      if (startDate) whereClause.matchDate.gte = new Date(startDate as string);
      if (endDate) whereClause.matchDate.lte = new Date(endDate as string);
    }

    // Get matches with pagination
    const [matches, totalCount] = await prisma.$transaction([
      prisma.match.findMany({
        where: whereClause,
        include: {
          player: {
            select: { name: true, username: true, image: true }
          },
          opponent: {
            select: { name: true, username: true, image: true }
          },
          stats: true,
        },
        orderBy: { matchDate: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.match.count({ where: whereClause }),
    ]);

    // Process matches with outcome filtering if needed
    let processedMatches = matches.map(match => {
      const isPlayer = match.playerId === userId;
      const matchOutcome = isPlayer 
        ? match.outcome 
        : (match.outcome === 'win' ? 'loss' : match.outcome === 'loss' ? 'win' : 'draw');

      return {
        id: match.id,
        sport: match.sport,
        matchType: match.matchType,
        date: match.matchDate,
        opponent: isPlayer ? match.opponent : match.player,
        playerScore: isPlayer ? match.playerScore : match.opponentScore,
        opponentScore: isPlayer ? match.opponentScore : match.playerScore,
        outcome: matchOutcome,
        location: match.location,
        duration: match.duration,
        notes: match.notes,
        stats: match.stats,
      };
    });

    // Apply outcome filter if specified
    if (outcome && outcome !== 'all') {
      processedMatches = processedMatches.filter(match => match.outcome === outcome);
    }

    const totalPages = Math.ceil(totalCount / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;

    const responseData = {
      matches: processedMatches,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: Number(limit),
      },
    };

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

export const getMatchDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { matchId } = req.params;
    
    if (!userId) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "Authentication required"));
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        player: {
          select: { name: true, username: true, image: true, id: true }
        },
        opponent: {
          select: { name: true, username: true, image: true, id: true }
        },
        stats: true,
      },
    });

    if (!match) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "Match not found"));
    }

    // Check if user is part of this match
    if (match.playerId !== userId && match.opponentId !== userId) {
      return res
        .status(403)
        .json(new ApiResponse(false, 403, null, "Access denied"));
    }

    const isPlayer = match.playerId === userId;
    const matchOutcome = isPlayer 
      ? match.outcome 
      : (match.outcome === 'win' ? 'loss' : match.outcome === 'loss' ? 'win' : 'draw');

    const detailedMatch = {
      id: match.id,
      sport: match.sport,
      matchType: match.matchType,
      date: match.matchDate,
      player: isPlayer ? match.player : match.opponent,
      opponent: isPlayer ? match.opponent : match.player,
      playerScore: isPlayer ? match.playerScore : match.opponentScore,
      opponentScore: isPlayer ? match.opponentScore : match.playerScore,
      outcome: matchOutcome,
      location: match.location,
      duration: match.duration,
      notes: match.notes,
      createdAt: match.createdAt,
      stats: match.stats ? {
        playerStats: {
          aces: isPlayer ? match.stats.playerAces : match.stats.opponentAces,
          unforcedErrors: isPlayer ? match.stats.playerUnforcedErrors : match.stats.opponentUnforcedErrors,
          winners: isPlayer ? match.stats.playerWinners : match.stats.opponentWinners,
          doubleFaults: isPlayer ? match.stats.playerDoubleFaults : match.stats.opponentDoubleFaults,
        },
        opponentStats: {
          aces: isPlayer ? match.stats.opponentAces : match.stats.playerAces,
          unforcedErrors: isPlayer ? match.stats.opponentUnforcedErrors : match.stats.playerUnforcedErrors,
          winners: isPlayer ? match.stats.opponentWinners : match.stats.playerWinners,
          doubleFaults: isPlayer ? match.stats.opponentDoubleFaults : match.stats.playerDoubleFaults,
        },
        matchStats: {
          rallyCount: match.stats.rallyCount,
          longestRally: match.stats.longestRally,
          breakPointsConverted: match.stats.breakPointsConverted,
          breakPointsTotal: match.stats.breakPointsTotal,
        }
      } : null,
    };

    return res
      .status(200)
      .json(new ApiResponse(true, 200, detailedMatch, "Match details fetched successfully"));

  } catch (error) {
    console.error("Error fetching match details:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch match details"));
  }
};

const checkPlayerActivityStatus = async (userId: string): Promise<string> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMatches = await prisma.match.count({
      where: {
        participants: {
          some: {
            userId: userId,
          },
        },
        matchDate: { gte: thirtyDaysAgo },
      },
    });

    const isActive = recentMatches > 0;
    
    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: { 
        status: isActive ? 'active' : 'inactive',
        lastActivityCheck: new Date(),
      },
    });

    return isActive ? 'active' : 'inactive';
  } catch (error) {
    console.error("Error checking activity status:", error);
    return 'active'; // Default to active on error
  }
};

export const updatePlayerProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { name, username, email, location, image, phoneNumber, bio } = req.body;

    // Validate required fields
    if (!name || !username || !email) {
      return res.status(400).json({
        success: false,
        status: 400,
        data: null,
        message: 'Name, username, and email are required'
      });
    }

    // Check if username is already taken by another user
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username,
          id: { not: userId } // Exclude current user
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          status: 400,
          data: null,
          message: 'Username is already taken'
        });
      }
    }

    // Check if email is already taken by another user
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: email,
          id: { not: userId } // Exclude current user
        }
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          status: 400,
          data: null,
          message: 'Email is already taken'
        });
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

    res.json({
      success: true,
      status: 200,
      data: updatedUser,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating player profile:', error);
    res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to update profile'
    });
  }
};

export const changePlayerPassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log(`🔑 Password change request for user: ${userId}`);
    console.log(`🔑 Current password provided: ${currentPassword ? 'Yes' : 'No'}`);
    console.log(`🔑 New password provided: ${newPassword ? 'Yes' : 'No'}`);

    // Validate required fields
    if (!currentPassword || !newPassword) {
      console.log(`❌ Missing required fields`);
      return res.status(400).json({
        success: false,
        status: 400,
        data: null,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      console.log(`❌ Password too short`);
      return res.status(400).json({
        success: false,
        status: 400,
        data: null,
        message: 'New password must be at least 8 characters long'
      });
    }

    console.log(`🔑 Attempting to change password via better-auth API...`);

    try {
      // Use better-auth's built-in password change functionality
      const result = await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword,
        },
        headers: req.headers,
      });

      console.log(`🔑 Better-auth result:`, result);

      if (result.error) {
        console.log(`❌ Better-auth password change failed:`, result.error);
        return res.status(400).json({
          success: false,
          status: 400,
          data: null,
          message: result.error.message || 'Failed to change password'
        });
      }
    } catch (apiError) {
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
          console.log(`❌ User not found: ${userId}`);
          return res.status(404).json({
            success: false,
            status: 404,
            data: null,
            message: 'User not found'
          });
        }

        // Find the email account
        const emailAccount = user.accounts.find(account => account.providerId === 'credential');
        
        if (!emailAccount) {
          console.log(`❌ Email account not found for user: ${userId}`);
          return res.status(400).json({
            success: false,
            status: 400,
            data: null,
            message: 'No email account found'
          });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, emailAccount.password);
        
        if (!isCurrentPasswordValid) {
          console.log(`❌ Current password is invalid for user: ${userId}`);
          return res.status(400).json({
            success: false,
            status: 400,
            data: null,
            message: 'Current password is incorrect'
          });
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

    res.json({
      success: true,
      status: 200,
      data: null,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Error changing password:', error);
    res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to change password'
    });
  }
};

export const getPlayerAchievements = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

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

    res.json({
      data: {
        achievements,
        totalPoints: achievements.reduce((sum, achievement) => sum + achievement.points, 0),
        count: achievements.length
      },
      success: true,
      status: 200,
      message: achievements.length > 0 ? 'Achievements retrieved successfully' : 'No achievements yet'
    });

  } catch (error) {
    console.error('Error fetching player achievements:', error);
    res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to fetch achievements'
    });
  }
};

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

    // Upload new image to cloud storage
    const imageUrl = await uploadToStorage(req.file.path, userId);

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

    // Clean up temporary file
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.log('Could not delete temporary file:', error);
    }

    res.status(200).json({
      success: true,
      status: 200,
      data: {
        user: updatedUser,
        imageUrl: imageUrl
      },
      message: 'Profile image uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    
    // Clean up temporary file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.log('Could not delete temporary file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      status: 500,
      data: null,
      message: 'Failed to upload profile image'
    });
  }
};

// ============================================
// PHASE 2: PLAYER DISCOVERY & SOCIAL FEATURES
// ============================================

/**
 * Search for players by name or username
 * GET /api/player/search?q=searchTerm&sport=tennis
 */
export const searchPlayers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, sport } = req.query;
    const currentUserId = req.user?.id;

    // Build where clause
    const whereClause: any = {
      id: { not: currentUserId }, // Exclude current user
      role: Role.USER,
      status: 'active',
    };

    // Add search filter if query provided
    if (q && typeof q === 'string' && q.trim().length >= 2) {
      const searchTerm = q.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { username: { contains: searchTerm, mode: 'insensitive' } },
        { displayUsername: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const players = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        username: true,
        displayUsername: true,
        image: true,
        bio: true,
        area: true,
        gender: true,
      },
      take: 20, // Limit results
    });

    // Fetch sports and ratings for each player
    const playersWithDetails = await Promise.all(
      players.map(async (player) => {
        const responses = await prisma.questionnaireResponse.findMany({
          where: { userId: player.id, completedAt: { not: null } },
          include: { result: true },
        });

        const sports = [...new Set(responses.map((r) => r.sport.toLowerCase()))];

        // Get ratings
        const skillRatings: any = {};
        responses.forEach((res) => {
          if (res.result) {
            skillRatings[res.sport.toLowerCase()] = {
              singles: res.result.singles ? res.result.singles / 1000 : null,
              doubles: res.result.doubles ? res.result.doubles / 1000 : null,
              rating: (res.result.doubles ?? res.result.singles ?? 0) / 1000,
            };
          }
        });

        return {
          ...player,
          sports,
          skillRatings,
        };
      })
    );

    // Filter by sport if provided
    const filteredPlayers = sport
      ? playersWithDetails.filter((p) => p.sports.includes((sport as string).toLowerCase()))
      : playersWithDetails;

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
 * Get available players for a season (league members without active partnerships)
 * Includes: 1) Players needing new partners due to dissolution
 *           2) League members who haven't registered for season yet
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

    // Get season with league and category info
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        leagues: { select: { id: true } },
        categories: {
          select: {
            id: true,
            genderRestriction: true,
            gender_category: true
          }
        }
      },
    });

    if (!season) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Season not found')
      );
    }

    const leagueIds = season.leagues.map(l => l.id);

    // Get gender restriction from season's category
    const categoryGender = season.categories[0]?.gender_category || season.categories[0]?.genderRestriction;
    console.log('🔍 Season category gender restriction:', categoryGender);

    // Get players in ACTIVE partnerships for this season (these should be excluded)
    const activePairs = await prisma.partnership.findMany({
      where: {
        seasonId,
        status: 'ACTIVE',
        dissolvedAt: null
      },
      select: { player1Id: true, player2Id: true },
    });

    const activelyPairedPlayerIds = [
      ...activePairs.map((p) => p.player1Id),
      ...activePairs.map((p) => p.player2Id),
    ];

    // Get players who are registered for this season with dissolved partnerships
    // These are players who paid but need a new partner
    const dissolvedPartnerships = await prisma.partnership.findMany({
      where: {
        seasonId,
        OR: [
          { status: 'DISSOLVED' },
          { dissolvedAt: { not: null } }
        ]
      },
      select: { player1Id: true, player2Id: true },
    });

    const playersNeedingNewPartner = [
      ...new Set([
        ...dissolvedPartnerships.map(p => p.player1Id),
        ...dissolvedPartnerships.map(p => p.player2Id),
      ])
    ];

    // Get players with approved withdrawal requests who need new partners
    const approvedWithdrawals = await prisma.withdrawalRequest.findMany({
      where: {
        seasonId,
        status: 'APPROVED',
        partnershipId: { not: null }
      },
      select: { userId: true },
    });

    const withdrawalPlayerIds = approvedWithdrawals.map(w => w.userId);

    // Combine players needing new partners
    const needsNewPartnerIds = [
      ...new Set([...playersNeedingNewPartner, ...withdrawalPlayerIds])
    ];

    // Get league members (players who have joined the league)
    const leagueMembers = await prisma.leagueMembership.findMany({
      where: { leagueId: { in: leagueIds } },
      select: { userId: true },
    });

    const leagueMemberIds = leagueMembers.map(m => m.userId);

    // Build gender filter if category has gender restriction
    const genderFilter: any = {};
    if (categoryGender && categoryGender !== 'MIXED' && categoryGender !== 'OPEN') {
      genderFilter.gender = categoryGender;
      console.log('🔍 Applying gender filter:', categoryGender);
    }

    // INCLUDE:
    // 1. Players who need a new partner (registered but dissolved/withdrawn)
    // 2. League members who haven't registered for this season yet
    // EXCLUDE:
    // - Players in active partnerships
    // - Current user
    // FILTER BY:
    // - Gender (if category is gender-restricted)
    const availablePlayers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { id: { notIn: activelyPairedPlayerIds } },
          { role: Role.USER },
          { status: 'active' },
          ...Object.keys(genderFilter).length > 0 ? [genderFilter] : [],
          {
            OR: [
              // Players who need new partners
              { id: { in: needsNewPartnerIds } },
              // League members who haven't registered for season yet
              {
                AND: [
                  { id: { in: leagueMemberIds } },
                  {
                    seasonMemberships: {
                      none: {
                        seasonId: seasonId,
                        status: 'ACTIVE'
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        displayUsername: true,
        image: true,
        bio: true,
        area: true,
        gender: true,
      },
    });

    // Add sports and ratings
    const playersWithDetails = await Promise.all(
      availablePlayers.map(async (player) => {
        const responses = await prisma.questionnaireResponse.findMany({
          where: { userId: player.id, completedAt: { not: null } },
          include: { result: true },
        });

        const sports = [...new Set(responses.map((r) => r.sport.toLowerCase()))];

        const skillRatings: any = {};
        responses.forEach((res) => {
          if (res.result) {
            skillRatings[res.sport.toLowerCase()] = {
              singles: res.result.singles ? res.result.singles / 1000 : null,
              doubles: res.result.doubles ? res.result.doubles / 1000 : null,
              rating: (res.result.doubles ?? res.result.singles ?? 0) / 1000,
            };
          }
        });

        return {
          ...player,
          sports,
          skillRatings,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(true, 200, playersWithDetails, 'Available players retrieved successfully')
    );
  } catch (error) {
    console.error('Error getting available players:', error);
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add sports and ratings to each favorited user
    const favoritesWithDetails = await Promise.all(
      favorites.map(async (fav) => {
        const responses = await prisma.questionnaireResponse.findMany({
          where: { userId: fav.favoritedId, completedAt: { not: null } },
          include: { result: true },
        });

        const sports = [...new Set(responses.map((r) => r.sport.toLowerCase()))];

        const skillRatings: any = {};
        responses.forEach((res) => {
          if (res.result) {
            skillRatings[res.sport.toLowerCase()] = {
              singles: res.result.singles ? res.result.singles / 1000 : null,
              doubles: res.result.doubles ? res.result.doubles / 1000 : null,
              rating: (res.result.doubles ?? res.result.singles ?? 0) / 1000,
            };
          }
        });

        return {
          ...fav.favorited,
          favoritedAt: fav.createdAt,
          sports,
          skillRatings,
        };
      })
    );

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

    if (!favoritedId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'User ID is required')
      );
    }

    if (userId === favoritedId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Cannot favorite yourself')
      );
    }

    // Check if user exists
    const userToFavorite = await prisma.user.findUnique({
      where: { id: favoritedId, role: Role.USER, status: 'active' },
    });

    if (!userToFavorite) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'User not found')
      );
    }

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_favoritedId: {
          userId,
          favoritedId,
        },
      },
    });

    if (existingFavorite) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'User already in favorites')
      );
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: {
        userId,
        favoritedId,
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

    return res.status(201).json(
      new ApiResponse(true, 201, favorite, 'User added to favorites successfully')
    );
  } catch (error) {
    console.error('Error adding favorite:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to add favorite')
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

    if (!favoritedId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'User ID is required')
      );
    }

    // Check if favorite exists
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_favoritedId: {
          userId,
          favoritedId,
        },
      },
    });

    if (!existingFavorite) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Favorite not found')
      );
    }

    // Delete favorite
    await prisma.favorite.delete({
      where: {
        userId_favoritedId: {
          userId,
          favoritedId,
        },
      },
    });

    return res.status(200).json(
      new ApiResponse(true, 200, null, 'User removed from favorites successfully')
    );
  } catch (error) {
    console.error('Error removing favorite:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to remove favorite')
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

    console.log('🔍 getPublicPlayerProfile: prisma is', typeof prisma, prisma);

    if (!userId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'User ID is required')
      );
    }

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
        // Exclude: email, phoneNumber, etc.
      },
    });

    if (!player) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Player not found')
      );
    }

    // Get sports and ratings
    const responses = await prisma.questionnaireResponse.findMany({
      where: { userId, completedAt: { not: null } },
      include: { result: true },
      orderBy: { completedAt: 'desc' },
    });

    const sports = [...new Set(responses.map((r) => r.sport.toLowerCase()))];

    const skillRatings: any = {};
    responses.forEach((res) => {
      if (res.result) {
        skillRatings[res.sport.toLowerCase()] = {
          singles: res.result.singles ? res.result.singles / 1000 : null,
          doubles: res.result.doubles ? res.result.doubles / 1000 : null,
          rating: (res.result.doubles ?? res.result.singles ?? 0) / 1000,
          confidence: res.result.confidence ?? 'N/A',
          rd: res.result.rd ?? 0,
        };
      }
    });

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
    const isFriend = currentUserId
      ? await prisma.friendship.findFirst({
          where: {
            OR: [
              {
                requesterId: currentUserId,
                recipientId: userId,
                status: 'ACCEPTED',
              },
              {
                requesterId: userId,
                recipientId: currentUserId,
                status: 'ACCEPTED',
              },
            ],
          },
        })
      : null;

    const profileData = {
      ...player,
      sports,
      skillRatings,
      recentMatches,
      totalMatches,
      isFriend: !!isFriend,
    };

    return res.status(200).json(
      new ApiResponse(true, 200, profileData, 'Player profile retrieved successfully')
    );
  } catch (error) {
    console.error('Error getting public player profile:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get player profile')
    );
  }
};

// Get player's league participation history
export const getPlayerLeagueHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate player exists
    const player = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!player) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Player not found')
      );
    }

    // Get leagues where player has participated
    const playerLeagues = await prisma.league.findMany({
      where: {
        memberships: {
          some: {
            userId: id
          }
        }
      },
      include: {
        memberships: {
          where: { userId: id },
          select: { 
            joinedAt: true,
            id: true
          }
        },
        seasons: {
          select: { 
            id: true, 
            name: true, 
            status: true,
            startDate: true,
            endDate: true
          },
          orderBy: { startDate: 'desc' }
        },
        categories: {
          select: { 
            id: true, 
            name: true,
            game_type: true,
            gender_category: true
          }
        },
        createdBy: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: { 
            memberships: true,
            seasons: true,
            categories: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data for better frontend consumption
    const transformedLeagues = playerLeagues.map(league => ({
      ...league,
      membership: league.memberships[0], // Player's membership details
      memberships: undefined // Remove the array since we only need the player's membership
    }));

    return res.status(200).json(
      new ApiResponse(true, 200, {
        player: {
          id: player.id,
          name: player.name
        },
        leagues: transformedLeagues,
        count: transformedLeagues.length
      }, 'Player league history retrieved successfully')
    );

  } catch (error) {
    console.error('Error getting player league history:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to fetch player league history')
    );
  }
};

// Get player's season participation history
export const getPlayerSeasonHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate player exists
    const player = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!player) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Player not found')
      );
    }

    // Get seasons where player has participated
    const playerSeasons = await prisma.season.findMany({
      where: {
        memberships: {
          some: {
            userId: id
          }
        }
      },
      include: {
        memberships: {
          where: { userId: id },
          select: { 
            joinedAt: true,
            status: true,
            division: {
              select: { 
                id: true, 
                name: true, 
                gameType: true,
                genderCategory: true,
                level: true
              }
            }
          }
        },
        categories: {
          select: { 
            id: true, 
            name: true,
            game_type: true,
            gender_category: true,
            leagues: {
              select: {
                id: true,
                name: true,
                sportType: true,
                location: true
              }
            }
          }
        },
        leagues: {
          select: { 
            id: true, 
            name: true, 
            sportType: true,
            location: true,
            status: true
          }
        },
        divisions: {
          select: {
            id: true,
            name: true,
            gameType: true,
            genderCategory: true,
            level: true,
            isActiveDivision: true
          }
        },
        _count: {
          select: { 
            memberships: true,
            divisions: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Transform data for better frontend consumption
    const transformedSeasons = playerSeasons.map(season => ({
      ...season,
      membership: season.memberships[0], // Player's membership details
      memberships: undefined // Remove the array since we only need the player's membership
    }));

    return res.status(200).json(
      new ApiResponse(true, 200, {
        player: {
          id: player.id,
          name: player.name
        },
        seasons: transformedSeasons,
        count: transformedSeasons.length
      }, 'Player season history retrieved successfully')
    );

  } catch (error) {
    console.error('Error getting player season history:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to fetch player season history')
    );
  }
};

// Get player's division participation history
export const getPlayerDivisionHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate player exists
    const player = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!player) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Player not found')
      );
    }

    // Get divisions where player has been assigned
    const playerDivisions = await prisma.division.findMany({
      where: {
        assignments: {
          some: {
            userId: id
          }
        }
      },
      include: {
        assignments: {
          where: { userId: id },
          select: { 
            assignedAt: true,
            reassignmentCount: true,
            notes: true,
            assignedByAdmin: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        season: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            sportType: true,
            location: true,
            status: true
          }
        },
        divisionSponsor: {
          select: {
            id: true,
            sponsoredName: true,
            packageTier: true,
            prizePoolTotal: true
          }
        },
        _count: {
          select: { 
            assignments: true,
            matches: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data for better frontend consumption
    const transformedDivisions = playerDivisions.map(division => ({
      ...division,
      assignment: division.assignments[0], // Player's assignment details
      assignments: undefined // Remove the array since we only need the player's assignment
    }));

    return res.status(200).json(
      new ApiResponse(true, 200, {
        player: {
          id: player.id,
          name: player.name
        },
        divisions: transformedDivisions,
        count: transformedDivisions.length
      }, 'Player division history retrieved successfully')
    );

  } catch (error) {
    console.error('Error getting player division history:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to fetch player division history')
    );
  }
};

// Get player's match participation history (admin access)
export const getPlayerMatchHistoryAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate player exists
    const player = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!player) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Player not found')
      );
    }

    // Get matches where player has participated
    const playerMatches = await prisma.match.findMany({
      where: {
        participants: {
          some: {
            userId: id
          }
        }
      },
      include: {
        participants: {
          where: { userId: id },
          select: { 
            isStarter: true,
            team: true
          }
        },
        division: {
          select: {
            id: true,
            name: true,
            gameType: true,
            genderCategory: true,
            level: true,
            season: {
              select: {
                id: true,
                name: true,
                status: true
              }
            },
            league: {
              select: {
                id: true,
                name: true,
                sportType: true,
                location: true
              }
            }
          }
        },
        stats: {
          select: {
            playerAces: true,
            playerUnforcedErrors: true,
            playerWinners: true,
            playerDoubleFaults: true,
            opponentAces: true,
            opponentUnforcedErrors: true,
            opponentWinners: true,
            opponentDoubleFaults: true,
            rallyCount: true,
            longestRally: true,
            breakPointsConverted: true,
            breakPointsTotal: true
          }
        },
        _count: {
          select: { 
            participants: true
          }
        }
      },
      orderBy: {
        matchDate: 'desc'
      }
    });

    // Transform data for better frontend consumption
    const transformedMatches = playerMatches.map(match => ({
      ...match,
      participation: match.participants[0], // Player's participation details
      participants: undefined // Remove the array since we only need the player's participation
    }));

    return res.status(200).json(
      new ApiResponse(true, 200, {
        player: {
          id: player.id,
          name: player.name
        },
        matches: transformedMatches,
        count: transformedMatches.length
      }, 'Player match history retrieved successfully')
    );

  } catch (error) {
    console.error('Error getting player match history:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to fetch player match history')
    );
  }
};