import { prisma } from '../lib/prisma';
import { SeasonInvitationStatus, PartnershipStatus } from '@prisma/client';

interface ServiceResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ==========================================
// SEASON INVITATION FUNCTIONS
// ==========================================

/**
 * Send a season invitation to a general partnership
 */
export const sendSeasonInvitation = async (data: {
  senderId: string;
  recipientId: string;
  generalPartnershipId: string;
  seasonId: string;
  message?: string;
}): Promise<ServiceResponse> => {
  try {
    const { senderId, recipientId, generalPartnershipId, seasonId, message } = data;

    // Validate: Cannot invite yourself
    if (senderId === recipientId) {
      return { success: false, message: 'Cannot send invitation to yourself' };
    }

    // Validate: General partnership exists and is active
    const generalPartnership = await prisma.generalPartnership.findUnique({
      where: { id: generalPartnershipId }
    });

    if (!generalPartnership) {
      return { success: false, message: 'General partnership not found' };
    }

    if (generalPartnership.status !== 'ACTIVE') {
      return { success: false, message: 'General partnership is not active' };
    }

    // Validate: Sender is part of the partnership
    if (generalPartnership.player1Id !== senderId && generalPartnership.player2Id !== senderId) {
      return { success: false, message: 'You are not part of this partnership' };
    }

    // Validate: Recipient is the other player in the partnership
    const expectedRecipientId = generalPartnership.player1Id === senderId
      ? generalPartnership.player2Id
      : generalPartnership.player1Id;

    if (recipientId !== expectedRecipientId) {
      return { success: false, message: 'Invalid recipient for this partnership' };
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
      return { success: false, message: 'Your partner already has a partnership in this season' };
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.seasonInvitation.findFirst({
      where: {
        generalPartnershipId,
        seasonId,
        status: 'PENDING'
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
        generalPartnershipId,
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
        },
        generalPartnership: {
          include: {
            player1: {
              select: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                image: true
              }
            },
            player2: {
              select: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                image: true
              }
            }
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
 * Accept a season invitation and create season-specific partnership
 */
export const acceptSeasonInvitation = async (
  invitationId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const invitation = await prisma.seasonInvitation.findUnique({
      where: { id: invitationId },
      include: {
        generalPartnership: true
      }
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

    // Transaction: Update invitation + Create season partnership
    const result = await prisma.$transaction(async (tx) => {
      await tx.seasonInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date()
        }
      });

      const partnership = await tx.partnership.create({
        data: {
          captainId: invitation.senderId,
          partnerId: invitation.recipientId,
          seasonId: invitation.seasonId,
          generalPartnershipId: invitation.generalPartnershipId,
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
          },
          generalPartnership: {
            include: {
              player1: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  image: true
                }
              },
              player2: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  image: true
                }
              }
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
          },
          generalPartnership: {
            include: {
              player1: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  image: true
                }
              },
              player2: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  image: true
                }
              }
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
        },
        generalPartnership: {
          include: {
            player1: {
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
            player2: {
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
            }
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
