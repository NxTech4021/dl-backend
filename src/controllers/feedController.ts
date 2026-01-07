import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as feedService from '../services/feedService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { socialCommunityNotifications } from '../helpers/notifications/socialCommunityNotifications';
import { notificationService } from '../services/notificationService';
import { addLikeToGroup } from '../services/notification/likeNotificationGroupingService';

// ============================================
// POST HANDLERS
// ============================================

interface CreatePostBody {
  matchId?: string;
  caption?: string;
}

export const createPostHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { matchId, caption } = req.body as CreatePostBody;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!matchId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Match ID is required'));
    }

    const post = await feedService.createPost({
      matchId,
      authorId: userId,
      ...(caption !== undefined && { caption }),
    });

    return res.status(201).json(new ApiResponse(true, 201, post, 'Post created successfully'));
  } catch (error: unknown) {
    console.error('Error creating post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};

interface GetFeedQuery {
  sport?: string;
  limit?: string;
  cursor?: string;
}

export const getFeedPostsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { sport, limit, cursor } = req.query as GetFeedQuery;

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;

    const filters: feedService.FeedFilters = { limit: parsedLimit };
    if (sport) filters.sport = sport;
    if (cursor) filters.cursor = cursor;

    const result = await feedService.getFeedPosts(filters, userId);

    return res.status(200).json(new ApiResponse(true, 200, result, 'Feed retrieved successfully'));
  } catch (error: unknown) {
    console.error('Error getting feed:', error);
    return res.status(500).json(new ApiResponse(false, 500, null, 'Failed to get feed'));
  }
};

export const getPostByIdHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    const post = await feedService.getPostById(postId, userId);

    if (!post) {
      return res.status(404).json(new ApiResponse(false, 404, null, 'Post not found'));
    }

    return res.status(200).json(new ApiResponse(true, 200, post, 'Post retrieved successfully'));
  } catch (error: unknown) {
    console.error('Error getting post:', error);
    return res.status(500).json(new ApiResponse(false, 500, null, 'Failed to get post'));
  }
};

interface UpdateCaptionBody {
  caption?: string;
}

export const updatePostCaptionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { caption } = req.body as UpdateCaptionBody;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    if (caption === undefined) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Caption is required'));
    }

    const post = await feedService.updatePostCaption(postId, userId, caption);

    return res.status(200).json(new ApiResponse(true, 200, post, 'Caption updated successfully'));
  } catch (error: unknown) {
    console.error('Error updating caption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update caption';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};

export const deletePostHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    await feedService.deletePost(postId, userId);

    return res.status(200).json(new ApiResponse(true, 200, null, 'Post deleted successfully'));
  } catch (error: unknown) {
    console.error('Error deleting post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete post';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};

// ============================================
// LIKE HANDLERS
// ============================================

export const toggleLikeHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    const result = await feedService.toggleLike(postId, userId);

    // Send grouped notification if liked (not unliked) and not liking own post
    if (result.liked) {
      const post = await feedService.getPostById(postId);
      if (post && post.authorId !== userId) {
        const liker = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true },
        });

        if (liker) {
          // Use notification grouping service to batch multiple likes
          await addLikeToGroup(
            postId,
            post.authorId,
            userId,
            liker.name || liker.username || 'Someone'
          );
        }
      }
    }

    return res.status(200).json(
      new ApiResponse(true, 200, result, result.liked ? 'Post liked' : 'Post unliked')
    );
  } catch (error: unknown) {
    console.error('Error toggling like:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle like';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};

interface GetLikersQuery {
  limit?: string;
}

export const getPostLikersHandler = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { limit } = req.query as GetLikersQuery;

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const likers = await feedService.getPostLikers(postId, parsedLimit);

    return res.status(200).json(new ApiResponse(true, 200, likers, 'Likers retrieved successfully'));
  } catch (error: unknown) {
    console.error('Error getting likers:', error);
    return res.status(500).json(new ApiResponse(false, 500, null, 'Failed to get likers'));
  }
};

// ============================================
// COMMENT HANDLERS
// ============================================

interface AddCommentBody {
  text?: string;
}

export const addCommentHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { text } = req.body as AddCommentBody;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    if (!text) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Comment text is required'));
    }

    const comment = await feedService.addComment(postId, userId, text);

    // Send notification to post author (if not commenting on own post)
    const post = await feedService.getPostById(postId);
    if (post && post.authorId !== userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, username: true },
      });

      if (commenter) {
        const commentPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
        const notification = socialCommunityNotifications.postCommented(
          commenter.name || commenter.username || 'Someone',
          postId,
          commentPreview
        );
        await notificationService.createNotification({
          userIds: [post.authorId],
          ...notification,
          metadata: {
            ...notification.metadata,
            commenterId: userId,
            commentId: comment.id,
          },
        });
      }
    }

    return res.status(201).json(new ApiResponse(true, 201, comment, 'Comment added successfully'));
  } catch (error: unknown) {
    console.error('Error adding comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add comment';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};

interface GetCommentsQuery {
  limit?: string;
  offset?: string;
}

export const getPostCommentsHandler = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { limit, offset } = req.query as GetCommentsQuery;

    if (!postId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Post ID is required'));
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const comments = await feedService.getPostComments(postId, parsedLimit, parsedOffset);

    return res.status(200).json(new ApiResponse(true, 200, comments, 'Comments retrieved successfully'));
  } catch (error: unknown) {
    console.error('Error getting comments:', error);
    return res.status(500).json(new ApiResponse(false, 500, null, 'Failed to get comments'));
  }
};

export const deleteCommentHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { commentId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Authentication required'));
    }

    if (!commentId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Comment ID is required'));
    }

    await feedService.deleteComment(commentId, userId);

    return res.status(200).json(new ApiResponse(true, 200, null, 'Comment deleted successfully'));
  } catch (error: unknown) {
    console.error('Error deleting comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete comment';
    return res.status(400).json(new ApiResponse(false, 400, null, errorMessage));
  }
};
