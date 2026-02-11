import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as feedService from '../services/feedService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { socialCommunityNotifications } from '../helpers/notifications/socialCommunityNotifications';
import { notificationService } from '../services/notificationService';
import { addLikeToGroup } from '../services/notification/likeNotificationGroupingService';

// ============================================
// POST HANDLERS
// ============================================

const MAX_CAPTION_LENGTH = 500;

interface CreatePostBody {
  matchId?: string;
  caption?: string;
}

export const createPostHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { matchId, caption } = req.body as CreatePostBody;

    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!matchId) {
      return sendError(res, 'Match ID is required', 400);
    }

    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      return sendError(res, `Caption must not exceed ${MAX_CAPTION_LENGTH} characters`, 400);
    }

    const result = await feedService.createPost({
      matchId,
      authorId: userId,
      ...(caption !== undefined && { caption }),
    });

    const statusCode = result.alreadyExists ? 200 : 201;
    const message = result.alreadyExists
      ? 'You have already posted this match'
      : 'Post created successfully';

    return sendSuccess(res, { ...result.post, alreadyExists: result.alreadyExists }, message, statusCode);
  } catch (error: unknown) {
    console.error('Error creating post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
    return sendError(res, errorMessage, 400);
  }
};

interface GetFeedQuery {
  sport?: string;
  limit?: string;
  cursor?: string;
  filter?: 'all' | 'friends' | 'recommended';
}

export const getFeedPostsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { sport, limit, cursor, filter } = req.query as GetFeedQuery;

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;

    const filters: feedService.FeedFilters = {
      limit: parsedLimit,
      filter: filter || 'all' // Default to showing all posts
    };
    if (sport) filters.sport = sport;
    if (cursor) filters.cursor = cursor;

    const result = await feedService.getFeedPosts(filters, userId);

    return sendSuccess(res, result, 'Feed retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting feed:', error);
    return sendError(res, 'Failed to get feed', 500);
  }
};

export const getPostByIdHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!postId) {
      return sendError(res, 'Post ID is required', 400);
    }

    const post = await feedService.getPostById(postId, userId);

    if (!post) {
      return sendError(res, 'Post not found', 404);
    }

    return sendSuccess(res, post, 'Post retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting post:', error);
    return sendError(res, 'Failed to get post', 500);
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
      return sendError(res, 'Authentication required', 401);
    }

    if (!postId) {
      return sendError(res, 'Post ID is required', 400);
    }

    if (caption === undefined) {
      return sendError(res, 'Caption is required', 400);
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      return sendError(res, `Caption must not exceed ${MAX_CAPTION_LENGTH} characters`, 400);
    }

    const post = await feedService.updatePostCaption(postId, userId, caption);

    return sendSuccess(res, post, 'Caption updated successfully');
  } catch (error: unknown) {
    console.error('Error updating caption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update caption';
    return sendError(res, errorMessage, 400);
  }
};

export const deletePostHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!postId) {
      return sendError(res, 'Post ID is required', 400);
    }

    await feedService.deletePost(postId, userId);

    return sendSuccess(res, null, 'Post deleted successfully');
  } catch (error: unknown) {
    console.error('Error deleting post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete post';
    return sendError(res, errorMessage, 400);
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
      return sendError(res, 'Authentication required', 401);
    }

    if (!postId) {
      return sendError(res, 'Post ID is required', 400);
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

    return sendSuccess(res, result, result.liked ? 'Post liked' : 'Post unliked');
  } catch (error: unknown) {
    console.error('Error toggling like:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to toggle like';
    return sendError(res, errorMessage, 400);
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
      return sendError(res, 'Post ID is required', 400);
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const likers = await feedService.getPostLikers(postId, parsedLimit);

    return sendSuccess(res, likers, 'Likers retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting likers:', error);
    return sendError(res, 'Failed to get likers', 500);
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
      return sendError(res, 'Authentication required', 401);
    }

    if (!postId) {
      return sendError(res, 'Post ID is required', 400);
    }

    if (!text) {
      return sendError(res, 'Comment text is required', 400);
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

    return sendSuccess(res, comment, 'Comment added successfully', 201);
  } catch (error: unknown) {
    console.error('Error adding comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add comment';
    return sendError(res, errorMessage, 400);
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
      return sendError(res, 'Post ID is required', 400);
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const comments = await feedService.getPostComments(postId, parsedLimit, parsedOffset);

    return sendSuccess(res, comments, 'Comments retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting comments:', error);
    return sendError(res, 'Failed to get comments', 500);
  }
};

export const deleteCommentHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { commentId } = req.params;

    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!commentId) {
      return sendError(res, 'Comment ID is required', 400);
    }

    await feedService.deleteComment(commentId, userId);

    return sendSuccess(res, null, 'Comment deleted successfully');
  } catch (error: unknown) {
    console.error('Error deleting comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete comment';
    return sendError(res, errorMessage, 400);
  }
};
