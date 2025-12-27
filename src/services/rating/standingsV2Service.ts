/**
 * Standings V2 Service
 * Implements DEUCE League standings with Best 6 results and correct tiebreakers
 *
 * TIEBREAKER ORDER:
 * 1. Total Points (from Best 6)
 * 2. Head-to-Head Record (ALL matches)
 * 3. Set/Game Win % (Best 6 only)
 * 4. Games/Points Win % (Best 6 only)
 * 5. Alphabetical
 */

import { prisma } from '../../lib/prisma';
import { Best6AlgorithmService } from '../match/best6/best6AlgorithmService';
import { logger } from '../../utils/logger';

// =============================================
// TYPE DEFINITIONS
// =============================================

interface TiebreakMetrics {
  totalPoints: number;
  headToHead: Record<string, H2HRecord>;
  setWinPct: number;
  gameWinPct: number;
}

interface H2HRecord {
  wins: number;
  losses: number;
}

interface PlayerMetrics {
  standingId: string;
  userId: string;
  name: string;
  metrics: TiebreakMetrics;
}

// =============================================
// STANDINGS V2 SERVICE
// =============================================

export class StandingsV2Service {
  private best6Service = new Best6AlgorithmService();

  /**
   * Recalculate standings for entire division
   * Uses Best 6 results ONLY for points and most tiebreakers
   *
   * OPTIMIZED: Uses batch queries to avoid N+1 problem
   */
  async recalculateDivisionStandings(divisionId: string, seasonId: string): Promise<void> {
    logger.info(`Recalculating standings for division ${divisionId}`);

    // Get all players in division WITH user data (1 query)
    const standings = await prisma.divisionStanding.findMany({
      where: { divisionId, seasonId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    const playerIds = standings
      .filter(s => s.userId)
      .map(s => s.userId!);

    // Get ALL match results for ALL players in division (1 query)
    const allResults = await prisma.matchResult.findMany({
      where: {
        playerId: { in: playerIds },
        match: {
          divisionId,
          seasonId,
          status: 'COMPLETED'
        }
      },
      include: {
        match: true
      }
    });

    // Group results by player
    const resultsByPlayer: Record<string, typeof allResults> = {};
    for (const result of allResults) {
      if (!result.playerId) continue;

      if (!resultsByPlayer[result.playerId]) {
        resultsByPlayer[result.playerId] = [];
      }
      resultsByPlayer[result.playerId]!.push(result);
    }

    // Calculate metrics for each player (no more DB queries!)
    const playerMetrics = standings
      .filter(s => s.userId)
      .map(s => {
        const playerResults = resultsByPlayer[s.userId!] || [];
        const best6Results = playerResults.filter(r => r.countsForStandings);

        return {
          standingId: s.id,
          userId: s.userId!,
          name: s.user?.name || 'Unknown',
          metrics: this.calculatePlayerMetricsFromResults(playerResults, best6Results)
        };
      });

    // Sort by tiebreakers
    const sortedPlayers = this.sortByTiebreakers(playerMetrics);

    // Update database
    await this.applyRankings(sortedPlayers, divisionId, seasonId);

    logger.info(`Completed standings recalculation for division ${divisionId}`);
  }

  /**
   * Calculate all metrics for a player (DEPRECATED - kept for backward compatibility)
   * Use calculatePlayerMetricsFromResults instead for better performance
   */
  private async calculatePlayerMetrics(
    playerId: string,
    divisionId: string,
    seasonId: string
  ): Promise<TiebreakMetrics> {

    // Get ALL match results (for H2H and total record)
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
        match: true
      }
    });

    // Get BEST 6 results only (for points and tiebreakers)
    const best6Results = allResults.filter(r => r.countsForStandings);

    return this.calculatePlayerMetricsFromResults(allResults, best6Results);
  }

  /**
   * Calculate metrics from pre-fetched results (OPTIMIZED)
   * Avoids N+1 query problem by reusing already-fetched data
   */
  private calculatePlayerMetricsFromResults(
    allResults: any[],
    best6Results: any[]
  ): TiebreakMetrics {

    // 1. Total Points (from Best 6)
    const totalPoints = best6Results.reduce((sum, r) => sum + r.matchPoints, 0);

    // 2. Head-to-Head (ALL matches)
    const headToHead = this.calculateHeadToHead(allResults);

    // 3. Set Win % (from Best 6)
    const setWinPct = this.calculateSetWinPercentage(best6Results);

    // 4. Game Win % (from Best 6)
    const gameWinPct = this.calculateGameWinPercentage(best6Results);

    return {
      totalPoints,
      headToHead,
      setWinPct,
      gameWinPct
    };
  }

