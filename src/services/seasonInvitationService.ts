import { prisma } from '../lib/prisma';
import { SeasonInvitationStatus, PartnershipStatus, FriendshipStatus } from '@prisma/client';

interface ServiceResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ==========================================
// SEASON INVITATION FUNCTIONS
// ==========================================

/**
 * Send a season invitation to a friend
 */
export const sendSeasonInvitation = async (data: {
  senderId: string;
  recipientId: string;
  seasonId: string;
  message?: string;
}): Promise<ServiceResponse> => {
  try {
    const { senderId, recipientId, seasonId, message } = data;

    // Validate: Cannot invite yourself
    if (senderId === recipientId) {
      return { success: false, message: 'Cannot send invitation to yourself' };
    }

    // Validate: Must be friends (ACCEPTED friendship)
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: senderId, recipientId, status: FriendshipStatus.ACCEPTED },
          { requesterId: recipientId, recipientId: senderId, status: FriendshipStatus.ACCEPTED }
        ]
      }
    });

    if (!friendship) {
      return { success: false, message: 'Can only invite friends. Send a friend request first.' };
    }

    // Validate: Season exists
    const season = await prisma.season.findUnique({
      where: { id: seasonId }
    });

    if (!season) {
      return { success: false, message: 'Season not found' };
    }

    // Check if sender already has a partnership in this season
    const senderExistingPartnership = await prisma.partnership.findFirst({
      where: {
        OR: [
          { captainId: senderId, seasonId },
          { partnerId: senderId, seasonId }
        ],
        status: 'ACTIVE'
      }
    });

    if (senderExistingPartnership) {
      return { success: false, message: 'You already have a partnership in this season' };
    }

    // Check if recipient already has a partnership in this season
    const recipientExistingPartnership = await prisma.partnership.findFirst({
      where: {
        OR: [
          { captainId: recipientId, seasonId },
          { partnerId: recipientId, seasonId }
        ],
        status: 'ACTIVE'
      }
    });

    if (recipientExistingPartnership) {
      return { success: false, message: 'Your friend already has a partnership in this season' };
    }

    // Check for existing pending invitation between these two users for this season
    const existingInvitation = await prisma.seasonInvitation.findFirst({
      where: {
        OR: [
          { senderId, recipientId, seasonId, status: 'PENDING' },
          { senderId: recipientId, recipientId: senderId, seasonId, status: 'PENDING' }
        ]
      }
    });

    if (existingInvitation) {
      return { success: false, message: 'A pending invitation already exists for this season' };
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.seasonInvitation.create({
      data: {
        senderId,
        recipientId,
        seasonId,
        message,
        status: 'PENDING',
        expiresAt
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true
          }
        },
        season: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return {
      success: true,
      message: 'Season invitation sent successfully',
      data: invitation
    };
  } catch (error) {
    console.error('Error sending season invitation:', error);
    return { success: false, message: 'Failed to send season invitation' };
  }
};

/**
 * Accept a season invitation and create season-specific partnership + memberships
 */
