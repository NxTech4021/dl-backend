import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as friendshipService from '../services/friendshipService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { socialCommunityNotifications } from '../helpers/notifications/socialCommunityNotifications';
import { notificationService } from '../services/notificationService';

interface SendFriendRequestBody {
  recipientId?: string;
}

export const sendFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recipientId } = req.body as SendFriendRequestBody;

    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!recipientId) {
      return sendError(res, 'Recipient ID is required', 400);
    }

    // Create the friend request
    const friendship = await friendshipService.sendFriendRequest({
      requesterId: userId,
      recipientId,
    });


    // Get sender's name for the notification
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    });

    if (sender) {
      const notification = socialCommunityNotifications.friendRequest(sender.name || sender.username || 'Someone');
      await notificationService.createNotification({
        userIds: [recipientId],
        ...notification,
        metadata: {
          ...notification.metadata,
          senderId: userId,
        },
      });
    }

    return sendSuccess(res, friendship, undefined, 201);
  } catch (error: unknown) {
    console.error('Error sending friend request:', error);
    return sendError(res, 'Failed to send friend request', 500);
  }
};

export const acceptFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!friendshipId) {
      return sendError(res, 'Friendship ID required', 400);
    }

    const friendship = await friendshipService.acceptFriendRequest(friendshipId, userId);

    return sendSuccess(res, friendship, 'Friend request accepted');
  } catch (error: unknown) {
    console.error('Error accepting friend request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept friend request';
    return sendError(res, errorMessage, 400);
  }
};

export const rejectFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!friendshipId) {
      return sendError(res, 'Friendship ID required', 400);
    }

    const friendship = await friendshipService.rejectFriendRequest(friendshipId, userId);

    return sendSuccess(res, friendship, 'Friend request rejected');
  } catch (error: unknown) {
    console.error('Error rejecting friend request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject friend request';
    return sendError(res, errorMessage, 400);
  }
};

export const removeFriendHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!friendshipId) {
      return sendError(res, 'Friendship ID required', 400);
    }

    await friendshipService.removeFriend(friendshipId, userId);

    return sendSuccess(res, null, 'Friend removed successfully');
  } catch (error: unknown) {
    console.error('Error removing friend:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove friend';
    return sendError(res, errorMessage, 400);
  }
};

export const getFriendRequestsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const requests = await friendshipService.getFriendRequests(userId);

    return sendSuccess(res, requests, 'Friend requests retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting friend requests:', error);
    return sendError(res, 'Failed to get friend requests', 500);
  }
};

export const getFriendsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const friends = await friendshipService.getFriends(userId);

    return sendSuccess(res, friends, 'Friends retrieved successfully');
  } catch (error: unknown) {
    console.error('Error getting friends:', error);
    return sendError(res, 'Failed to get friends', 500);
  }
};
