import { prisma } from '../lib/prisma';
import { SeasonInvitationStatus, PartnershipStatus, FriendshipStatus } from '@prisma/client';
import { io } from '../app';

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

    // Validate: Season exists and registration is open
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        status: true,
        regiDeadline: true,
        startDate: true
      }
    });

    if (!season) {
      return { success: false, message: 'Season not found' };
    }

    // Validate: Registration is still open
    const now = new Date();

    if (season.status !== 'UPCOMING' && season.status !== 'ONGOING' && season.status !== 'ACTIVE') {
      return { success: false, message: 'This season is not accepting registrations' };
    }

    if (season.regiDeadline && now > season.regiDeadline) {
      return { success: false, message: 'Registration deadline has passed' };
    }

    if (season.startDate && now > season.startDate) {
      return { success: false, message: 'Season has already started' };
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

    let invitation;
    try {
      invitation = await prisma.seasonInvitation.create({
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
    } catch (createError: any) {
      // Handle unique constraint violation (P2002)
      if (createError.code === 'P2002') {
        return {
          success: false,
          message: 'You have already sent an invitation to this user for this season'
        };
      }
      throw createError;
    }

    // ✅ Emit Socket.IO event to notify recipient in real-time
    try {
      io.to(recipientId).emit('season_invitation_received', {
        invitationId: invitation.id,
        sender: invitation.sender,
        season: invitation.season,
        message: invitation.message,
        expiresAt: invitation.expiresAt
      });
      console.log(`📨 Socket.IO: Notified user ${recipientId} of new season invitation`);
    } catch (socketError) {
      console.error('Error emitting socket event:', socketError);
      // Don't fail the whole operation if socket fails
    }

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

    // Transaction with Serializable isolation: Update invitation + Create partnership + Create memberships
    const result = await prisma.$transaction(async (tx) => {
      // Check expiry inside transaction
      if (invitation.expiresAt < new Date()) {
        await tx.seasonInvitation.update({
          where: { id: invitationId },
          data: { status: 'EXPIRED', respondedAt: new Date() }
        });
        throw new Error('Invitation has expired');
      }

      // Check if sender still doesn't have a partnership (INSIDE transaction to prevent race condition)
      const senderExistingPartnership = await tx.partnership.findFirst({
        where: {
          OR: [
            { captainId: invitation.senderId, seasonId: invitation.seasonId },
            { partnerId: invitation.senderId, seasonId: invitation.seasonId }
          ],
          status: 'ACTIVE'
        }
      });

      if (senderExistingPartnership) {
        throw new Error('Sender already has a partnership in this season');
      }

      // Check if recipient doesn't have a partnership (INSIDE transaction to prevent race condition)
      const recipientExistingPartnership = await tx.partnership.findFirst({
        where: {
          OR: [
            { captainId: userId, seasonId: invitation.seasonId },
            { partnerId: userId, seasonId: invitation.seasonId }
          ],
          status: 'ACTIVE'
        }
      });

      if (recipientExistingPartnership) {
        throw new Error('You already have a partnership in this season');
      }

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
              // Removed questionnaireResponses to prevent N+1 queries
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
              // Removed questionnaireResponses to prevent N+1 queries
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

      // Delete any existing memberships first to avoid data corruption
      await tx.seasonMembership.deleteMany({
        where: {
          userId: { in: [invitation.senderId, invitation.recipientId] },
          seasonId: invitation.seasonId,
        },
      });

      // Create fresh season memberships for both players
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
      });

      return partnership;
    });

    // ✅ Emit Socket.IO events to notify both users
    try {
      // Notify sender that their invitation was accepted
      io.to(invitation.senderId).emit('season_invitation_accepted', {
        invitationId: invitation.id,
        acceptedBy: result.partner,
        partnership: {
          id: result.id,
          captain: result.captain,
          partner: result.partner,
          season: result.season
        }
      });
      console.log(`📨 Socket.IO: Notified sender ${invitation.senderId} of accepted invitation`);

      // Notify recipient (acceptor) about successful partnership creation
      io.to(invitation.recipientId).emit('partnership_created', {
        partnership: {
          id: result.id,
          captain: result.captain,
          partner: result.partner,
          season: result.season
        }
      });
      console.log(`📨 Socket.IO: Notified recipient ${invitation.recipientId} of partnership creation`);
    } catch (socketError) {
      console.error('Error emitting socket events:', socketError);
      // Don't fail the whole operation if socket fails
    }

    return {
      success: true,
      message: 'Season invitation accepted',
      data: result
    };
  } catch (error: any) {
    console.error('Error accepting season invitation:', error);
    // Return specific error message if available
    const errorMessage = error?.message || 'Failed to accept invitation';
    return { success: false, message: errorMessage };
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

    // Add direction indicator to help frontend determine UI state
    if (invitation) {
      return {
        ...invitation,
        direction: invitation.senderId === userId ? 'sent' : 'received'
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting pending season invitation:', error);
    throw error;
  }
};

// ==========================================
// SCHEDULED TASKS
// ==========================================

/**
 * Expire old season invitations (run daily via cron job)
 * Updates all PENDING invitations that have passed their expiresAt date to EXPIRED
 */
export const expireOldSeasonInvitations = async (): Promise<number> => {
  try {
    const now = new Date();
    const result = await prisma.seasonInvitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now }
      },
      data: {
        status: 'EXPIRED',
        respondedAt: now
      }
    });

    console.log(`✅ Expired ${result.count} season invitations`);
    return result.count;
  } catch (error) {
    console.error('❌ Error expiring season invitations:', error);
    throw error;
  }
};
