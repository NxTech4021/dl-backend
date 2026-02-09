/**
 * Feed Service Tests
 *
 * Tests for feed post retrieval, likes, comments, and deletion.
 *
 * IMPORTANT: feedService uses the global `prisma` client, NOT dependency injection.
 * Data created via prismaTest is NOT visible to the service (transaction isolation).
 * Therefore these tests focus on:
 *   - Empty/null result handling (non-existent posts, users)
 *   - Error handling (non-existent IDs)
 *   - Default filter behavior with no data
 *   - Parameter edge cases
 */

import * as feedService from '../../../src/services/feedService';

// Non-existent IDs that will never match real database rows
const NON_EXISTENT_POST_ID = 'non-existent-post-id-aaa111';
const NON_EXISTENT_USER_ID = 'non-existent-user-id-bbb222';

describe('FeedService', () => {
  // ============================================================================
  // GET FEED POSTS
  // ============================================================================
  describe('getFeedPosts', () => {
    it('should return posts structure with nextCursor when no posts exist', async () => {
      // Act - use a very specific sport filter unlikely to match anything
      const result = await feedService.getFeedPosts({
        sport: 'NONEXISTENT_SPORT_XYZ',
        limit: 10,
      });

      // Assert
      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('nextCursor');
      expect(Array.isArray(result.posts)).toBe(true);
      expect(result.nextCursor).toBeNull();
    });

    it('should respect limit parameter', async () => {
      // Act
      const result = await feedService.getFeedPosts({
        sport: 'NONEXISTENT_SPORT_XYZ',
        limit: 5,
      });

      // Assert
      expect(result.posts.length).toBeLessThanOrEqual(5);
    });

    it('should default to filter "all" when no filter specified', async () => {
      // Act - no filter parameter provided; should not throw
      const result = await feedService.getFeedPosts({
        sport: 'NONEXISTENT_SPORT_XYZ',
      });

      // Assert
      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('nextCursor');
    });

    it('should handle friends filter with non-existent user', async () => {
      // Act - friends filter with a user who has no friends
      const result = await feedService.getFeedPosts(
        { filter: 'friends', sport: 'NONEXISTENT_SPORT_XYZ' },
        NON_EXISTENT_USER_ID
      );

      // Assert - should return empty posts (user has no friends)
      expect(result.posts).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle recommended filter gracefully', async () => {
      // Act
      const result = await feedService.getFeedPosts({
        filter: 'recommended',
        sport: 'NONEXISTENT_SPORT_XYZ',
      });

      // Assert
      expect(result).toHaveProperty('posts');
      expect(Array.isArray(result.posts)).toBe(true);
    });
  });

  // ============================================================================
  // GET POST BY ID
  // ============================================================================
  describe('getPostById', () => {
    it('should return null for non-existent post ID', async () => {
      // Act
      const result = await feedService.getPostById(NON_EXISTENT_POST_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-existent post ID even with currentUserId', async () => {
      // Act
      const result = await feedService.getPostById(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // DELETE POST
  // ============================================================================
  describe('deletePost', () => {
    it('should throw error for non-existent post ID', async () => {
      // Act & Assert
      await expect(
        feedService.deletePost(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID)
      ).rejects.toThrow('Post not found or you are not the author');
    });
  });

  // ============================================================================
  // TOGGLE LIKE
  // ============================================================================
  describe('toggleLike', () => {
    it('should throw error for non-existent post', async () => {
      // Act & Assert
      await expect(
        feedService.toggleLike(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID)
      ).rejects.toThrow('Post not found');
    });
  });

  // ============================================================================
  // ADD COMMENT
  // ============================================================================
  describe('addComment', () => {
    it('should throw error when post does not exist (empty text)', async () => {
      // Note: The service checks post existence BEFORE text validation.
      // With a non-existent post ID, "Post not found" fires first regardless of text content.

      // Act & Assert
      await expect(
        feedService.addComment(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID, '')
      ).rejects.toThrow('Post not found');
    });

    it('should throw error when post does not exist (valid text)', async () => {
      // Act & Assert
      await expect(
        feedService.addComment(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID, 'Hello world')
      ).rejects.toThrow('Post not found');
    });

    it('should throw error when post does not exist (text exceeding max length)', async () => {
      // Note: Post existence check happens before text validation
      const longText = 'a'.repeat(201);

      // Act & Assert
      await expect(
        feedService.addComment(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID, longText)
      ).rejects.toThrow('Post not found');
    });
  });

  // ============================================================================
  // GET POST COMMENTS
  // ============================================================================
  describe('getPostComments', () => {
    it('should return empty array for non-existent post', async () => {
      // Act
      const result = await feedService.getPostComments(NON_EXISTENT_POST_ID);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array with custom limit and offset', async () => {
      // Act
      const result = await feedService.getPostComments(NON_EXISTENT_POST_ID, 25, 0);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // GET POST LIKERS
  // ============================================================================
  describe('getPostLikers', () => {
    it('should return empty array for non-existent post', async () => {
      // Act
      const result = await feedService.getPostLikers(NON_EXISTENT_POST_ID);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array with custom limit', async () => {
      // Act
      const result = await feedService.getPostLikers(NON_EXISTENT_POST_ID, 10);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // UPDATE POST CAPTION
  // ============================================================================
  describe('updatePostCaption', () => {
    it('should throw error for non-existent post', async () => {
      // Act & Assert
      await expect(
        feedService.updatePostCaption(NON_EXISTENT_POST_ID, NON_EXISTENT_USER_ID, 'New caption')
      ).rejects.toThrow('Post not found or you are not the author');
    });
  });

  // ============================================================================
  // DELETE COMMENT
  // ============================================================================
  describe('deleteComment', () => {
    it('should throw error for non-existent comment', async () => {
      // Act & Assert
      await expect(
        feedService.deleteComment('non-existent-comment-id', NON_EXISTENT_USER_ID)
      ).rejects.toThrow('Comment not found or you are not the author');
    });
  });

  // ============================================================================
  // CREATE POST
  // ============================================================================
  describe('createPost', () => {
    it('should throw error for non-existent match', async () => {
      // Act & Assert
      await expect(
        feedService.createPost({
          matchId: 'non-existent-match-id',
          authorId: NON_EXISTENT_USER_ID,
        })
      ).rejects.toThrow('Match not found');
    });
  });
});