  /**
   * Calculate Set Win Percentage from Best 6
   */
  private calculateSetWinPercentage(best6Results: any[]): number {
    const totalSets = best6Results.reduce((sum, r) => sum + r.setsWon + r.setsLost, 0);
    const setsWon = best6Results.reduce((sum, r) => sum + r.setsWon, 0);

    return totalSets > 0 ? (setsWon / totalSets) * 100 : 0;
  }

  /**
   * Calculate Game Win Percentage from Best 6
   */
  private calculateGameWinPercentage(best6Results: any[]): number {
    const totalGames = best6Results.reduce((sum, r) => sum + r.gamesWon + r.gamesLost, 0);
    const gamesWon = best6Results.reduce((sum, r) => sum + r.gamesWon, 0);

    return totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;
  }

  /**
   * Calculate Head-to-Head record (ALL matches)
   */
  private calculateHeadToHead(allResults: any[]): Record<string, H2HRecord> {
    const h2h: Record<string, H2HRecord> = {};

    for (const result of allResults) {
      if (!result.opponentId) continue;

      if (!h2h[result.opponentId]) {
        h2h[result.opponentId] = { wins: 0, losses: 0 };
      }

      if (result.isWin) {
        h2h[result.opponentId]!.wins++;
      } else {
        h2h[result.opponentId]!.losses++;
      }
    }

    return h2h;
  }

  /**
   * Sort players by tiebreaker rules
   *
   * SPEC ORDER:
   * 1. Total Points (from Best 6)
   * 2. Head-to-Head Record (for 2-way ties: direct H2H; for 3+ way ties: H2H within tied group)
   * 3. Set Win % (Best 6 only)
   * 4. Game Win % (Best 6 only)
   * 5. Alphabetical
   */
  private sortByTiebreakers(players: PlayerMetrics[]): PlayerMetrics[] {
    // First, group players by points
    const pointGroups = new Map<number, PlayerMetrics[]>();
    for (const player of players) {
      const points = player.metrics.totalPoints;
      if (!pointGroups.has(points)) {
        pointGroups.set(points, []);
      }
      pointGroups.get(points)!.push(player);
    }

    // Sort each group and flatten
    const sortedGroups: PlayerMetrics[] = [];
    const sortedPoints = Array.from(pointGroups.keys()).sort((a, b) => b - a);

    for (const points of sortedPoints) {
      const group = pointGroups.get(points)!;

      if (group.length === 1) {
        sortedGroups.push(group[0]);
      } else if (group.length === 2) {
        // 2-way tie: use direct H2H
        sortedGroups.push(...this.sortTwoWayTie(group));
      } else {
        // 3+ way tie: calculate H2H within tied group
        sortedGroups.push(...this.sortMultiWayTie(group));
      }
    }

    return sortedGroups;
  }

  /**
   * Sort a 2-way tie using direct head-to-head
   */
  private sortTwoWayTie(players: PlayerMetrics[]): PlayerMetrics[] {
    const a = players[0];
    const b = players[1];

    // Safety check - should never happen if called correctly
    if (!a || !b) {
      return players;
    }

    const aVsB = a.metrics.headToHead[b.userId];
    const bVsA = b.metrics.headToHead[a.userId];

    if (aVsB && bVsA && aVsB.wins !== bVsA.wins) {
      return aVsB.wins > bVsA.wins ? [a, b] : [b, a];
    }

    // If H2H tied or no matches, use set win %
    if (a.metrics.setWinPct !== b.metrics.setWinPct) {
      return b.metrics.setWinPct > a.metrics.setWinPct ? [b, a] : [a, b];
    }

    // Game win %
    if (a.metrics.gameWinPct !== b.metrics.gameWinPct) {
      return b.metrics.gameWinPct > a.metrics.gameWinPct ? [b, a] : [a, b];
    }

    // Alphabetical
    return a.name.localeCompare(b.name) <= 0 ? [a, b] : [b, a];
  }

