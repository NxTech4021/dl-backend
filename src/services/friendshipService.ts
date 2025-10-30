import { prisma } from '../lib/prisma';
import { FriendshipStatus } from '@prisma/client';

interface SendFriendRequestData {
  requesterId: string;
  recipientId: string;
}

export const sendFriendRequest = async (data: SendFriendRequestData) => {
  const { requesterId, recipientId } = data;

  // Validate: Cannot friend yourself
  if (requesterId === recipientId) {
    throw new Error('Cannot send friend request to yourself');
  }

  // Check if recipient exists
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId, role: 'USER', status: 'active' },
  });

  if (!recipient) {
    throw new Error('User not found');
  }

  // Check for existing friendship (any status, bidirectional)
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === FriendshipStatus.PENDING) {
      throw new Error('Friend request already pending');
    }
    if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
      throw new Error('Already friends');
    }
    if (existingFriendship.status === FriendshipStatus.BLOCKED) {
      throw new Error('Cannot send friend request');
    }
    if (existingFriendship.status === FriendshipStatus.REJECTED) {
      // Allow resending if previously rejected
      await prisma.friendship.delete({ where: { id: existingFriendship.id } });
    }
  }

  // Create friend request
  const friendship = await prisma.friendship.create({
    data: {
      requesterId,
      recipientId,
      status: FriendshipStatus.PENDING,
    },
    include: {
      requester: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
      recipient: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
    },
  });

  return friendship;
};

export const acceptFriendRequest = async (friendshipId: string, userId: string) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only recipient can accept
  if (friendship.recipientId !== userId) {
    throw new Error('Not authorized to accept this request');
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error('Request is not pending');
  }

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: {
      status: FriendshipStatus.ACCEPTED,
      respondedAt: new Date(),
    },
    include: {
      requester: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
      recipient: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
    },
  });

  return updated;
};

export const rejectFriendRequest = async (friendshipId: string, userId: string) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only recipient can reject
  if (friendship.recipientId !== userId) {
    throw new Error('Not authorized to reject this request');
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error('Request is not pending');
  }

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: {
      status: FriendshipStatus.REJECTED,
      respondedAt: new Date(),
    },
  });

  return updated;
};

export const removeFriend = async (friendshipId: string, userId: string) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friendship not found');
  }

  // Either party can remove friendship
  if (friendship.requesterId !== userId && friendship.recipientId !== userId) {
    throw new Error('Not authorized to remove this friendship');
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  return { success: true };
};

export const getFriendRequests = async (userId: string) => {
  const [sent, received] = await Promise.all([
    prisma.friendship.findMany({
      where: { requesterId: userId, status: FriendshipStatus.PENDING },
      include: {
        recipient: {
          select: { id: true, name: true, username: true, displayUsername: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { recipientId: userId, status: FriendshipStatus.PENDING },
      include: {
        requester: {
          select: { id: true, name: true, username: true, displayUsername: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { sent, received };
};

export const getFriends = async (userId: string) => {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { recipientId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    },
    include: {
      requester: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
      recipient: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true },
      },
    },
    orderBy: { respondedAt: 'desc' },
  });

  // Map to return the friend (not the current user)
  return friendships.map((f) => ({
    friendshipId: f.id,
    friend: f.requesterId === userId ? f.recipient : f.requester,
    since: f.respondedAt || f.createdAt,
  }));
};

export const areFriends = async (userId1: string, userId2: string): Promise<boolean> => {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId1, recipientId: userId2, status: FriendshipStatus.ACCEPTED },
        { requesterId: userId2, recipientId: userId1, status: FriendshipStatus.ACCEPTED },
      ],
    },
  });

  return !!friendship;
};
