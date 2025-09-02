import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";

const prisma = new PrismaClient();

export const getAllPlayers = async (req: Request, res: Response) => {
  try {
    const players = await prisma.user.findMany({
      where: {
        role: "USER",
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
        completedAt: { not: null },
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

      const sports = [
        ...new Set(userResponses.map((r) => r.sport.toLowerCase())),
      ];

      const skillRatings = userResponses.reduce((acc, res) => {
        if (res.result) {
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
      where: { role: "USER" },
    });

    const activePlayers = prisma.user.count({
      where: { role: "USER", status: "active" },
    });

    const inactivePlayers = prisma.user.count({
      where: { role: "USER", status: "inactive" },
    });

    const verifiedPlayers = prisma.user.count({
      where: { role: "USER", emailVerified: true },
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
        role: "USER",
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
        };
      }
      return acc;
    }, {} as Record<string, { rating: number; confidence: string; rd: number }>);

    const profileData = {
      ...player,
      registeredDate: player.createdAt,
      lastLoginDate: player.lastLogin,
      sports,
      skillRatings: Object.keys(skillRatings).length > 0 ? skillRatings : null,
      questionnaires: responses, // Include full questionnaire history
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
