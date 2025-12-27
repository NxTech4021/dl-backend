/**
 * Admin Report Service
 * Handles report generation for admin dashboard
 */

import { prisma } from '../../lib/prisma';
import { MatchStatus, DisputeStatus, Role, MembershipStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

export interface PlayerRegistrationStats {
  totalRegistrations: number;
  newThisMonth: number;
  newThisWeek: number;
  registrationsByMonth: { month: string; count: number }[];
  registrationsBySource: { source: string; count: number }[];
  onboardingCompletion: {
    total: number;
    withProfile: number;
    withMatches: number;
    fullyOnboarded: number;
  };
  dropoutRate: number;
}

export interface PlayerRetentionStats {
  totalPlayers: number;
  activePlayers: number;
  inactivePlayers: number;
  churned: number;
  retentionRate: number;
  retentionByMonth: { month: string; retained: number; churned: number; rate: number }[];
  engagementTiers: { tier: string; count: number; percentage: number }[];
  averageLifespan: number;
  reactivatedPlayers: number;
}

export interface SeasonPerformanceStats {
  seasonId: string;
  seasonName: string;
  totalMatches: number;
  completedMatches: number;
  completionRate: number;
  totalPlayers: number;
  activeParticipants: number;
  divisions: {
    id: string;
    name: string;
    players: number;
    matches: number;
    completionRate: number;
  }[];
  topPlayers: {
    id: string;
    name: string;
    wins: number;
    matches: number;
    winRate: number;
  }[];
  matchDistribution: { week: string; count: number }[];
}

export interface DisputeAnalysisStats {
  totalDisputes: number;
  openDisputes: number;
  resolvedDisputes: number;
  averageResolutionTime: number;
  disputesByCategory: { category: string; count: number }[];
  disputesByMonth: { month: string; count: number; resolved: number }[];
  resolutionOutcomes: { outcome: string; count: number }[];
  repeatOffenders: { userId: string; name: string; disputeCount: number }[];
}

export interface RevenueStats {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  growthRate: number;
  revenueBySource: { source: string; amount: number }[];
  revenueByMonth: { month: string; amount: number }[];
  outstandingPayments: number;
  refundsIssued: number;
}

export interface MembershipStats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  renewalRate: number;
  membershipsByTier: { tier: string; count: number }[];
  membershipsByMonth: { month: string; new: number; renewed: number; expired: number }[];
  averageMembershipDuration: number;
  upcomingRenewals: number;
}

export class AdminReportService {
  /**
   * Get player registration statistics
   */
  async getPlayerRegistrationStats(filters: DateRangeFilter): Promise<PlayerRegistrationStats> {
    const { startDate, endDate } = filters;
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dateFilter = startDate || endDate ? {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    } : {};

    // Get total registrations
    const totalRegistrations = await prisma.user.count({
      where: { role: Role.USER, ...dateFilter }
    });

    // New this month
    const newThisMonth = await prisma.user.count({
      where: {
        role: Role.USER,
        createdAt: { gte: monthAgo }
      }
    });

    // New this week
    const newThisWeek = await prisma.user.count({
      where: {
        role: Role.USER,
        createdAt: { gte: weekAgo }
      }
    });

    // Registrations by month (last 12 months)
    const registrationsByMonth = await this.getRegistrationsByMonth(12);

    // Onboarding completion
    const withProfile = await prisma.user.count({
      where: {
        role: Role.USER,
        ...dateFilter,
        OR: [
          { image: { not: null } },
          { phoneNumber: { not: null } }
        ]
      }
    });

    const withMatches = await prisma.user.count({
      where: {
        role: Role.USER,
        ...dateFilter,
        matchParticipants: { some: {} }
      }
    });

    const fullyOnboarded = await prisma.user.count({
      where: {
        role: Role.USER,
        ...dateFilter,
        image: { not: null },
        matchParticipants: { some: {} }
      }
    });

    // Dropout rate (registered but never played)
    const neverPlayed = await prisma.user.count({
      where: {
        role: Role.USER,
        createdAt: { lte: monthAgo },
        matchParticipants: { none: {} }
      }
    });

    const olderUsers = await prisma.user.count({
      where: {
        role: Role.USER,
        createdAt: { lte: monthAgo }
      }
    });

    const dropoutRate = olderUsers > 0 ? (neverPlayed / olderUsers) * 100 : 0;

    return {
      totalRegistrations,
      newThisMonth,
      newThisWeek,
      registrationsByMonth,
      registrationsBySource: [], // Would need tracking field
      onboardingCompletion: {
        total: totalRegistrations,
        withProfile,
        withMatches,
        fullyOnboarded
      },
      dropoutRate: Math.round(dropoutRate * 10) / 10
    };
  }

