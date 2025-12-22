/**
 * Admin Match Participant Service
 * Handles participant editing with full recalculation support
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  MatchType,
  ParticipantRole,
  InvitationStatus,
  MatchAdminActionType
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';
import {
  ParticipantInput,
  validateParticipantEdit,
  validateMatchStatus
} from './matchParticipantValidationService';

// Types
export interface EditParticipantsInput {
  matchId: string;
  adminId: string;
  participants: ParticipantInput[];
  reason: string;
  forceRecalculation?: boolean;
}

export interface ParticipantChange {
  userId: string;
  team: string | null;
  role: ParticipantRole;
  userName?: string;
}

export interface ParticipantChanges {
  added: ParticipantChange[];
  removed: ParticipantChange[];
  modified: { userId: string; oldTeam: string | null; newTeam: string | null }[];
}

export interface RecalculationResult {
  ratingsReversed: boolean;
  ratingsRecalculated: boolean;
  standingsRecalculated: boolean;
  best6Recalculated: boolean;
  affectedPlayerCount: number;
}

export interface EditParticipantsResult {
  success: boolean;
  match: any;
  changes: ParticipantChanges;
  recalculation?: RecalculationResult;
  notificationsSent: number;
}

export class AdminMatchParticipantService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Main entry point for editing participants
   */
  async editParticipants(input: EditParticipantsInput): Promise<EditParticipantsResult> {
    const { matchId, participants } = input;

    // Validate
    const validation = await validateParticipantEdit(matchId, participants);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if recalculation is needed
    const statusCheck = await validateMatchStatus(matchId);
    if (!statusCheck.canEdit) {
      throw new Error(statusCheck.blockedReason || 'Cannot edit this match');
    }

    if (statusCheck.requiresRecalc) {
      return this.editParticipantsWithRecalculation(input);
    } else {
      return this.editParticipantsSimple(input);
    }
  }

  /**
   * Edit participants for DRAFT/SCHEDULED matches (no recalculation needed)
   */
  private async editParticipantsSimple(
    input: EditParticipantsInput
  ): Promise<EditParticipantsResult> {
    const { matchId, adminId, participants, reason } = input;

    // Get current match with participants
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: { select: { id: true, name: true } } } },
        division: { select: { id: true, name: true } }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Calculate changes
    const changes = this.calculateParticipantChanges(match.participants, participants);

    // Get all affected user IDs for notifications
    const affectedUserIds = [
      ...changes.added.map(p => p.userId),
      ...changes.removed.map(p => p.userId),
      ...match.participants.map(p => p.userId)
    ];
    const uniqueAffectedUserIds = [...new Set(affectedUserIds)];

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      // Delete all existing participants
      await tx.matchParticipant.deleteMany({
        where: { matchId }
      });

      // Create new participants
      for (const p of participants) {
        await tx.matchParticipant.create({
          data: {
            matchId,
            userId: p.userId,
            team: p.team,
            role: p.role,
            invitationStatus: InvitationStatus.ACCEPTED,
            acceptedAt: new Date()
          }
        });
      }

      // Log admin action
      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.ADD_PARTICIPANT, // Use existing enum
          oldValue: {
            participants: match.participants.map(p => ({
              userId: p.userId,
              team: p.team,
              role: p.role,
              userName: p.user?.name
            }))
          },
          newValue: {
            participants: participants.map(p => ({
              userId: p.userId,
              team: p.team,
              role: p.role
            }))
          },
          reason,
          affectedUserIds: uniqueAffectedUserIds,
          triggeredRecalculation: false
        }
      });
    });

    // Send notifications
    const notificationsSent = await this.notifyParticipantChanges(
      matchId,
      changes,
      match
    );

    // Get updated match
    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true, image: true } } } },
        scores: { orderBy: { setNumber: 'asc' } },
        division: { select: { id: true, name: true } }
      }
    });

    logger.info(`Participants edited for match ${matchId} by admin ${adminId}`, {
      added: changes.added.length,
      removed: changes.removed.length,
      modified: changes.modified.length
    });

    return {
      success: true,
      match: updatedMatch,
      changes,
      notificationsSent
    };
  }

  /**
   * Edit participants for COMPLETED matches (with full recalculation)
   */
  private async editParticipantsWithRecalculation(
    input: EditParticipantsInput
  ): Promise<EditParticipantsResult> {
    const { matchId, adminId, participants, reason } = input;

    // Get current match with all related data
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: { select: { id: true, name: true } } } },
        scores: true,
        division: { select: { id: true, name: true, seasonId: true } }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== MatchStatus.COMPLETED) {
      throw new Error('This method is only for COMPLETED matches');
    }

    // Calculate changes
    const changes = this.calculateParticipantChanges(match.participants, participants);

    // Get all affected user IDs
    const affectedUserIds = [
      ...new Set([
        ...changes.added.map(p => p.userId),
        ...changes.removed.map(p => p.userId),
        ...match.participants.map(p => p.userId),
        ...participants.map(p => p.userId)
      ])
    ];

    let recalculationResult: RecalculationResult = {
      ratingsReversed: false,
      ratingsRecalculated: false,
      standingsRecalculated: false,
      best6Recalculated: false,
      affectedPlayerCount: affectedUserIds.length
    };

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Reverse existing ratings for all current participants
      await this.reverseMatchRatings(tx, matchId);
      recalculationResult.ratingsReversed = true;

      // Step 2: Delete existing MatchResult records
      await tx.matchResult.deleteMany({ where: { matchId } });

      // Step 3: Delete existing participants
      await tx.matchParticipant.deleteMany({ where: { matchId } });

      // Step 4: Create new participants
      for (const p of participants) {
        await tx.matchParticipant.create({
          data: {
            matchId,
            userId: p.userId,
            team: p.team,
            role: p.role,
            invitationStatus: InvitationStatus.ACCEPTED,
            acceptedAt: new Date()
          }
        });
      }

      // Step 5: Log admin action (before recalculation in case of failure)
      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.ADD_PARTICIPANT,
          oldValue: {
            participants: match.participants.map(p => ({
              userId: p.userId,
              team: p.team,
              role: p.role,
              userName: p.user?.name
            }))
          },
          newValue: {
            participants: participants.map(p => ({
              userId: p.userId,
              team: p.team,
              role: p.role
            }))
          },
          reason,
          affectedUserIds,
          triggeredRecalculation: true,
          recalculationDetails: {
            timestamp: new Date().toISOString(),
            willRecalculate: ['ratings', 'standings', 'best6']
          }
        }
      });
    });

    // Step 6: Recalculate ratings with new participants using DMR (outside main transaction)
    try {
      const { DMRRatingService } = await import('../rating/dmrRatingService');
      const sportType = match.sport === 'PICKLEBALL' ? 'PICKLEBALL' :
                        match.sport === 'TENNIS' ? 'TENNIS' : 'PADEL';
      const dmrService = new DMRRatingService(sportType as any);

      // Process match with DMR - the service handles score parsing internally
      const matchWithScores = await prisma.match.findUnique({
        where: { id: matchId },
        include: { participants: true, scores: true, pickleballScores: true }
      });

      if (matchWithScores && matchWithScores.seasonId) {
        // Use adminRatingService which now uses DMR
        const { recalculateMatchRatings } = await import('../rating/adminRatingService');
        await recalculateMatchRatings(matchId, adminId);
        recalculationResult.ratingsRecalculated = true;
      }
    } catch (error) {
      logger.error('Failed to recalculate DMR ratings', { matchId }, error as Error);
      // Don't throw - continue with other recalculations
    }

    // Step 7: Recalculate standings for affected division
    if (match.divisionId) {
      try {
        const { recalculateDivisionStandings } =
          await import('../rating/standingsCalculationService');
        await recalculateDivisionStandings(match.divisionId);
        recalculationResult.standingsRecalculated = true;
      } catch (error) {
        logger.error('Failed to recalculate standings', { divisionId: match.divisionId }, error as Error);
      }
    }

    // Step 8: Recalculate Best 6 for all affected players
    if (match.divisionId && match.seasonId) {
      try {
        const { Best6AlgorithmService } =
          await import('../match/best6/best6AlgorithmService');
        const best6Service = new Best6AlgorithmService();

        for (const userId of affectedUserIds) {
          await best6Service.applyBest6ToDatabase(
            userId,
            match.divisionId,
            match.seasonId
          );
        }
        recalculationResult.best6Recalculated = true;
      } catch (error) {
        logger.error('Failed to recalculate Best 6', { matchId }, error as Error);
      }
    }

    // Send notifications
    const notificationsSent = await this.notifyParticipantChanges(
      matchId,
      changes,
      match,
      true // includeRecalcNote
    );

    // Get updated match
    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true, image: true } } } },
        scores: { orderBy: { setNumber: 'asc' } },
        division: { select: { id: true, name: true } }
      }
    });

    logger.info(`Participants edited with recalculation for match ${matchId}`, {
      added: changes.added.length,
      removed: changes.removed.length,
      recalculationResult
    });

    return {
      success: true,
      match: updatedMatch,
      changes,
      recalculation: recalculationResult,
      notificationsSent
    };
  }

  /**
   * Reverse match ratings for all participants
   */
  private async reverseMatchRatings(
    tx: any, // Prisma transaction client
    matchId: string
  ): Promise<void> {
    // Get all rating history entries for this match
    const ratingHistories = await tx.ratingHistory.findMany({
      where: { matchId },
      include: { playerRating: true }
    });

    for (const history of ratingHistories) {
      // Revert to rating before this match
      await tx.playerRating.update({
        where: { id: history.playerRatingId },
        data: {
          currentRating: history.ratingBefore,
          ratingDeviation: history.rdBefore,
          matchesPlayed: { decrement: 1 }
        }
      });

      // Delete the history entry
      await tx.ratingHistory.delete({ where: { id: history.id } });
    }

    logger.debug(`Reversed ${ratingHistories.length} rating entries for match ${matchId}`);
  }

  /**
   * Calculate differences between current and new participants
   */
  private calculateParticipantChanges(
    currentParticipants: any[],
    newParticipants: ParticipantInput[]
  ): ParticipantChanges {
    const currentMap = new Map(
      currentParticipants.map(p => [p.userId, p])
    );
    const newMap = new Map(
      newParticipants.map(p => [p.userId, p])
    );

    const added: ParticipantChange[] = [];
    const removed: ParticipantChange[] = [];
    const modified: { userId: string; oldTeam: string | null; newTeam: string | null }[] = [];

    // Find added participants
    for (const [userId, newP] of newMap) {
      if (!currentMap.has(userId)) {
        added.push({
          userId,
          team: newP.team,
          role: newP.role
        });
      }
    }

    // Find removed participants
    for (const [userId, currentP] of currentMap) {
      if (!newMap.has(userId)) {
        removed.push({
          userId,
          team: currentP.team,
          role: currentP.role,
          userName: currentP.user?.name
        });
      }
    }

    // Find modified (team changed)
    for (const [userId, newP] of newMap) {
      const current = currentMap.get(userId);
      if (current && current.team !== newP.team) {
        modified.push({
          userId,
          oldTeam: current.team,
          newTeam: newP.team
        });
      }
    }

    return { added, removed, modified };
  }

  /**
   * Send notifications to affected participants
   */
  private async notifyParticipantChanges(
    matchId: string,
    changes: ParticipantChanges,
    match: any,
    includeRecalcNote: boolean = false
  ): Promise<number> {
    let count = 0;
    const matchInfo = `${match.division?.name || 'Match'} on ${new Date(match.matchDate).toLocaleDateString()}`;
    const recalcNote = includeRecalcNote ? ' Ratings and standings have been recalculated.' : '';

    // 1. Notify removed participants
    for (const removed of changes.removed) {
      try {
        await this.notificationService.createNotification({
          type: 'MATCH_PARTICIPANT_REMOVED',
          category: 'MATCH',
          title: 'Removed from Match',
          message: `You have been removed from the match: ${matchInfo}. Contact admin for details.${recalcNote}`,
          userIds: [removed.userId],
          matchId
        });
        count++;
      } catch (error) {
        logger.error('Failed to send removal notification', { userId: removed.userId }, error as Error);
      }
    }

    // 2. Notify added participants
    for (const added of changes.added) {
      try {
        await this.notificationService.createNotification({
          type: 'MATCH_PARTICIPANT_ADDED',
          category: 'MATCH',
          title: 'Added to Match',
          message: `You have been added to a match: ${matchInfo}. Check your schedule.${recalcNote}`,
          userIds: [added.userId],
          matchId
        });
        count++;
      } catch (error) {
        logger.error('Failed to send addition notification', { userId: added.userId }, error as Error);
      }
    }

    // 3. Notify remaining participants about changes (if any changes occurred)
    if (changes.added.length > 0 || changes.removed.length > 0) {
      const remainingUserIds = match.participants
        .filter((p: any) => !changes.removed.some(r => r.userId === p.userId))
        .map((p: any) => p.userId)
        .filter((id: string) => !changes.added.some(a => a.userId === id));

      if (remainingUserIds.length > 0) {
        try {
          await this.notificationService.createNotification({
            type: 'MATCH_PARTICIPANTS_UPDATED',
            category: 'MATCH',
            title: 'Match Participants Updated',
            message: `The participants for your match have been updated: ${matchInfo}.${recalcNote}`,
            userIds: remainingUserIds,
            matchId
          });
          count += remainingUserIds.length;
        } catch (error) {
          logger.error('Failed to send update notification', {}, error as Error);
        }
      }
    }

    return count;
  }

  /**
   * Get available players for a division (for player picker)
   */
  async getAvailablePlayersForMatch(
    divisionId: string,
    excludeMatchId?: string,
    search?: string
  ): Promise<any[]> {
    // Get all active members of the division
    const memberships = await prisma.seasonMembership.findMany({
      where: {
        divisionId,
        status: 'ACTIVE'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    let players = memberships.map(m => m.user);

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      players = players.filter(
        p =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.username?.toLowerCase().includes(searchLower)
      );
    }

    // If excluding a match, filter out players already in that match
    if (excludeMatchId) {
      const match = await prisma.match.findUnique({
        where: { id: excludeMatchId },
        include: { participants: { select: { userId: true } } }
      });

      if (match) {
        const participantIds = new Set(match.participants.map(p => p.userId));
        // Don't filter - we want to show current participants too for the dropdown
        // Just mark them differently in the UI
      }
    }

    return players;
  }
}

// Singleton export
let adminMatchParticipantService: AdminMatchParticipantService | null = null;

export function getAdminMatchParticipantService(
  notificationService?: NotificationService
): AdminMatchParticipantService {
  if (!adminMatchParticipantService) {
    adminMatchParticipantService = new AdminMatchParticipantService(notificationService);
  }
  return adminMatchParticipantService;
}
