/**
 * Achievement Definitions Seed
 * Creates the 20 initial achievement definitions.
 * This does NOT grant achievements to users — that's handled by the evaluation engine.
 */

import {
  AchievementCategory,
  AchievementScope,
  TierType,
} from "@prisma/client";
import { prisma, logSection, logSuccess } from "./utils";

// =============================================
// SEED DATA
// =============================================

const ACHIEVEMENTS = [
  // COMPETITION (8)
  {
    title: "First Victory",
    description: "Win your first match",
    icon: "trophy-outline",
    category: AchievementCategory.COMPETITION,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 1,
    sortOrder: 1,
    points: 5,
  },
  {
    title: "On a Roll",
    description: "Win 10 matches",
    icon: "trophy",
    category: AchievementCategory.COMPETITION,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 10,
    sortOrder: 2,
    points: 10,
  },
  {
    title: "Quarter Century",
    description: "Win 25 matches",
    icon: "trophy",
    category: AchievementCategory.COMPETITION,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 25,
    sortOrder: 3,
    points: 25,
  },
  {
    title: "Half Century",
    description: "Win 50 matches",
    icon: "trophy",
    category: AchievementCategory.COMPETITION,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 50,
    sortOrder: 4,
    points: 50,
  },
  {
    title: "Centurion",
    description: "Win 100 matches",
    icon: "trophy",
    category: AchievementCategory.COMPETITION,
    tier: TierType.PLATINUM,
    scope: AchievementScope.MATCH,
    evaluatorKey: "total_wins",
    threshold: 100,
    sortOrder: 5,
    points: 100,
  },
  {
    title: "Hot Streak",
    description: "Win 3 matches in a row",
    icon: "flame-outline",
    category: AchievementCategory.COMPETITION,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 3,
    sortOrder: 6,
    points: 10,
  },
  {
    title: "On Fire",
    description: "Win 5 matches in a row",
    icon: "flame",
    category: AchievementCategory.COMPETITION,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 5,
    sortOrder: 7,
    points: 25,
  },
  {
    title: "Unstoppable",
    description: "Win 10 matches in a row",
    icon: "flame",
    category: AchievementCategory.COMPETITION,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "win_streak",
    threshold: 10,
    sortOrder: 8,
    points: 50,
  },

  // RATING (4)
  {
    title: "Rising Star",
    description: "Reach a peak DMR rating of 1600",
    icon: "trending-up",
    category: AchievementCategory.RATING,
    tier: TierType.BRONZE,
    scope: AchievementScope.MATCH,
    evaluatorKey: "peak_rating",
    threshold: 1600,
    sortOrder: 1,
    points: 15,
  },
  {
    title: "Contender",
    description: "Reach a peak DMR rating of 1700",
    icon: "trending-up",
    category: AchievementCategory.RATING,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "peak_rating",
    threshold: 1700,
    sortOrder: 2,
    points: 30,
  },
  {
    title: "Elite",
    description: "Reach a peak DMR rating of 1800",
    icon: "star",
    category: AchievementCategory.RATING,
    tier: TierType.GOLD,
    scope: AchievementScope.MATCH,
    evaluatorKey: "peak_rating",
    threshold: 1800,
    sortOrder: 3,
    points: 50,
  },
  {
    title: "Giant Killer",
    description: "Beat an opponent rated 100+ points higher than you",
    icon: "flash",
    category: AchievementCategory.RATING,
    tier: TierType.SILVER,
    scope: AchievementScope.MATCH,
    evaluatorKey: "rating_upset",
    threshold: 1,
    sortOrder: 4,
    isHidden: true,
    points: 25,
  },

  // SEASON (5)
  {
    title: "Division Champion",
    description: "Finish first in your division",
    icon: "medal",
    category: AchievementCategory.SEASON,
    tier: TierType.GOLD,
    scope: AchievementScope.SEASON,
    evaluatorKey: "division_champion",
    threshold: 1,
    sortOrder: 1,
    points: 50,
  },
  {
    title: "Podium Finish",
    description: "Finish in the top 3 of your division",
    icon: "podium-outline",
    category: AchievementCategory.SEASON,
    tier: TierType.SILVER,
    scope: AchievementScope.SEASON,
    evaluatorKey: "top_3_finish",
    threshold: 1,
    sortOrder: 2,
    points: 25,
  },
  {
    title: "Perfect Season",
    description: "Win all 6 of your Best 6 matches in a season",
    icon: "diamond",
    category: AchievementCategory.SEASON,
    tier: TierType.PLATINUM,
    scope: AchievementScope.SEASON,
    evaluatorKey: "perfect_season",
    threshold: 1,
    sortOrder: 3,
    isHidden: true,
    points: 100,
  },
  {
    title: "Iron Player",
    description: "Play all scheduled matches in a season",
    icon: "barbell",
    category: AchievementCategory.SEASON,
    tier: TierType.BRONZE,
    scope: AchievementScope.SEASON,
    evaluatorKey: "iron_player",
    threshold: 1,
    sortOrder: 4,
    points: 15,
  },
  {
    title: "Veteran Champion",
    description: "Win your division 3 times",
    icon: "medal",
    category: AchievementCategory.SEASON,
    tier: TierType.PLATINUM,
    scope: AchievementScope.SEASON,
    evaluatorKey: "division_champion",
    threshold: 3,
    sortOrder: 5,
    points: 100,
  },

  // SOCIAL (3)
  {
    title: "Multi-Sport Athlete",
    description: "Play matches in 2 different sports",
    icon: "globe",
    category: AchievementCategory.SOCIAL,
    tier: TierType.BRONZE,
    scope: AchievementScope.LIFETIME,
    evaluatorKey: "multi_sport",
    threshold: 2,
    sortOrder: 1,
    points: 10,
  },
  {
    title: "Triple Threat",
    description: "Play matches in all 3 sports",
    icon: "globe",
    category: AchievementCategory.SOCIAL,
    tier: TierType.SILVER,
    scope: AchievementScope.LIFETIME,
    evaluatorKey: "multi_sport",
    threshold: 3,
    sortOrder: 2,
    points: 25,
  },
  {
    title: "Team Player",
    description: "Play doubles in 3 different seasons",
    icon: "people",
    category: AchievementCategory.SOCIAL,
    tier: TierType.SILVER,
    scope: AchievementScope.LIFETIME,
    evaluatorKey: "partnership_seasons",
    threshold: 3,
    sortOrder: 3,
    points: 20,
  },
];

// =============================================
// SEED FUNCTION
// =============================================

export async function seedAchievements() {
  logSection("Seeding Achievements");

  let created = 0;
  let updated = 0;

  for (const achievement of ACHIEVEMENTS) {
    const existing = await prisma.achievement.findFirst({
      where: {
        evaluatorKey: achievement.evaluatorKey,
        threshold: achievement.threshold,
      },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: {
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          tier: achievement.tier,
          scope: achievement.scope,
          sortOrder: achievement.sortOrder,
          isHidden: achievement.isHidden ?? false,
          points: achievement.points,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.achievement.create({
        data: {
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          tier: achievement.tier,
          scope: achievement.scope,
          evaluatorKey: achievement.evaluatorKey,
          threshold: achievement.threshold,
          sortOrder: achievement.sortOrder,
          isHidden: achievement.isHidden ?? false,
          points: achievement.points,
          isActive: true,
        },
      });
      created++;
    }
  }

  logSuccess(`Seeded achievements: ${created} created, ${updated} updated`);
  return { count: ACHIEVEMENTS.length };
}
