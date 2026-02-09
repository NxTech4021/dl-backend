/**
 * Admin Inactivity Service Tests
 *
 * Tests for admin inactivity threshold management.
 * Focuses on:
 * - getEffectiveThreshold() with no settings in DB (returns defaults)
 * - getAllInactivitySettings() with empty DB (returns empty array)
 * - setInactivitySettings() validation errors (pure validation logic)
 * - deleteInactivitySettings() with non-existent ID (error handling)
 *
 * Note: These tests work because:
 * - Default/empty DB queries return predictable results via global prisma
 * - Validation checks throw before any DB write
 * - Non-existent ID lookups return null and throw errors
 */

import { prismaTest } from '../../../setup/prismaTestClient';

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
  getEffectiveThreshold,
  getAllInactivitySettings,
  setInactivitySettings,
  deleteInactivitySettings,
  InactivitySettingsInput,
} from '../../../../src/services/admin/adminInactivityService';

describe('AdminInactivityService', () => {
  // ============================================================================
  // getEffectiveThreshold - Returns defaults when no settings exist
  // ============================================================================
  describe('getEffectiveThreshold', () => {
    it('should return default thresholds when no settings exist', async () => {
      // Act: no seasonId => no DB settings found => falls to env/defaults
      const result = await getEffectiveThreshold();

      // Assert: defaults are 30 inactivity, 21 warning (or env vars)
      expect(result).toBeDefined();
      expect(typeof result.inactivityDays).toBe('number');
      expect(typeof result.warningDays).toBe('number');
      expect(result.inactivityDays).toBeGreaterThan(0);
      expect(result.warningDays).toBeGreaterThan(0);
    });

    it('should return defaults for non-existent seasonId', async () => {
      const result = await getEffectiveThreshold('non-existent-season-id');

      expect(result).toBeDefined();
      expect(result.inactivityDays).toBeGreaterThan(0);
      expect(result.warningDays).toBeGreaterThan(0);
    });

    it('should have warning days less than inactivity days by default', async () => {
      const result = await getEffectiveThreshold();

      expect(result.warningDays).toBeLessThan(result.inactivityDays);
    });

    it('should return consistent results across multiple calls', async () => {
      const result1 = await getEffectiveThreshold();
      const result2 = await getEffectiveThreshold();

      expect(result1.inactivityDays).toBe(result2.inactivityDays);
      expect(result1.warningDays).toBe(result2.warningDays);
    });
  });

  // ============================================================================
  // getAllInactivitySettings - Empty DB returns empty array
  // ============================================================================
  describe('getAllInactivitySettings', () => {
    it('should return an array', async () => {
      const result = await getAllInactivitySettings();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return results without throwing', async () => {
      await expect(getAllInactivitySettings()).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // setInactivitySettings - Validation (throws BEFORE any DB write)
  // ============================================================================
  describe('setInactivitySettings', () => {
    describe('inactivityThresholdDays validation', () => {
      it('should throw when inactivityThresholdDays is 0', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 0,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold must be at least 1 day'
        );
      });

      it('should throw when inactivityThresholdDays is negative', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: -5,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold must be at least 1 day'
        );
      });

      it('should throw when inactivityThresholdDays exceeds 365', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 366,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold cannot exceed 365 days'
        );
      });

      it('should throw when inactivityThresholdDays is 1000', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 1000,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold cannot exceed 365 days'
        );
      });
    });

    describe('warningThresholdDays validation', () => {
      it('should throw when warningThresholdDays is 0', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 30,
          warningThresholdDays: 0,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Warning threshold must be at least 1 day'
        );
      });

      it('should throw when warningThresholdDays is negative', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 30,
          warningThresholdDays: -1,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Warning threshold must be at least 1 day'
        );
      });

      it('should throw when warningThresholdDays equals inactivityThresholdDays', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 30,
          warningThresholdDays: 30,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Warning threshold must be less than inactivity threshold'
        );
      });

      it('should throw when warningThresholdDays exceeds inactivityThresholdDays', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 20,
          warningThresholdDays: 25,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Warning threshold must be less than inactivity threshold'
        );
      });
    });

    describe('reminderDaysBefore validation', () => {
      it('should throw when reminderDaysBefore is 0', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 30,
          reminderDaysBefore: 0,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Reminder days must be at least 1'
        );
      });

      it('should throw when reminderDaysBefore is negative', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 30,
          reminderDaysBefore: -3,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Reminder days must be at least 1'
        );
      });
    });

    describe('Combined validation edge cases', () => {
      it('should throw for threshold of 0 even with valid warning', async () => {
        // inactivityThresholdDays validation runs first
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 0,
          warningThresholdDays: -1,
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold must be at least 1 day'
        );
      });

      it('should throw for threshold > 365 before checking warning', async () => {
        const input: InactivitySettingsInput = {
          inactivityThresholdDays: 500,
          warningThresholdDays: 600, // Also invalid, but threshold check runs first
          adminId: 'test-admin-id',
        };

        await expect(setInactivitySettings(input)).rejects.toThrow(
          'Inactivity threshold cannot exceed 365 days'
        );
      });
    });
  });

  // ============================================================================
  // deleteInactivitySettings - Error handling for non-existent ID
  // ============================================================================
  describe('deleteInactivitySettings', () => {
    it('should throw "Settings not found" for non-existent settings ID', async () => {
      await expect(
        deleteInactivitySettings('non-existent-settings-id', 'admin-id')
      ).rejects.toThrow('Settings not found');
    });

    it('should throw "Settings not found" for empty string ID', async () => {
      await expect(
        deleteInactivitySettings('', 'admin-id')
      ).rejects.toThrow('Settings not found');
    });

    it('should throw "Settings not found" for random UUID', async () => {
      await expect(
        deleteInactivitySettings('550e8400-e29b-41d4-a716-446655440000', 'admin-id')
      ).rejects.toThrow('Settings not found');
    });
  });
});
