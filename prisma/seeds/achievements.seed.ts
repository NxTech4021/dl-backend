/**
 * Achievement Definitions Seed
 * Creates the 30 achievement definitions across 5 categories.
 * This does NOT grant achievements to users — that's handled by the evaluation engine.
 */

import {
  AchievementCategory,
  AchievementScope,
  TierType,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  monthsAgo,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";

// =============================================
// Types
// =============================================

interface AchievementSeedData {
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: TierType;
  scope: AchievementScope;
  evaluatorKey: string;
  threshold: number;
  sortOrder: number;
  points: number;
  isRevocable?: boolean;
  badgeGroup?: string;
}

// =============================================
// SEED DATA — 30 Achievements
// =============================================

const ACHIEVEMENTS: AchievementSeedData[] = [
  // ===== MATCH_COUNTER (3) — Live counter badge =====
  {
    title: "Match Counter",
    description: "Play your first league match",
    icon: "tennisball-outline",
    category: AchievementCategory.MATCH_COUNTER,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_matches",
    threshold: 1,
    sortOrder: 1,
    points: 5,
    badgeGroup: "match_counter",
  },
  {
    title: "Match Counter",
    description: "Play 25 league matches",
    icon: "tennisball",
    category: AchievementCategory.MATCH_COUNTER,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_matches",
    threshold: 25,
    sortOrder: 2,
    points: 15,
    badgeGroup: "match_counter",
  },
  {
    title: "Match Counter",
    description: "Play 100 league matches",
    icon: "tennisball",
    category: AchievementCategory.MATCH_COUNTER,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_matches",
    threshold: 100,
    sortOrder: 3,
    points: 50,
    badgeGroup: "match_counter",
  },

  // ===== LEAGUE_SEASON (11) =====
  {
    title: "First Season",
    description: "Complete your first season with at least 1 league match",
    icon: "calendar-outline",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.NONE,
    scope: AchievementScope.SEASON,
    evaluatorKey: "seasons_completed",
    threshold: 1,
    sortOrder: 1,
    points: 5,
  },
  {
    title: "3 Seasons",
    description: "Complete 3 seasons",
    icon: "calendar",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.BRONZE,
    scope: AchievementScope.SEASON,
    evaluatorKey: "seasons_completed",
    threshold: 3,
    sortOrder: 2,
    points: 10,
  },
  {
    title: "5 Seasons",
    description: "Complete 5 seasons",
    icon: "calendar",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.SILVER,
    scope: AchievementScope.SEASON,
    evaluatorKey: "seasons_completed",
    threshold: 5,
    sortOrder: 3,
    points: 20,
  },
  {
    title: "10 Seasons",
    description: "Complete 10 seasons",
    icon: "calendar",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "seasons_completed",
    threshold: 10,
    sortOrder: 4,
    points: 40,
  },
  {
    title: "20 Seasons",
    description: "Complete 20 seasons",
    icon: "calendar",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.PLATINUM,
    scope: AchievementScope.SEASON,
    evaluatorKey: "seasons_completed",
    threshold: 20,
    sortOrder: 5,
    points: 75,
  },
  {
    title: "Full Division",
    description: "Play every opponent in your division in a season",
    icon: "people-outline",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.BRONZE,
    scope: AchievementScope.SEASON,
    evaluatorKey: "full_division",
    threshold: 1,
    sortOrder: 6,
    points: 10,
  },
  {
    title: "Full Division x3",
    description: "Complete a full division in 3 separate seasons",
    icon: "people",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.SILVER,
    scope: AchievementScope.SEASON,
    evaluatorKey: "full_division",
    threshold: 3,
    sortOrder: 7,
    points: 25,
  },
  {
    title: "Full Division x10",
    description: "Complete a full division in 10 separate seasons",
    icon: "people",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "full_division",
    threshold: 10,
    sortOrder: 8,
    points: 50,
  },
  {
    title: "Back-to-Back Seasons",
    description: "Play in 2 consecutive seasons",
    icon: "repeat-outline",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.BRONZE,
    scope: AchievementScope.SEASON,
    evaluatorKey: "consecutive_seasons",
    threshold: 2,
    sortOrder: 9,
    points: 10,
  },
  {
    title: "Consecutive Seasons - 5",
    description: "Play in 5 consecutive seasons",
    icon: "repeat",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.SILVER,
    scope: AchievementScope.SEASON,
    evaluatorKey: "consecutive_seasons",
    threshold: 5,
    sortOrder: 10,
    points: 25,
  },
  {
    title: "Consecutive Seasons - 10",
    description: "Play in 10 consecutive seasons",
    icon: "repeat",
    category: AchievementCategory.LEAGUE_SEASON,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "consecutive_seasons",
    threshold: 10,
    sortOrder: 11,
    points: 50,
  },

  // ===== WINNING (12) =====
  {
    title: "First Win",
    description: "Win your first league match",
    icon: "trophy-outline",
    category: AchievementCategory.WINNING,
    tier: TierType.NONE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 1,
    sortOrder: 1,
    points: 5,
  },
  {
    title: "10 Wins",
    description: "Win 10 league matches",
    icon: "trophy",
    category: AchievementCategory.WINNING,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 10,
    sortOrder: 2,
    points: 10,
  },
  {
    title: "25 Wins",
    description: "Win 25 league matches",
    icon: "trophy",
    category: AchievementCategory.WINNING,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 25,
    sortOrder: 3,
    points: 25,
  },
  {
    title: "50 Wins",
    description: "Win 50 league matches",
    icon: "trophy",
    category: AchievementCategory.WINNING,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 50,
    sortOrder: 4,
    points: 40,
  },
  {
    title: "100 Wins",
    description: "Win 100 league matches",
    icon: "trophy",
    category: AchievementCategory.WINNING,
    tier: TierType.PLATINUM,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 100,
    sortOrder: 5,
    points: 75,
  },
  {
    title: "Win Streak - 3",
    description: "Achieve a personal best win streak of 3 matches",
    icon: "flame-outline",
    category: AchievementCategory.WINNING,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 3,
    sortOrder: 6,
    points: 10,
  },
  {
    title: "Win Streak - 5",
    description: "Achieve a personal best win streak of 5 matches",
    icon: "flame",
    category: AchievementCategory.WINNING,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 5,
    sortOrder: 7,
    points: 25,
  },
  {
    title: "Win Streak - 10",
    description: "Achieve a personal best win streak of 10 matches",
    icon: "flame",
    category: AchievementCategory.WINNING,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 10,
    sortOrder: 8,
    points: 50,
  },
  {
    title: "Perfect Season",
    description: "Win all 6 of your Best 6 matches in a season",
    icon: "diamond",
    category: AchievementCategory.WINNING,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "perfect_season",
    threshold: 1,
    sortOrder: 9,
    points: 75,
  },
  {
    title: "Division Champion",
    description: "Finish #1 in your division after tiebreakers",
    icon: "medal",
    category: AchievementCategory.WINNING,
    tier: TierType.SILVER,
    scope: AchievementScope.SEASON,
    evaluatorKey: "division_champion",
    threshold: 1,
    sortOrder: 10,
    points: 50,
  },
  {
    title: "2x Champion",
    description: "Win your division 2 times",
    icon: "medal",
    category: AchievementCategory.WINNING,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "division_champion",
    threshold: 2,
    sortOrder: 11,
    points: 75,
  },
  {
    title: "5x Champion",
    description: "Win your division 5 times",
    icon: "medal",
    category: AchievementCategory.WINNING,
    tier: TierType.PLATINUM,
    scope: AchievementScope.SEASON,
    evaluatorKey: "division_champion",
    threshold: 5,
    sortOrder: 12,
    points: 100,
  },

  // ===== MULTI_SPORT (1) =====
  {
    title: "Cross-Court",
    description: "Play league matches in 2 or more sports",
    icon: "globe-outline",
    category: AchievementCategory.MULTI_SPORT,
    tier: TierType.NONE,
    scope: AchievementScope.LIFETIME,
    evaluatorKey: "multi_sport",
    threshold: 2,
    sortOrder: 1,
    points: 15,
  },

  // ===== MATCH_STREAK (3) — Revocable live badge =====
  {
    title: "Match Streak",
    description: "Play at least 1 match per week for 2 consecutive weeks",
    icon: "flash-outline",
    category: AchievementCategory.MATCH_STREAK,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "match_streak_weeks",
    threshold: 2,
    sortOrder: 1,
    points: 5,
    isRevocable: true,
    badgeGroup: "match_streak",
  },
  {
    title: "Match Streak",
    description: "Play at least 1 match per week for 5 consecutive weeks",
    icon: "flash",
    category: AchievementCategory.MATCH_STREAK,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "match_streak_weeks",
    threshold: 5,
    sortOrder: 2,
    points: 15,
    isRevocable: true,
    badgeGroup: "match_streak",
  },
  {
    title: "Match Streak",
    description: "Play at least 1 match per week for 12 consecutive weeks",
    icon: "flash",
    category: AchievementCategory.MATCH_STREAK,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "match_streak_weeks",
    threshold: 12,
    sortOrder: 3,
    points: 50,
    isRevocable: true,
    badgeGroup: "match_streak",
  },
];

// =============================================
// SEED FUNCTION
// =============================================

export async function seedAchievements() {
  logSection("Seeding Achievements");

  // Build set of new evaluatorKey+threshold combos
  const newKeys = new Set(
    ACHIEVEMENTS.map(a => `${a.evaluatorKey}:${a.threshold}`)
  );

  // Deactivate old achievements that don't match new evaluator keys
  const existing = await prisma.achievement.findMany({
    where: { isActive: true },
    select: { id: true, evaluatorKey: true, threshold: true },
  });

  let deactivated = 0;
  for (const old of existing) {
    const key = `${old.evaluatorKey}:${old.threshold}`;
    if (!newKeys.has(key)) {
      await prisma.achievement.update({
        where: { id: old.id },
        data: { isActive: false },
      });
      deactivated++;
    }
  }

  if (deactivated > 0) {
    logSuccess(`Deactivated ${deactivated} old achievement(s)`);
  }

  let created = 0;
  let updated = 0;

  for (const achievement of ACHIEVEMENTS) {
    const found = await prisma.achievement.findFirst({
      where: {
        evaluatorKey: achievement.evaluatorKey,
        threshold: achievement.threshold,
      },
    });

    const data = {
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      tier: achievement.tier,
      scope: achievement.scope,
      sortOrder: achievement.sortOrder,
      isHidden: false,
      points: achievement.points,
      isActive: true,
      isRevocable: achievement.isRevocable ?? false,
      badgeGroup: achievement.badgeGroup ?? null,
    };

    if (found) {
      await prisma.achievement.update({
        where: { id: found.id },
        data,
      });
      updated++;
    } else {
      await prisma.achievement.create({
        data: {
          ...data,
          evaluatorKey: achievement.evaluatorKey,
          threshold: achievement.threshold,
        },
      });
      created++;
    }
  }

  logSuccess(`Seeded achievements: ${created} created, ${updated} updated`);
  return { count: ACHIEVEMENTS.length };
}

// =============================================
// SEED USER ACHIEVEMENTS (evaluate from actual data)
// =============================================

export async function seedUserAchievements(): Promise<number> {
  logSection("🏅 Evaluating user achievements from seeded data...");

  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
  });
  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE", completedOnboarding: true },
    select: { id: true },
  });

  if (achievements.length === 0 || activeUsers.length === 0) {
    logProgress("   No achievements or users found, skipping...");
    return 0;
  }

  // Pre-fetch aggregated data for all users in bulk
  const userIds = activeUsers.map((u) => u.id);

  // Match counts per player
  const matchCounts = await prisma.matchResult.groupBy({
    by: ["playerId"],
    where: { playerId: { in: userIds } },
    _count: { id: true },
  });
  const matchCountMap = new Map(
    matchCounts.map((r) => [r.playerId, r._count.id])
  );

  // Win counts per player
  const winCounts = await prisma.matchResult.groupBy({
    by: ["playerId"],
    where: { playerId: { in: userIds }, isWin: true },
    _count: { id: true },
  });
  const winCountMap = new Map(
    winCounts.map((r) => [r.playerId, r._count.id])
  );

  // Season memberships for FINISHED seasons
  const finishedMemberships = await prisma.seasonMembership.findMany({
    where: {
      userId: { in: userIds },
      status: "ACTIVE",
      season: { status: "FINISHED" },
    },
    select: { userId: true },
  });
  const seasonCountMap = new Map<string, number>();
  for (const m of finishedMemberships) {
    seasonCountMap.set(m.userId, (seasonCountMap.get(m.userId) || 0) + 1);
  }

  // Sports per user from questionnaire responses
  const questionnaireData = await prisma.questionnaireResponse.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, sport: true },
  });
  const sportMap = new Map<string, Set<string>>();
  for (const r of questionnaireData) {
    if (!sportMap.has(r.userId)) sportMap.set(r.userId, new Set());
    sportMap.get(r.userId)!.add(r.sport);
  }

  // Win streak: fetch ordered results for top 100 most active players
  const topPlayers = [...matchCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([id]) => id);

  const winStreakMap = new Map<string, number>();
  for (const playerId of topPlayers) {
    const results = await prisma.matchResult.findMany({
      where: { playerId },
      orderBy: { datePlayed: "asc" },
      select: { isWin: true },
    });

    let maxStreak = 0;
    let currentStreak = 0;
    for (const r of results) {
      if (r.isWin) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
    if (maxStreak > 0) winStreakMap.set(playerId, maxStreak);
  }

  // Group achievements by evaluatorKey for efficient lookup
  const achievementsByKey = new Map<string, typeof achievements>();
  for (const a of achievements) {
    const arr = achievementsByKey.get(a.evaluatorKey) || [];
    arr.push(a);
    achievementsByKey.set(a.evaluatorKey, arr);
  }

  let created = 0;

  for (const user of activeUsers) {
    const userId = user.id;
    const matchCount = matchCountMap.get(userId) || 0;
    const winCount = winCountMap.get(userId) || 0;
    const seasonCount = seasonCountMap.get(userId) || 0;
    const sportCount = sportMap.get(userId)?.size || 0;
    const winStreak = winStreakMap.get(userId) || 0;

    // Evaluate each evaluator key
    const evaluations: Array<{ key: string; progress: number }> = [
      { key: "total_matches", progress: matchCount },
      { key: "total_wins", progress: winCount },
      { key: "seasons_completed", progress: seasonCount },
      { key: "multi_sport", progress: sportCount },
      { key: "win_streak", progress: winStreak },
    ];

    for (const { key, progress } of evaluations) {
      if (progress === 0) continue;

      const keyAchievements = achievementsByKey.get(key);
      if (!keyAchievements) continue;

      for (const achievement of keyAchievements) {
        const isCompleted = progress >= achievement.threshold;

        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId,
              achievementId: achievement.id,
            },
          },
          update: {
            progress,
            isCompleted,
            unlockedAt: isCompleted
              ? randomDate(monthsAgo(6), new Date())
              : null,
          },
          create: {
            userId,
            achievementId: achievement.id,
            progress,
            isCompleted,
            unlockedAt: isCompleted
              ? randomDate(monthsAgo(6), new Date())
              : null,
          },
        });
        created++;
      }
    }

    if (created % 500 === 0 && created > 0) {
      logProgress(`   User achievements: ${created}`);
    }
  }

  logSuccess(`Created ${created} user achievements`);
  return created;
}