export const acceptSeasonInvitation = async (
  invitationId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const invitation = await prisma.seasonInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return { success: false, message: 'Invitation not found' };
    }

    if (invitation.recipientId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, message: 'Invitation is not pending' };
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.seasonInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' }
      });
      return { success: false, message: 'Invitation has expired' };
    }

    // Check if sender still doesn't have a partnership in this season
    const senderExistingPartnership = await prisma.partnership.findFirst({
      where: {
        OR: [
          { captainId: invitation.senderId, seasonId: invitation.seasonId },
          { partnerId: invitation.senderId, seasonId: invitation.seasonId }
        ],
        status: 'ACTIVE'
      }
    });

    if (senderExistingPartnership) {
      return { success: false, message: 'Sender already has a partnership in this season' };
    }

    // Check if recipient doesn't have a partnership in this season
    const recipientExistingPartnership = await prisma.partnership.findFirst({
      where: {
        OR: [
          { captainId: userId, seasonId: invitation.seasonId },
          { partnerId: userId, seasonId: invitation.seasonId }
        ],
        status: 'ACTIVE'
      }
    });

    if (recipientExistingPartnership) {
      return { success: false, message: 'You already have a partnership in this season' };
    }

    // Transaction: Update invitation + Create season partnership + Create season memberships for both players
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      await tx.seasonInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date()
        }
      });

      // Create partnership
      const partnership = await tx.partnership.create({
        data: {
          captainId: invitation.senderId,
          partnerId: invitation.recipientId,
          seasonId: invitation.seasonId,
          status: 'ACTIVE'
        },
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
              area: true,
              gender: true,
              questionnaireResponses: {
                where: { completedAt: { not: null } },
                include: { result: true }
              }
            }
          },
          partner: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
              area: true,
              gender: true,
              questionnaireResponses: {
                where: { completedAt: { not: null } },
                include: { result: true }
              }
            }
          },
          season: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Create season memberships for both players
      await tx.seasonMembership.createMany({
        data: [
          {
            userId: invitation.senderId,
            seasonId: invitation.seasonId,
            status: 'PENDING', // Status will be updated once payment is processed
            paymentStatus: 'PENDING'
          },
          {
            userId: invitation.recipientId,
            seasonId: invitation.seasonId,
            status: 'PENDING',
            paymentStatus: 'PENDING'
          }
        ],
        skipDuplicates: true // In case membership already exists
      });

      return partnership;
    });

    return {
      success: true,
      message: 'Season invitation accepted',
      data: result
    };
  } catch (error) {
    console.error('Error accepting season invitation:', error);
    return { success: false, message: 'Failed to accept invitation' };
  }
};

/**
 * Deny a season invitation
 */
export const denySeasonInvitation = async (
  invitationId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const invitation = await prisma.seasonInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return { success: false, message: 'Invitation not found' };
    }

    if (invitation.recipientId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, message: 'Invitation is not pending' };
    }

    await prisma.seasonInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'DENIED',
        respondedAt: new Date()
      }
    });

    return { success: true, message: 'Season invitation denied' };
  } catch (error) {
    console.error('Error denying season invitation:', error);
    return { success: false, message: 'Failed to deny invitation' };
  }
};

/**
 * Cancel a season invitation
 */
export const cancelSeasonInvitation = async (
  invitationId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const invitation = await prisma.seasonInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return { success: false, message: 'Invitation not found' };
    }

    if (invitation.senderId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, message: 'Invitation is not pending' };
    }

    await prisma.seasonInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        respondedAt: new Date()
      }
    });

    return { success: true, message: 'Season invitation cancelled' };
  } catch (error) {
    console.error('Error cancelling season invitation:', error);
    return { success: false, message: 'Failed to cancel invitation' };
  }
};

/**
 * Get all season invitations for a user
 */
export const getSeasonInvitations = async (userId: string) => {
  try {
    const [sent, received] = await Promise.all([
      prisma.seasonInvitation.findMany({
        where: { senderId: userId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true
            }
          },
          recipient: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true
            }
          },
          season: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.seasonInvitation.findMany({
        where: { recipientId: userId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true
            }
          },
          recipient: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true
            }
          },
          season: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return { sent, received };
  } catch (error) {
    console.error('Error getting season invitations:', error);
    throw error;
  }
};

/**
 * Get pending season invitation for a specific season and user
 */
export const getPendingSeasonInvitation = async (
  userId: string,
  seasonId: string
) => {
  try {
    const invitation = await prisma.seasonInvitation.findFirst({
      where: {
        OR: [
          { senderId: userId, seasonId },
          { recipientId: userId, seasonId }
        ],
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
            area: true,
            gender: true,
            questionnaireResponses: {
              where: { completedAt: { not: null } },
              include: { result: true }
            }
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
            area: true,
            gender: true,
            questionnaireResponses: {
              where: { completedAt: { not: null } },
              include: { result: true }
            }
          }
        },
        season: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return invitation;
  } catch (error) {
    console.error('Error getting pending season invitation:', error);
    throw error;
  }
};
