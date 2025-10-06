// src/controllers/division.controller.ts
import { Request, Response } from "express";
import { PrismaClient} from "@prisma/client";
import * as divisionService from '../services/divisionService';
import { ApiResponse } from '../utils/ApiResponse';
import type { Division, Season, Match } from "@prisma/client";

// Type for Division with related season and matches
type DivisionWithRelations = Division & {
  season: Season;
  matches: Match[];
};


const prisma = new PrismaClient();

export const createDivision = async (req: Request, res: Response) => {
  const { 
    seasonId,
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSingles,
    maxDoublesTeams,
    isActive = true,
  } = req.body;

  if (!seasonId || !name || !divisionLevel || !gameType || !genderCategory) {
    return res.status(400).json({
      error: "seasonId, name, divisionLevel, gameType, and genderCategory are required.",
    });
  }

  try {
    const seasonExists = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!seasonExists) return res.status(404).json({ error: "Season not found." });

    const existingDivision = await prisma.division.findFirst({
      where: { seasonId, name },
    });
    if (existingDivision)
      return res.status(409).json({ error: "Division name already exists in this season." });

    const division = await prisma.division.create({
      data: {
        seasonId,
        name,
        description,
        threshold,
        divisionLevel,   
        gameType,       
        genderCategory, 
        maxSingles,
        maxDoublesTeams,
        isActive,
      },
    });

    res.status(201).json(division);
  } catch (err: any) {
    console.error("Create Division Error:", err);
    res.status(500).json({ error: "An error occurred while creating the division." });
  }
};

export const getDivisions = async (req: Request, res: Response) => {
  try {
    const divisions = await prisma.division.findMany({
      include: {
        season: true,
        matches: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(divisions);
  } catch (err: any) {
    console.error("Get Divisions Error:", err);
    res.status(500).json({ error: "Failed to retrieve divisions." });
  }
};


export const getDivisionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Division ID is required." });

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      include: {
        season: true,
        matches: true,
      },
    });

    if (!division) return res.status(404).json({ error: "Division not found." });

    res.status(200).json(division);
  } catch (err: any) {
    console.error("Get Division By ID Error:", err);
    res.status(500).json({ error: "Failed to retrieve division." });
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, threshold } = req.body;

  if (!id) return res.status(400).json({ error: "Division ID is required." });

  try {
    const existingDivision = await prisma.division.findUnique({ where: { id } });
    if (!existingDivision) return res.status(404).json({ error: "Division not found." });

    const division = await prisma.division.update({
      where: { id },
      data: { name, description, threshold },
    });
    res.json(division);
  } catch (err: any) {
    console.error("Update Division Error:", err);
    res.status(500).json({ error: "Failed to update division." });
  }
};

export const deleteDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Division ID is required." });

  try {
    const existingDivision = await prisma.division.findUnique({ where: { id } });
    if (!existingDivision) return res.status(404).json({ error: "Division not found." });

    await prisma.division.delete({ where: { id } });
    res.json({ message: "Division deleted successfully." });
  } catch (err: any) {
    console.error("Delete Division Error:", err);
    res.status(500).json({ error: "Failed to delete division." });
  }
};




export const getDivisions = async (req: Request, res: Response) => {
  try {
    const { seasonId, name } = req.query;

    // Build where clause
    const where: any = {};
    if (seasonId) where.seasonId = Number(seasonId);
    if (name) {
      where.name = { contains: name as string, mode: 'insensitive' };
    }

    const divisions = await prisma.division.findMany({
      where,
      include: {
        season: {
          select: {
            id: true,
            name: true,
            league: {
              select: {
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: [
        { seasonId: 'desc' },
        { rank: 'asc' }
      ]
    });

    // Transform for frontend
    const transformedDivisions = divisions.map(division => ({
      id: division.id,
      rank: division.rank,
      name: division.name,
      description: division.description,
      season: division.season,
      maxParticipants: division.maxParticipants,
      minRating: division.minRating,
      maxRating: division.maxRating,
      registrationCount: division._count.registrations,
      createdAt: division.createdAt,
      updatedAt: division.updatedAt
    }));

    if (transformedDivisions.length === 0) {
      return res.status(200).json(
        new ApiResponse(true, 200, [], "No divisions found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, transformedDivisions, "Divisions fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching divisions:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching divisions")
    );
  }
};

export const getDivisionById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid division ID')
      );
    }

    const division = await prisma.division.findUnique({
      where: { id },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            league: {
              select: {
                name: true,
                sport: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        registrations: {
          include: {
            player: {
              select: {
                name: true,
                email: true
              }
            },
            team: {
              select: {
                name: true
              }
            },
            payment: {
              select: {
                status: true
              }
            }
          },
          orderBy: {
            registeredAt: 'desc'
          }
        }
      }
    });

    if (!division) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Division not found')
      );
    }

    // Transform for detailed view
    const transformedDivision = {
      id: division.id,
      rank: division.rank,
      name: division.name,
      description: division.description,
      season: division.season,
      maxParticipants: division.maxParticipants,
      minRating: division.minRating,
      maxRating: division.maxRating,
      registrations: division.registrations,
      registrationCount: division.registrations.length,
      createdAt: division.createdAt,
      updatedAt: division.updatedAt
    };

    return res.status(200).json(
      new ApiResponse(true, 200, transformedDivision, "Division details fetched successfully")
    );
  } catch (error: any) {
    console.error("Error fetching division:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching division")
    );
  }
};

export const createDivision = async (req: Request, res: Response) => {
  try {
    const {
      rank,
      name,
      description,
      seasonId,
      maxParticipants,
      minRating,
      maxRating
    } = req.body;

    if (!rank || !name || !seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Missing required fields: rank, name, seasonId')
      );
    }

    // Use service for business logic
    const newDivision = await divisionService.createDivision({
      rank: parseInt(rank),
      name,
      description,
      seasonId: parseInt(seasonId),
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
      minRating: minRating ? parseInt(minRating) : undefined,
      maxRating: maxRating ? parseInt(maxRating) : undefined,
    });

    return res.status(201).json(
      new ApiResponse(true, 201, newDivision, "Division created successfully")
    );
  } catch (error: any) {
    console.error("Create division error:", error);
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating division")
    );
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid division ID')
      );
    }

    const updateData = { ...req.body };
    
    // Convert numeric fields
    if (updateData.rank) updateData.rank = parseInt(updateData.rank);
    if (updateData.maxParticipants) updateData.maxParticipants = parseInt(updateData.maxParticipants);
    if (updateData.minRating) updateData.minRating = parseInt(updateData.minRating);
    if (updateData.maxRating) updateData.maxRating = parseInt(updateData.maxRating);

    // Use service for business logic
    const updatedDivision = await divisionService.updateDivision(id, updateData);
    
    return res.status(200).json(
      new ApiResponse(true, 200, updatedDivision, "Division updated successfully")
    );
  } catch (error: any) {
    console.error("Error updating division:", error);
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating division")
    );
  }
};

export const deleteDivision = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid division ID')
      );
    }

    // Use service for business logic
    await divisionService.deleteDivision(id);
    
    return res.status(200).json(
      new ApiResponse(true, 200, null, "Division deleted successfully")
    );
  } catch (error: any) {
    console.error("Error deleting division:", error);
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    } else if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    } else {
      return res.status(500).json(
        new ApiResponse(false, 500, null, "Error deleting division")
      );
    }
  }
};