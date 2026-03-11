/**
 * FriendshipController Unit Tests
 *
 * Tests for F-1 (forward specific error messages) and F-2 (notification crash isolation).
 * Uses mocks to isolate controller logic from service/DB dependencies.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../../src/middlewares/auth.middleware';

// Mock dependencies BEFORE importing controller
jest.mock('../../../src/services/friendshipService');
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../../../src/services/notificationService', () => ({
  notificationService: {
    createNotification: jest.fn(),
  },
}));
jest.mock('../../../src/helpers/notifications/socialCommunityNotifications', () => ({
  socialCommunityNotifications: {
    friendRequest: jest.fn().mockReturnValue({
      title: 'Friend Request',
      body: 'Someone sent you a friend request',
      metadata: {},
    }),
  },
}));

import { sendFriendRequestHandler } from '../../../src/controllers/friendshipController';
import * as friendshipService from '../../../src/services/friendshipService';
import { prisma } from '../../../src/lib/prisma';
import { notificationService } from '../../../src/services/notificationService';

// Helper: create mock request
function mockRequest(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-123' },
    body: { recipientId: 'recipient-456' },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

// Helper: create mock response with spy methods
function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('sendFriendRequestHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // F-2: Notification failure should NOT crash the request
  // ==========================================================================
  describe('F-2: notification failure isolation', () => {
    it('should return 201 success even when notification creation fails', async () => {
      // Arrange: friendship creates successfully
      const mockFriendship = { id: 'friendship-1', requesterId: 'user-123', recipientId: 'recipient-456', status: 'PENDING' };
      (friendshipService.sendFriendRequest as jest.Mock).mockResolvedValue(mockFriendship);

      // Arrange: sender lookup succeeds
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ name: 'TestUser', username: 'testuser' });

      // Arrange: notification THROWS
      (notificationService.createNotification as jest.Mock).mockRejectedValue(new Error('Push service down'));

      const req = mockRequest();
      const res = mockResponse();

      // Act
      await sendFriendRequestHandler(req, res);

      // Assert: should return 201 with friendship data, NOT 500
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockFriendship,
        })
      );
    });

    it('should return 201 success when sender lookup fails (notification skipped)', async () => {
      // Arrange: friendship creates successfully
      const mockFriendship = { id: 'friendship-1', requesterId: 'user-123', recipientId: 'recipient-456', status: 'PENDING' };
      (friendshipService.sendFriendRequest as jest.Mock).mockResolvedValue(mockFriendship);

      // Arrange: sender lookup THROWS
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

      const req = mockRequest();
      const res = mockResponse();

      // Act
      await sendFriendRequestHandler(req, res);

      // Assert: should still return 201, not 500
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockFriendship,
        })
      );
    });
  });

  // ==========================================================================
  // F-1: Forward specific service error messages with correct HTTP status
  // ==========================================================================
  describe('F-1: forward specific error messages', () => {
    const clientErrors = [
      { message: 'Cannot send friend request to yourself', expectedStatus: 400 },
      { message: 'User not found', expectedStatus: 400 },
      { message: 'Friend request already pending', expectedStatus: 400 },
      { message: 'Already friends', expectedStatus: 400 },
      { message: 'Cannot send friend request', expectedStatus: 400 },
    ];

    clientErrors.forEach(({ message, expectedStatus }) => {
      it(`should return ${expectedStatus} with message "${message}"`, async () => {
        // Arrange: service throws specific error
        (friendshipService.sendFriendRequest as jest.Mock).mockRejectedValue(new Error(message));

        const req = mockRequest();
        const res = mockResponse();

        // Act
        await sendFriendRequestHandler(req, res);

        // Assert: should forward the specific message with correct status
        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message,
          })
        );
      });
    });

    it('should return 500 for unknown/unexpected errors', async () => {
      // Arrange: service throws unexpected error
      (friendshipService.sendFriendRequest as jest.Mock).mockRejectedValue(new Error('Prisma connection timeout'));

      const req = mockRequest();
      const res = mockResponse();

      // Act
      await sendFriendRequestHandler(req, res);

      // Assert: unknown errors should remain 500 but still forward the message
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ==========================================================================
  // Happy path (sanity check)
  // ==========================================================================
  describe('happy path', () => {
    it('should return 201 with friendship data on success', async () => {
      const mockFriendship = { id: 'friendship-1', requesterId: 'user-123', recipientId: 'recipient-456', status: 'PENDING' };
      (friendshipService.sendFriendRequest as jest.Mock).mockResolvedValue(mockFriendship);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ name: 'TestUser', username: 'testuser' });
      (notificationService.createNotification as jest.Mock).mockResolvedValue(undefined);

      const req = mockRequest();
      const res = mockResponse();

      await sendFriendRequestHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockFriendship,
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();

      await sendFriendRequestHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when recipientId is missing', async () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await sendFriendRequestHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
