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
  CancellationReason
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

    if (startDate || endDate) {
      where.matchDate = {};
      if (startDate) where.matchDate.gte = startDate;
      if (endDate) where.matchDate.lte = endDate;
    }

    if (search) {
      where.OR = [
        { participants: { some: { user: { name: { contains: search, mode: 'insensitive' } } } } },
        { participants: { some: { user: { username: { contains: search, mode: 'insensitive' } } } } }
      ];
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

    const [total, byStatus, disputed, lateCancellations] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.match.count({ where: { ...where, isDisputed: true } }),
      prisma.match.count({ where: { ...where, isLateCancellation: true } })
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach(s => {
      statusCounts[s.status] = s._count;
    });

    return {
      total,
      byStatus: statusCounts,
      disputed,
      lateCancellations
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
          { priority: 'desc' },
          { createdAt: 'asc' }
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

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new Error('Dispute has already been resolved');
    }

    await prisma.$transaction(async (tx) => {
      // Update dispute
      await tx.matchDispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
          adminResolution: reason,
          resolutionAction: action,
          finalScore: finalScore ? JSON.stringify(finalScore) : null
        }
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
        await tx.playerPenalty.create({
          data: {
            userId: match.cancelledById!,
            penaltyType: PenaltyType.WARNING, // Late cancellation
            severity: penaltySeverity,
            relatedMatchId: matchId,
            issuedByAdminId: adminId,
            reason: reason || 'Late cancellation without valid reason',
            status: PenaltyStatus.ACTIVE,
            pointsDeducted: penaltySeverity === PenaltySeverity.POINTS_DEDUCTION ? 2 : undefined,
            suspensionDays: penaltySeverity === PenaltySeverity.SUSPENSION ? 7 : undefined,
            expiresAt: penaltySeverity === PenaltySeverity.SUSPENSION
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              : undefined
          }
        });
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

    const penalty = await prisma.playerPenalty.create({
      data: {
        userId,
        penaltyType,
        severity,
        relatedMatchId,
        relatedDisputeId,
        pointsDeducted,
        suspensionDays,
        suspensionStartDate: severity === PenaltySeverity.SUSPENSION ? new Date() : undefined,
        suspensionEndDate: expiresAt,
        issuedByAdminId: adminId,
        reason,
        evidenceUrl,
        status: PenaltyStatus.ACTIVE,
        expiresAt
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
        issuedByAdmin: { select: { id: true, user: { select: { name: true } } } }
      }
    });

    // Notify user
    await this.notificationService.createNotification({
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
   * Message match participants
   */
  async messageParticipants(matchId: string, adminId: string, message: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: { select: { userId: true } } }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const recipientIds = match.participants.map(p => p.userId);

    await this.notificationService.createNotification({
      title: 'Message from Admin',
      message,
      category: 'ADMIN',
      matchId,
      recipientIds
    });

    logger.info(`Admin ${adminId} messaged participants of match ${matchId}`);

    return { sent: recipientIds.length, recipients: recipientIds };
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

      const actionText = {
        [DisputeResolutionAction.UPHOLD_ORIGINAL]: 'Original score upheld',
        [DisputeResolutionAction.UPHOLD_DISPUTER]: "Disputer's score accepted",
        [DisputeResolutionAction.CUSTOM_SCORE]: 'Score adjusted by admin',
        [DisputeResolutionAction.VOID_MATCH]: 'Match voided',
        [DisputeResolutionAction.AWARD_WALKOVER]: 'Walkover awarded',
        [DisputeResolutionAction.REQUEST_MORE_INFO]: 'More information requested'
      }[action];

      const recipientIds = dispute.match.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        title: 'Dispute Resolved',
        message: `${actionText}. ${reason}`,
        category: 'MATCH',
        matchId: dispute.matchId,
        recipientIds
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
        title: 'Match Result Updated',
        message: 'An admin has updated the match result. Please review.',
        category: 'MATCH',
        matchId,
        recipientIds
      });
    } catch (error) {
      logger.error('Error sending result edited notification', {}, error as Error);
    }
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
