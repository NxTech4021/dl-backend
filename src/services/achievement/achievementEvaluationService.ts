/**
 * Achievement Evaluation Service
 *
 * Core engine that evaluates achievements for a given user.
 * Fire-and-forget pattern: never throws, catches errors internally.
 *
 * Hook points:
 * - After match completion (MATCH + LIFETIME scope)
 * - After season finalization (SEASON + LIFETIME scope)
 */

import { prisma } from '../../lib/prisma';
import { AchievementScope, SportType, GameType } from '@prisma/client';
import { getEvaluator, EvaluatorContext } from './achievementDefinitions';
import { NotificationService } from '../notificationService';
import { accountNotifications } from '../../helpers/notifications/accountNotifications';
import { logger } from '../../utils/logger';
import { io } from '../../app';

// ========================================
// Types
// ========================================

interface EvaluationResult {
  evaluated: number;
  newlyUnlocked: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    tier: string;
    category: string;
    points: number;
  }>;
}

// ========================================
// Core Evaluation
// ========================================

/**
 * Evaluate all active achievements matching the given scopes for a user.
 * Returns which achievements were evaluated and which were newly unlocked.
 */
async function evaluateAchievements(
  userId: string,
  scopes: AchievementScope[],
  context: EvaluatorContext
): Promise<EvaluationResult> {
  // 1. Fetch all active achievements matching these scopes
  const achievements = await prisma.achievement.findMany({
    where: {
      isActive: true,
      scope: { in: scopes },
    },
  });

  const result: EvaluationResult = { evaluated: 0, newlyUnlocked: [] };

  for (const achievement of achievements) {
    // 2. Check if already completed
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    if (existing?.isCompleted) continue;

    // 3. Get the evaluator function
    const evaluator = getEvaluator(achievement.evaluatorKey);
    if (!evaluator) {
      logger.warn(`No evaluator found for key: ${achievement.evaluatorKey}`);
      continue;
    }

    // 4. Run the evaluator
    const evalResult = await evaluator(
      context,
      achievement.threshold,
      achievement.sportFilter as SportType | null,
      achievement.gameTypeFilter as GameType | null
    );

    result.evaluated++;

    // 5. Upsert progress
    const isNowComplete = evalResult.isComplete;

    await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
      create: {
        userId,
        achievementId: achievement.id,
        progress: evalResult.currentValue,
        isCompleted: isNowComplete,
        unlockedAt: isNowComplete ? new Date() : null,
      },
      update: {
        progress: evalResult.currentValue,
        ...(isNowComplete && !existing?.isCompleted
          ? { isCompleted: true, unlockedAt: new Date() }
          : {}),
      },
    });

    // 6. If newly completed, send notification
    if (isNowComplete && !existing?.isCompleted) {
      result.newlyUnlocked.push({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        category: achievement.category,
        points: achievement.points,
      });

      // Send in-app notification (fire-and-forget)
      try {
        const notificationService = new NotificationService();
        const payload = accountNotifications.achievementUnlocked(achievement.title);
        await notificationService.createNotification({
          ...payload,
          userIds: userId,
          achievementId: achievement.id,
        });
      } catch (err) {
        logger.error('Failed to send achievement notification:', {
          error: err instanceof Error ? err.message : String(err),
          achievementId: achievement.id,
          userId,
        });
      }

      // Emit real-time socket event for celebration UI (fire-and-forget)
      try {
        if (io) {
          io.to(userId).emit('achievement_unlocked', {
            achievementId: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
            tier: achievement.tier,
            category: achievement.category,
            points: achievement.points,
          });
          logger.debug(`Emitted achievement_unlocked to user ${userId} for achievement ${achievement.id}`);
        }
      } catch (err) {
        logger.warn('Failed to emit achievement_unlocked socket event:', {
          error: err instanceof Error ? err.message : String(err),
          achievementId: achievement.id,
          userId,
        });
      }
    }
  }

  return result;
}

