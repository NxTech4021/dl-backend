/**
 * Admin Dashboard Service
 * Provides aggregated statistics for admin dashboard
 */

import { prisma } from '../../lib/prisma';
import { Role, SportType } from '@prisma/client';

/**
 * Dashboard KPI stats
 */
export interface DashboardKPIStats {
  totalUsers: number;
  leagueParticipants: number;
  conversionRate: number;
  totalRevenue: number;
  previousTotalUsers: number;
  previousLeagueParticipants: number;
  previousRevenue: number;
}

/**
 * Sport-specific metrics
 */
export interface SportMetrics {
  sport: string;
  sportType: SportType;
  users: number;
  payingMembers: number;
  revenue: number;
  matches: number;
}

/**
 * Match activity data for charts
 */
export interface MatchActivityData {
  week: string;
  date: string;
  tennisLeague: number;
  tennisFriendly: number;
  pickleballLeague: number;
  pickleballFriendly: number;
  padelLeague: number;
  padelFriendly: number;
}

/**
 * User growth data for charts
 */
export interface UserGrowthData {
  month: string;
  totalUsers: number;
  payingMembers: number;
}

/**
 * Get dashboard KPI statistics
 */
export async function getDashboardKPIStats(): Promise<DashboardKPIStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Current period stats
  const [totalUsers, leagueParticipants] = await Promise.all([
    prisma.user.count({
      where: { role: Role.USER },
    }),
    prisma.seasonMembership.groupBy({
      by: ['userId'],
      where: {
        status: 'ACTIVE',
      },
    }).then(groups => groups.length),
  ]);

  // Previous period stats (30-60 days ago)
  const [previousTotalUsers, previousLeagueParticipants] = await Promise.all([
    prisma.user.count({
      where: {
        role: Role.USER,
        createdAt: { lte: thirtyDaysAgo },
      },
    }),
    prisma.seasonMembership.groupBy({
      by: ['userId'],
      where: {
        status: 'ACTIVE',
        joinedAt: { lte: thirtyDaysAgo },
      },
    }).then(groups => groups.length),
  ]);

  // Calculate conversion rate
  const conversionRate = totalUsers > 0
    ? Math.round((leagueParticipants / totalUsers) * 1000) / 10
    : 0;

  // Revenue calculations (placeholder - would need actual payment/subscription model)
  // For now, estimate based on paying members at RM30/month
  const estimatedMonthlyFee = 30;
  const totalRevenue = leagueParticipants * estimatedMonthlyFee;
  const previousRevenue = previousLeagueParticipants * estimatedMonthlyFee;

  return {
    totalUsers,
    leagueParticipants,
    conversionRate,
    totalRevenue,
    previousTotalUsers,
    previousLeagueParticipants,
    previousRevenue,
  };
}

/**
 * Get sport-specific metrics
 */
export async function getSportMetrics(): Promise<SportMetrics[]> {
  const sportTypes: SportType[] = ['TENNIS', 'PICKLEBALL', 'PADEL'];
  const metrics: SportMetrics[] = [];

  for (const sportType of sportTypes) {
    // Count users who have played in this sport via division's league
    const usersWithSport = await prisma.seasonMembership.groupBy({
      by: ['userId'],
      where: {
        division: {
          league: {
            sportType,
          },
        },
      },
    });

    // Count active paying members in this sport via division's league
    const payingMembers = await prisma.seasonMembership.groupBy({
      by: ['userId'],
      where: {
        status: 'ACTIVE',
        division: {
          league: {
            sportType,
          },
        },
      },
    });

    // Count matches in this sport via division's league
    const matchCount = await prisma.match.count({
      where: {
        division: {
          league: {
            sportType,
          },
        },
        status: 'COMPLETED',
      },
    });

    // Estimate revenue (RM30/month per paying member)
    const revenue = payingMembers.length * 30;

    const sportName = sportType === 'TENNIS' ? 'Tennis'
      : sportType === 'PICKLEBALL' ? 'Pickleball'
      : 'Padel';

    metrics.push({
      sport: sportName,
      sportType,
      users: usersWithSport.length,
      payingMembers: payingMembers.length,
      revenue,
      matches: matchCount,
    });
  }

  return metrics;
}

/**
 * Get match activity data for charts
 */
export async function getMatchActivityData(weeks: number = 12): Promise<MatchActivityData[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  const data: MatchActivityData[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get matches for each sport (divisionId present = league match, null = friendly)
    const [tennisLeague, tennisFriendly, pickleballLeague, pickleballFriendly, padelLeague, padelFriendly] = await Promise.all([
      // Tennis league matches (have division)
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: { not: null },
          division: { league: { sportType: 'TENNIS' } },
        },
      }),
      // Tennis friendly matches (no division but has league)
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: null,
          league: { sportType: 'TENNIS' },
        },
      }),
      // Pickleball league matches
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: { not: null },
          division: { league: { sportType: 'PICKLEBALL' } },
        },
      }),
      // Pickleball friendly matches
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: null,
          league: { sportType: 'PICKLEBALL' },
        },
      }),
      // Padel league matches
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: { not: null },
          division: { league: { sportType: 'PADEL' } },
        },
      }),
      // Padel friendly matches
      prisma.match.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          divisionId: null,
          league: { sportType: 'PADEL' },
        },
      }),
    ]);

    const dateStr = weekStart.toISOString().split('T')[0];

    data.push({
      week: `Week ${i + 1}`,
      date: dateStr ?? '',
      tennisLeague,
      tennisFriendly,
      pickleballLeague,
      pickleballFriendly,
      padelLeague,
      padelFriendly,
    });
  }

  return data;
}

/**
 * Get user growth data for charts
 */
export async function getUserGrowthData(months: number = 6): Promise<UserGrowthData[]> {
  const now = new Date();
  const data: UserGrowthData[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const [totalUsers, payingMembers] = await Promise.all([
      prisma.user.count({
        where: {
          role: Role.USER,
          createdAt: { lte: monthEnd },
        },
      }),
      prisma.seasonMembership.groupBy({
        by: ['userId'],
        where: {
          status: 'ACTIVE',
          joinedAt: { lte: monthEnd },
        },
      }).then(groups => groups.length),
    ]);

    data.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      totalUsers,
      payingMembers,
    });
  }

  return data;
}

/**
 * Get sport comparison data for charts
 */
export async function getSportComparisonData(): Promise<{ sport: string; payingMembers: number; revenue: number; fill: string }[]> {
  const sportMetrics = await getSportMetrics();

  const colorMap: Record<string, string> = {
    Tennis: '#ABFE4D',
    Pickleball: '#A04DFE',
    Padel: '#4DABFE',
  };

  return sportMetrics.map(metric => ({
    sport: metric.sport,
    payingMembers: metric.payingMembers,
    revenue: metric.revenue,
    fill: colorMap[metric.sport] || '#888888',
  }));
}

/**
 * Get all dashboard stats in one call
 */
export async function getAllDashboardStats() {
  const [kpiStats, sportMetrics, matchActivity, userGrowth, sportComparison] = await Promise.all([
    getDashboardKPIStats(),
    getSportMetrics(),
    getMatchActivityData(12),
    getUserGrowthData(6),
    getSportComparisonData(),
  ]);

  return {
    kpi: kpiStats,
    sportMetrics,
    matchActivity,
    userGrowth,
    sportComparison,
  };
}
