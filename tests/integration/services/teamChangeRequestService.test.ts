/**
 * TeamChangeRequestService Integration Tests
 *
 * Tests for team change request lifecycle: creation, processing, cancellation.
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser, createTestDivision, createTestAdmin } from '../../helpers/factories';

// Mock notification service
jest.mock('../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue([]),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/services/notification/adminNotificationService', () => ({
  notifyAdminsTeamChange: jest.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import {
  createTeamChangeRequest,
  processTeamChangeRequest,
  getTeamChangeRequests,
  getTeamChangeRequestById,
  cancelTeamChangeRequest,
  getPendingTeamChangeRequestsCount,
} from '../../../src/services/teamChangeRequestService';

describe('TeamChangeRequestService', () => {
  describe('createTeamChangeRequest', () => {
    it('should create a team change request successfully', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      // Act
      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
        reason: 'Want to play in a different skill level',
      });

      // Assert
      expect(request).toBeDefined();
      expect(request.userId).toBe(user.id);
      expect(request.currentDivisionId).toBe(division1.id);
      expect(request.requestedDivisionId).toBe(division2.id);
      expect(request.status).toBe('PENDING');
      expect(request.reason).toBe('Want to play in a different skill level');
    });

    it('should throw error if current division does not exist', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act & Assert
      await expect(
        createTeamChangeRequest({
          userId: user.id,
          currentDivisionId: 'non-existent-division',
          requestedDivisionId: division.id,
          seasonId: division.seasonId!,
        })
      ).rejects.toThrow('Current division not found');
    });

    it('should throw error if requested division does not exist', async () => {
      // Arrange
      const user = await createTestUser();
      const division = await createTestDivision();

      // Act & Assert
      await expect(
        createTeamChangeRequest({
          userId: user.id,
          currentDivisionId: division.id,
          requestedDivisionId: 'non-existent-division',
          seasonId: division.seasonId!,
        })
      ).rejects.toThrow('Requested division not found');
    });

    it('should throw error if divisions are in different seasons', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division Season 1' });
      const division2 = await createTestDivision({ name: 'Division Season 2' });

      // Act & Assert
      await expect(
        createTeamChangeRequest({
          userId: user.id,
          currentDivisionId: division1.id,
          requestedDivisionId: division2.id,
          seasonId: division1.seasonId!,
        })
      ).rejects.toThrow('Cannot request transfer between divisions in different seasons');
    });

    it('should throw error if user already has pending request', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      // Create first request
      await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act & Assert - Try to create another
      await expect(
        createTeamChangeRequest({
          userId: user.id,
          currentDivisionId: division1.id,
          requestedDivisionId: division2.id,
          seasonId: division1.seasonId!,
        })
      ).rejects.toThrow('You already have a pending team change request for this season');
    });
  });

  describe('processTeamChangeRequest', () => {
    it('should approve team change request successfully', async () => {
      // Arrange
      const user = await createTestUser();
      const { admin } = await createTestAdmin();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      // Create season membership for the user
      await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division1.seasonId!,
          divisionId: division1.id,
          status: 'ACTIVE',
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const result = await processTeamChangeRequest({
        requestId: request.id,
        status: 'APPROVED',
        adminId: admin.id,
        adminNotes: 'Request approved',
      });

      // Assert
      expect(result.status).toBe('APPROVED');
      expect(result.reviewedByAdminId).toBe(admin.id);
      expect(result.adminNotes).toBe('Request approved');
      expect(result.reviewedAt).toBeDefined();
    });

    it('should deny team change request successfully', async () => {
      // Arrange
      const user = await createTestUser();
      const { admin } = await createTestAdmin();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const result = await processTeamChangeRequest({
        requestId: request.id,
        status: 'DENIED',
        adminId: admin.id,
        adminNotes: 'Request denied due to skill mismatch',
      });

      // Assert
      expect(result.status).toBe('DENIED');
      expect(result.adminNotes).toBe('Request denied due to skill mismatch');
    });

    it('should throw error if request is not found', async () => {
      // Arrange
      const { admin } = await createTestAdmin();

      // Act & Assert
      await expect(
        processTeamChangeRequest({
          requestId: 'non-existent-request',
          status: 'APPROVED',
          adminId: admin.id,
        })
      ).rejects.toThrow('Team change request not found');
    });

    it('should throw error if request is already processed', async () => {
      // Arrange
      const user = await createTestUser();
      const { admin } = await createTestAdmin();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Process once
      await processTeamChangeRequest({
        requestId: request.id,
        status: 'DENIED',
        adminId: admin.id,
      });

      // Act & Assert - Try to process again
      await expect(
        processTeamChangeRequest({
          requestId: request.id,
          status: 'APPROVED',
          adminId: admin.id,
        })
      ).rejects.toThrow('Request has already been denied');
    });

    it('should throw error if admin is not found', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act & Assert
      await expect(
        processTeamChangeRequest({
          requestId: request.id,
          status: 'APPROVED',
          adminId: 'non-existent-admin',
        })
      ).rejects.toThrow('Admin not found');
    });
  });

  describe('getTeamChangeRequests', () => {
    it('should get all team change requests', async () => {
      // Arrange
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      await createTeamChangeRequest({
        userId: user1.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      await createTeamChangeRequest({
        userId: user2.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const requests = await getTeamChangeRequests();

      // Assert
      expect(requests.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by season', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const requests = await getTeamChangeRequests({
        seasonId: division1.seasonId!,
      });

      // Assert
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests.every((r) => r.seasonId === division1.seasonId)).toBe(true);
    });

    it('should filter by status', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const requests = await getTeamChangeRequests({
        status: 'PENDING',
      });

      // Assert
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests.every((r) => r.status === 'PENDING')).toBe(true);
    });

    it('should filter by user', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const requests = await getTeamChangeRequests({
        userId: user.id,
      });

      // Assert
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests.every((r) => r.userId === user.id)).toBe(true);
    });
  });

  describe('getTeamChangeRequestById', () => {
    it('should get a team change request by ID', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const created = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const request = await getTeamChangeRequestById(created.id);

      // Assert
      expect(request).toBeDefined();
      expect(request!.id).toBe(created.id);
      expect(request!.userId).toBe(user.id);
    });

    it('should return null for non-existent request', async () => {
      // Act
      const request = await getTeamChangeRequestById('non-existent-id');

      // Assert
      expect(request).toBeNull();
    });
  });

  describe('cancelTeamChangeRequest', () => {
    it('should allow user to cancel their own request', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const result = await cancelTeamChangeRequest(request.id, user.id, false);

      // Assert
      expect(result.status).toBe('CANCELLED');
    });

    it('should allow admin to cancel any request', async () => {
      // Arrange
      const user = await createTestUser();
      const { user: adminUser } = await createTestAdmin();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const result = await cancelTeamChangeRequest(request.id, adminUser.id, true);

      // Assert
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if non-owner tries to cancel', async () => {
      // Arrange
      const user = await createTestUser();
      const otherUser = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act & Assert
      await expect(cancelTeamChangeRequest(request.id, otherUser.id, false)).rejects.toThrow(
        'You can only cancel your own requests'
      );
    });

    it('should throw error when cancelling already processed request', async () => {
      // Arrange
      const user = await createTestUser();
      const { admin } = await createTestAdmin();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      const request = await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Process the request first
      await processTeamChangeRequest({
        requestId: request.id,
        status: 'DENIED',
        adminId: admin.id,
      });

      // Act & Assert
      await expect(cancelTeamChangeRequest(request.id, user.id, false)).rejects.toThrow(
        'Cannot cancel a request that has been denied'
      );
    });

    it('should throw error if request not found', async () => {
      // Arrange
      const user = await createTestUser();

      // Act & Assert
      await expect(cancelTeamChangeRequest('non-existent', user.id, false)).rejects.toThrow(
        'Team change request not found'
      );
    });
  });

  describe('getPendingTeamChangeRequestsCount', () => {
    it('should return count of pending requests', async () => {
      // Arrange
      const user = await createTestUser();
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: division1.gameType,
        },
      });

      // Get initial count
      const initialCount = await getPendingTeamChangeRequestsCount();

      await createTeamChangeRequest({
        userId: user.id,
        currentDivisionId: division1.id,
        requestedDivisionId: division2.id,
        seasonId: division1.seasonId!,
      });

      // Act
      const count = await getPendingTeamChangeRequestsCount();

      // Assert
      expect(count).toBe(initialCount + 1);
    });
  });
});
