import { prismaTest } from '../../setup/prismaTestClient';
import { SeasonStatus } from '@prisma/client';

// Simple random string generator
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface CreateSeasonOptions {
  id?: string;
  name?: string;
  leagueId?: string;
  startDate?: Date;
  endDate?: Date;
  regiDeadline?: Date;
  entryFee?: number;
  status?: SeasonStatus;
  isActive?: boolean;
}

/**
 * Create a test season with sensible defaults
 */
export async function createTestSeason(options: CreateSeasonOptions = {}) {
  const uniqueSuffix = randomString(8);
  const now = new Date();

  return prismaTest.season.create({
    data: {
      id: options.id ?? `test-season-${uniqueSuffix}`,
      name: options.name ?? `Test Season ${uniqueSuffix}`,
      startDate: options.startDate ?? now,
      endDate: options.endDate ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
      regiDeadline: options.regiDeadline ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      entryFee: options.entryFee ?? 50,
      status: options.status ?? SeasonStatus.ACTIVE,
      isActive: options.isActive ?? true,
      ...(options.leagueId && {
        leagues: {
          connect: { id: options.leagueId },
        },
      }),
    },
  });
}

/**
 * Create an upcoming season (not yet started)
 */
export async function createUpcomingSeason(options: CreateSeasonOptions = {}) {
  const now = new Date();
  return createTestSeason({
    ...options,
    startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    endDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
    regiDeadline: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000), // 23 days from now
    status: SeasonStatus.UPCOMING,
    isActive: false,
  });
}

/**
 * Create an ended season
 */
export async function createEndedSeason(options: CreateSeasonOptions = {}) {
  const now = new Date();
  return createTestSeason({
    ...options,
    startDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
    endDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    regiDeadline: new Date(now.getTime() - 127 * 24 * 60 * 60 * 1000), // 127 days ago
    status: SeasonStatus.COMPLETED,
    isActive: false,
  });
}
