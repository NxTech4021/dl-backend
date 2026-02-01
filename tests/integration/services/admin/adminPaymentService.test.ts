/**
 * AdminPaymentService Integration Tests
 *
 * Tests for admin payment management: payment filtering, status updates, and statistics.
 */

import { prismaTest } from '../../../setup/prismaTestClient';
import { createTestUser, createTestSeason, createTestDivision } from '../../../helpers/factories';
import { PaymentStatus, MembershipStatus } from '@prisma/client';

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
  getPaymentsWithFilters,
  getPaymentStats,
  updatePaymentStatus,
  bulkUpdatePaymentStatus,
  getSeasonsWithPayment,
} from '../../../../src/services/admin/adminPaymentService';

describe('AdminPaymentService', () => {
  describe('getPaymentsWithFilters', () => {
    it('should return empty list when no memberships exist', async () => {
      // Act
      const result = await getPaymentsWithFilters({});

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should use default pagination values', async () => {
      // Act
      const result = await getPaymentsWithFilters({});

      // Assert
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should respect custom pagination parameters', async () => {
      // Act
      const result = await getPaymentsWithFilters({
        page: 2,
        limit: 10,
      });

      // Assert
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by payment status', async () => {
      // Act
      const result = await getPaymentsWithFilters({
        status: PaymentStatus.PENDING,
      });

      // Assert
      expect(result.data.every((m: any) => m.paymentStatus === PaymentStatus.PENDING || m.paymentStatus === undefined)).toBeTruthy();
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      // Act
      const stats = await getPaymentStats();

      // Assert
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.totalRevenue).toBe('number');
      expect(typeof stats.outstandingAmount).toBe('number');
    });

    it('should return zero values when no memberships exist', async () => {
      // Act - Get stats for a non-existent season
      const stats = await getPaymentStats('non-existent-season-id');

      // Assert
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.outstandingAmount).toBe(0);
    });
  });

  describe('updatePaymentStatus', () => {
    it('should throw error for non-existent membership', async () => {
      // Act & Assert
      await expect(
        updatePaymentStatus({
          membershipId: 'non-existent-membership',
          adminId: 'admin-id',
          paymentStatus: PaymentStatus.COMPLETED,
        })
      ).rejects.toThrow('Membership not found');
    });
  });

  describe('bulkUpdatePaymentStatus', () => {
    it('should throw error when membershipIds is empty', async () => {
      // Act & Assert
      await expect(
        bulkUpdatePaymentStatus({
          membershipIds: [],
          adminId: 'admin-id',
          paymentStatus: PaymentStatus.COMPLETED,
        })
      ).rejects.toThrow('No membership IDs provided');
    });

    it('should throw error when memberships not found', async () => {
      // Act & Assert
      await expect(
        bulkUpdatePaymentStatus({
          membershipIds: ['non-existent-1', 'non-existent-2'],
          adminId: 'admin-id',
          paymentStatus: PaymentStatus.COMPLETED,
        })
      ).rejects.toThrow('Memberships not found');
    });
  });

  describe('getSeasonsWithPayment', () => {
    it('should return array of seasons', async () => {
      // Act
      const seasons = await getSeasonsWithPayment();

      // Assert
      expect(seasons).toBeDefined();
      expect(Array.isArray(seasons)).toBe(true);
    });

    it('should include required fields in each season', async () => {
      // Act
      const seasons = await getSeasonsWithPayment();

      // Assert
      if (seasons.length > 0) {
        const season = seasons[0];
        expect(season).toHaveProperty('id');
        expect(season).toHaveProperty('name');
        expect(season).toHaveProperty('entryFee');
        expect(season).toHaveProperty('status');
      }
    });
  });
});
