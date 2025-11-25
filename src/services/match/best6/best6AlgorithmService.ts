/**
 * Best 6 Algorithm Service
 * Implements the core DEUCE League Best 6 Results system
 *
 * SPEC ALGORITHM:
 * 1. Sort all results chronologically
 * 2. Take first 6 wins
 * 3. If < 6 wins, fill with strongest losses (points → margin → date)
 * 4. Mark counted: countsForStandings = true, resultSequence = 1-6
 * 5. Mark non-counted: countsForStandings = false, resultSequence = null
 */

import { prisma } from '../../../lib/prisma';
import { MatchResult } from '@prisma/client';
import { logger } from '../../../utils/logger';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface Best6Result {
  matchResultId: string;
  sequence: number;  // 1-6
  type: 'win' | 'loss';
  matchPoints: number;
  margin: number;
  datePlayed: Date;
}

export interface Best6Composition {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  countedWins: number;
  countedLosses: number;
  totalPoints: number;
  results: Array<{
    matchId: string;
    opponentName: string;
    isWin: boolean;
    matchPoints: number;
    margin: number;
    datePlayed: Date;
    sequence: number;
    counted: boolean;
  }>;
}

// =============================================
// BEST 6 ALGORITHM SERVICE
// =============================================

export class Best6AlgorithmService {

  /**
   * Calculate Best 6 results for a player in a division
   *
   * CRITICAL: First 6 wins chronologically ALWAYS count
   * CRITICAL: If < 6 wins, fill with strongest losses
   */
  async calculateBest6(
    playerId: string,
    divisionId: string,
    seasonId: string
  ): Promise<Best6Result[]> {

    // Step 1: Get all match results for player in this division/season
    const allResults = await prisma.matchResult.findMany({
      where: {
        playerId,
        match: {
          divisionId,
          seasonId,
          status: 'COMPLETED'
        }
      },
      include: {
        match: {
          select: {
            matchDate: true,
            divisionId: true,
            status: true
          }
        }
      },
      orderBy: {
        datePlayed: 'asc'  // Chronological order
      }
    });

    // Step 2: Separate wins and losses
    const wins = allResults.filter(r => r.isWin);
    const losses = allResults.filter(r => !r.isWin);

    // Step 3: Take first 6 wins chronologically
    // CRITICAL: These are LOCKED - Win #7 cannot replace Win #1
    const countedWins = wins.slice(0, 6);

    // Step 4: If < 6 wins, add strongest losses
    let countedLosses: typeof allResults = [];

    if (countedWins.length < 6) {
      const slotsRemaining = 6 - countedWins.length;

      // Sort losses by strength:
      // 1. Primary: matchPoints (descending - 2 > 1)
      // 2. Secondary: margin (descending - least negative/most positive)
      // 3. Tertiary: datePlayed (descending - newest first)
      countedLosses = [...losses].sort((a, b) => {
        // Primary: Match points (higher is better)
        if (a.matchPoints !== b.matchPoints) {
          return b.matchPoints - a.matchPoints;
        }

        // Secondary: Margin (higher is better, even if negative)
        if (a.margin !== b.margin) {
          return b.margin - a.margin;
        }

        // Tertiary: Date (newer is better)
        return b.datePlayed.getTime() - a.datePlayed.getTime();
      }).slice(0, slotsRemaining);
    }

    // Step 5: Combine into Best 6
    const best6 = [
      ...countedWins.map((r, index) => ({
        matchResultId: r.id,
        sequence: index + 1,
        type: 'win' as const,
        matchPoints: r.matchPoints,
        margin: r.margin,
        datePlayed: r.datePlayed
      })),
      ...countedLosses.map((r, index) => ({
        matchResultId: r.id,
        sequence: countedWins.length + index + 1,
        type: 'loss' as const,
        matchPoints: r.matchPoints,
        margin: r.margin,
        datePlayed: r.datePlayed
      }))
    ];

    return best6;
  }