  /**
   * Get player retention statistics
   */
  async getPlayerRetentionStats(filters: DateRangeFilter): Promise<PlayerRetentionStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const totalPlayers = await prisma.user.count({
      where: { role: Role.USER }
    });

    // Active players (played in last 30 days)
    const activePlayers = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {
            match: {
              matchDate: { gte: thirtyDaysAgo }
            }
          }
        }
      }
    });

    // Inactive players (no match in 30+ days but had matches before)
    const inactivePlayers = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {},
          none: {
            match: {
              matchDate: { gte: thirtyDaysAgo }
            }
          }
        }
      }
    });

    // Churned (inactive for 90+ days)
    const churned = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {},
          none: {
            match: {
              matchDate: { gte: ninetyDaysAgo }
            }
          }
        }
      }
    });

    const retentionRate = totalPlayers > 0 ? ((totalPlayers - churned) / totalPlayers) * 100 : 0;

    // Retention by month
    const retentionByMonth = await this.getRetentionByMonth(6);

    // Engagement tiers
    const highEngagement = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {
            match: { matchDate: { gte: thirtyDaysAgo } }
          }
        }
      }
    });

    const mediumEngagement = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {
            match: { matchDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
          }
        }
      }
    });

    const lowEngagement = await prisma.user.count({
      where: {
        role: Role.USER,
        matchParticipants: {
          some: {
            match: { matchDate: { gte: ninetyDaysAgo, lt: sixtyDaysAgo } }
          }
        }
      }
    });

    const engagementTiers = [
      { tier: 'High (Active <30 days)', count: highEngagement, percentage: totalPlayers > 0 ? (highEngagement / totalPlayers) * 100 : 0 },
      { tier: 'Medium (30-60 days)', count: mediumEngagement, percentage: totalPlayers > 0 ? (mediumEngagement / totalPlayers) * 100 : 0 },
      { tier: 'Low (60-90 days)', count: lowEngagement, percentage: totalPlayers > 0 ? (lowEngagement / totalPlayers) * 100 : 0 },
      { tier: 'Churned (90+ days)', count: churned, percentage: totalPlayers > 0 ? (churned / totalPlayers) * 100 : 0 }
    ];

    return {
      totalPlayers,
      activePlayers,
      inactivePlayers,
      churned,
      retentionRate: Math.round(retentionRate * 10) / 10,
      retentionByMonth,
      engagementTiers,
      averageLifespan: 0, // Would need first/last match calculation
      reactivatedPlayers: 0 // Would need tracking
    };
  }

  /**
   * Get season performance statistics
   */
  async getSeasonPerformanceStats(seasonId?: string): Promise<SeasonPerformanceStats[]> {
    const seasons = seasonId
      ? await prisma.season.findMany({ where: { id: seasonId } })
      : await prisma.season.findMany({
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          take: 5
        });

    const stats: SeasonPerformanceStats[] = [];

    for (const season of seasons) {
      const totalMatches = await prisma.match.count({
        where: { seasonId: season.id }
      });

      const completedMatches = await prisma.match.count({
        where: { seasonId: season.id, status: MatchStatus.COMPLETED }
      });

      const divisions = await prisma.division.findMany({
        where: { seasonId: season.id },
        include: {
          _count: {
            select: {
              matches: true,
              assignments: true
            }
          }
        }
      });

      const divisionStats = await Promise.all(
        divisions.map(async (div) => {
          const completedInDiv = await prisma.match.count({
            where: { divisionId: div.id, status: MatchStatus.COMPLETED }
          });
          return {
            id: div.id,
            name: div.name,
            players: div._count.assignments,
            matches: div._count.matches,
            completionRate: div._count.matches > 0 ? (completedInDiv / div._count.matches) * 100 : 0
          };
        })
      );

      // Get memberships for this season
      const memberships = await prisma.seasonMembership.count({
        where: { seasonId: season.id }
      });

      stats.push({
        seasonId: season.id,
        seasonName: season.name,
        totalMatches,
        completedMatches,
        completionRate: totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0,
        totalPlayers: memberships,
        activeParticipants: memberships,
        divisions: divisionStats,
        topPlayers: [], // Would need win calculation
        matchDistribution: [] // Would need weekly grouping
      });
    }

    return stats;
  }

  /**
   * Get dispute analysis statistics
   */
  async getDisputeAnalysisStats(filters: DateRangeFilter): Promise<DisputeAnalysisStats> {
    const { startDate, endDate } = filters;

    const dateFilter = startDate || endDate ? {
      submittedAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    } : {};

    const totalDisputes = await prisma.matchDispute.count({ where: dateFilter });
    const openDisputes = await prisma.matchDispute.count({
      where: { ...dateFilter, status: DisputeStatus.OPEN }
    });
    const resolvedDisputes = await prisma.matchDispute.count({
      where: { ...dateFilter, status: DisputeStatus.RESOLVED }
    });

    // Disputes by category
    const disputesByCategory = await prisma.matchDispute.groupBy({
      by: ['disputeCategory'],
      where: dateFilter,
      _count: true
    });

    // Disputes by month
    const disputesByMonth = await this.getDisputesByMonth(6);

    // Resolution outcomes
    const resolutionOutcomes = await prisma.matchDispute.groupBy({
      by: ['resolutionAction'],
      where: { ...dateFilter, status: DisputeStatus.RESOLVED },
      _count: true
    });

    // Repeat offenders (users with 3+ disputes)
    const userDisputes = await prisma.matchDispute.groupBy({
      by: ['raisedByUserId'],
      where: dateFilter,
      _count: true,
      having: {
        raisedByUserId: {
          _count: { gte: 3 }
        }
      }
    });

    const repeatOffenders = await Promise.all(
      userDisputes.slice(0, 10).map(async (ud) => {
        const user = await prisma.user.findUnique({
          where: { id: ud.raisedByUserId },
          select: { id: true, name: true }
        });
        return {
          userId: ud.raisedByUserId,
          name: user?.name || 'Unknown',
          disputeCount: ud._count
        };
      })
    );

    return {
      totalDisputes,
      openDisputes,
      resolvedDisputes,
      averageResolutionTime: 0, // Would need time calculation
      disputesByCategory: disputesByCategory.map(d => ({
        category: d.disputeCategory,
        count: d._count
      })),
      disputesByMonth,
      resolutionOutcomes: resolutionOutcomes.map(r => ({
        outcome: r.resolutionAction || 'Unknown',
        count: r._count
      })),
      repeatOffenders
    };
  }

  /**
   * Get revenue statistics
   * Note: Using membership data as proxy for revenue since no Payment model exists
   */
  async getRevenueStats(filters: DateRangeFilter): Promise<RevenueStats> {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Use membership counts as revenue proxy (assume $50 per membership)
    const MEMBERSHIP_FEE = 50;

    // Total memberships
    const totalMemberships = await prisma.seasonMembership.count({
      where: { status: MembershipStatus.ACTIVE }
    });

    const membershipsThisMonth = await prisma.seasonMembership.count({
      where: {
        joinedAt: { gte: thisMonth }
      }
    });

    const membershipsLastMonth = await prisma.seasonMembership.count({
      where: {
        joinedAt: { gte: lastMonth, lte: lastMonthEnd }
      }
    });

    // Pending memberships as outstanding
    const pendingMemberships = await prisma.seasonMembership.count({
      where: { status: MembershipStatus.PENDING }
    });

    // Removed memberships as refunds
    const removedMemberships = await prisma.seasonMembership.count({
      where: { status: MembershipStatus.REMOVED }
    });

    const thisMonthAmount = membershipsThisMonth * MEMBERSHIP_FEE;
    const lastMonthAmount = membershipsLastMonth * MEMBERSHIP_FEE;
    const growthRate = lastMonthAmount > 0 ? ((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100 : 0;

    // Revenue by month
    const revenueByMonth = await this.getRevenueByMonth(6);

    return {
      totalRevenue: totalMemberships * MEMBERSHIP_FEE,
      revenueThisMonth: thisMonthAmount,
      revenueLastMonth: lastMonthAmount,
      growthRate: Math.round(growthRate * 10) / 10,
      revenueBySource: [
        { source: 'Season Memberships', amount: totalMemberships * MEMBERSHIP_FEE }
      ],
      revenueByMonth,
      outstandingPayments: pendingMemberships * MEMBERSHIP_FEE,
      refundsIssued: removedMemberships * MEMBERSHIP_FEE
    };
  }

  /**
   * Get membership statistics
   */
  async getMembershipStats(filters: DateRangeFilter): Promise<MembershipStats> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalMembers = await prisma.seasonMembership.count();

    const activeMembers = await prisma.seasonMembership.count({
      where: { status: MembershipStatus.ACTIVE }
    });

    const expiredMembers = await prisma.seasonMembership.count({
      where: { status: MembershipStatus.INACTIVE }
    });

    // Memberships by month
    const membershipsByMonth = await this.getMembershipsByMonth(6);

    // Upcoming renewals (seasons ending in 30 days)
    const upcomingRenewals = await prisma.seasonMembership.count({
      where: {
        status: MembershipStatus.ACTIVE,
        season: {
          endDate: { lte: thirtyDaysFromNow, gte: now }
        }
      }
    });

    const renewalRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

    return {
      totalMembers,
      activeMembers,
      expiredMembers,
      renewalRate: Math.round(renewalRate * 10) / 10,
      membershipsByTier: [], // Would need tier field
      membershipsByMonth,
      averageMembershipDuration: 0, // Would need calculation
      upcomingRenewals
    };
  }

  // Helper methods

  private async getRegistrationsByMonth(months: number) {
    const result: { month: string; count: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const count = await prisma.user.count({
        where: {
          role: Role.USER,
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        }
      });

      result.unshift({
        month: startOfMonth.toISOString().slice(0, 7),
        count
      });
    }

    return result;
  }

  private async getRetentionByMonth(months: number) {
    const result: { month: string; retained: number; churned: number; rate: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const active = await prisma.user.count({
        where: {
          role: Role.USER,
          matchParticipants: {
            some: {
              match: {
                matchDate: { gte: startOfMonth, lte: endOfMonth }
              }
            }
          }
        }
      });

      const total = await prisma.user.count({
        where: {
          role: Role.USER,
          createdAt: { lte: endOfMonth }
        }
      });

      const churned = total - active;
      const rate = total > 0 ? (active / total) * 100 : 0;

      result.unshift({
        month: startOfMonth.toISOString().slice(0, 7),
        retained: active,
        churned,
        rate: Math.round(rate * 10) / 10
      });
    }

    return result;
  }

  private async getDisputesByMonth(months: number) {
    const result: { month: string; count: number; resolved: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const count = await prisma.matchDispute.count({
        where: {
          submittedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      });

      const resolved = await prisma.matchDispute.count({
        where: {
          submittedAt: { gte: startOfMonth, lte: endOfMonth },
          status: DisputeStatus.RESOLVED
        }
      });

      result.unshift({ month: startOfMonth.toISOString().slice(0, 7), count, resolved });
    }

    return result;
  }

  private async getRevenueByMonth(months: number) {
    const result: { month: string; amount: number }[] = [];
    const now = new Date();
    const MEMBERSHIP_FEE = 50;

    for (let i = 0; i < months; i++) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const membershipCount = await prisma.seasonMembership.count({
        where: {
          joinedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      });

      result.unshift({
        month: startOfMonth.toISOString().slice(0, 7),
        amount: membershipCount * MEMBERSHIP_FEE
      });
    }

    return result;
  }

  private async getMembershipsByMonth(months: number) {
    const result: { month: string; new: number; renewed: number; expired: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const newMembers = await prisma.seasonMembership.count({
        where: {
          joinedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      });

      result.unshift({
        month: startOfMonth.toISOString().slice(0, 7),
        new: newMembers,
        renewed: 0, // Would need tracking
        expired: 0 // Would need tracking
      });
    }

    return result;
  }
}

// Export singleton
let adminReportService: AdminReportService | null = null;

export function getAdminReportService(): AdminReportService {
  if (!adminReportService) {
    adminReportService = new AdminReportService();
  }
  return adminReportService;
}
