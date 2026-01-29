/**
 * AdminPlayerService Integration Tests
 *
 * Tests for admin player management: banning, unbanning, status changes, and data updates.
 *
 * Note: Some tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so players created via prismaTest are not visible to the service.
 * See tests/TODO-skipped-tests.md for details on fixing with dependency injection.
 */

import { prismaTest } from '../../../setup/prismaTestClient';
import { createTestUser, createTestAdmin } from '../../../helpers/factories';
import { UserStatus, StatusChangeReason, AdminActionType } from '@prisma/client';

// Mock the logger
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the admin log service
jest.mock('../../../../src/services/admin/adminLogService', () => ({
  logPlayerAction: jest.fn().mockResolvedValue(null),
}));

// Import after mocking
import {
  banPlayer,
  unbanPlayer,
  deletePlayer,
  updatePlayerStatus,
  getPlayersByStatus,
  adminUpdatePlayer,
} from '../../../../src/services/admin/adminPlayerService';

describe('AdminPlayerService', () => {
  describe('banPlayer', () => {
    it('should throw error for non-existent player', async () => {
      // Act & Assert
      await expect(
        banPlayer({
          playerId: 'non-existent-player',
          adminId: 'some-admin-id',
          reason: StatusChangeReason.POLICY_VIOLATION,
          notes: 'Test ban',
        })
      ).rejects.toThrow('Player not found');
    });
  });

  describe('unbanPlayer', () => {
    it('should throw error for non-existent player', async () => {
      // Act & Assert
      await expect(
        unbanPlayer({
          playerId: 'non-existent-player',
          adminId: 'some-admin-id',
        })
      ).rejects.toThrow('Player not found');
    });
  });

  describe('deletePlayer', () => {
    it('should throw error for non-existent player', async () => {
      // Act & Assert
      await expect(
        deletePlayer({
          playerId: 'non-existent-player',
          adminId: 'some-admin-id',
          reason: StatusChangeReason.ACCOUNT_TERMINATED,
        })
      ).rejects.toThrow('Player not found');
    });
  });

  describe('updatePlayerStatus', () => {
    it('should throw error for non-existent player', async () => {
      // Act & Assert
      await expect(
        updatePlayerStatus({
          playerId: 'non-existent-player',
          adminId: 'some-admin-id',
          newStatus: UserStatus.INACTIVE,
          reason: StatusChangeReason.INACTIVITY,
        })
      ).rejects.toThrow('Player not found');
    });
  });

  describe('getPlayersByStatus', () => {
    it('should return paginated players with default options', async () => {
      // Act
      const result = await getPlayersByStatus();

      // Assert
      expect(result).toBeDefined();
      expect(result.players).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should return empty list when no players match status', async () => {
      // Act - Search for BANNED players (none exist in default DB state)
      const result = await getPlayersByStatus(UserStatus.BANNED);

      // Assert
      expect(result.players).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should respect pagination parameters', async () => {
      // Act
      const result = await getPlayersByStatus(undefined, {
        page: 2,
        limit: 5,
      });

      // Assert
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
    });

    it('should filter by ACTIVE status', async () => {
      // Act
      const result = await getPlayersByStatus(UserStatus.ACTIVE);

      // Assert
      expect(result).toBeDefined();
      expect(result.players).toBeDefined();
      // All returned players should be ACTIVE
      result.players.forEach((player: any) => {
        expect(player.status).toBe(UserStatus.ACTIVE);
      });
    });
  });

  describe('adminUpdatePlayer', () => {
    it('should throw error for non-existent player', async () => {
      // Act & Assert
      await expect(
        adminUpdatePlayer({
          playerId: 'non-existent-player',
          adminId: 'some-admin-id',
          name: 'Updated Name',
        })
      ).rejects.toThrow('Player not found');
    });
  });
});
