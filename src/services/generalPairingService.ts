import { prisma } from '../lib/prisma';
import { GeneralPairRequestStatus, GeneralPartnershipStatus } from '@prisma/client';

interface ServiceResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ==========================================
// GENERAL PAIR REQUEST FUNCTIONS
// ==========================================

/**
 * Send a general pair request (no season)
 */
export const sendGeneralPairRequest = async (data: {
  requesterId: string;
  recipientId: string;
  message?: string;
}): Promise<ServiceResponse> => {
  try {
    const { requesterId, recipientId, message } = data;

    // Validate: Cannot pair with yourself
    if (requesterId === recipientId) {
      return { success: false, message: 'Cannot send pair request to yourself' };
    }

    // Check if they already have an active general partnership
    const existingPartnership = await prisma.generalPartnership.findFirst({
      where: {
        OR: [
          { player1Id: requesterId, player2Id: recipientId },
          { player1Id: recipientId, player2Id: requesterId }
        ],
        status: 'ACTIVE'
      }
    });

    if (existingPartnership) {
      return { success: false, message: 'You are already paired with this player' };
    }

    // Check for existing pending request
    const existingRequest = await prisma.generalPairRequest.findFirst({
      where: {
        OR: [
          { requesterId, recipientId, status: 'PENDING' },
          { requesterId: recipientId, recipientId: requesterId, status: 'PENDING' }
        ]
      }
    });

    if (existingRequest) {
      return { success: false, message: 'A pending pair request already exists' };
    }

    // Create request (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const pairRequest = await prisma.generalPairRequest.create({
      data: {
        requesterId,
        recipientId,
        message,
        status: 'PENDING',
        expiresAt
      },
      include: {
        requester: {
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
        }
      }
    });

    return {
      success: true,
      message: 'Pair request sent successfully',
      data: pairRequest
    };
  } catch (error) {
    console.error('Error sending general pair request:', error);
    return { success: false, message: 'Failed to send pair request' };
  }
};

/**
 * Accept a general pair request
 */
export const acceptGeneralPairRequest = async (
  requestId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const request = await prisma.generalPairRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return { success: false, message: 'Request not found' };
    }

    if (request.recipientId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, message: 'Request is not pending' };
    }

    if (request.expiresAt < new Date()) {
      await prisma.generalPairRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' }
      });
      return { success: false, message: 'Request has expired' };
    }

    // Transaction: Update request + Create partnership
    const result = await prisma.$transaction(async (tx) => {
      await tx.generalPairRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date()
        }
      });

      const partnership = await tx.generalPartnership.create({
        data: {
          player1Id: request.requesterId,
          player2Id: request.recipientId,
          status: 'ACTIVE'
        },
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
      });

      return partnership;
    });

    return {
      success: true,
      message: 'Pair request accepted',
      data: result
    };
  } catch (error) {
    console.error('Error accepting general pair request:', error);
    return { success: false, message: 'Failed to accept request' };
  }
};

/**
 * Deny a general pair request
 */
export const denyGeneralPairRequest = async (
  requestId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const request = await prisma.generalPairRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return { success: false, message: 'Request not found' };
    }

    if (request.recipientId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, message: 'Request is not pending' };
    }

    await prisma.generalPairRequest.update({
      where: { id: requestId },
      data: {
        status: 'DENIED',
        respondedAt: new Date()
      }
    });

    return { success: true, message: 'Pair request denied' };
  } catch (error) {
    console.error('Error denying general pair request:', error);
    return { success: false, message: 'Failed to deny request' };
  }
};

/**
 * Cancel a general pair request
 */
export const cancelGeneralPairRequest = async (
  requestId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const request = await prisma.generalPairRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return { success: false, message: 'Request not found' };
    }

    if (request.requesterId !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, message: 'Request is not pending' };
    }

    await prisma.generalPairRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        respondedAt: new Date()
      }
    });

    return { success: true, message: 'Pair request cancelled' };
  } catch (error) {
    console.error('Error cancelling general pair request:', error);
    return { success: false, message: 'Failed to cancel request' };
  }
};

/**
 * Get all general pair requests for a user
 */
export const getGeneralPairRequests = async (userId: string) => {
  try {
    const [sent, received] = await Promise.all([
      prisma.generalPairRequest.findMany({
        where: { requesterId: userId },
        include: {
          requester: {
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
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.generalPairRequest.findMany({
        where: { recipientId: userId },
        include: {
          requester: {
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
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return { sent, received };
  } catch (error) {
    console.error('Error getting general pair requests:', error);
    throw error;
  }
};

/**
 * Get user's general partnerships
 */
export const getGeneralPartnerships = async (userId: string) => {
  try {
    const partnerships = await prisma.generalPartnership.findMany({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId }
        ],
        status: 'ACTIVE'
      },
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
            // Get questionnaire for DMR rating
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
      },
      orderBy: { createdAt: 'desc' }
    });

    return partnerships;
  } catch (error) {
    console.error('Error getting general partnerships:', error);
    throw error;
  }
};

/**
 * Dissolve a general partnership
 */
export const dissolveGeneralPartnership = async (
  partnershipId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    const partnership = await prisma.generalPartnership.findUnique({
      where: { id: partnershipId }
    });

    if (!partnership) {
      return { success: false, message: 'Partnership not found' };
    }

    if (partnership.player1Id !== userId && partnership.player2Id !== userId) {
      return { success: false, message: 'Not authorized' };
    }

    await prisma.generalPartnership.update({
      where: { id: partnershipId },
      data: {
        status: 'DISSOLVED',
        dissolvedAt: new Date()
      }
    });

    return { success: true, message: 'Partnership dissolved' };
  } catch (error) {
    console.error('Error dissolving general partnership:', error);
    return { success: false, message: 'Failed to dissolve partnership' };
  }
};
