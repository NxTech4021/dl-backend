import {
  DivisionLevel,
  GameType,
  Gender,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

const toEnum = <T extends DivisionLevel | GameType | Gender>(
  value: string | undefined,
  enumType: Record<string, T>
): T | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return enumType[normalized as keyof typeof enumType];
};

const FALLBACK_DATE_ISO = new Date(0).toISOString();

const toISODateString = (input: unknown): string => {
  if (!input) return FALLBACK_DATE_ISO;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? FALLBACK_DATE_ISO : date.toISOString();
};

const toISODateStringOrNull = (input: unknown): string | null => {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatSeason = (season: any) => ({
  id: season?.id ?? "",
  name: season?.name ?? "",
  sportType: season?.sportType ?? null,
  seasonType: season?.seasonType ?? null,
  description: season?.description ?? null,
  startDate: toISODateStringOrNull(season?.startDate),
  endDate: toISODateStringOrNull(season?.endDate),
  regiDeadline: toISODateStringOrNull(season?.regiDeadline),
  status: season?.status ?? "UPCOMING",
  current:
    season && "current" in season
      ? Boolean(season.current)
      : Boolean(season?.isActive),
  createdAt: toISODateString(season?.createdAt),
  updatedAt: toISODateString(season?.updatedAt),
  memberships: [],
  withdrawalRequests: [],
});

const formatDivision = (division: any) => ({
  id: division.id,
  seasonId: division.seasonId,
  name: division.name,
  description: division.description ?? null,
  threshold:
    division.pointsThreshold !== null && division.pointsThreshold !== undefined
      ? Number(division.pointsThreshold)
      : null,
  divisionLevel: division.level
    ? division.level.toLowerCase()
    : "beginner",
  gameType: division.gameType ? division.gameType.toLowerCase() : "singles",
  genderCategory: division.genderCategory
    ? division.genderCategory.toLowerCase()
    : "mixed",
  maxSingles:
    division.maxSinglesPlayers !== null && division.maxSinglesPlayers !== undefined
      ? Number(division.maxSinglesPlayers)
      : null,
  maxDoublesTeams:
    division.maxDoublesTeams !== null && division.maxDoublesTeams !== undefined
      ? Number(division.maxDoublesTeams)
      : null,
  currentSinglesCount:
    division.currentSinglesCount !== null && division.currentSinglesCount !== undefined
      ? Number(division.currentSinglesCount)
      : null,
  currentDoublesCount:
    division.currentDoublesCount !== null && division.currentDoublesCount !== undefined
      ? Number(division.currentDoublesCount)
      : null,
  autoAssignmentEnabled: division.autoAssignmentEnabled,
  isActive: division.isActiveDivision,
  prizePoolTotal: division.prizePoolTotal
    ? Number(division.prizePoolTotal)
    : null,
  sponsoredDivisionName: division.sponsoredDivisionName ?? null,
  season: formatSeason(division.season),
  createdAt: toISODateString(division.createdAt),
  updatedAt: toISODateString(division.updatedAt),
});

export const createDivision = async (req: Request, res: Response) => {
  const {
    seasonId,
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled = false,
    isActive = true,
    prizePoolTotal,
    sponsorName,
  } = req.body;

  if (!seasonId || !name || !divisionLevel || !gameType) {
    return res.status(400).json({
      error:
        "seasonId, name, divisionLevel, and gameType are required fields.",
    });
  }

  const levelEnum = toEnum(divisionLevel, DivisionLevel);
  const gameTypeEnum = toEnum(gameType, GameType);
  const genderEnum = toEnum(genderCategory, Gender);

  if (!levelEnum) {
    return res.status(400).json({ error: "Invalid divisionLevel value." });
  }
  if (!gameTypeEnum) {
    return res.status(400).json({ error: "Invalid gameType value." });
  }

  if (
    gameTypeEnum === GameType.SINGLES &&
    (maxSinglesPlayers === null || maxSinglesPlayers === undefined)
  ) {
    return res.status(400).json({
      error: "maxSinglesPlayers is required when gameType is singles.",
    });
  }

  if (
    gameTypeEnum === GameType.DOUBLES &&
    (maxDoublesTeams === null || maxDoublesTeams === undefined)
  ) {
    return res.status(400).json({
      error: "maxDoublesTeams is required when gameType is doubles.",
    });
  }

  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { 
        id: true, 
        name: true,  
        leagues: { 
          select: {
            id: true
            }
        }
      },
    });

    if (!season) {
      return res.status(404).json({ error: "Season not found." });
    }

    const leagueId = season.leagues && season.leagues.length > 0 ? season.leagues[0].id : null;

    if (!leagueId) {
      
        return res.status(400).json({ error: "Season is not linked to any league." });
    }
    const duplicate = await prisma.division.findFirst({
      where: { seasonId, name },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        error: "A division with this name already exists in the season.",
      });
    }

    const division = await prisma.division.create({
      data: {
        seasonId,
        leagueId: leagueId,
        name,
        description,
        pointsThreshold:
          threshold !== undefined && threshold !== null
            ? Number(threshold)
            : null,
        level: levelEnum,
        gameType: gameTypeEnum,
        genderCategory: genderEnum,
        maxSinglesPlayers:
          maxSinglesPlayers !== undefined && maxSinglesPlayers !== null
            ? Number(maxSinglesPlayers)
            : null,
        maxDoublesTeams:
          maxDoublesTeams !== undefined && maxDoublesTeams !== null
            ? Number(maxDoublesTeams)
            : null,
        autoAssignmentEnabled: Boolean(autoAssignmentEnabled),
        isActiveDivision: Boolean(isActive),
        prizePoolTotal:
          prizePoolTotal !== undefined && prizePoolTotal !== null
            ? new Prisma.Decimal(prizePoolTotal)
            : null,
        sponsoredDivisionName: sponsorName ?? null,
      },
      include: {
        season: true,
      },
    });

    return res.status(201).json({
      data: formatDivision(division),
      message: "Division created successfully",
    });
  } catch (error) {
    console.error("Create Division Error:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating the division." });
  }
};