// ========================================
// Public API (fire-and-forget wrappers)
// ========================================

/**
 * Evaluate match-triggered achievements for a user.
 * Fire-and-forget: never throws.
 */
export async function evaluateMatchAchievementsSafe(
  userId: string,
  context: EvaluatorContext
): Promise<void> {
  try {
    const result = await evaluateAchievements(
      userId,
      [AchievementScope.MATCH, AchievementScope.LIFETIME],
      context
    );

    if (result.newlyUnlocked.length > 0) {
      logger.info(`User ${userId} unlocked ${result.newlyUnlocked.length} achievement(s) after match`, {
        achievements: result.newlyUnlocked.map(a => a.title),
      });
    }
  } catch (error: unknown) {
    logger.error('Failed to evaluate match achievements:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      ...(context.matchId !== undefined ? { matchId: context.matchId } : {}),
    });
  }
}

/**
 * Evaluate season-triggered achievements for a user.
 * Called when a season is finalized (status → FINISHED).
 * Fire-and-forget: never throws.
 */
export async function evaluateSeasonAchievementsSafe(
  userId: string,
  context: EvaluatorContext
): Promise<void> {
  try {
    const result = await evaluateAchievements(
      userId,
      [AchievementScope.SEASON, AchievementScope.LIFETIME],
      context
    );

    if (result.newlyUnlocked.length > 0) {
      logger.info(`User ${userId} unlocked ${result.newlyUnlocked.length} achievement(s) after season`, {
        achievements: result.newlyUnlocked.map(a => a.title),
      });
    }
  } catch (error: unknown) {
    logger.error('Failed to evaluate season achievements:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      ...(context.seasonId !== undefined ? { seasonId: context.seasonId } : {}),
    });
  }
}

/**
 * Evaluate ALL achievements for a user (all scopes).
 * Used for retroactive evaluation on initial seed, or admin-triggered evaluation.
 * Fire-and-forget: never throws.
 */
export async function evaluateAllAchievementsSafe(
  userId: string
): Promise<void> {
  try {
    const result = await evaluateAchievements(
      userId,
      [AchievementScope.MATCH, AchievementScope.SEASON, AchievementScope.LIFETIME],
      { userId }
    );

    logger.info(`Full evaluation for user ${userId}: ${result.evaluated} evaluated, ${result.newlyUnlocked.length} unlocked`);
  } catch (error: unknown) {
    logger.error('Failed to evaluate all achievements:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
  }
}

/**
 * Evaluate season achievements for ALL players in a season's divisions.
 * Called when admin finalizes a season (status → FINISHED).
 */
export async function finalizeSeasonAchievements(
  seasonId: string
): Promise<void> {
  try {
    // Get all division standings for this season
    const standings = await prisma.divisionStanding.findMany({
      where: { seasonId },
      select: { userId: true, divisionId: true },
    });

    // Dedupe by userId (a player might be in multiple divisions)
    const userDivisions = new Map<string, string[]>();
    for (const s of standings) {
      if (!s.userId) continue;
      const existing = userDivisions.get(s.userId) || [];
      existing.push(s.divisionId);
      userDivisions.set(s.userId, existing);
    }

    logger.info(`Finalizing season achievements for ${userDivisions.size} players in season ${seasonId}`);

    // Process in batches of 5 to avoid overwhelming the database
    const entries = Array.from(userDivisions.entries());
    const BATCH_SIZE = 5;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(([userId, divisionIds]) =>
          evaluateSeasonAchievementsSafe(userId, {
            userId,
            seasonId,
            divisionId: divisionIds[0],
          })
        )
      );
    }

    logger.info(`Completed season achievement finalization for season ${seasonId}`);
  } catch (error: unknown) {
    logger.error('Failed to finalize season achievements:', {
      error: error instanceof Error ? error.message : String(error),
      seasonId,
    });
  }
}
