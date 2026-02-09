/**
 * Friendship Service Tests
 *
 * Tests for friend request sending, acceptance, rejection, removal,
 * and friendship query operations.
 *
 * IMPORTANT: friendshipService uses the global `prisma` client, NOT dependency injection.
 * Data created via prismaTest is NOT visible to the service (transaction isolation).
 * Therefore these tests focus on:
 *   - Validation / error handling (self-friending, non-existent users/IDs)
 *   - Empty result handling (non-existent user queries)
 *   - Parameter edge cases
 */

import * as friendshipService from '../../../src/services/friendshipService';

// Non-existent IDs that will never match real database rows
const NON_EXISTENT_ID_1 = 'non-existent-user-id-aaa111';
const NON_EXISTENT_ID_2 = 'non-existent-user-id-bbb222';
const NON_EXISTENT_FRIENDSHIP_ID = 'non-existent-friendship-id-ccc333';

describe('FriendshipService', () => {
  // ============================================================================
  // SEND FRIEND REQUEST
  // ============================================================================
  describe('sendFriendRequest', () => {
    it('should throw error when requesting to friend yourself', async () => {
      // Arrange
      const sameId = 'same-user-id-12345';

      // Act & Assert
      await expect(
        friendshipService.sendFriendRequest({
          requesterId: sameId,
          recipientId: sameId,
        })
      ).rejects.toThrow('Cannot send friend request to yourself');
    });

    it('should throw error when recipient does not exist', async () => {
      // Arrange - use two non-existent IDs (different from each other to pass self-check)
      // The service first validates self-friending, then looks up the recipient
      // A non-existent recipient should throw "User not found"

      // Act & Assert
      await expect(
        friendshipService.sendFriendRequest({
          requesterId: NON_EXISTENT_ID_1,
          recipientId: NON_EXISTENT_ID_2,
        })
      ).rejects.toThrow('User not found');
    });
  });

  // ============================================================================
  // ACCEPT FRIEND REQUEST
  // ============================================================================
  describe('acceptFriendRequest', () => {
    it('should throw error for non-existent friendship ID', async () => {
      // Act & Assert
      await expect(
        friendshipService.acceptFriendRequest(NON_EXISTENT_FRIENDSHIP_ID, NON_EXISTENT_ID_1)
      ).rejects.toThrow('Friend request not found');
    });
  });

  // ============================================================================
  // REJECT FRIEND REQUEST
  // ============================================================================
  describe('rejectFriendRequest', () => {
    it('should throw error for non-existent friendship ID', async () => {
      // Act & Assert
      await expect(
        friendshipService.rejectFriendRequest(NON_EXISTENT_FRIENDSHIP_ID, NON_EXISTENT_ID_1)
      ).rejects.toThrow('Friend request not found');
    });
  });

  // ============================================================================
  // REMOVE FRIEND
  // ============================================================================
  describe('removeFriend', () => {
    it('should throw error for non-existent friendship ID', async () => {
      // Act & Assert
      await expect(
        friendshipService.removeFriend(NON_EXISTENT_FRIENDSHIP_ID, NON_EXISTENT_ID_1)
      ).rejects.toThrow('Friendship not found');
    });
  });

  // ============================================================================
  // GET FRIENDS
  // ============================================================================
  describe('getFriends', () => {
    it('should return empty array for non-existent user', async () => {
      // Act
      const result = await friendshipService.getFriends(NON_EXISTENT_ID_1);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return an array (not null or undefined)', async () => {
      // Act
      const result = await friendshipService.getFriends(NON_EXISTENT_ID_1);

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // GET FRIEND REQUESTS
  // ============================================================================
  describe('getFriendRequests', () => {
    it('should return empty sent and received arrays for non-existent user', async () => {
      // Act
      const result = await friendshipService.getFriendRequests(NON_EXISTENT_ID_1);

      // Assert
      expect(result).toEqual({
        sent: [],
        received: [],
      });
    });

    it('should return object with sent and received properties', async () => {
      // Act
      const result = await friendshipService.getFriendRequests(NON_EXISTENT_ID_1);

      // Assert
      expect(result).toHaveProperty('sent');
      expect(result).toHaveProperty('received');
      expect(Array.isArray(result.sent)).toBe(true);
      expect(Array.isArray(result.received)).toBe(true);
    });
  });

  // ============================================================================
  // ARE FRIENDS
  // ============================================================================
  describe('areFriends', () => {
    it('should return false for non-existent users', async () => {
      // Act
      const result = await friendshipService.areFriends(NON_EXISTENT_ID_1, NON_EXISTENT_ID_2);

      // Assert
      expect(result).toBe(false);
    });

    it('should return a boolean value', async () => {
      // Act
      const result = await friendshipService.areFriends(NON_EXISTENT_ID_1, NON_EXISTENT_ID_2);

      // Assert
      expect(typeof result).toBe('boolean');
    });
  });
});
