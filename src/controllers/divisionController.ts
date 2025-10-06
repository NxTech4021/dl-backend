// src/controllers/division.controller.ts
import { Request, Response } from "express";
import { PrismaClient} from "@prisma/client";
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
