/**
 * Best 6 Event Handler
 * Handles match lifecycle events and triggers Best 6 recalculation
 */

import { prisma } from '../../../lib/prisma';
import { Best6AlgorithmService } from './best6AlgorithmService';
import { logger } from '../../../utils/logger';

export class Best6EventHandler {
  private best6Service = new Best6AlgorithmService();

  /**
   * Handle match completion event
   * Triggers Best 6 recalculation for both players
   */
  async onMatchCompleted(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    });

    if (!match || !match.divisionId || !match.seasonId) {
      logger.warn(`Match ${matchId} has no division or season`);
      return;
    }

    if (match.status !== 'COMPLETED') {
      logger.warn(`Match ${matchId} is not completed yet`);
      return;
    }

    // Get unique player IDs (filter out nulls)
    const playerIds = [...new Set(
      match.participants
        .filter(p => p.userId)
        .map(p => p.userId!)
    )];

    logger.info(`Recalculating Best 6 for ${playerIds.length} players after match ${matchId}`);

    // Recalculate Best 6 for each player
    for (const playerId of playerIds) {
      try {
        await this.best6Service.applyBest6ToDatabase(
          playerId,
          match.divisionId,
          match.seasonId
        );

        logger.info(`Recalculated Best 6 for player ${playerId} after match ${matchId}`);
      } catch (error) {
        logger.error(
          `Failed to recalculate Best 6 for player ${playerId}`,
          { matchId },
          error as Error
        );
        // Don't throw - continue with other players
      }
    }
  }

  /**
   * Handle match deletion event
   */
  async onMatchDeleted(
    matchId: string,
    divisionId: string,
    seasonId: string,
    affectedPlayerIds: string[]
  ): Promise<void> {
    logger.info(`Recalculating Best 6 after match deletion ${matchId}`);

    // Recalculate Best 6 for affected players
    for (const playerId of affectedPlayerIds) {
      try {
        await this.best6Service.applyBest6ToDatabase(playerId, divisionId, seasonId);
      } catch (error) {
        logger.error(
          `Failed to recalculate Best 6 for player ${playerId} after deletion`,
          { matchId },
          error as Error
        );
      }
    }
  }

  /**
   * Handle match voided event
   */
  async onMatchVoided(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    });

    if (!match || !match.divisionId || !match.seasonId) {
      return;
    }

    const playerIds = [...new Set(
      match.participants
        .filter(p => p.userId)
        .map(p => p.userId!)
    )];

    logger.info(`Recalculating Best 6 after match voided ${matchId}`);

    for (const playerId of playerIds) {
      try {
        await this.best6Service.applyBest6ToDatabase(
          playerId,
          match.divisionId,
          match.seasonId
        );
      } catch (error) {
        logger.error(
          `Failed to recalculate Best 6 for player ${playerId} after void`,
          { matchId },
          error as Error
        );
      }
    }
  }

  /**
   * Bulk recalculation for entire division
   */
  async recalculateDivision(divisionId: string, seasonId: string): Promise<void> {
    logger.info(`Starting bulk Best 6 recalculation for division ${divisionId}`);

    try {
      await this.best6Service.recalculateDivisionBest6(divisionId, seasonId);
      logger.info(`Completed bulk Best 6 recalculation for division ${divisionId}`);
    } catch (error) {
      logger.error(
        `Failed bulk Best 6 recalculation for division ${divisionId}`,
        {},
        error as Error
      );
      throw error;
    }
  }
}
