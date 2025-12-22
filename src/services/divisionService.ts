import { prisma, PrismaClient } from "../lib/prisma";
import { GameType, DivisionLevel, GenderType } from '@prisma/client';


interface DivisionCreationData {
  name: string;
  description?: string;
  seasonId: string;
  gameType: GameType;
  level?: DivisionLevel;
  genderCategory?: GenderType;
  pointsThreshold?: number;
  maxSinglesPlayers?: number;
  maxDoublesTeams?: number;
}

interface DivisionUpdateData {
  name?: string;
  description?: string;
  pointsThreshold?: number;
  maxSinglesPlayers?: number;
  maxDoublesTeams?: number;
}

/**
 * DivisionService class with dependency injection support
 * Allows injecting a custom Prisma client for testing
 */
export class DivisionService {
  private prisma: PrismaClient;

  /**
   * Create a new DivisionService instance
   * @param prismaClient - Optional Prisma client for dependency injection (useful for testing)
   */
  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  // Business Logic: Division creation with validation
  async createDivision(data: DivisionCreationData) {
    const { seasonId, name } = data;

    // Business Rule: Verify season exists
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        leagues: {
          select: { id: true },
          take: 1
        }
      }
    });
    if (!season) {
      throw new Error(`Season with ID ${seasonId} not found.`);
    }

    const leagueId = season.leagues?.[0]?.id;
    if (!leagueId) {
      throw new Error('Season is not linked to any league.');
    }

    // Business Rule: Check for duplicate division names in same season
    const existingDivision = await this.prisma.division.findFirst({
      where: {
        seasonId,
        name: { equals: name, mode: 'insensitive' }
      }
    });
    if (existingDivision) {
      throw new Error(`A division with name "${name}" already exists in this season.`);
    }

    // Business Logic: Create division
    return this.prisma.division.create({
      data: {
        name,
        description: data.description ?? null,
        seasonId,
        leagueId,
        gameType: data.gameType,
        level: data.level ?? null,
        genderCategory: data.genderCategory ?? null,
        pointsThreshold: data.pointsThreshold ?? null,
        maxSinglesPlayers: data.maxSinglesPlayers ?? null,
        maxDoublesTeams: data.maxDoublesTeams ?? null,
      },
      include: {
        season: { select: { name: true } },
      },
    });
  }

  // Business Logic: Division update with validation
  async updateDivision(id: string, data: DivisionUpdateData) {
    // Business Rule: Verify division exists
    const division = await this.prisma.division.findUnique({
      where: { id },
      include: {
        season: { select: { id: true, name: true } },
        _count: {
          select: {
            assignments: true,
            seasonMemberships: true
          }
        }
      }
    });

    if (!division) {
      throw new Error(`Division with ID ${id} not found.`);
    }

    // Business Rule: Check name uniqueness if name is being updated
    if (data.name && data.name !== division.name) {
      const duplicateName = await this.prisma.division.findFirst({
        where: {
          seasonId: division.seasonId,
          name: { equals: data.name, mode: 'insensitive' },
          id: { not: id }
        }
      });
      if (duplicateName) {
        throw new Error(`A division with name "${data.name}" already exists in this season.`);
      }
    }

    // Business Rule: Cannot reduce capacity below current assignments
    const currentCount = division.gameType === GameType.SINGLES
      ? division.currentSinglesCount ?? 0
      : division.currentDoublesCount ?? 0;

    if (data.maxSinglesPlayers !== undefined && division.gameType === GameType.SINGLES) {
      if (data.maxSinglesPlayers < currentCount) {
        throw new Error(`Cannot reduce capacity below current assignment count (${currentCount}).`);
      }
    }

    if (data.maxDoublesTeams !== undefined && division.gameType === GameType.DOUBLES) {
      if (data.maxDoublesTeams < currentCount) {
        throw new Error(`Cannot reduce capacity below current assignment count (${currentCount}).`);
      }
    }

    // Build update data object only with defined values
    const updateData: {
      name?: string;
      description?: string | null;
      pointsThreshold?: number | null;
      maxSinglesPlayers?: number | null;
      maxDoublesTeams?: number | null;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description ?? null;
    }
    if (data.pointsThreshold !== undefined) {
      updateData.pointsThreshold = data.pointsThreshold ?? null;
    }
    if (data.maxSinglesPlayers !== undefined) {
      updateData.maxSinglesPlayers = data.maxSinglesPlayers ?? null;
    }
    if (data.maxDoublesTeams !== undefined) {
      updateData.maxDoublesTeams = data.maxDoublesTeams ?? null;
    }

    // Business Logic: Update division
    return this.prisma.division.update({
      where: { id },
      data: updateData,
      include: {
        season: { select: { name: true } },
      },
    });
  }

  // Business Logic: Division deletion with constraint checking
  async deleteDivision(id: string) {
    // Business Rule: Check if division has members
    const memberCount = await this.prisma.seasonMembership.count({
      where: { divisionId: id },
    });

    if (memberCount > 0) {
      throw new Error(`Cannot delete division: ${memberCount} member(s) are assigned to this division.`);
    }

    // Business Logic: Delete division
    return this.prisma.division.delete({
      where: { id },
    });
  }
}

// Create a default instance for backward compatibility
const defaultDivisionService = new DivisionService();

// Export functions that delegate to the default instance for backward compatibility
export const createDivision = (data: DivisionCreationData) =>
  defaultDivisionService.createDivision(data);

export const updateDivision = (id: string, data: DivisionUpdateData) =>
  defaultDivisionService.updateDivision(id, data);

export const deleteDivision = (id: string) =>
  defaultDivisionService.deleteDivision(id);