  /**
   * Apply Best 6 results to database
   * Updates countsForStandings and resultSequence fields
   */
  async applyBest6ToDatabase(
    playerId: string,
    divisionId: string,
    seasonId: string
  ): Promise<void> {

    // Calculate Best 6
    const best6 = await this.calculateBest6(playerId, divisionId, seasonId);
    const best6Ids = new Set(best6.map(r => r.matchResultId));

    // Get all results for this player in division
    const allResults = await prisma.matchResult.findMany({
      where: {
        playerId,
        match: {
          divisionId,
          seasonId
        }
      }
    });

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      for (const result of allResults) {
        if (best6Ids.has(result.id)) {
          // This result is in Best 6
          const best6Entry = best6.find(b => b.matchResultId === result.id)!;

          await tx.matchResult.update({
            where: { id: result.id },
            data: {
              countsForStandings: true,
              resultSequence: best6Entry.sequence
            }
          });
        } else {
          // This result is NOT in Best 6
          await tx.matchResult.update({
            where: { id: result.id },
            data: {
              countsForStandings: false,
              resultSequence: null
            }
          });
        }
      }
    });

    logger.info(`Applied Best 6 for player ${playerId} in division ${divisionId}`, {
      best6Count: best6.length,
      totalResults: allResults.length
    });
  }

  /**
   * Recalculate Best 6 for all players in a division
   */
  async recalculateDivisionBest6(divisionId: string, seasonId: string): Promise<void> {
    // Get all players in division
    const standings = await prisma.divisionStanding.findMany({
      where: { divisionId, seasonId },
      select: { userId: true }
    });

    const playerIds = standings
      .filter(s => s.userId)
      .map(s => s.userId!);

    logger.info(`Recalculating Best 6 for ${playerIds.length} players in division ${divisionId}`);

    // Recalculate for each player
    for (const playerId of playerIds) {
      try {
        await this.applyBest6ToDatabase(playerId, divisionId, seasonId);
      } catch (error) {
        logger.error(`Failed to recalculate Best 6 for player ${playerId}`, {}, error as Error);
      }
    }

    logger.info(`Completed Best 6 recalculation for division ${divisionId}`);
  }

  /**
   * Get Best 6 composition for display
   */
  async getBest6Composition(
    playerId: string,
    divisionId: string,
    seasonId: string
  ): Promise<Best6Composition> {
    const allResults = await prisma.matchResult.findMany({
      where: {
        playerId,
        match: {
          divisionId,
          seasonId,
          status: 'COMPLETED'
        }
      },
      include: {
        opponent: {
          select: { name: true }
        },
        match: {
          select: { id: true }
        }
      },
      orderBy: [
        { countsForStandings: 'desc' },
        { resultSequence: 'asc' },
        { datePlayed: 'asc' }
      ]
    });

    const totalWins = allResults.filter(r => r.isWin).length;
    const totalLosses = allResults.filter(r => !r.isWin).length;
    const countedResults = allResults.filter(r => r.countsForStandings);
    const countedWins = countedResults.filter(r => r.isWin).length;
    const countedLosses = countedResults.filter(r => !r.isWin).length;
    const totalPoints = countedResults.reduce((sum, r) => sum + r.matchPoints, 0);

    return {
      totalMatches: allResults.length,
      totalWins,
      totalLosses,
      countedWins,
      countedLosses,
      totalPoints,
      results: allResults.map(r => ({
        matchId: r.match.id,
        opponentName: r.opponent.name,
        isWin: r.isWin,
        matchPoints: r.matchPoints,
        margin: r.margin,
        datePlayed: r.datePlayed,
        sequence: r.resultSequence || 0,
        counted: r.countsForStandings
      }))
    };
  }

  /**
   * Get summary stats for a player
   */
  async getPlayerStats(
    playerId: string,
    divisionId: string,
    seasonId: string
  ): Promise<{
    record: string;
    leaguePoints: number;
    bestPossible: number;
    resultsCounted: string;
  }> {
    const composition = await this.getBest6Composition(playerId, divisionId, seasonId);

    const record = `${composition.totalWins}W-${composition.totalLosses}L`;
    const leaguePoints = composition.totalPoints;

    // Best possible: current points + (potential wins × 5)
    const matchesRemaining = 9 - composition.totalMatches; // Assuming 9 scheduled matches
    const potentialWins = Math.max(0, 6 - composition.countedWins);
    const bestPossible = leaguePoints + (potentialWins * 5);

    const resultsCounted = composition.countedLosses > 0
      ? `${composition.countedWins}W + ${composition.countedLosses}L`
      : `${composition.countedWins} wins`;

    return {
      record,
      leaguePoints,
      bestPossible,
      resultsCounted
    };
  }
}
