/**
 * MatchService Integration Tests
 *
 * Tests for match creation hooks and feed post creation.
 */

import { prismaTest } from '../../setup/prismaTestClient';
import {
  createTestUser,
  createTestDivision,
  createCompletedMatch,
  createTestMatch,
} from '../../helpers/factories';

// Mock inactivity service
jest.mock('../../../src/services/inactivityService', () => ({
  getInactivityService: () => ({
    reactivateUser: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock notification service
jest.mock('../../../src/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue([]),
  })),
  notificationService: {
    createNotification: jest.fn().mockResolvedValue([]),
  },
}));

// Import after mocking
import { handlePostMatchCreation, createMatchFeedPost } from '../../../src/services/matchService';

describe('MatchService', () => {
  describe('handlePostMatchCreation', () => {
    it('should handle match creation hook without errors', async () => {
      // Arrange
      const creator = await createTestUser();
      const division = await createTestDivision();

      const match = await prismaTest.match.create({
        data: {
          createdById: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'SCHEDULED',
          matchType: 'SINGLES',
          isFriendly: false,
          sport: 'PADEL',
          participants: {
            create: {
              userId: creator.id,
              team: 'team1',
              role: 'CREATOR',
              invitationStatus: 'ACCEPTED',
            },
          },
        },
      });

      // Act & Assert - Should not throw
      await expect(handlePostMatchCreation(match.id)).resolves.not.toThrow();
    });

    it('should handle non-existent match gracefully', async () => {
      // Act & Assert - Should not throw even for invalid match ID
      await expect(handlePostMatchCreation('non-existent-match-id')).resolves.not.toThrow();
    });

    it('should handle match with multiple participants', async () => {
      // Arrange
      const creator = await createTestUser();
      const opponent = await createTestUser();
      const division = await createTestDivision();

      const match = await prismaTest.match.create({
        data: {
          createdById: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'SCHEDULED',
          matchType: 'SINGLES',
          isFriendly: false,
          sport: 'PADEL',
          participants: {
            create: [
              {
                userId: creator.id,
                team: 'team1',
                role: 'CREATOR',
                invitationStatus: 'ACCEPTED',
              },
              {
                userId: opponent.id,
                team: 'team2',
                role: 'OPPONENT',
                invitationStatus: 'ACCEPTED',
              },
            ],
          },
        },
      });

      // Act & Assert
      await expect(handlePostMatchCreation(match.id)).resolves.not.toThrow();
    });
  });

  describe('createMatchFeedPost', () => {
    it('should return null for non-existent match', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await createMatchFeedPost('non-existent-match', user.id);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-completed match', async () => {
      // Arrange
      const creator = await createTestUser();
      const division = await createTestDivision();

      const match = await prismaTest.match.create({
        data: {
          createdById: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'SCHEDULED', // Not COMPLETED
          matchType: 'SINGLES',
          isFriendly: false,
          sport: 'PADEL',
          participants: {
            create: {
              userId: creator.id,
              team: 'team1',
              role: 'CREATOR',
              invitationStatus: 'ACCEPTED',
            },
          },
        },
      });

      // Act
      const result = await createMatchFeedPost(match.id, creator.id);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when author is not a participant', async () => {
      // Arrange
      const creator = await createTestUser();
      const nonParticipant = await createTestUser();
      const division = await createTestDivision();

      const match = await prismaTest.match.create({
        data: {
          createdById: creator.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          matchDate: new Date(),
          status: 'COMPLETED',
          matchType: 'SINGLES',
          isFriendly: false,
          sport: 'PADEL',
          participants: {
            create: {
              userId: creator.id,
              team: 'team1',
              role: 'CREATOR',
              invitationStatus: 'ACCEPTED',
            },
          },
        },
      });

      // Act
      const result = await createMatchFeedPost(match.id, nonParticipant.id);

      // Assert
      expect(result).toBeNull();
    });

    it('should create feed post for completed match', async () => {
      // Arrange - Use factory for completed match
      const { match } = await createCompletedMatch();

      // Act
      const result = await createMatchFeedPost(match.id, match.createdById!);

      // Assert
      expect(result).not.toBeNull();

      // Verify feed post exists
      const feedPost = await prismaTest.feedPost.findUnique({
        where: { id: result! },
      });
      expect(feedPost).toBeDefined();
      expect(feedPost!.authorId).toBe(match.createdById);
      expect(feedPost!.matchId).toBe(match.id);
    });

    it('should return existing feed post ID for duplicate requests', async () => {
      // Arrange - Use factory for completed match
      const { match } = await createCompletedMatch();

      // Create first feed post
      const firstResult = await createMatchFeedPost(match.id, match.createdById!);
      expect(firstResult).not.toBeNull();

      // Act - Try to create another one
      const secondResult = await createMatchFeedPost(match.id, match.createdById!);

      // Assert - Should return the same ID (existing post)
      expect(secondResult).toBe(firstResult);
    });

    it('should set gameType based on leagueId presence', async () => {
      // Arrange - Use factory for completed match (has leagueId)
      const { match } = await createCompletedMatch();

      // Act
      const result = await createMatchFeedPost(match.id, match.createdById!);

      // Assert
      expect(result).not.toBeNull();

      const feedPost = await prismaTest.feedPost.findUnique({
        where: { id: result! },
      });
      // Note: gameType is 'league' when match has leagueId, 'friendly' otherwise
      // Factory creates matches with leagueId, so gameType should be 'league'
      expect(feedPost!.gameType).toBe('league');
    });
  });
});
