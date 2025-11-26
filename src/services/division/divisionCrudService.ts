import { prisma } from '../../lib/prisma';
import { Prisma, DivisionLevel, GameType, GenderType } from "@prisma/client";
import { formatDivision } from './utils/formatters';
import { toEnum } from './utils/enums';
import { CreateDivisionData, UpdateDivisionData, DivisionWithThread } from './utils/types';

/**
 * Create a new division with associated thread
 * @param data - Division creation data
 * @param tx - Optional transaction client
 * @returns Created division and thread
 */

export async function createDivisionWithThread(
  data: CreateDivisionData,
  adminId: string
): Promise<DivisionWithThread> {
  // Convert enums
  const levelEnum = toEnum(data.divisionLevel, DivisionLevel);
  const gameTypeEnum = toEnum(data.gameType, GameType);
  const genderEnum = data.genderCategory ? toEnum(data.genderCategory, GenderType) : null;

  if (!levelEnum) {
    throw new Error("Invalid divisionLevel value.");
  }
  if (!gameTypeEnum) {
    throw new Error("Invalid gameType value.");
  }

  // Verify admin exists
  const adminUser = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, name: true }
  });

  if (!adminUser) {
    throw new Error("Admin user not found.");
  }

  // Verify season exists and get league
  const season = await prisma.season.findUnique({
    where: { id: data.seasonId },
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
    throw new Error("Season not found.");
  }

  const leagueId = season.leagues && season.leagues.length > 0 ? season.leagues[0]?.id : null;

  if (!leagueId) {
    throw new Error("Season is not linked to any league.");
  }

  // Check for duplicate name
  const duplicate = await prisma.division.findFirst({
    where: { seasonId: data.seasonId, name: data.name },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("A division with this name already exists in the season.");
  }

  // Create division and thread in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the division first
    const division = await tx.division.create({
      data: {
        seasonId: data.seasonId,
        leagueId: leagueId,
        name: data.name,
        description: data.description ?? null,
        pointsThreshold:
          data.threshold !== undefined && data.threshold !== null
            ? Number(data.threshold)
            : null,
        level: levelEnum,
        gameType: gameTypeEnum,
        genderCategory: genderEnum ?? null,
        maxSinglesPlayers:
          data.maxSinglesPlayers !== undefined && data.maxSinglesPlayers !== null
            ? Number(data.maxSinglesPlayers)
            : null,
        maxDoublesTeams:
          data.maxDoublesTeams !== undefined && data.maxDoublesTeams !== null
            ? Number(data.maxDoublesTeams)
            : null,
        autoAssignmentEnabled: Boolean(data.autoAssignmentEnabled ?? false),
        isActiveDivision: Boolean(data.isActive ?? true),
        prizePoolTotal:
          data.prizePoolTotal !== undefined && data.prizePoolTotal !== null
            ? new Prisma.Decimal(data.prizePoolTotal)
            : null,
        sponsoredDivisionName: data.sponsorName ?? null,
      },
      include: {
        season: { select: { id: true, name: true } },
        league: { 
          select: { 
            id: true, 
            name: true, 
            sportType: true
          } 
        },
      },
    });

    // Create the group chat/thread for the division
    const thread = await tx.thread.create({
      data: {
        name: `${division.name} Chat`,
        isGroup: true,
        divisionId: division.id,
        members: {
          create: [{
            userId: adminId,
            role: "admin"
          }]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        }
      }
    });

    console.log(`✅ Division ${division.id} created with chat thread ${thread.id}`);

    return { division, thread, season };
  });

  return result;
}

export async function getAllDivisions() {
  const divisions = await prisma.division.findMany({
    include: { season: true },
    orderBy: { createdAt: "desc" },
  });

  return divisions.map(formatDivision);
}

export async function getDivisionById(divisionId: string) {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: { season: true },
  });

  if (!division) {
    return null;
  }

  return formatDivision(division);
}

export async function updateDivision(
  divisionId: string,
  updates: UpdateDivisionData
) {
  // Verify division exists
  const existing = await prisma.division.findUnique({
    where: { id: divisionId },
    include: { season: true },
  });

  if (!existing) {
    throw new Error("Division not found.");
  }

  // Build update data
  const data: Prisma.DivisionUpdateInput = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.threshold !== undefined)
    data.pointsThreshold =
      updates.threshold !== null ? Number(updates.threshold) : (null as any);

  if (updates.divisionLevel !== undefined) {
    const levelEnum = toEnum(updates.divisionLevel, DivisionLevel);
    if (!levelEnum) {
      throw new Error("Invalid divisionLevel value.");
    }
    data.level = levelEnum;
  }

  if (updates.seasonId !== undefined) {
    data.season = {
      connect: { id: updates.seasonId },
    };
  }

  if (updates.gameType !== undefined) {
    const gameTypeEnum = toEnum(updates.gameType, GameType);
    if (!gameTypeEnum) {
      throw new Error("Invalid gameType value.");
    }
    data.gameType = gameTypeEnum;
  }

  if (updates.genderCategory !== undefined) {
    const genderEnum = toEnum(updates.genderCategory, GenderType);
    if (!genderEnum) {
      throw new Error("Invalid genderCategory value.");
    }
    data.genderCategory = genderEnum;
  }

  if (updates.maxSinglesPlayers !== undefined) {
    data.maxSinglesPlayers =
      updates.maxSinglesPlayers !== null ? Number(updates.maxSinglesPlayers) : null;
  }

  if (updates.maxDoublesTeams !== undefined) {
    data.maxDoublesTeams =
      updates.maxDoublesTeams !== null ? Number(updates.maxDoublesTeams) : null;
  }

  if (updates.autoAssignmentEnabled !== undefined) {
    data.autoAssignmentEnabled = Boolean(updates.autoAssignmentEnabled);
  }

  if (updates.isActive !== undefined) {
    data.isActiveDivision = Boolean(updates.isActive);
  }

  if (updates.prizePoolTotal !== undefined) {
    data.prizePoolTotal =
      updates.prizePoolTotal !== null
        ? new Prisma.Decimal(updates.prizePoolTotal)
        : (null as any);
  }

  if (updates.sponsorName !== undefined) {
    data.sponsoredDivisionName = updates.sponsorName;
  }

  const division = await prisma.division.update({
    where: { id: divisionId },
    data,
    include: { season: true },
  });

  return formatDivision(division);
}

/**
 * Delete division
 * @param divisionId - Division ID
 */
export async function deleteDivision(divisionId: string): Promise<void> {
  await prisma.division.delete({ where: { id: divisionId } });
}
