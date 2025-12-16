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
import { NotificationService } from '../notificationService';

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
    this.notificationService = notificationService || new NotificationService();
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
            select: { id: true, status: true, disputeCategory: true, priority: true }
          },
          walkover: true,
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
      VOID: 0
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
   * Get all disputes for admin review (AS5)
   */
  async getDisputes(filters: {
    status?: DisputeStatus[];
    priority?: DisputePriority;
    page?: number;
    limit?: number;
  }) {
    const { status, priority, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status && status.length > 0) where.status = { in: status };
    if (priority) where.priority = priority;

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

    return prisma.matchDispute.update({
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

    // Determine final status based on action
    const finalStatus = action === DisputeResolutionAction.REJECT
      ? DisputeStatus.REJECTED
      : DisputeStatus.RESOLVED;

    await prisma.$transaction(async (tx) => {
      // Update dispute
      const disputeUpdateData: any = {
        status: finalStatus,
        resolvedByAdminId: adminId,
        adminResolution: reason,
        resolutionAction: action,
        resolvedAt: new Date()
      };
      if (finalScore) disputeUpdateData.finalScore = JSON.stringify(finalScore);

      await tx.matchDispute.update({
        where: { id: disputeId },
        data: disputeUpdateData
      });

      // Handle different resolution actions
      if (action === DisputeResolutionAction.UPHOLD_ORIGINAL) {
        // Keep original score, mark match as no longer disputed
        await tx.match.update({
          where: { id: dispute.matchId },
          data: { isDisputed: false }
        });
      } else if (action === DisputeResolutionAction.UPHOLD_DISPUTER || action === DisputeResolutionAction.CUSTOM_SCORE) {
        // Update match with new score
        if (finalScore) {
          // Delete old scores
          await tx.matchScore.deleteMany({
            where: { matchId: dispute.matchId }
          });

          // Create new scores
          if (finalScore.setScores) {
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

          // Determine winner
          const winner = finalScore.team1Score > finalScore.team2Score ? 'team1' : 'team2';

          await tx.match.update({
            where: { id: dispute.matchId },
            data: {
              team1Score: finalScore.team1Score,
              team2Score: finalScore.team2Score,
              outcome: winner,
              isDisputed: false,
              requiresAdminReview: false
            }
          });
        }
      } else if (action === DisputeResolutionAction.VOID_MATCH) {
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            status: MatchStatus.VOID,
            isDisputed: false,
            adminNotes: reason
          }
        });
      } else if (action === DisputeResolutionAction.AWARD_WALKOVER) {
        await tx.match.update({
          where: { id: dispute.matchId },
          data: {
            isWalkover: true,
            isDisputed: false,
            team1Score: finalScore?.team1Score || 2,
            team2Score: finalScore?.team2Score || 0,
            outcome: (finalScore?.team1Score || 2) > (finalScore?.team2Score || 0) ? 'team1' : 'team2'
          }
        });
      } else if (action === DisputeResolutionAction.REJECT) {
        // Reject dispute - mark match as no longer disputed, keep original score
        await tx.match.update({
          where: { id: dispute.matchId },
          data: { isDisputed: false }
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

    // Store old values for audit
    const oldValue = {
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      outcome: match.outcome,
      isWalkover: match.isWalkover
    };

    await prisma.$transaction(async (tx) => {
      // Update scores if provided
      if (setScores) {
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

      await tx.match.update({
        where: { id: matchId },
        data: updateData
      });

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

    // Trigger rating and standings recalculation for completed matches using DMR
    if (match.status === MatchStatus.COMPLETED && match.divisionId && match.seasonId) {
      try {
        // Use DMR service for rating recalculation
        const { recalculateMatchRatings } = await import('../rating/adminRatingService');
        await recalculateMatchRatings(matchId, adminId);

        // Recalculate standings for division
        const { recalculateDivisionStandings } = await import('../rating/standingsCalculationService');
        await recalculateDivisionStandings(match.divisionId);

        // Recalculate Best 6 for affected players
        const { Best6AlgorithmService } = await import('../match/best6/best6AlgorithmService');
        const best6Service = new Best6AlgorithmService();
        for (const participant of match.participants) {
          await best6Service.applyBest6ToDatabase(
            participant.userId,
            match.divisionId,
            match.seasonId
          );
        }

        logger.info(`DMR ratings and standings recalculated after match ${matchId} result edit`);
      } catch (error) {
        logger.error('Error during DMR recalculation after result edit', { matchId }, error as Error);
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
   */
  async voidMatch(matchId: string, adminId: string, reason: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.VOID,
          adminNotes: reason
        }
      });

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

    logger.info(`Match ${matchId} voided by admin ${adminId}`);

    return prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: { include: { user: true } } }
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

    const recipientIds = match.participants.map(p => p.userId);
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

      const recipientIds = dispute.match.participants.map(p => p.userId);

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

      const recipientIds = match.participants.map(p => p.userId);

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
    winnerId: string;
    reason: string;
    walkoverReason?: string;
  }) {
    const { matchId, adminId, winnerId, reason, walkoverReason } = input;

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
      await tx.matchWalkover.create({
        data: {
          matchId,
          walkoverFlag: true,
          walkoverReason: walkoverReasonEnum,
          walkoverReasonDetail: reason,
          defaultingPlayerId: loserParticipant.userId,
          winningPlayerId: winnerId,
          reportedBy: adminId, // Admin reporting
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
