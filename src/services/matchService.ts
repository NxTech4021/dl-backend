/**
 * Match Service
 * Handles match creation with inactivity reactivation
 */

import { prisma } from '../lib/prisma';
import { getInactivityService } from './inactivityService';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

/**
 * Hook to reactivate players after match creation
 * Call this function after successfully creating a match
 */
export async function handlePostMatchCreation(matchId: string): Promise<void> {
  try {
    // Get all participants from the match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!match) {
      logger.warn(`Match ${matchId} not found for reactivation check`);
      return;
    }

    // Reactivate each participant if they were inactive
    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);

    for (const participant of match.participants) {
      await inactivityService.reactivateUser(participant.userId);
    }

    logger.info(`Processed reactivation check for ${match.participants.length} participants in match ${matchId}`);
  } catch (error) {
    logger.error(`Error in post-match reactivation for match ${matchId}:`, {}, error as Error);
    // Don't throw - reactivation failure shouldn't block match creation
  }
}
