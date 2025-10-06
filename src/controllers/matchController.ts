import { Request, Response } from "express";
import { PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

export const createMatch = async (req: Request, res: Response) => {
  const { divisionId, sport, matchType, playerScore, opponentScore, outcome, matchDate, location, notes, duration } = req.body;

  if (!divisionId || !sport || !matchType) {
    return res.status(400).json({ error: "divisionId, sport, and matchType are required." });
  }

  try {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) return res.status(404).json({ error: "Division not found." });

    const match = await prisma.match.create({
      data: {
        divisionId,
        sport,
        matchType,
        playerScore,
        opponentScore,
        outcome,
        matchDate,
        location,
        notes,
        duration,
      },
      include: { participants: true, stats: true },
    });
    res.status(201).json(match);
  } catch (err: any) {
    console.error("Create Match Error:", err);
    res.status(500).json({ error: "Failed to create match." });
  }
};

export const getMatches = async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      include: { division: true, participants: { include: { user: true } }, stats: true },
      orderBy: { matchDate: "desc" },
    });
    res.json(matches);
  } catch (err: any) {
    console.error("Get Matches Error:", err);
    res.status(500).json({ error: "Failed to retrieve matches." });
  }
};

export const getMatchById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const match = await prisma.match.findUnique({
      where: { id },
      include: { division: true, participants: { include: { user: true } }, stats: true },
    });
    if (!match) return res.status(404).json({ error: "Match not found." });
    res.json(match);
  } catch (err: any) {
    console.error("Get Match By ID Error:", err);
    res.status(500).json({ error: "Failed to retrieve match." });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const existingMatch = await prisma.match.findUnique({ where: { id } });
    if (!existingMatch) return res.status(404).json({ error: "Match not found." });

    const match = await prisma.match.update({
      where: { id },
      data,
      include: { participants: true, stats: true },
    });
    res.json(match);
  } catch (err: any) {
    console.error("Update Match Error:", err);
    res.status(500).json({ error: "Failed to update match." });
  }
};

export const deleteMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Match ID is required." });

  try {
    const existingMatch = await prisma.match.findUnique({ where: { id } });
    if (!existingMatch) return res.status(404).json({ error: "Match not found." });

    await prisma.match.delete({ where: { id } });
    res.json({ message: "Match deleted successfully." });
  } catch (err: any) {
    console.error("Delete Match Error:", err);
    res.status(500).json({ error: "Failed to delete match." });
  }
};
