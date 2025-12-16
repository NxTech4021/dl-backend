import { prismaTest } from '../../setup/prismaTestClient';
import { Statuses, SportType, GameType } from '@prisma/client';

// Simple random string generator
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomLeagueName(): string {
  const names = ['Phoenix', 'Thunder', 'Eagles', 'Warriors', 'Tigers', 'Lions', 'Hawks', 'Blazers'];
  return `${names[Math.floor(Math.random() * names.length)]} League`;
}

function randomCity(): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Austin', 'Miami', 'Seattle'];
  return cities[Math.floor(Math.random() * cities.length)];
}

export interface CreateLeagueOptions {
  id?: string;
  name?: string;
  location?: string;
  description?: string;
  status?: Statuses;
  sportType?: SportType;
  gameType?: GameType;
}

/**
 * Create a test league with sensible defaults
 */
export async function createTestLeague(options: CreateLeagueOptions = {}) {
  const uniqueSuffix = randomString(8);

  return prismaTest.league.create({
    data: {
      id: options.id ?? `test-league-${uniqueSuffix}`,
      name: options.name ?? randomLeagueName(),
      location: options.location ?? randomCity(),
      description: options.description ?? 'Test league description',
      status: options.status ?? Statuses.ACTIVE,
      sportType: options.sportType ?? SportType.PICKLEBALL,
      gameType: options.gameType ?? GameType.SINGLES,
    },
  });
}

/**
 * Create a test league with related season and division
 * This is a convenience method for tests that need a complete league setup
 */
export async function createTestLeagueWithSeasonAndDivision(options: CreateLeagueOptions = {}) {
  const league = await createTestLeague(options);

  const season = await prismaTest.season.create({
    data: {
      name: `${league.name} - Season 1`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      regiDeadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      entryFee: 50,
      status: 'ACTIVE',
      isActive: true,
      leagues: {
        connect: { id: league.id },
      },
    },
  });

  const division = await prismaTest.division.create({
    data: {
      name: 'Division A',
      description: 'Test division',
      level: 'BEGINNER',
      gameType: league.gameType,
      genderCategory: 'MIXED',
      maxSinglesPlayers: 16,
      isActiveDivision: true,
      seasonId: season.id,
      leagueId: league.id,
    },
  });

  return { league, season, division };
}