  /**
   * Sort a 3+ way tie using H2H record within the tied group
   * For each player, count wins against OTHER players in the tied group only
   */
  private sortMultiWayTie(players: PlayerMetrics[]): PlayerMetrics[] {
    const tiedUserIds = new Set(players.map(p => p.userId));

    // Calculate H2H wins within the tied group for each player
    const groupH2HWins = players.map(player => {
      let winsInGroup = 0;
      for (const opponentId of tiedUserIds) {
        if (opponentId === player.userId) continue;
        const h2h = player.metrics.headToHead[opponentId];
        if (h2h) {
          winsInGroup += h2h.wins;
        }
      }
      return { player, winsInGroup };
    });

    // Sort by H2H wins within group
    groupH2HWins.sort((a, b) => {
      if (b.winsInGroup !== a.winsInGroup) {
        return b.winsInGroup - a.winsInGroup;
      }

      // If still tied, use set win %
      if (a.player.metrics.setWinPct !== b.player.metrics.setWinPct) {
        return b.player.metrics.setWinPct - a.player.metrics.setWinPct;
      }

      // Game win %
      if (a.player.metrics.gameWinPct !== b.player.metrics.gameWinPct) {
        return b.player.metrics.gameWinPct - a.player.metrics.gameWinPct;
      }

      // Alphabetical
      return a.player.name.localeCompare(b.player.name);
    });

    return groupH2HWins.map(g => g.player);
  }

  /**
   * Apply rankings to database
   */
  private async applyRankings(
    rankings: PlayerMetrics[],
    divisionId: string,
    seasonId: string
  ): Promise<void> {

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rankings.length; i++) {
        const ranking = rankings[i];
        if (!ranking) continue;

        const rank = i + 1;

        // Get Best 6 results for this player
        const best6 = await tx.matchResult.findMany({
          where: {
            playerId: ranking.userId,
            countsForStandings: true,
            match: {
              divisionId,
              seasonId
            }
          }
        });

        // Calculate aggregate stats
        const countedWins = best6.filter(r => r.isWin).length;
        const countedLosses = best6.filter(r => !r.isWin).length;
        const best6SetsWon = best6.reduce((sum, r) => sum + r.setsWon, 0);
        const best6SetsTotal = best6.reduce((sum, r) => sum + r.setsWon + r.setsLost, 0);
        const best6GamesWon = best6.reduce((sum, r) => sum + r.gamesWon, 0);
        const best6GamesTotal = best6.reduce((sum, r) => sum + r.gamesWon + r.gamesLost, 0);

        // Get ALL results for total match count
        const allResults = await tx.matchResult.findMany({
          where: {
            playerId: ranking.userId,
            match: {
              divisionId,
              seasonId
            }
          }
        });

        const totalWins = allResults.filter(r => r.isWin).length;
        const totalLosses = allResults.filter(r => !r.isWin).length;
        const allSetsWon = allResults.reduce((sum, r) => sum + r.setsWon, 0);
        const allSetsLost = allResults.reduce((sum, r) => sum + r.setsLost, 0);
        const allGamesWon = allResults.reduce((sum, r) => sum + r.gamesWon, 0);
        const allGamesLost = allResults.reduce((sum, r) => sum + r.gamesLost, 0);

        // Update standing
        await tx.divisionStanding.update({
          where: { id: ranking.standingId },
          data: {
            rank,
            totalPoints: ranking.metrics.totalPoints,

            // Best 6 counts
            countedWins,
            countedLosses,

            // Total match record
            wins: totalWins,
            losses: totalLosses,
            matchesPlayed: allResults.length,

            // All matches aggregate
            setsWon: allSetsWon,
            setsLost: allSetsLost,
            gamesWon: allGamesWon,
            gamesLost: allGamesLost,

            // Best 6 specific (for tiebreakers)
            best6SetsWon,
            best6SetsTotal,
            best6GamesWon,
            best6GamesTotal,

            // H2H (ALL matches)
            headToHead: JSON.parse(JSON.stringify(ranking.metrics.headToHead)),

            lastCalculatedAt: new Date()
          }
        });
      }
    });
  }

  /**
   * Get standings for display
   */
  async getDivisionStandings(divisionId: string): Promise<any[]> {
    const standings = await prisma.divisionStanding.findMany({
      where: { divisionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { rank: 'asc' }
    });

    return standings.map(s => ({
      rank: s.rank,
      playerId: s.userId,
      playerName: s.user?.name || 'Unknown',
      playerImage: s.user?.image,

      // Points and record
      totalPoints: s.totalPoints,
      record: `${s.wins}W-${s.losses}L`,
      matchesPlayed: s.matchesPlayed,

      // Best 6 composition
      resultsCounted: s.countedLosses > 0
        ? `${s.countedWins}W + ${s.countedLosses}L`
        : `${s.countedWins} wins`,

      // Detailed stats
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      setWinPct: s.best6SetsTotal > 0
        ? ((s.best6SetsWon / s.best6SetsTotal) * 100).toFixed(1) + '%'
        : 'N/A',

      gamesWon: s.gamesWon,
      gamesLost: s.gamesLost,
      gameWinPct: s.best6GamesTotal > 0
        ? ((s.best6GamesWon / s.best6GamesTotal) * 100).toFixed(1) + '%'
        : 'N/A'
    }));
  }
}
