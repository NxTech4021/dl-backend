import { Request, Response } from 'express';
import * as friendshipService from '../services/friendshipService';
import { ApiResponse } from '../utils/ApiResponse';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const sendFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recipientId } = req.body;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    if (!recipientId) {
      return res.status(400).json(new ApiResponse(false, 400, null, 'Recipient ID required'));
    }

    const friendship = await friendshipService.sendFriendRequest({
      requesterId: userId,
      recipientId,
    });

    return res.status(201).json(
      new ApiResponse(true, 201, friendship, 'Friend request sent successfully')
    );
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Failed to send friend request')
    );
  }
};

export const acceptFriendRequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    if (!userId) {
      return res.status(401).json(new ApiResponse(false, 401, null, 'Unauthorized'));
    }

    const friendship = await friendshipService.acceptFriendRequest(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, friendship, 'Friend request accepted')
    );
  } catch (error: any) {
    console.error('Error accepting friend request:', error);
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Failed to accept friend request')
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

    const friendship = await friendshipService.rejectFriendRequest(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, friendship, 'Friend request rejected')
    );
  } catch (error: any) {
    console.error('Error rejecting friend request:', error);
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Failed to reject friend request')
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

    await friendshipService.removeFriend(friendshipId, userId);

    return res.status(200).json(
      new ApiResponse(true, 200, null, 'Friend removed successfully')
    );
  } catch (error: any) {
    console.error('Error removing friend:', error);
    return res.status(400).json(
      new ApiResponse(false, 400, null, error.message || 'Failed to remove friend')
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
  } catch (error: any) {
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
  } catch (error: any) {
    console.error('Error getting friends:', error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, 'Failed to get friends')
    );
  }
};
