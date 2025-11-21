/**
 * Bracket Service
 * Handles finals bracket creation, seeding, and management (AS2)
 */

import { prisma } from '../../lib/prisma';
import {
  BracketType,
  BracketStatus,
  SeedingSource,
  BracketMatchStatus,
  GameType
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';

// Types
export interface CreateBracketInput {
  seasonId: string;
  divisionId: string;
  bracketName: string;
  bracketType?: BracketType;
  seedingSource?: SeedingSource;
  numPlayers?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface SeedBracketInput {
  bracketId: string;
  adminId: string;
  seedingSource?: SeedingSource;
  manualSeeds?: { seed: number; playerId: string }[];
}

export interface PublishBracketInput {
  bracketId: string;
  adminId: string;
  notifyPlayers?: boolean;
}

export interface UpdateBracketMatchInput {
  bracketMatchId: string;
  adminId: string;
  scheduledTime?: Date;
  courtLocation?: string;
  player1Id?: string;
  player2Id?: string;
}

export class BracketService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a new bracket for a division
   */
  async createBracket(input: CreateBracketInput) {
    const {
      seasonId,
      divisionId,
      bracketName,
      bracketType = BracketType.SINGLE_ELIMINATION,
      seedingSource = SeedingSource.STANDINGS,
      numPlayers = 8,
      startDate,
      endDate
    } = input;

    // Verify season and division exist
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: { season: true }
    });

    if (!division) {
      throw new Error('Division not found');
    }

    if (division.seasonId !== seasonId) {
      throw new Error('Division does not belong to the specified season');
    }

    // Check if bracket already exists
    const existing = await prisma.bracket.findUnique({
      where: {
        seasonId_divisionId: { seasonId, divisionId }
      }
    });

    if (existing) {
      throw new Error('A bracket already exists for this division');
    }

    // Calculate number of rounds based on players
    const numRounds = Math.ceil(Math.log2(numPlayers));

    // Create bracket with rounds
    const bracket = await prisma.$transaction(async (tx) => {
      const bracketData: any = {
        seasonId,
        divisionId,
        bracketName,
        bracketType,
        seedingSource,
        numPlayers,
        status: 'DRAFT'
      };
      if (startDate) bracketData.startDate = startDate;
      if (endDate) bracketData.endDate = endDate;

      const newBracket = await tx.bracket.create({
        data: bracketData
      });

      // Create rounds
      const roundNames = this.getRoundNames(numRounds);
      for (let i = 0; i < numRounds; i++) {
        await tx.bracketRound.create({
          data: {
            bracketId: newBracket.id,
            roundNumber: i + 1,
            roundName: roundNames[i]
          }
        });
      }

      return newBracket;
    });

    logger.info(`Bracket created: ${bracket.id} for division ${divisionId}`);

    return this.getBracketById(bracket.id);
  }

  /**
   * Seed bracket from standings or ratings
   */
  async seedBracket(input: SeedBracketInput) {
    const { bracketId, adminId, seedingSource, manualSeeds } = input;

    const bracket = await prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        division: { include: { season: true } },
        rounds: { orderBy: { roundNumber: 'asc' } }
      }
    });

    if (!bracket) {
      throw new Error('Bracket not found');
    }

    if (bracket.isLocked) {
      throw new Error('Bracket is locked and cannot be reseeded');
    }

    if (bracket.status !== BracketStatus.DRAFT && bracket.status !== BracketStatus.SEEDED) {
      throw new Error('Cannot seed bracket in current status');
    }

    // Get seeded players
    let seededPlayers: { seed: number; playerId: string; name: string; standing?: number; rating?: number }[];

    if (manualSeeds && manualSeeds.length > 0) {
      // Manual seeding
      const userIds = manualSeeds.map(s => s.playerId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
      });

      seededPlayers = manualSeeds.map(s => {
        const user = users.find(u => u.id === s.playerId);
        return {
          seed: s.seed,
          playerId: s.playerId,
          name: user?.name || 'Unknown'
        };
      });
    } else if (seedingSource === SeedingSource.RATING || bracket.seedingSource === SeedingSource.RATING) {
      // Seed from ratings
      const ratings = await prisma.playerRating.findMany({
        where: {
          seasonId: bracket.seasonId,
          divisionId: bracket.divisionId
        },
        include: {
          user: { select: { id: true, name: true } }
        },
        orderBy: { currentRating: 'desc' },
        take: bracket.numPlayers
      });

      seededPlayers = ratings.map((r, index) => ({
        seed: index + 1,
        playerId: r.userId,
        name: r.user.name,
        rating: r.currentRating
      }));
    } else {
      // Seed from standings (default)
      const standings = await prisma.divisionStanding.findMany({
        where: {
          divisionId: bracket.divisionId,
          seasonId: bracket.seasonId,
          userId: { not: null }
        },
        include: {
          user: { select: { id: true, name: true } }
        },
        orderBy: { rank: 'asc' },
        take: bracket.numPlayers
      });

      seededPlayers = standings.map(s => ({
        seed: s.rank,
        playerId: s.userId!,
        name: s.user?.name || 'Unknown',
        standing: s.rank
      }));
    }

    if (seededPlayers.length < 2) {
      throw new Error('Not enough players to seed bracket');
    }

    // Pad to power of 2 if needed
    const targetSize = Math.pow(2, Math.ceil(Math.log2(seededPlayers.length)));

    // Create bracket matches
    await prisma.$transaction(async (tx) => {
      // Delete existing matches
      await tx.bracketMatch.deleteMany({
        where: { bracketId }
      });

      // Create matches for each round
      const firstRound = bracket.rounds[0];
      const matchesInFirstRound = targetSize / 2;

      // Generate first round matches with seeding
      const firstRoundMatches = this.generateFirstRoundMatches(seededPlayers, matchesInFirstRound);

      for (let i = 0; i < firstRoundMatches.length; i++) {
        const match = firstRoundMatches[i];
        await tx.bracketMatch.create({
          data: {
            bracketId,
            roundId: firstRound.id,
            matchNumber: i + 1,
            seed1: match.seed1,
            seed2: match.seed2,
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            status: match.player2Id ? BracketMatchStatus.PENDING : BracketMatchStatus.BYE
          }
        });
      }

      // Create subsequent round matches (empty)
      for (let roundIndex = 1; roundIndex < bracket.rounds.length; roundIndex++) {
        const round = bracket.rounds[roundIndex];
        const matchesInRound = matchesInFirstRound / Math.pow(2, roundIndex);

        for (let i = 0; i < matchesInRound; i++) {
          await tx.bracketMatch.create({
            data: {
              bracketId,
              roundId: round.id,
              matchNumber: i + 1,
              status: BracketMatchStatus.PENDING
            }
          });
        }
      }

      // Update bracket status
      await tx.bracket.update({
        where: { id: bracketId },
        data: {
          status: BracketStatus.SEEDED,
          seedingSource: seedingSource || bracket.seedingSource
        }
      });
    });

    logger.info(`Bracket ${bracketId} seeded with ${seededPlayers.length} players`);

    return {
      bracket: await this.getBracketById(bracketId),
      seededPlayers
    };
  }

  /**
   * Publish bracket (locks seeding, notifies participants)
   */
  async publishBracket(input: PublishBracketInput) {
    const { bracketId, adminId, notifyPlayers = true } = input;

    const bracket = await prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        matches: {
          where: { roundId: { not: undefined } },
          include: { player1: true, player2: true }
        }
      }
    });

    if (!bracket) {
      throw new Error('Bracket not found');
    }

    if (bracket.status === BracketStatus.PUBLISHED) {
      throw new Error('Bracket is already published');
    }

    if (bracket.status !== BracketStatus.SEEDED) {
      throw new Error('Bracket must be seeded before publishing');
    }

    // Check all first round matches have at least one player
    const firstRoundMatches = bracket.matches.filter(m => m.player1Id || m.player2Id);
    if (firstRoundMatches.length === 0) {
      throw new Error('Bracket has no seeded matches');
    }

    await prisma.bracket.update({
      where: { id: bracketId },
      data: {
        status: BracketStatus.PUBLISHED,
        isLocked: true,
        publishedAt: new Date(),
        publishedById: adminId
      }
    });

    // Notify participants
    if (notifyPlayers) {
      const playerIds = new Set<string>();
      bracket.matches.forEach(m => {
        if (m.player1Id) playerIds.add(m.player1Id);
        if (m.player2Id) playerIds.add(m.player2Id);
      });

      await this.notificationService.createNotification({
        type: 'BRACKET_PUBLISHED',
        title: 'Finals Bracket Published',
        message: `The finals bracket for ${bracket.bracketName} has been published. Check your matches!`,
        category: 'MATCH',
        userIds: Array.from(playerIds)
      });
    }

    logger.info(`Bracket ${bracketId} published by admin ${adminId}`);

    return this.getBracketById(bracketId);
  }

  /**
   * Update bracket match (schedule, location, etc.)
   */
  async updateBracketMatch(input: UpdateBracketMatchInput) {
    const { bracketMatchId, adminId, scheduledTime, courtLocation, player1Id, player2Id } = input;

    const bracketMatch = await prisma.bracketMatch.findUnique({
      where: { id: bracketMatchId },
      include: { bracket: true }
    });

    if (!bracketMatch) {
      throw new Error('Bracket match not found');
    }

    // Can only change players if bracket is not locked
    if ((player1Id || player2Id) && bracketMatch.bracket.isLocked) {
      throw new Error('Cannot change players in a locked bracket');
    }

    return prisma.bracketMatch.update({
      where: { id: bracketMatchId },
      data: {
        scheduledTime,
        courtLocation,
        ...(player1Id && { player1Id }),
        ...(player2Id && { player2Id })
      },
      include: {
        player1: { select: { id: true, name: true, username: true } },
        player2: { select: { id: true, name: true, username: true } }
      }
    });
  }

  /**
   * Record bracket match result and advance winner
   */
  async recordMatchResult(bracketMatchId: string, winnerId: string, matchId?: string) {
    const bracketMatch = await prisma.bracketMatch.findUnique({
      where: { id: bracketMatchId },
      include: {
        bracket: {
          include: {
            rounds: { orderBy: { roundNumber: 'asc' } },
            matches: true
          }
        },
        round: true
      }
    });

    if (!bracketMatch) {
      throw new Error('Bracket match not found');
    }

    // Verify winner is one of the participants
    if (winnerId !== bracketMatch.player1Id && winnerId !== bracketMatch.player2Id) {
      throw new Error('Winner must be one of the match participants');
    }

    await prisma.$transaction(async (tx) => {
      // Update this match
      await tx.bracketMatch.update({
        where: { id: bracketMatchId },
        data: {
          winnerId,
          matchId,
          status: BracketMatchStatus.COMPLETED
        }
      });

      // Find and update next round match
      const currentRoundIndex = bracketMatch.bracket.rounds.findIndex(
        r => r.id === bracketMatch.roundId
      );
      const nextRound = bracketMatch.bracket.rounds[currentRoundIndex + 1];

      if (nextRound) {
        // Determine which match in next round
        const nextMatchNumber = Math.ceil(bracketMatch.matchNumber / 2);
        const nextMatch = bracketMatch.bracket.matches.find(
          m => m.roundId === nextRound.id && m.matchNumber === nextMatchNumber
        );

        if (nextMatch) {
          // Determine if winner goes to player1 or player2 slot
          const isOddMatch = bracketMatch.matchNumber % 2 === 1;
          await tx.bracketMatch.update({
            where: { id: nextMatch.id },
            data: isOddMatch
              ? { player1Id: winnerId, seed1: bracketMatch.seed1 || bracketMatch.seed2 }
              : { player2Id: winnerId, seed2: bracketMatch.seed1 || bracketMatch.seed2 }
          });
        }
      } else {
        // This was the finals - bracket is complete
        await tx.bracket.update({
          where: { id: bracketMatch.bracketId },
          data: { status: BracketStatus.COMPLETED }
        });
      }

      // Update bracket status to IN_PROGRESS if first match completed
      if (bracketMatch.bracket.status === BracketStatus.PUBLISHED) {
        await tx.bracket.update({
          where: { id: bracketMatch.bracketId },
          data: { status: BracketStatus.IN_PROGRESS }
        });
      }
    });

    logger.info(`Bracket match ${bracketMatchId} completed, winner: ${winnerId}`);

    return this.getBracketById(bracketMatch.bracketId);
  }

  /**
   * Get bracket by ID with full details
   */
  async getBracketById(bracketId: string) {
    return prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        season: { select: { id: true, name: true } },
        division: { select: { id: true, name: true, gameType: true } },
        publishedBy: {
          select: { id: true, user: { select: { name: true } } }
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            matches: {
              orderBy: { matchNumber: 'asc' },
              include: {
                player1: {
                  select: { id: true, name: true, username: true, image: true }
                },
                player2: {
                  select: { id: true, name: true, username: true, image: true }
                },
                match: {
                  select: { id: true, status: true, team1Score: true, team2Score: true }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * Get all brackets for a season
   */
  async getBracketsBySeason(seasonId: string) {
    return prisma.bracket.findMany({
      where: { seasonId },
      include: {
        division: { select: { id: true, name: true } },
        _count: { select: { matches: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Generate round names based on number of rounds
   */
  private getRoundNames(numRounds: number): string[] {
    const names: string[] = [];
    for (let i = numRounds; i > 0; i--) {
      if (i === 1) names.push('Finals');
      else if (i === 2) names.push('Semi-Finals');
      else if (i === 3) names.push('Quarter-Finals');
      else names.push(`Round of ${Math.pow(2, i)}`);
    }
    return names.reverse();
  }

  /**
   * Generate first round matches with standard tournament seeding
   * Seed 1 vs lowest, Seed 2 vs second lowest, etc.
   */
  private generateFirstRoundMatches(
    seededPlayers: { seed: number; playerId: string }[],
    numMatches: number
  ): { seed1?: number; seed2?: number; player1Id?: string; player2Id?: string }[] {
    const matches: { seed1?: number; seed2?: number; player1Id?: string; player2Id?: string }[] = [];

    // Standard tournament bracket seeding order
    const bracketOrder = this.getBracketOrder(numMatches * 2);

    for (let i = 0; i < numMatches; i++) {
      const pos1 = bracketOrder[i * 2];
      const pos2 = bracketOrder[i * 2 + 1];

      const player1 = seededPlayers.find(p => p.seed === pos1);
      const player2 = seededPlayers.find(p => p.seed === pos2);

      matches.push({
        seed1: pos1,
        seed2: pos2,
        player1Id: player1?.playerId,
        player2Id: player2?.playerId
      });
    }

    return matches;
  }

  /**
   * Get standard tournament bracket order
   * e.g., for 8 players: [1,8,4,5,2,7,3,6]
   */
  private getBracketOrder(numPlayers: number): number[] {
    if (numPlayers === 2) return [1, 2];

    const halfSize = numPlayers / 2;
    const subOrder = this.getBracketOrder(halfSize);

    const result: number[] = [];
    for (const seed of subOrder) {
      result.push(seed);
      result.push(numPlayers + 1 - seed);
    }

    return result;
  }
}

// Export singleton
let bracketService: BracketService | null = null;

export function getBracketService(notificationService?: NotificationService): BracketService {
  if (!bracketService) {
    bracketService = new BracketService(notificationService);
  }
  return bracketService;
}
