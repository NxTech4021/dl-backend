import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

export const getAllPlayers = async (req: Request, res: Response) => {
  try {
    const players = await prisma.user.findMany({
      where: {
        role: 'USER',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (players.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(true, 200, [], "No players found"));
    }

    const playerIds = players.map(p => p.id);

    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        userId: { in: playerIds },
        completedAt: { not: null },
      },
      include: {
        result: true, 
      }
    });

    const responsesByUserId = responses.reduce((acc, res) => {
      (acc[res.userId] = acc[res.userId] || []).push(res);
      return acc;
    }, {} as Record<string, typeof responses>);

    const transformedPlayers = players.map((player) => {
      const userResponses = responsesByUserId[player.id] || [];
      
      const sports = [...new Set(userResponses.map(r => r.sport.toLowerCase()))];
      
      const skillRatings = userResponses.reduce((acc, res) => {
        if (res.result) {
          const rating = res.result.doubles ?? res.result.singles ?? 0;
          acc[res.sport.toLowerCase()] = {
            rating: rating / 1000,
            confidence: res.result.confidence ?? 'N/A',
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
        skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
        status: player.status,
        completedOnboarding: player.completedOnboarding,
      };
    });

    return res
      .status(200)
      .json(
        new ApiResponse(true, 200, transformedPlayers, "Players fetched successfully")
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
      where: { role: 'USER' },
    });

    const activePlayers = prisma.user.count({
      where: { role: 'USER', status: 'active' },
    });

    const inactivePlayers = prisma.user.count({
      where: { role: 'USER', status: 'inactive' },
    });
    
    const verifiedPlayers = prisma.user.count({
      where: { role: 'USER', emailVerified: true },
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
      .json(new ApiResponse(true, 200, stats, "Player stats fetched successfully"));
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
        role: 'USER',
      },
      include: {
        accounts: {
          select: {
            providerId: true,
            createdAt: true,
          }
        },
        sessions: {
          select: {
            ipAddress: true,
            userAgent: true,
            expiresAt: true,
          }
        },
      }
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
        completedAt: 'desc',
      },
    });
    
    const sports = [...new Set(responses.map(r => r.sport.toLowerCase()))];
    const skillRatings = responses.reduce((acc, res) => {
      if (res.result) {
        const rating = res.result.doubles ?? res.result.singles ?? 0;
        acc[res.sport.toLowerCase()] = {
          rating: rating / 1000,
          confidence: res.result.confidence ?? 'N/A',
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
      .json(new ApiResponse(true, 200, profileData, "Player profile fetched successfully"));

  } catch (error) {
    console.error(`Error fetching profile for player ${id}:`, error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Failed to fetch player profile"));
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

    // Get questionnaire responses with ratings
    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        userId: userId,
        completedAt: { not: null },
      },
      include: {
        result: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Get recent match history
    const recentMatches = await prisma.match.findMany({
      where: {
        OR: [
          { playerId: userId },
          { opponentId: userId },
        ],
      },
      include: {
        player: {
          select: { name: true, username: true, image: true }
        },
        opponent: {
          select: { name: true, username: true, image: true }
        },
      },
      orderBy: {
        matchDate: 'desc',
      },
      take: 5,
    });

    // Process ratings
    const skillRatings = responses.reduce((acc, res) => {
      if (res.result) {
        const rating = res.result.doubles ?? res.result.singles ?? 0;
        acc[res.sport.toLowerCase()] = {
          rating: rating / 1000,
          confidence: res.result.confidence ?? 'N/A',
          rd: res.result.rd ?? 0,
          lastUpdated: res.completedAt,
        };
      }
      return acc;
    }, {} as Record<string, { rating: number; confidence: string; rd: number; lastUpdated: Date | null }>);

    // Process recent matches
    const processedMatches = recentMatches.map(match => ({
      id: match.id,
      sport: match.sport,
      date: match.matchDate,
      opponent: match.playerId === userId ? match.opponent : match.player,
      playerScore: match.playerId === userId ? match.playerScore : match.opponentScore,
      opponentScore: match.playerId === userId ? match.opponentScore : match.playerScore,
      outcome: match.playerId === userId 
        ? match.outcome 
        : (match.outcome === 'win' ? 'loss' : match.outcome === 'loss' ? 'win' : 'draw'),
      location: match.location,
    }));

    // Check activity status
    const activityStatus = await checkPlayerActivityStatus(userId);

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
      status: activityStatus,
      lastLogin: player.lastLogin,
      registeredDate: player.createdAt,
      skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
      recentMatches: processedMatches,
      totalMatches: await prisma.match.count({
        where: {
          OR: [{ playerId: userId }, { opponentId: userId }],
        },
      }),
    };

    return res
      .status(200)
      .json(new ApiResponse(true, 200, profileData, "Player profile fetched successfully"));

  } catch (error) {
    console.error("Error fetching player profile:", error);
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
        OR: [{ playerId: userId }, { opponentId: userId }],
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

