/**
 * Achievement CRUD Service
 *
 * Handles admin CRUD operations for achievement definitions
 * and player-facing achievement queries.
 */

import { prisma } from '../../lib/prisma';
import { AchievementCategory, AchievementScope, TierType, SportType, GameType, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

// ========================================
// Types
// ========================================

interface CreateAchievementInput {
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier?: TierType | undefined;
  scope?: AchievementScope | undefined;
  evaluatorKey: string;
  threshold?: number | undefined;
  sportFilter?: SportType | null | undefined;
  gameTypeFilter?: GameType | null | undefined;
  sortOrder?: number | undefined;
  isHidden?: boolean | undefined;
  points?: number | undefined;
  isActive?: boolean | undefined;
}

interface UpdateAchievementInput extends Partial<CreateAchievementInput> {}

interface AchievementWithStats {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: TierType;
  scope: AchievementScope;
  evaluatorKey: string;
  threshold: number;
  sportFilter: SportType | null;
  gameTypeFilter: GameType | null;
  sortOrder: number;
  isHidden: boolean;
  points: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  unlockCount: number;
  totalPlayers: number;
}

interface AdminListFilters {
  category?: AchievementCategory | undefined;
  tier?: TierType | undefined;
  isActive?: boolean | undefined;
  search?: string | undefined;
}

// ========================================
// Admin CRUD
// ========================================

/**
 * Get all achievements with unlock stats (admin endpoint).
 */
export async function getAchievementsAdmin(filters?: AdminListFilters): Promise<AchievementWithStats[]> {
  const where: Prisma.AchievementWhereInput = {};
  if (filters?.category) where.category = filters.category;
  if (filters?.tier) where.tier = filters.tier;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const achievements = await prisma.achievement.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { tier: 'asc' }],
    include: {
      _count: {
        select: {
          userAchievements: { where: { isCompleted: true } },
        },
      },
    },
  });

  // Get total player count for unlock rate calculation
  const totalPlayers = await prisma.user.count();

  return achievements.map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    icon: a.icon,
    category: a.category,
    tier: a.tier,
    scope: a.scope,
    evaluatorKey: a.evaluatorKey,
    threshold: a.threshold,
    sportFilter: a.sportFilter,
    gameTypeFilter: a.gameTypeFilter,
    sortOrder: a.sortOrder,
    isHidden: a.isHidden,
    points: a.points,
    isActive: a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    unlockCount: a._count.userAchievements,
    totalPlayers,
  }));
}

/**
 * Get a single achievement by ID with stats.
 */
export async function getAchievementById(id: string) {
  const achievement = await prisma.achievement.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          userAchievements: { where: { isCompleted: true } },
        },
      },
    },
  });

  if (!achievement) return null;

  const totalPlayers = await prisma.user.count();

  return {
    ...achievement,
    unlockCount: achievement._count.userAchievements,
    totalPlayers,
  };
}

/**
 * Create a new achievement definition.
 */
export async function createAchievement(input: CreateAchievementInput) {
  return prisma.achievement.create({
    data: {
      title: input.title,
      description: input.description,
      icon: input.icon,
      category: input.category,
      tier: input.tier ?? TierType.BRONZE,
      scope: input.scope ?? AchievementScope.LIFETIME,
      evaluatorKey: input.evaluatorKey,
      threshold: input.threshold ?? 1,
      sportFilter: input.sportFilter ?? null,
      gameTypeFilter: input.gameTypeFilter ?? null,
      sortOrder: input.sortOrder ?? 0,
      isHidden: input.isHidden ?? false,
      points: input.points ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Update an achievement definition.
 */
export async function updateAchievement(id: string, input: UpdateAchievementInput) {
  // Filter out undefined values so Prisma receives only defined fields
  const data = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  return prisma.achievement.update({
    where: { id },
    data,
  });
}

/**
 * Soft-delete an achievement (set isActive=false).
 */
export async function deleteAchievement(id: string) {
  return prisma.achievement.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Grant an achievement to a user (admin action).
 * Creates a completed UserAchievement regardless of evaluator result.
 */
export async function grantAchievement(achievementId: string, userId: string) {
  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
  });

  if (!achievement) {
    throw new Error(`Achievement ${achievementId} not found`);
  }

  return prisma.userAchievement.upsert({
    where: {
      userId_achievementId: { userId, achievementId },
    },
    create: {
      userId,
      achievementId,
      progress: achievement.threshold,
      isCompleted: true,
      unlockedAt: new Date(),
    },
    update: {
      progress: achievement.threshold,
      isCompleted: true,
      unlockedAt: new Date(),
    },
  });
}

// ========================================
// Player Queries
// ========================================

/**
 * Get all achievements with user progress (for full achievements screen).
 * Returns all active achievements, merged with user's progress data.
 */
export async function getPlayerAchievements(userId: string) {
  const [achievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.userAchievement.findMany({
      where: { userId },
    }),
  ]);

  const progressMap = new Map(
    userAchievements.map(ua => [ua.achievementId, ua])
  );

  const merged = achievements.map(a => {
    const ua = progressMap.get(a.id);
    return {
      id: a.id,
      title: a.title,
      description: a.isHidden && !ua?.isCompleted ? '???' : a.description,
      icon: a.icon,
      category: a.category,
      tier: a.tier,
      scope: a.scope,
      threshold: a.threshold,
      sportFilter: a.sportFilter,
      gameTypeFilter: a.gameTypeFilter,
      sortOrder: a.sortOrder,
      isHidden: a.isHidden,
      points: a.points,
      progress: ua?.progress ?? 0,
      isCompleted: ua?.isCompleted ?? false,
      unlockedAt: ua?.unlockedAt ?? null,
    };
  });

  const completed = merged.filter(a => a.isCompleted);

  return {
    achievements: merged,
    completedCount: completed.length,
    totalCount: merged.length,
    totalPoints: completed.reduce((sum, a) => sum + a.points, 0),
  };
}

/**
 * Get only completed achievements (for profile preview card).
 * Lighter payload — only returns unlocked achievements.
 */
export async function getCompletedAchievements(userId: string) {
  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId, isCompleted: true },
    include: {
      achievement: {
        select: {
          id: true,
          title: true,
          description: true,
          icon: true,
          category: true,
          tier: true,
          points: true,
        },
      },
    },
    orderBy: { unlockedAt: 'desc' },
  });

  const totalActive = await prisma.achievement.count({
    where: { isActive: true },
  });

  return {
    achievements: userAchievements.map(ua => ({
      id: ua.achievement.id,
      title: ua.achievement.title,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      category: ua.achievement.category,
      tier: ua.achievement.tier,
      points: ua.achievement.points,
      unlockedAt: ua.unlockedAt,
      isCompleted: true,
    })),
    completedCount: userAchievements.length,
    totalCount: totalActive,
    totalPoints: userAchievements.reduce((sum, ua) => sum + ua.achievement.points, 0),
  };
}
