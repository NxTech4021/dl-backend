/**
 * Admin Match Management Service
 * Handles admin-side match operations: dashboard, disputes, editing, penalties
 */

import { prisma } from '../../lib/prisma';
import {
  MatchStatus,
  MatchAdminActionType,
  DisputeStatus,
  DisputeResolutionAction,
  DisputePriority,
  PenaltyType,
  PenaltySeverity,
  PenaltyStatus,
  CancellationReason,
  MatchReportCategory
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService, notificationService as notificationServiceSingleton } from '../notificationService';
import { DMRRatingService } from '../rating/dmrRatingService';
import { StandingsV2Service } from '../rating/standingsV2Service';

// Types
export interface AdminMatchFilters {
  leagueId?: string;
  seasonId?: string;
  divisionId?: string;
  status?: MatchStatus[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  isDisputed?: boolean;
  hasLateCancellation?: boolean;
  isWalkover?: boolean;
  requiresAdminReview?: boolean;
  matchContext?: 'league' | 'friendly' | 'all';
  showHidden?: boolean;
  showReported?: boolean;
  page?: number;
  limit?: number;
}

export interface EditMatchResultInput {
  matchId: string;
  adminId: string;
  team1Score?: number;
  team2Score?: number;
  setScores?: { setNumber: number; team1Games: number; team2Games: number }[];
  outcome?: string;
  isWalkover?: boolean;
  walkoverReason?: string;
  reason: string;
}

export interface ResolveDisputeInput {
  disputeId: string;
  adminId: string;
  action: DisputeResolutionAction;
  finalScore?: {
    team1Score: number;
    team2Score: number;
    setScores?: { setNumber: number; team1Games: number; team2Games: number }[];
  };
  reason: string;
  notifyPlayers?: boolean;
}

export interface ApplyPenaltyInput {
  userId: string;
  adminId: string;
  penaltyType: PenaltyType;
  severity: PenaltySeverity;
  relatedMatchId?: string;
  relatedDisputeId?: string;
  pointsDeducted?: number;
  suspensionDays?: number;
  reason: string;
  evidenceUrl?: string;
}

export interface ReviewCancellationInput {
  matchId: string;
  adminId: string;
  approved: boolean;
  applyPenalty?: boolean;
  penaltySeverity?: PenaltySeverity;
  reason?: string;
}

export class AdminMatchService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || notificationServiceSingleton;
  }

  /**
   * Get matches for admin dashboard with comprehensive filters (AS6)
   */
  async getAdminMatches(filters: AdminMatchFilters) {
    const {
      leagueId,
      seasonId,
      divisionId,
      status,
      startDate,
      endDate,
      search,
      isDisputed,
      hasLateCancellation,
      isWalkover,
      requiresAdminReview,
      matchContext,
      showHidden,
      showReported,
      page = 1,
      limit = 20
    } = filters;

    const where: any = {};

    if (leagueId) where.leagueId = leagueId;
    if (seasonId) where.seasonId = seasonId;
    if (divisionId) where.divisionId = divisionId;
    if (status && status.length > 0) where.status = { in: status };
    if (isDisputed !== undefined) where.isDisputed = isDisputed;
    if (hasLateCancellation) where.isLateCancellation = true;
    if (isWalkover !== undefined) where.isWalkover = isWalkover;
    if (requiresAdminReview !== undefined) where.requiresAdminReview = requiresAdminReview;

    // Match context filter: league vs friendly matches
    if (matchContext === 'league') {
      // League matches have at least one of: divisionId, leagueId, or seasonId
      where.OR = [
        { divisionId: { not: null } },
        { leagueId: { not: null } },
        { seasonId: { not: null } }
      ];
    } else if (matchContext === 'friendly') {
      // Friendly matches have none of these IDs
      where.AND = [
        { divisionId: null },
        { leagueId: null },
        { seasonId: null }
      ];
    }
    // 'all' or undefined = no filter applied

    // Hidden/Reported filters
    if (showHidden === true) {
      where.isHiddenFromPublic = true;
    } else if (showHidden === false) {
      where.isHiddenFromPublic = false;
    }

    if (showReported === true) {
      where.isReportedForAbuse = true;
    }

    if (startDate || endDate) {
      where.matchDate = {};
      if (startDate) where.matchDate.gte = startDate;
      if (endDate) where.matchDate.lte = endDate;
    }

    if (search) {
      // Preserve existing OR conditions if matchContext added them
      const searchCondition = [
        { participants: { some: { user: { name: { contains: search, mode: 'insensitive' } } } } },
        { participants: { some: { user: { username: { contains: search, mode: 'insensitive' } } } } }
      ];

      if (where.OR && matchContext === 'league') {
        // Wrap in AND to preserve both conditions
        where.AND = where.AND || [];
        where.AND.push({ OR: searchCondition });
      } else {
        where.OR = searchCondition;
      }
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          division: {
            include: { season: true, league: true }
          },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, username: true, image: true }
              }
            }
          },
          scores: { orderBy: { setNumber: 'asc' } },
          disputes: {
            select: {
              id: true,
              status: true,
              disputeCategory: true,
              disputeComment: true,
              disputerScore: true,
              evidenceUrl: true,
              priority: true,
              submittedAt: true,
              raisedByUser: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  image: true
                }
              }
            }
          },
          walkover: {
            include: {
              defaultingPlayer: {
                select: { id: true, name: true, username: true, image: true }
              },
              winningPlayer: {
                select: { id: true, name: true, username: true, image: true }
              },
              reporter: {
                select: { id: true, name: true, username: true }
              }
            }
          },
          createdBy: {
            select: { id: true, name: true, username: true }
          }
        },
        orderBy: [
          { isReportedForAbuse: 'desc' },
          { isDisputed: 'desc' },
          { isLateCancellation: 'desc' },
          { matchDate: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    // Get stats
    const stats = await this.getMatchStats(filters);

    return {
      matches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats
    };
  }

  /**
   * Get match statistics for dashboard
   */
  async getMatchStats(filters: Partial<AdminMatchFilters>) {
    const where: any = {};
    if (filters.leagueId) where.leagueId = filters.leagueId;
    if (filters.seasonId) where.seasonId = filters.seasonId;
    if (filters.divisionId) where.divisionId = filters.divisionId;

    const [total, byStatus, disputed, lateCancellations, walkovers, pendingConfirmation] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.match.count({ where: { ...where, isDisputed: true } }),
      prisma.match.count({ where: { ...where, isLateCancellation: true } }),
      prisma.match.count({ where: { ...where, isWalkover: true } }),
      // Pending confirmation: result submitted but not yet confirmed
      prisma.match.count({
        where: {
          ...where,
          resultSubmittedAt: { not: null },
          resultConfirmedAt: null,
          status: MatchStatus.SCHEDULED
        }
      })
    ]);

    // Build status counts with all statuses defaulting to 0
    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      SCHEDULED: 0,
      ONGOING: 0,
      COMPLETED: 0,
      UNFINISHED: 0,
      CANCELLED: 0,
      VOID: 0,
      WALKOVER_PENDING: 0,
    };
    byStatus.forEach(s => {
      statusCounts[s.status] = s._count;
    });

    // Count matches requiring admin review (disputed or late cancellation)
    const requiresAdminReview = disputed + lateCancellations;

    return {
      totalMatches: total,
      byStatus: statusCounts,
      disputed,
      pendingConfirmation,
      lateCancellations,
      walkovers,
      requiresAdminReview
    };
  }

  /**
   * Get a single match by ID with full details
   */
  async getMatchById(matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        division: {
          include: { season: true, league: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } },
        disputes: {
          select: {
            id: true,
            status: true,
            disputeCategory: true,
            disputeComment: true,
            disputerScore: true,
            evidenceUrl: true,
            priority: true,
            submittedAt: true,
            raisedByUser: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true
              }
            }
          }
        },
        walkover: {
          include: {
            defaultingPlayer: {
              select: { id: true, name: true, username: true, image: true }
            },
            winningPlayer: {
              select: { id: true, name: true, username: true, image: true }
            },
            reporter: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        createdBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });

    return match;
  }

  /**
   * Get all disputes for admin review (AS5)
   */
  async getDisputes(filters: {
    status?: DisputeStatus[];
    priority?: DisputePriority;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, priority, category, search, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status && status.length > 0) where.status = { in: status };
    if (priority) where.priority = priority;
    if (category) where.disputeCategory = category;
    if (search) {
      where.OR = [
        { raisedByUser: { name: { contains: search, mode: 'insensitive' } } },
        { raisedByUser: { username: { contains: search, mode: 'insensitive' } } },
        { disputeComment: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [disputes, total] = await Promise.all([
      prisma.matchDispute.findMany({
        where,
        include: {
          match: {
            include: {
              division: true,
              participants: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, image: true }
                  }
                }
              },
              scores: true
            }
          },
          raisedByUser: {
            select: { id: true, name: true, username: true, image: true }
          },
          reviewedByAdmin: {
            select: { id: true, user: { select: { name: true } } }
          },
          resolvedByAdmin: {
            select: { id: true, user: { select: { name: true } } }
          },
          adminNotes: {
            orderBy: { createdAt: 'desc' }
          },
          comments: {
            include: {
              sender: {
                select: { id: true, name: true, username: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: [
          { priority: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.matchDispute.count({ where })
    ]);

    return {
      disputes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get dispute by ID with full details
   */
  async getDisputeById(disputeId: string) {
    return prisma.matchDispute.findUnique({
      where: { id: disputeId },
      include: {
        match: {
          include: {
            division: { include: { season: true } },
            participants: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, image: true }
                }
              }
            },
            scores: { orderBy: { setNumber: 'asc' } },
            resultSubmittedBy: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        raisedByUser: {
          select: { id: true, name: true, username: true, image: true }
        },
        reviewedByAdmin: {
          select: { id: true, user: { select: { name: true } } }
        },
        resolvedByAdmin: {
          select: { id: true, user: { select: { name: true } } }
        },
        adminNotes: {
          include: {
            admin: {
              select: { id: true, user: { select: { name: true } } }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        comments: {
          include: {
            sender: {
              select: { id: true, name: true, username: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        penalties: true
      }
    });
  }

  /**
   * Start reviewing a dispute - changes status from OPEN to UNDER_REVIEW
   */
  async startDisputeReview(disputeId: string, adminId: string) {
    const dispute = await prisma.matchDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.OPEN) {
      // Already under review or resolved, just return current dispute
      return prisma.matchDispute.findUnique({
        where: { id: disputeId },
        include: {
          match: {
            include: {
              participants: { include: { user: true } },
              scores: true,
              division: { include: { season: true } }
            }
          },
          raisedByUser: true,
          reviewedByAdmin: { include: { user: true } },
          resolvedByAdmin: { include: { user: true } }
        }
      });
    }

    const updatedDispute = await prisma.matchDispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.UNDER_REVIEW,
        reviewedByAdminId: adminId
      },
      include: {
        match: {
          include: {
            participants: { include: { user: true } },
            scores: true,
            division: { include: { season: true } }
          }
        },
        raisedByUser: true,
        reviewedByAdmin: { include: { user: true } },
        resolvedByAdmin: { include: { user: true } }
      }
    });

    // Notify match participants that their dispute is being reviewed
    try {
      const participantIds = updatedDispute.match?.participants?.map(p => p.userId).filter((id): id is string => id !== null) || [];
      if (participantIds.length > 0) {
        await this.notificationService.createNotification({
          userIds: participantIds,
          type: 'ADMIN_MESSAGE',
          category: 'MATCH',
          title: 'Dispute Under Review',
          message: 'Your match dispute is now being reviewed by an admin. You will be notified when a decision is made.',
          matchId: updatedDispute.matchId,
        });
      }
    } catch (notifError) {
      logger.warn('Failed to notify parties about dispute review start', { disputeId, error: notifError });
    }

    return updatedDispute;
  }

  /**
   * Resolve a dispute (AS5)
   */
  async resolveDispute(input: ResolveDisputeInput) {
    const { disputeId, adminId, action, finalScore, reason, notifyPlayers = true } = input;

    const dispute = await prisma.matchDispute.findUnique({
      where: { id: disputeId },
      include: {
        match: {
          include: { participants: true, scores: true }
        }
      }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) {
      throw new Error('Dispute has already been resolved or rejected');
    }

    // Determine final dispute status based on action
    const finalStatus = action === DisputeResolutionAction.REJECT
      ? DisputeStatus.REJECTED
      : action === DisputeResolutionAction.REQUEST_MORE_INFO
        ? DisputeStatus.UNDER_REVIEW
        : DisputeStatus.RESOLVED;

    await prisma.$transaction(async (tx) => {
      // Update dispute
      const disputeUpdateData: any = {
        status: finalStatus,
        resolvedByAdminId: adminId,
        adminResolution: reason,
        resolutionAction: action,
        // Only set resolvedAt for actual resolution actions, not REQUEST_MORE_INFO
        ...(action !== DisputeResolutionAction.REQUEST_MORE_INFO && { resolvedAt: new Date() }),
      };
      if (finalScore) disputeUpdateData.finalScore = JSON.stringify(finalScore);

      await tx.matchDispute.update({
        where: { id: disputeId },
        data: disputeUpdateData
      });

      // Handle different resolution actions
      if (action === DisputeResolutionAction.UPHOLD_ORIGINAL) {
        // Keep original score, mark match as completed
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            isDisputed: false,
            status: MatchStatus.COMPLETED,
            resultConfirmedAt: new Date(),
          }
        });
      } else if (action === DisputeResolutionAction.UPHOLD_DISPUTER || action === DisputeResolutionAction.CUSTOM_SCORE) {
        // Update match with new score and mark as completed
        if (finalScore) {
          // Delete old scores and create new ones — sport-aware table selection
          if (finalScore.setScores) {
            if (dispute.match.sport === 'PICKLEBALL') {
              await tx.pickleballGameScore.deleteMany({ where: { matchId: dispute.matchId } });
              for (const score of finalScore.setScores) {
                await tx.pickleballGameScore.create({
                  data: {
                    matchId: dispute.matchId,
                    gameNumber: score.setNumber,
                    player1Points: score.team1Games,
                    player2Points: score.team2Games,
                  }
                });
              }
            } else {
              await tx.matchScore.deleteMany({ where: { matchId: dispute.matchId } });
              for (const score of finalScore.setScores) {
                await tx.matchScore.create({
                  data: {
                    matchId: dispute.matchId,
                    setNumber: score.setNumber,
                    player1Games: score.team1Games,
                    player2Games: score.team2Games
                  }
                });
              }
            }
          }

          // Determine winner
          const winner = finalScore.team1Score > finalScore.team2Score ? 'team1' : 'team2';

          await tx.match.update({
            where: { id: dispute.matchId },
            data: {
              team1Score: finalScore.team1Score,
              team2Score: finalScore.team2Score,
              outcome: winner,
              isDisputed: false,
              requiresAdminReview: false,
              status: MatchStatus.COMPLETED,
              resultConfirmedAt: new Date(),
            }
          });
        }
      } else if (action === DisputeResolutionAction.VOID_MATCH) {
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            status: MatchStatus.VOID,
            isDisputed: false,
            isWalkover: false,
            adminNotes: reason
          }
        });
        // Audit-A: delete the paired MatchWalkover row if present. The
        // walkoverUpdate block below would otherwise mark adminVerified=true
        // on an orphan we no longer want. The updateMany there will then
        // run on zero rows (safe no-op).
        if (dispute.match.isWalkover) {
          await tx.matchWalkover.deleteMany({ where: { matchId: dispute.matchId } });
        }
      } else if (action === DisputeResolutionAction.AWARD_WALKOVER) {
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            isWalkover: true,
            isDisputed: false,
            team1Score: finalScore?.team1Score || 2,
            team2Score: finalScore?.team2Score || 0,
            outcome: (finalScore?.team1Score || 2) > (finalScore?.team2Score || 0) ? 'team1' : 'team2',
            status: MatchStatus.COMPLETED,
            resultConfirmedAt: new Date(),
          }
        });
      } else if (action === DisputeResolutionAction.REJECT) {
        // Reject dispute — original score accepted, match completed
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            isDisputed: false,
            status: MatchStatus.COMPLETED,
            resultConfirmedAt: new Date(),
          }
        });
      }

      // Clean up walkover record if this was a walkover dispute
      if (dispute.match.isWalkover) {
        const walkoverUpdate: any = {
          adminVerified: true,
          adminVerifiedBy: adminId,
          adminVerifiedAt: new Date(),
        };

        // If admin reversed the walkover (disputer wins), swap winner/defaulter
        if (action === DisputeResolutionAction.UPHOLD_DISPUTER) {
          const walkover = await tx.matchWalkover.findUnique({
            where: { matchId: dispute.matchId },
          });
          if (walkover) {
            walkoverUpdate.winningPlayerId = walkover.defaultingPlayerId;
            walkoverUpdate.defaultingPlayerId = walkover.winningPlayerId;
          }
        }

        // If admin provided actual scores (CUSTOM_SCORE), match is no longer a walkover
        if (action === DisputeResolutionAction.CUSTOM_SCORE) {
          await tx.match.update({
            where: { id: dispute.matchId },
            data: { isWalkover: false },
          });
          // Audit-A: delete the MatchWalkover row — the walkover didn't
          // happen. The subsequent updateMany will run on zero rows (no-op).
          await tx.matchWalkover.deleteMany({ where: { matchId: dispute.matchId } });
        }

        await tx.matchWalkover.updateMany({
          where: { matchId: dispute.matchId },
          data: walkoverUpdate,
        });
      }

      // Log admin action
      await tx.matchAdminAction.create({
        data: {
          matchId: dispute.matchId,
          adminId,
          actionType: MatchAdminActionType.OVERRIDE_DISPUTE,
          oldValue: { disputeStatus: dispute.status },
          newValue: { resolution: action, finalScore },
          reason,
          affectedUserIds: dispute.match.participants.map(p => p.userId),
          triggeredRecalculation: action !== DisputeResolutionAction.REQUEST_MORE_INFO
        }
      });
    });

    // Send notifications
    if (notifyPlayers) {
      await this.sendDisputeResolvedNotification(disputeId, action, reason);
    }

    logger.info(`Dispute ${disputeId} resolved by admin ${adminId} with action ${action}`);

    // Recalculate standings, ratings, and Best 6 after dispute resolution
    // Uses V2 standings (Best 6 based) + MatchResult refresh for consistency
    // with normal match completion flow (processMatchCompletion)
    const actionsRequiringRecalc: DisputeResolutionAction[] = [
      DisputeResolutionAction.UPHOLD_ORIGINAL,
      DisputeResolutionAction.UPHOLD_DISPUTER,
      DisputeResolutionAction.CUSTOM_SCORE,
      DisputeResolutionAction.VOID_MATCH,
      DisputeResolutionAction.AWARD_WALKOVER,
      DisputeResolutionAction.REJECT,
    ];

    if (actionsRequiringRecalc.includes(action)) {
      const resolvedMatch = await prisma.match.findUnique({
        where: { id: dispute.matchId },
        select: {
          id: true,
          status: true,
          sport: true,
          divisionId: true,
          seasonId: true,
          participants: { select: { userId: true } },
        },
      });

      if (resolvedMatch?.divisionId && resolvedMatch?.seasonId) {
        try {
          // Step 1: Refresh MatchResult records (V2 standings depends on these)
          const { MatchResultCreationService } = await import(
            '../match/calculation/matchResultCreationService'
          );
          const matchResultCreator = new MatchResultCreationService();
          await matchResultCreator.deleteMatchResults(resolvedMatch.id);
          if (resolvedMatch.status === MatchStatus.COMPLETED) {
            try {
              await matchResultCreator.createMatchResults(resolvedMatch.id);
            } catch (mrError) {
              logger.error('Failed to create MatchResult records after dispute resolution', {
                disputeId, matchId: resolvedMatch.id,
              }, mrError as Error);
              // Flag for admin review but don't block
              await prisma.match.update({
                where: { id: resolvedMatch.id },
                data: { requiresAdminReview: true },
              });
            }
          }
          // VOID matches: delete only, no MatchResult recreation

          // Step 2: Recalculate ratings (reverses old + applies new — safe for re-runs)
          if (resolvedMatch.status === MatchStatus.COMPLETED) {
            const { recalculateMatchRatings } = await import('../rating/adminRatingService');
            await recalculateMatchRatings(resolvedMatch.id, adminId);
          } else if (resolvedMatch.status === MatchStatus.VOID) {
            // F-4: Reverse ratings on dispute-voided matches. Mirrors the direct voidMatch
            // path (line ~1091) which calls reverseMatchRatings. Without this, a VOID_MATCH
            // dispute resolution on a previously-completed match leaves phantom rating deltas.
            // reverseMatchRatings is safe on empty history (warns + returns early).
            try {
              const dmrService = new DMRRatingService(resolvedMatch.sport as any);
              await dmrService.reverseMatchRatings(resolvedMatch.id);
              logger.info(`Reversed ratings for dispute-voided match ${resolvedMatch.id}`);
            } catch (ratingError) {
              logger.error(`Failed to reverse ratings for dispute-voided match ${resolvedMatch.id}:`, {}, ratingError as Error);
              // Audit-B2: flag for manual retry (same pattern as voidMatch).
              await prisma.match.update({
                where: { id: resolvedMatch.id },
                data: { requiresManualRatingReversal: true },
              }).catch(flagErr => {
                logger.error(
                  `Failed to set requiresManualRatingReversal flag on dispute-voided match ${resolvedMatch.id}`,
                  {}, flagErr as Error
                );
              });
            }
          }

          // Step 3: Recalculate Best 6 (must run before V2 standings)
          const { Best6AlgorithmService } = await import('../match/best6/best6AlgorithmService');
          const best6Service = new Best6AlgorithmService();
          for (const participant of resolvedMatch.participants) {
            if (!participant.userId) continue;
            await best6Service.applyBest6ToDatabase(
              participant.userId,
              resolvedMatch.divisionId,
              resolvedMatch.seasonId,
            );
          }

          // Step 4: Recalculate V2 standings (reads MatchResult + Best 6)
          const { StandingsV2Service } = await import('../rating/standingsV2Service');
          const standingsV2 = new StandingsV2Service();
          await standingsV2.recalculateDivisionStandings(
            resolvedMatch.divisionId,
            resolvedMatch.seasonId,
          );

          logger.info('Post-dispute recalculation complete (V2 standings + ratings + Best 6)', {
            disputeId,
            matchId: resolvedMatch.id,
            divisionId: resolvedMatch.divisionId,
          });
        } catch (error) {
          logger.error('Error in post-dispute recalculation', {
            disputeId,
            matchId: resolvedMatch.id,
          }, error as Error);
          // Don't throw — dispute resolution succeeded, recalculation is secondary
        }
      }
    }

    return this.getDisputeById(disputeId);
  }

  /**
   * Edit match result (AS4)
   */
  async editMatchResult(input: EditMatchResultInput) {
    const {
      matchId,
      adminId,
      team1Score,
      team2Score,
      setScores,
      outcome,
      isWalkover,
      walkoverReason,
      reason
    } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true, scores: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // F-8: block edits on terminal/pre-schedule statuses — a CANCELLED, VOID,
    // or DRAFT match has no result to edit. Admin must reinstate the match
    // (via another endpoint) before submitting a result.
    if (
      match.status === MatchStatus.CANCELLED ||
      match.status === MatchStatus.VOID ||
      match.status === MatchStatus.DRAFT
    ) {
      throw new Error(`Cannot edit result of match in status ${match.status}`);
    }

    // Capture original status before TypeScript narrows it inside the transaction callback
    const originalStatus = match.status;

    // Store old values for audit
    const oldValue = {
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      outcome: match.outcome,
      isWalkover: match.isWalkover
    };

    await prisma.$transaction(async (tx) => {
      // Update scores if provided — sport-aware table selection
      if (setScores) {
        if (match.sport === 'PICKLEBALL') {
          // Pickleball uses PickleballGameScore table
          await tx.pickleballGameScore.deleteMany({ where: { matchId } });
          for (const score of setScores) {
            await tx.pickleballGameScore.create({
              data: {
                matchId,
                gameNumber: score.setNumber,
                player1Points: score.team1Games,
                player2Points: score.team2Games,
              }
            });
          }
        } else {
          // Tennis/Padel uses MatchScore table
          await tx.matchScore.deleteMany({ where: { matchId } });
          for (const score of setScores) {
            await tx.matchScore.create({
              data: {
                matchId,
                setNumber: score.setNumber,
                player1Games: score.team1Games,
                player2Games: score.team2Games
              }
            });
          }
        }
      }

      // Update match
      const updateData: any = {};
      if (team1Score !== undefined) updateData.team1Score = team1Score;
      if (team2Score !== undefined) updateData.team2Score = team2Score;
      if (outcome !== undefined) updateData.outcome = outcome;
      if (isWalkover !== undefined) {
        updateData.isWalkover = isWalkover;
        if (isWalkover && walkoverReason) {
          updateData.walkoverReason = walkoverReason;
        }
      }

      // F-60: real set scores mean the match was actually played. Clear
      // isWalkover (unless admin explicitly asserted it) so downstream
      // matchResultCreationService uses the real outcome instead of
      // synthesizing a 2-0 from the walkover branch.
      if (setScores && setScores.length > 0 && isWalkover !== true) {
        updateData.isWalkover = false;
        updateData.walkoverReason = null;
      }

      // #043 BUG 3: Auto-complete match when admin provides scores with outcome
      // Admin editing scores is an explicit decision — no reason to leave match ONGOING
      if (outcome && match.status !== MatchStatus.COMPLETED) {
        updateData.status = MatchStatus.COMPLETED;
        updateData.resultConfirmedAt = new Date();
      }

      await tx.match.update({
        where: { id: matchId },
        data: updateData
      });

      // Audit-A: if the resulting Match explicitly has isWalkover=false (admin
      // cleared it, or F-60 cleared it for real setScores), remove any stale
      // MatchWalkover row so admin UI stops surfacing stale winner/defaulter.
      // deleteMany is a no-op when no row exists (non-walkover matches).
      if (updateData.isWalkover === false) {
        await tx.matchWalkover.deleteMany({ where: { matchId } });
      }

      // Log admin action
      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.EDIT_RESULT,
          oldValue,
          newValue: { team1Score, team2Score, outcome, isWalkover, setScores },
          reason,
          affectedUserIds: match.participants.map(p => p.userId),
          triggeredRecalculation: true
        }
      });
    });

    // Trigger rating and standings recalculation for completed matches
    // Uses V2 standings (Best 6 based) + MatchResult refresh for consistency
    // #043 BUG 3: Also triggers if admin just completed the match (status was changed in transaction)
    const isNowCompleted = originalStatus === MatchStatus.COMPLETED || (outcome && originalStatus !== MatchStatus.COMPLETED);
    if (isNowCompleted && match.divisionId && match.seasonId) {
      try {
        // Step 1: Refresh MatchResult records (V2 standings depends on these)
        const { MatchResultCreationService } = await import(
          '../match/calculation/matchResultCreationService'
        );
        const matchResultCreator = new MatchResultCreationService();
        await matchResultCreator.deleteMatchResults(matchId);
        await matchResultCreator.createMatchResults(matchId);

        // Step 2: Recalculate ratings (reverses old + applies new)
        const { recalculateMatchRatings } = await import('../rating/adminRatingService');
        await recalculateMatchRatings(matchId, adminId);

        // Step 3: Recalculate Best 6 (must run before V2 standings)
        const { Best6AlgorithmService } = await import('../match/best6/best6AlgorithmService');
        const best6Service = new Best6AlgorithmService();
        for (const participant of match.participants) {
          if (!participant.userId) continue;
          await best6Service.applyBest6ToDatabase(
            participant.userId,
            match.divisionId,
            match.seasonId
          );
        }

        // Step 4: Recalculate V2 standings (reads MatchResult + Best 6)
        const { StandingsV2Service } = await import('../rating/standingsV2Service');
        const standingsV2 = new StandingsV2Service();
        await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);

        logger.info(`Post-edit recalculation complete (V2 standings + ratings + Best 6) for match ${matchId}`);
      } catch (error) {
        logger.error('Error during post-edit recalculation', { matchId }, error as Error);
        // Don't throw - the edit was successful, recalculation is secondary
      }
    }

    // Notify participants
    await this.sendResultEditedNotification(matchId);

    logger.info(`Match ${matchId} result edited by admin ${adminId}`);

    return prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: { include: { user: true } },
        scores: { orderBy: { setNumber: 'asc' } }
      }
    });
  }

  /**
   * Void a match (AS4)
   * Reverses ratings and recalculates standings
   */
  async voidMatch(matchId: string, adminId: string, reason: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // F-11: block void on terminal / pre-schedule states — these have nothing to void.
    if (
      match.status === MatchStatus.VOID ||
      match.status === MatchStatus.CANCELLED ||
      match.status === MatchStatus.DRAFT
    ) {
      throw new Error(`Cannot void match in status ${match.status}`);
    }

    // Only reverse ratings if match was previously completed
    const wasCompleted = match.status === MatchStatus.COMPLETED;
    // Audit-A: capture before update so post-write MatchWalkover cleanup is conditional.
    const wasWalkover = match.isWalkover;

    await prisma.$transaction(async (tx) => {
      // Audit-B3: optimistic lock — only update if status is still what we
      // observed pre-tx. Prevents two concurrent voidMatch calls from both
      // crossing the F-11 guard, both flipping VOID, and both reaching
      // reverseMatchRatings (double-decrement of matchesPlayed). The losing
      // side gets count=0 and an explicit error.
      const updated = await tx.match.updateMany({
        where: { id: matchId, status: match.status },
        data: {
          status: MatchStatus.VOID,
          // Audit-A: VOID is semantically inconsistent with isWalkover=true.
          // Mirror the F-67 fix applied to resolveDispute(VOID_MATCH).
          isWalkover: false,
          adminNotes: reason
        }
      });

      if (updated.count === 0) {
        throw new Error(
          `Match ${matchId} was modified concurrently. Please refresh and retry.`
        );
      }

      // Audit-A: delete the paired MatchWalkover row so admin UI (getAdminMatches,
      // getMatchById) stops surfacing stale winningPlayerId/defaultingPlayerId
      // for a now-VOID match. No-op when wasWalkover=false.
      if (wasWalkover) {
        await tx.matchWalkover.deleteMany({ where: { matchId } });
      }

      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.VOID_MATCH,
          oldValue: { status: match.status },
          newValue: { status: MatchStatus.VOID },
          reason,
          affectedUserIds: match.participants.map(p => p.userId),
          triggeredRecalculation: true
        }
      });
    });

    // Audit-B2: reverseMatchRatings and recalculateDivisionStandings each
    // open their own $transaction on a separate Prisma pool connection, so
    // they cannot be wrapped in the outer $transaction above (inner writes
    // survive outer rollback + deadlock risk — full analysis in the audit
    // doc). Instead, on failure we flip `requiresManualRatingReversal` on
    // the already-committed Match row so the split-brain state is
    // surfaceable for admin follow-up. Idempotent retry path is safe now
    // that audit-B1 landed (reverseMatchRatings no longer double-decrements).
    // Admin retry endpoint is still TODO(111-audit-B2-retry); today the
    // flag is visible via direct DB read / Prisma Studio.
    if (wasCompleted) {
      try {
        const dmrService = new DMRRatingService(match.sport as any);
        await dmrService.reverseMatchRatings(matchId);
        logger.info(`Reversed ratings for voided match ${matchId}`);
      } catch (error) {
        logger.error(`Failed to reverse ratings for match ${matchId}:`, {}, error as Error);
        await prisma.match.update({
          where: { id: matchId },
          data: { requiresManualRatingReversal: true },
        }).catch(flagErr => {
          logger.error(
            `Failed to set requiresManualRatingReversal flag on match ${matchId}`,
            {}, flagErr as Error
          );
        });
      }

      // Recalculate standings
      if (match.divisionId && match.seasonId) {
        try {
          const standingsV2 = new StandingsV2Service();
          await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
          logger.info(`Recalculated standings after voiding match ${matchId}`);
        } catch (error) {
          logger.error(`Failed to recalculate standings for match ${matchId}:`, {}, error as Error);
          await prisma.match.update({
            where: { id: matchId },
            data: { requiresManualRatingReversal: true },
          }).catch(flagErr => {
            logger.error(
              `Failed to set requiresManualRatingReversal flag on match ${matchId}`,
              {}, flagErr as Error
            );
          });
        }
      }
    }

    logger.info(`Match ${matchId} voided by admin ${adminId}`);

    return prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: { include: { user: true } } }
    });
  }

  /**
   * Retry the manual rating reversal for a match that was left in the
   * split-brain state documented in audit-B2 (voidMatch or resolveDispute
   * flipped status to VOID, but reverseMatchRatings or the following
   * standings recalc threw after the outer transaction had already
   * committed, so `requiresManualRatingReversal` is true).
   *
   * Safe to call multiple times thanks to audit-B1 (reverseMatchRatings is
   * idempotent via the RatingHistory.isReversed column). The flag is only
   * cleared if BOTH reversal and standings recalc complete without
   * throwing; partial success keeps the flag true so the admin can retry
   * again.
   */
  async retryManualRatingReversal(matchId: string, adminId: string, reason?: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        sport: true,
        divisionId: true,
        seasonId: true,
        requiresManualRatingReversal: true,
        participants: { select: { userId: true } },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.requiresManualRatingReversal) {
      throw new Error('Match is not flagged for manual rating reversal');
    }

    if (match.status !== MatchStatus.VOID) {
      throw new Error(
        `Cannot retry rating reversal: match status is ${match.status}, expected VOID`
      );
    }

    // Both calls are idempotent. If either throws, we leave the flag set
    // so the admin can retry again after investigating.
    const dmrService = new DMRRatingService(match.sport as any);
    await dmrService.reverseMatchRatings(matchId);
    logger.info(`Retry reverseMatchRatings succeeded for match ${matchId}`);

    if (match.divisionId && match.seasonId) {
      const standingsV2 = new StandingsV2Service();
      await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);
      logger.info(`Retry recalculateDivisionStandings succeeded for match ${matchId}`);
    }

    // Both steps succeeded — clear the flag and audit the action atomically.
    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: { requiresManualRatingReversal: false },
      });

      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.RETRY_RATING_REVERSAL,
          oldValue: { requiresManualRatingReversal: true },
          newValue: { requiresManualRatingReversal: false },
          reason: reason ?? 'Manual rating reversal retry',
          affectedUserIds: match.participants.map(p => p.userId),
          triggeredRecalculation: true,
        },
      });
    });

    logger.info(`Manual rating reversal retry completed for match ${matchId} by admin ${adminId}`);

    return prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        requiresManualRatingReversal: true,
      },
    });
  }

  /**
   * Get pending late cancellations for review (AS3)
   */
  async getPendingCancellations() {
    return prisma.match.findMany({
      where: {
        status: MatchStatus.CANCELLED,
        isLateCancellation: true,
        // No admin action taken yet
        adminActions: {
          none: {
            actionType: {
              in: [
                MatchAdminActionType.APPROVE_LATE_CANCELLATION,
                MatchAdminActionType.DENY_LATE_CANCELLATION
              ]
            }
          }
        }
      },
      include: {
        division: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        cancelledBy: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { cancelledAt: 'asc' }
    });
  }

  /**
   * Review a late cancellation (AS3)
   */
  async reviewCancellation(input: ReviewCancellationInput) {
    const { matchId, adminId, approved, applyPenalty, penaltySeverity, reason } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.cancelledById) {
      throw new Error('No cancellation recorded for this match');
    }

    await prisma.$transaction(async (tx) => {
      // Log admin action
      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: approved
            ? MatchAdminActionType.APPROVE_LATE_CANCELLATION
            : MatchAdminActionType.DENY_LATE_CANCELLATION,
          reason: reason || (approved ? 'Approved' : 'Denied'),
          affectedUserIds: [match.cancelledById!]
        }
      });

      // Apply penalty if requested
      if (!approved && applyPenalty && penaltySeverity) {
        const penaltyData: any = {
          userId: match.cancelledById!,
          penaltyType: PenaltyType.WARNING, // Late cancellation
          severity: penaltySeverity,
          relatedMatchId: matchId,
          issuedByAdminId: adminId,
          reason: reason || 'Late cancellation without valid reason',
          status: PenaltyStatus.ACTIVE
        };
        if (penaltySeverity === PenaltySeverity.POINTS_DEDUCTION) penaltyData.pointsDeducted = 2;
        if (penaltySeverity === PenaltySeverity.SUSPENSION) {
          penaltyData.suspensionDays = 7;
          penaltyData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
        await tx.playerPenalty.create({ data: penaltyData });
      }
    });

    logger.info(`Late cancellation for match ${matchId} ${approved ? 'approved' : 'denied'} by admin ${adminId}`);

    // Notify the player who cancelled about the decision
    try {
      const notifMessage = approved
        ? 'Your late cancellation has been reviewed and approved.'
        : `Your late cancellation has been reviewed and denied.${applyPenalty ? ' A penalty has been applied to your account.' : ''}`;

      await this.notificationService.createNotification({
        userIds: match.cancelledById!,
        type: 'ADMIN_MESSAGE',
        category: 'MATCH',
        title: approved ? 'Cancellation Approved' : 'Cancellation Denied',
        message: notifMessage,
        matchId,
      });
    } catch (notifError) {
      logger.warn('Failed to notify player about cancellation review', { matchId, error: notifError });
    }

    return { success: true, approved, penaltyApplied: !approved && applyPenalty };
  }

  /**
   * Apply penalty to player (AS3)
   */
  async applyPenalty(input: ApplyPenaltyInput) {
    const {
      userId,
      adminId,
      penaltyType,
      severity,
      relatedMatchId,
      relatedDisputeId,
      pointsDeducted,
      suspensionDays,
      reason,
      evidenceUrl
    } = input;

    // Calculate expiration for suspensions
    let expiresAt: Date | undefined;
    if (severity === PenaltySeverity.SUSPENSION && suspensionDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + suspensionDays);
    }

    const penaltyData: any = {
      userId,
      penaltyType,
      severity,
      issuedByAdminId: adminId,
      reason,
      status: PenaltyStatus.ACTIVE
    };
    if (relatedMatchId) penaltyData.relatedMatchId = relatedMatchId;
    if (relatedDisputeId) penaltyData.relatedDisputeId = relatedDisputeId;
    if (pointsDeducted) penaltyData.pointsDeducted = pointsDeducted;
    if (suspensionDays) penaltyData.suspensionDays = suspensionDays;
    if (severity === PenaltySeverity.SUSPENSION) penaltyData.suspensionStartDate = new Date();
    if (expiresAt) {
      penaltyData.suspensionEndDate = expiresAt;
      penaltyData.expiresAt = expiresAt;
    }
    if (evidenceUrl) penaltyData.evidenceUrl = evidenceUrl;

    const penalty = await prisma.playerPenalty.create({
      data: penaltyData,
      include: {
        user: { select: { id: true, name: true, username: true } },
        issuedByAdmin: { select: { id: true, user: { select: { name: true } } } }
      }
    });

    // Notify user
    await this.notificationService.createNotification({
      type: 'ADMIN_PENALTY_ISSUED',
      title: 'Penalty Applied',
      message: `You have received a ${severity.toLowerCase()} for: ${reason}`,
      category: 'ADMIN',
      userIds: [userId]
    });

    logger.info(`Penalty applied to user ${userId} by admin ${adminId}: ${severity}`);

    return penalty;
  }

  /**
   * Get player's penalty history
   */
  async getPlayerPenalties(userId: string) {
    return prisma.playerPenalty.findMany({
      where: { userId },
      include: {
        relatedMatch: {
          select: { id: true, matchDate: true }
        },
        issuedByAdmin: {
          select: { id: true, user: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Add admin note to dispute
   */
  async addDisputeNote(disputeId: string, adminId: string, note: string, isInternalOnly = true) {
    return prisma.disputeAdminNote.create({
      data: {
        disputeId,
        adminId,
        note,
        isInternalOnly
      }
    });
  }

  /**
   * Message match participants with multi-channel delivery
   * Respects user notification preferences for each delivery channel
   */
  async messageParticipants(
    matchId: string,
    adminId: string,
    data: {
      subject: string;
      message: string;
      sendEmail: boolean;
      sendPush: boolean;
    }
  ) {
    const { subject, message, sendEmail, sendPush } = data;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                pushTokens: {
                  where: { isActive: true },
                  select: { token: true, platform: true }
                },
                notificationPreferences: {
                  select: {
                    pushEnabled: true,
                    emailEnabled: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const recipientIds = match.participants.map(p => p.userId).filter((id): id is string => id !== null);
    const deliveryResults = {
      inApp: 0,
      email: 0,
      emailSkipped: 0,
      push: 0,
      pushSkipped: 0
    };

    // Always create in-app notification
    await this.notificationService.createNotification({
      type: 'ADMIN_MESSAGE',
      title: subject,
      message,
      category: 'ADMIN',
      matchId,
      userIds: recipientIds
    });
    deliveryResults.inApp = recipientIds.length;

    // Send email if requested and user has email notifications enabled
    if (sendEmail) {
      for (const participant of match.participants) {
        // Check user's email notification preference (default to enabled if no preference set)
        const emailEnabled = participant.user?.notificationPreferences?.emailEnabled ?? true;

        if (!emailEnabled) {
          logger.debug(`Skipping email for user ${participant.userId}: email notifications disabled`);
          deliveryResults.emailSkipped++;
          continue;
        }

        if (participant.user?.email) {
          try {
            const emailInput: { to: string; subject: string; body: string; recipientName?: string } = {
              to: participant.user.email,
              subject,
              body: message,
            };
            if (participant.user.name) {
              emailInput.recipientName = participant.user.name;
            }
            await this.notificationService.sendEmail(emailInput);
            deliveryResults.email++;
          } catch (error) {
            logger.error(`Failed to send email to ${participant.user.email}:`, {}, error as Error);
          }
        }
      }
    }

    // Send push notification if requested and user has push notifications enabled
    if (sendPush) {
      for (const participant of match.participants) {
        // Check user's push notification preference (default to enabled if no preference set)
        const pushEnabled = participant.user?.notificationPreferences?.pushEnabled ?? true;

        if (!pushEnabled) {
          logger.debug(`Skipping push for user ${participant.userId}: push notifications disabled`);
          deliveryResults.pushSkipped++;
          continue;
        }

        const pushTokens = participant.user?.pushTokens || [];
        for (const tokenRecord of pushTokens) {
          try {
            await this.notificationService.sendPushNotification({
              token: tokenRecord.token,
              title: subject,
              body: message,
              data: { matchId, type: 'ADMIN_MESSAGE' }
            });
            deliveryResults.push++;
          } catch (error) {
            logger.error(`Failed to send push to token ${tokenRecord.token}:`, {}, error as Error);
          }
        }
      }
    }

    // Create audit log entry
    await prisma.adminMessageLog.create({
      data: {
        adminId,
        matchId,
        subject,
        message,
        recipientIds,
        sendEmail,
        sendPush,
        inAppCount: deliveryResults.inApp,
        emailCount: deliveryResults.email,
        emailSkipped: deliveryResults.emailSkipped,
        pushCount: deliveryResults.push,
        pushSkipped: deliveryResults.pushSkipped,
      }
    });

    logger.info(`Admin ${adminId} messaged participants of match ${matchId}`, {
      recipients: recipientIds.length,
      deliveryResults
    });

    return {
      sent: recipientIds.length,
      recipients: recipientIds,
      deliveryResults
    };
  }

  /**
   * Send notification when dispute is resolved
   */
  private async sendDisputeResolvedNotification(
    disputeId: string,
    action: DisputeResolutionAction,
    reason: string
  ) {
    try {
      const dispute = await prisma.matchDispute.findUnique({
        where: { id: disputeId },
        include: {
          match: { include: { participants: { select: { userId: true } } } }
        }
      });

      if (!dispute) return;

      const actionText: Record<string, string> = {
        'UPHOLD_ORIGINAL': 'Original score upheld',
        'UPHOLD_DISPUTER': "Disputer's score accepted",
        'CUSTOM_SCORE': 'Score adjusted by admin',
        'VOID_MATCH': 'Match voided',
        'AWARD_WALKOVER': 'Walkover awarded',
        'REQUEST_MORE_INFO': 'More information requested'
      };
      const message = actionText[action] || 'Dispute resolved';

      const recipientIds = dispute.match.participants.map(p => p.userId).filter((id): id is string => id !== null);

      await this.notificationService.createNotification({
        type: 'MATCH_DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: `${message}. ${reason}`,
        category: 'MATCH',
        matchId: dispute.matchId,
        userIds: recipientIds
      });
    } catch (error) {
      logger.error('Error sending dispute resolved notification', {}, error as Error);
    }
  }

  /**
   * Send notification when result is edited by admin
   */
  private async sendResultEditedNotification(matchId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { participants: { select: { userId: true } } }
      });

      if (!match) return;

      const recipientIds = match.participants.map(p => p.userId).filter((id): id is string => id !== null);

      await this.notificationService.createNotification({
        type: 'MATCH_RESULT_UPDATED',
        title: 'Match Result Updated',
        message: 'An admin has updated the match result. Please review.',
        category: 'MATCH',
        matchId,
        userIds: recipientIds
      });
    } catch (error) {
      logger.error('Error sending result edited notification', {}, error as Error);
    }
  }

  // =============================================
  // FRIENDLY MATCH MODERATION METHODS
  // =============================================

  /**
   * Hide a match from public view (friendly match moderation)
   */
  async hideMatch(matchId: string, adminId: string, reason: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, isHiddenFromPublic: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.isHiddenFromPublic) {
      throw new Error('Match is already hidden');
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        isHiddenFromPublic: true,
        hiddenAt: new Date(),
        hiddenByAdminId: adminId,
        hiddenReason: reason
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      }
    });

    // Log admin action
    await prisma.matchAdminAction.create({
      data: {
        matchId,
        adminId,
        actionType: MatchAdminActionType.HIDE_MATCH,
        oldValue: { isHiddenFromPublic: false },
        newValue: { isHiddenFromPublic: true, hiddenReason: reason },
        reason: `Match hidden: ${reason}`
      }
    });

    logger.info(`Match ${matchId} hidden by admin ${adminId}: ${reason}`);

    return updatedMatch;
  }

  /**
   * Unhide a match (restore visibility)
   */
  async unhideMatch(matchId: string, adminId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, isHiddenFromPublic: true, hiddenReason: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.isHiddenFromPublic) {
      throw new Error('Match is not hidden');
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        isHiddenFromPublic: false,
        hiddenAt: null,
        hiddenByAdminId: null,
        hiddenReason: null
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      }
    });

    // Log admin action
    await prisma.matchAdminAction.create({
      data: {
        matchId,
        adminId,
        actionType: MatchAdminActionType.UNHIDE_MATCH,
        oldValue: { isHiddenFromPublic: true, hiddenReason: match.hiddenReason },
        newValue: { isHiddenFromPublic: false },
        reason: 'Match visibility restored'
      }
    });

    logger.info(`Match ${matchId} unhidden by admin ${adminId}`);

    return updatedMatch;
  }

  /**
   * Report a match for abuse
   */
  async reportMatchAbuse(
    matchId: string,
    adminId: string,
    reason: string,
    category: MatchReportCategory
  ) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, isReportedForAbuse: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.isReportedForAbuse) {
      throw new Error('Match is already reported');
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        isReportedForAbuse: true,
        reportedAt: new Date(),
        reportedByAdminId: adminId,
        reportReason: reason,
        reportCategory: category,
        requiresAdminReview: true
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      }
    });

    // Log admin action
    await prisma.matchAdminAction.create({
      data: {
        matchId,
        adminId,
        actionType: MatchAdminActionType.REPORT_ABUSE,
        oldValue: { isReportedForAbuse: false },
        newValue: { isReportedForAbuse: true, reportCategory: category, reportReason: reason },
        reason: `Match reported for abuse (${category}): ${reason}`
      }
    });

    logger.info(`Match ${matchId} reported for abuse by admin ${adminId}: ${category} - ${reason}`);

    return updatedMatch;
  }

  /**
   * Clear abuse report from a match
   */
  async clearMatchReport(matchId: string, adminId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, isReportedForAbuse: true, reportCategory: true, reportReason: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.isReportedForAbuse) {
      throw new Error('Match has no active report');
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        isReportedForAbuse: false,
        reportedAt: null,
        reportedByAdminId: null,
        reportReason: null,
        reportCategory: null,
        requiresAdminReview: false
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      }
    });

    // Log admin action
    await prisma.matchAdminAction.create({
      data: {
        matchId,
        adminId,
        actionType: MatchAdminActionType.CLEAR_REPORT,
        oldValue: { isReportedForAbuse: true, reportCategory: match.reportCategory, reportReason: match.reportReason },
        newValue: { isReportedForAbuse: false },
        reason: 'Abuse report cleared after review'
      }
    });

    logger.info(`Match ${matchId} abuse report cleared by admin ${adminId}`);

    return updatedMatch;
  }

  /**
   * Convert a match to walkover
   */
  async convertToWalkover(input: {
    matchId: string;
    adminId: string;
    userId: string;
    winnerId: string;
    reason: string;
    walkoverReason?: string;
  }) {
    const { matchId, adminId, userId, winnerId, reason, walkoverReason } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Determine winner team
    const winnerParticipant = match.participants.find(p => p.userId === winnerId);
    if (!winnerParticipant) {
      throw new Error('Winner must be a participant in this match');
    }

    const winnerTeam = winnerParticipant.team || 'team1';
    const team1Score = winnerTeam === 'team1' ? 2 : 0;
    const team2Score = winnerTeam === 'team2' ? 2 : 0;

    const oldValue = {
      status: match.status,
      isWalkover: match.isWalkover,
      team1Score: match.team1Score,
      team2Score: match.team2Score
    };

    const updatedMatch = await prisma.$transaction(async (tx) => {
      // Find the defaulting player (the loser)
      const loserParticipant = match.participants.find(p => p.userId !== winnerId);
      if (!loserParticipant) {
        throw new Error('Could not determine defaulting player');
      }

      // Map reason to WalkoverReason enum
      const walkoverReasonEnum = walkoverReason && ['NO_SHOW', 'LATE_CANCELLATION', 'INJURY', 'PERSONAL_EMERGENCY', 'OTHER'].includes(walkoverReason)
        ? walkoverReason as 'NO_SHOW' | 'LATE_CANCELLATION' | 'INJURY' | 'PERSONAL_EMERGENCY' | 'OTHER'
        : 'OTHER';

      // Update match to COMPLETED with walkover flag
      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          isWalkover: true,
          team1Score,
          team2Score,
          outcome: winnerTeam,
          adminNotes: reason
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, username: true } }
            }
          }
        }
      });

      // Create walkover record with proper fields
      if (!loserParticipant.userId) {
        throw new Error('Defaulting player has no associated user');
      }
      await tx.matchWalkover.create({
        data: {
          matchId,
          walkoverFlag: true,
          walkoverReason: walkoverReasonEnum,
          walkoverReasonDetail: reason,
          defaultingPlayerId: loserParticipant.userId,
          winningPlayerId: winnerId,
          reportedBy: userId, // User ID of admin (FK references User table)
          adminVerified: true,
          adminVerifiedBy: adminId,
          adminVerifiedAt: new Date()
        }
      });

      // Log admin action
      await tx.matchAdminAction.create({
        data: {
          matchId,
          adminId,
          actionType: MatchAdminActionType.VOID_MATCH, // Using VOID as closest action type
          oldValue,
          newValue: { status: MatchStatus.COMPLETED, isWalkover: true, team1Score, team2Score },
          reason,
          affectedUserIds: match.participants.map(p => p.userId),
          triggeredRecalculation: true
        }
      });

      return updated;
    });

    logger.info(`Match ${matchId} converted to walkover by admin ${adminId}, winner: ${winnerId}`);

    // Recalculate standings and ratings after walkover conversion
    // The match is now COMPLETED — standings should reflect the walkover outcome
    if (match.divisionId && match.seasonId) {
      try {
        // Step 1: Refresh MatchResult records for V2 standings
        const { MatchResultCreationService } = await import(
          '../match/calculation/matchResultCreationService'
        );
        const matchResultService = new MatchResultCreationService();
        await matchResultService.createMatchResults(matchId);

        // Step 2: Recalculate V2 standings (Best 6 based)
        const standingsV2 = new StandingsV2Service();
        await standingsV2.recalculateDivisionStandings(match.divisionId, match.seasonId);

        logger.info(`Recalculated standings after walkover conversion for match ${matchId}`);
      } catch (error) {
        logger.error(`Failed to recalculate after walkover conversion for match ${matchId}:`, {}, error as Error);
      }
    }

    return updatedMatch;
  }
}

// Export singleton
let adminMatchService: AdminMatchService | null = null;

export function getAdminMatchService(notificationService?: NotificationService): AdminMatchService {
  if (!adminMatchService) {
    adminMatchService = new AdminMatchService(notificationService);
  }
  return adminMatchService;
}