export const getDivisions = async (_req: Request, res: Response) => {
  try {
    const divisions = await prisma.division.findMany({
      include: { season: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(divisions.map(formatDivision));
  } catch (error) {
    console.error("Get Divisions Error:", error);
    return res.status(500).json({ error: "Failed to retrieve divisions." });
  }
};

export const getDivisionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      include: { season: true },
    });

    if (!division) {
      return res.status(404).json({ error: "Division not found." });
    }

    return res.json(formatDivision(division));
  } catch (error) {
    console.error("Get Division By ID Error:", error);
    return res.status(500).json({ error: "Failed to retrieve division." });
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  const {
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled,
    isActive,
    prizePoolTotal,
    sponsorName,
  } = req.body;

  try {
    const existing = await prisma.division.findUnique({
      where: { id },
      include: { season: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Division not found." });
    }

    const data: Prisma.DivisionUpdateInput = {};

    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (threshold !== undefined)
      data.pointsThreshold =
        threshold !== null ? Number(threshold) : (null as any);

    if (divisionLevel !== undefined) {
      const levelEnum = toEnum(divisionLevel, DivisionLevel);
      if (!levelEnum) {
        return res.status(400).json({ error: "Invalid divisionLevel value." });
      }
      data.level = levelEnum;
    }

    if (gameType !== undefined) {
      const gameTypeEnum = toEnum(gameType, GameType);
      if (!gameTypeEnum) {
        return res.status(400).json({ error: "Invalid gameType value." });
      }
      data.gameType = gameTypeEnum;
    }

    if (genderCategory !== undefined) {
      const genderEnum = toEnum(genderCategory, Gender);
      if (!genderEnum) {
        return res
          .status(400)
          .json({ error: "Invalid genderCategory value." });
      }
      data.genderCategory = genderEnum;
    }

    if (maxSinglesPlayers !== undefined) {
      data.maxSinglesPlayers =
        maxSinglesPlayers !== null ? Number(maxSinglesPlayers) : null;
    }

    if (maxDoublesTeams !== undefined) {
      data.maxDoublesTeams =
        maxDoublesTeams !== null ? Number(maxDoublesTeams) : null;
    }

    if (autoAssignmentEnabled !== undefined) {
      data.autoAssignmentEnabled = Boolean(autoAssignmentEnabled);
    }

    if (isActive !== undefined) {
      data.isActiveDivision = Boolean(isActive);
    }

    if (prizePoolTotal !== undefined) {
      data.prizePoolTotal =
        prizePoolTotal !== null
          ? new Prisma.Decimal(prizePoolTotal)
          : (null as any);
    }

    if (sponsorName !== undefined) {
      data.sponsoredDivisionName = sponsorName;
    }

    const division = await prisma.division.update({
      where: { id },
      data,
      include: { season: true },
    });

    return res.json({
      data: formatDivision(division),
      message: "Division updated successfully",
    });
  } catch (error) {
    console.error("Update Division Error:", error);
    return res.status(500).json({ error: "Failed to update division." });
  }
};

export const deleteDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    await prisma.division.delete({ where: { id } });
    return res.json({ message: "Division deleted successfully" });
  } catch (error) {
    console.error("Delete Division Error:", error);
    return res.status(500).json({ error: "Failed to delete division." });
  }
};
