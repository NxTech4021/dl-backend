/**
 * AdminDashboardService Integration Tests
 *
 * Tests for admin dashboard statistics: KPIs, sport metrics, match activity, user growth.
 *
 * Note: Some tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so data created via prismaTest are not visible to the service.
 */

import { prismaTest } from '../../../setup/prismaTestClient';
import { SportType } from '@prisma/client';

// Mock the logger
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
import {
  getDashboardKPIStats,
  getSportMetrics,
  getMatchActivityData,
  getUserGrowthData,
  getSportComparisonData,
  getAllDashboardStats,
  DashboardKPIStats,
  SportMetrics,
  MatchActivityData,
  UserGrowthData,
} from '../../../../src/services/admin/adminDashboardService';

describe('AdminDashboardService', () => {
  describe('getDashboardKPIStats', () => {
    it('should return KPI statistics with all required fields', async () => {
      // Act
      const stats = await getDashboardKPIStats();

      // Assert
      expect(stats).toBeDefined();
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.leagueParticipants).toBe('number');
      expect(typeof stats.conversionRate).toBe('number');
      expect(typeof stats.totalRevenue).toBe('number');
      expect(typeof stats.previousTotalUsers).toBe('number');
      expect(typeof stats.previousLeagueParticipants).toBe('number');
      expect(typeof stats.previousRevenue).toBe('number');
      expect(typeof stats.totalMatches).toBe('number');
      expect(typeof stats.previousMatches).toBe('number');
      expect(typeof stats.activeUsers).toBe('number');
      expect(typeof stats.previousActiveUsers).toBe('number');
    });

    it('should return non-negative values', async () => {
      // Act
      const stats = await getDashboardKPIStats();

      // Assert
      expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
      expect(stats.leagueParticipants).toBeGreaterThanOrEqual(0);
      expect(stats.conversionRate).toBeGreaterThanOrEqual(0);
      expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(stats.totalMatches).toBeGreaterThanOrEqual(0);
      expect(stats.activeUsers).toBeGreaterThanOrEqual(0);
    });

    it('should calculate conversion rate correctly', async () => {
      // Act
      const stats = await getDashboardKPIStats();

      // Assert
      // Conversion rate should be between 0 and 100 (percentage)
      expect(stats.conversionRate).toBeGreaterThanOrEqual(0);
      expect(stats.conversionRate).toBeLessThanOrEqual(100);
    });
  });

  describe('getSportMetrics', () => {
    it('should return metrics for all sport types', async () => {
      // Act
      const metrics = await getSportMetrics();

      // Assert
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(3); // TENNIS, PICKLEBALL, PADEL
    });

    it('should include all required fields for each sport', async () => {
      // Act
      const metrics = await getSportMetrics();

      // Assert
      const expectedSports = ['Tennis', 'Pickleball', 'Padel'];
      const sportNames = metrics.map((m) => m.sport);
      expectedSports.forEach((sport) => {
        expect(sportNames).toContain(sport);
      });

      metrics.forEach((metric) => {
        expect(metric).toHaveProperty('sport');
        expect(metric).toHaveProperty('sportType');
        expect(metric).toHaveProperty('users');
        expect(metric).toHaveProperty('payingMembers');
        expect(metric).toHaveProperty('revenue');
        expect(metric).toHaveProperty('matches');
        expect(typeof metric.users).toBe('number');
        expect(typeof metric.payingMembers).toBe('number');
        expect(typeof metric.revenue).toBe('number');
        expect(typeof metric.matches).toBe('number');
      });
    });

    it('should return non-negative values for all metrics', async () => {
      // Act
      const metrics = await getSportMetrics();

      // Assert
      metrics.forEach((metric) => {
        expect(metric.users).toBeGreaterThanOrEqual(0);
        expect(metric.payingMembers).toBeGreaterThanOrEqual(0);
        expect(metric.revenue).toBeGreaterThanOrEqual(0);
        expect(metric.matches).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have correct sport type values', async () => {
      // Act
      const metrics = await getSportMetrics();

      // Assert
      const sportTypes = metrics.map((m) => m.sportType);
      expect(sportTypes).toContain('TENNIS');
      expect(sportTypes).toContain('PICKLEBALL');
      expect(sportTypes).toContain('PADEL');
    });
  });

  describe('getMatchActivityData', () => {
    it('should return data for default 12 weeks', async () => {
      // Act
      const data = await getMatchActivityData();

      // Assert
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(12);
    });

    it('should return data for custom number of weeks', async () => {
      // Act
      const data = await getMatchActivityData(6);

      // Assert
      expect(data).toBeDefined();
      expect(data.length).toBe(6);
    });

    it('should include all required fields for each week', async () => {
      // Act
      const data = await getMatchActivityData(2);

      // Assert
      data.forEach((weekData) => {
        expect(weekData).toHaveProperty('week');
        expect(weekData).toHaveProperty('date');
        expect(weekData).toHaveProperty('tennisLeague');
        expect(weekData).toHaveProperty('tennisFriendly');
        expect(weekData).toHaveProperty('pickleballLeague');
        expect(weekData).toHaveProperty('pickleballFriendly');
        expect(weekData).toHaveProperty('padelLeague');
        expect(weekData).toHaveProperty('padelFriendly');
      });
    });

    it('should have week labels in correct format', async () => {
      // Act
      const data = await getMatchActivityData(3);

      // Assert
      expect(data[0]?.week).toBe('Week 1');
      expect(data[1]?.week).toBe('Week 2');
      expect(data[2]?.week).toBe('Week 3');
    });

    it('should have valid date strings', async () => {
      // Act
      const data = await getMatchActivityData(2);

      // Assert
      data.forEach((weekData) => {
        // Check date format YYYY-MM-DD
        expect(weekData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should return non-negative match counts', async () => {
      // Act
      const data = await getMatchActivityData(4);

      // Assert
      data.forEach((weekData) => {
        expect(weekData.tennisLeague).toBeGreaterThanOrEqual(0);
        expect(weekData.tennisFriendly).toBeGreaterThanOrEqual(0);
        expect(weekData.pickleballLeague).toBeGreaterThanOrEqual(0);
        expect(weekData.pickleballFriendly).toBeGreaterThanOrEqual(0);
        expect(weekData.padelLeague).toBeGreaterThanOrEqual(0);
        expect(weekData.padelFriendly).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getUserGrowthData', () => {
    it('should return data for default 6 months', async () => {
      // Act
      const data = await getUserGrowthData();

      // Assert
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(6);
    });

    it('should return data for custom number of months', async () => {
      // Act
      const data = await getUserGrowthData(3);

      // Assert
      expect(data).toBeDefined();
      expect(data.length).toBe(3);
    });

    it('should include all required fields for each month', async () => {
      // Act
      const data = await getUserGrowthData(2);

      // Assert
      data.forEach((monthData) => {
        expect(monthData).toHaveProperty('month');
        expect(monthData).toHaveProperty('totalUsers');
        expect(monthData).toHaveProperty('payingMembers');
        expect(typeof monthData.totalUsers).toBe('number');
        expect(typeof monthData.payingMembers).toBe('number');
      });
    });

    it('should have month labels in YYYY-MM format', async () => {
      // Act
      const data = await getUserGrowthData(2);

      // Assert
      data.forEach((monthData) => {
        expect(monthData.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it('should return non-negative user counts', async () => {
      // Act
      const data = await getUserGrowthData(3);

      // Assert
      data.forEach((monthData) => {
        expect(monthData.totalUsers).toBeGreaterThanOrEqual(0);
        expect(monthData.payingMembers).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getSportComparisonData', () => {
    it('should return comparison data for all sports', async () => {
      // Act
      const data = await getSportComparisonData();

      // Assert
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
    });

    it('should include all required fields', async () => {
      // Act
      const data = await getSportComparisonData();

      // Assert
      data.forEach((item) => {
        expect(item).toHaveProperty('sport');
        expect(item).toHaveProperty('payingMembers');
        expect(item).toHaveProperty('revenue');
        expect(item).toHaveProperty('fill');
        expect(typeof item.payingMembers).toBe('number');
        expect(typeof item.revenue).toBe('number');
        expect(typeof item.fill).toBe('string');
      });
    });

    it('should have color fill values', async () => {
      // Act
      const data = await getSportComparisonData();

      // Assert
      data.forEach((item) => {
        // Check hex color format
        expect(item.fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have specific colors for each sport', async () => {
      // Act
      const data = await getSportComparisonData();

      // Assert
      const tennisItem = data.find((d) => d.sport === 'Tennis');
      const pballItem = data.find((d) => d.sport === 'Pickleball');
      const padelItem = data.find((d) => d.sport === 'Padel');

      expect(tennisItem?.fill).toBe('#ABFE4D');
      expect(pballItem?.fill).toBe('#A04DFE');
      expect(padelItem?.fill).toBe('#4DABFE');
    });
  });

  describe('getAllDashboardStats', () => {
    it('should return all dashboard statistics in one call', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('kpi');
      expect(stats).toHaveProperty('sportMetrics');
      expect(stats).toHaveProperty('matchActivity');
      expect(stats).toHaveProperty('userGrowth');
      expect(stats).toHaveProperty('sportComparison');
    });

    it('should return KPI stats', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(stats.kpi).toBeDefined();
      expect(typeof stats.kpi.totalUsers).toBe('number');
      expect(typeof stats.kpi.leagueParticipants).toBe('number');
    });

    it('should return sport metrics array', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(Array.isArray(stats.sportMetrics)).toBe(true);
      expect(stats.sportMetrics.length).toBe(3);
    });

    it('should return match activity array with 12 weeks', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(Array.isArray(stats.matchActivity)).toBe(true);
      expect(stats.matchActivity.length).toBe(12);
    });

    it('should return user growth array with 6 months', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(Array.isArray(stats.userGrowth)).toBe(true);
      expect(stats.userGrowth.length).toBe(6);
    });

    it('should return sport comparison array', async () => {
      // Act
      const stats = await getAllDashboardStats();

      // Assert
      expect(Array.isArray(stats.sportComparison)).toBe(true);
      expect(stats.sportComparison.length).toBe(3);
    });
  });
});
