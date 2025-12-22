import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import * as friendshipService from '../services/friendshipService';
import { ApiResponse } from '../utils/ApiResponse';
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
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

    res.status(201).json({ success: true, friendship });
  } catch (error: unknown) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

export const acceptFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    if (!friendshipId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Friendship ID required'));
    }

    const friendship = await friendshipService.acceptFriendRequest(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, friendship, 'Friend request accepted')
    );
  } catch (error: unknown) {
    console.error('Error accepting friend request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept friend request';
    return res.status(400).json(
      new ApiResponse(false, 400, null, errorMessage)
    );
  }
};

export const rejectFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    if (!friendshipId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Friendship ID required'));
    }

    const friendship = await friendshipService.rejectFriendRequest(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, friendship, 'Friend request rejected')
    );
  } catch (error: unknown) {
    console.error('Error rejecting friend request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject friend request';
    return res.status(400).json(
      new ApiResponse(false, 400, null, errorMessage)
    );
  }
};

export const removeFriendHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    if (!friendshipId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Friendship ID required'));
    }

    await friendshipService.removeFriend(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, null, 'Friend removed successfully')
    );
  } catch (error: unknown) {
    console.error('Error removing friend:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove friend';
    return res.status(400).json(
      new ApiResponse(false, 400, null, errorMessage)
    );
  }
};

export const getFriendRequestsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    const requests = await friendshipService.getFriendRequests(userId);

    return res.status(200).json(
      new ApiResponse(true, 200, requests, 'Friend requests retrieved successfully')
    );
  } catch (error: unknown) {
    console.error('Error getting friend requests:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get friend requests')
    );
  }
};

export const getFriendsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    const friends = await friendshipService.getFriends(userId);

    return res.status(200).json(
      new ApiResponse(true, 200, friends, 'Friends retrieved successfully')
    );
  } catch (error: unknown) {
    console.error('Error getting friends:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get friends')
    );
  }
};
