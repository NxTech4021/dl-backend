import { prismaTest } from '../../setup/prismaTestClient';
import { DivisionLevel, GameType, GenderType } from '@prisma/client';

// Simple random string generator
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomDivisionLetter(): string {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return letters[Math.floor(Math.random() * letters.length)];
}

function randomCity(): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Austin', 'Miami', 'Seattle'];
  return cities[Math.floor(Math.random() * cities.length)];
}

export interface CreateDivisionOptions {
  id?: string;
  name?: string;
  description?: string;
  seasonId?: string;
  leagueId?: string;
  level?: DivisionLevel;
  gameType?: GameType;
  genderCategory?: GenderType;
  maxSinglesPlayers?: number;
  maxDoublesTeams?: number;
  isActiveDivision?: boolean;
}

/**
 * Create a test division with sensible defaults
 */
export async function createTestDivision(options: CreateDivisionOptions = {}) {
  const uniqueSuffix = randomString(8);

  // If no seasonId or leagueId provided, we need to create them
  let seasonId = options.seasonId;
  let leagueId = options.leagueId;

  if (!seasonId || !leagueId) {
    // Create a league first
    const league = await prismaTest.league.create({
      data: {
        name: `Test League ${uniqueSuffix}`,
        location: randomCity(),
        status: 'ACTIVE',
        sportType: 'PICKLEBALL',
        gameType: options.gameType ?? GameType.SINGLES,
      },
    });
    leagueId = league.id;

    // Create a season
    const season = await prismaTest.season.create({
      data: {
        name: `Test Season ${uniqueSuffix}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        regiDeadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        entryFee: 50,
        status: 'ACTIVE',
        isActive: true,
        leagues: {
          connect: { id: leagueId },
        },
      },
    });
    seasonId = season.id;
  }

  return prismaTest.division.create({
    data: {
      id: options.id ?? `test-division-${uniqueSuffix}`,
      name: options.name ?? `Division ${randomDivisionLetter()}`,
      description: options.description ?? 'Test division description',
      level: options.level ?? DivisionLevel.BEGINNER,
      gameType: options.gameType ?? GameType.SINGLES,
      genderCategory: options.genderCategory ?? GenderType.MIXED,
      maxSinglesPlayers: options.maxSinglesPlayers ?? 16,
      maxDoublesTeams: options.maxDoublesTeams,
      isActiveDivision: options.isActiveDivision ?? true,
      seasonId: seasonId,
      leagueId: leagueId,
    },
    include: {
      season: true,
      league: true,
    },
  });
}

/**
 * Create a doubles division
 */
export async function createDoublesDivision(options: CreateDivisionOptions = {}) {
  return createTestDivision({
    ...options,
    gameType: GameType.DOUBLES,
    maxSinglesPlayers: undefined,
    maxDoublesTeams: options.maxDoublesTeams ?? 8,
  });
}
