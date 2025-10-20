import { prisma } from '../lib/prisma';
import { PairRequestStatus } from '@prisma/client';

/**
 * Pairing Service
 * Handles all business logic for team pairing requests and partnerships
 */

interface SendPairRequestData {
  requesterId: string;
  recipientId: string;
  seasonId: string;
  message?: string;
}

interface PairRequestResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Calculate the average rating for a pair of players for a specific season
 */
export const calculatePairRating = async (
  player1Id: string,
  player2Id: string,
  seasonId: string
): Promise<number> => {
  try {
    // Get season details to know which sport
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        category: {
          select: { game_type: true }
        }
      },
    });

    if (!season) {
      throw new Error('Season not found');
    }

    const sport = season.category?.game_type?.toLowerCase() || '';

    // Get questionnaire responses for both players for this sport
    const [player1Response, player2Response] = await Promise.all([
      prisma.questionnaireResponse.findFirst({
        where: {
          userId: player1Id,
          sport: {
            equals: sport,
            mode: 'insensitive',
          },
          completedAt: { not: null },
        },
        include: { result: true },
      }),
      prisma.questionnaireResponse.findFirst({
        where: {
          userId: player2Id,
          sport: {
            equals: sport,
            mode: 'insensitive',
          },
          completedAt: { not: null },
        },
        include: { result: true },
      }),
    ]);

    // Calculate average rating (using doubles rating if available, otherwise singles)
    const player1Rating =
      player1Response?.result?.doubles ?? player1Response?.result?.singles ?? 0;
    const player2Rating =
      player2Response?.result?.doubles ?? player2Response?.result?.singles ?? 0;

    return Math.round((player1Rating + player2Rating) / 2);
  } catch (error) {
    console.error('Error calculating pair rating:', error);
    return 0;
  }
};

/**
 * Send a pair request to another player
 */
export const sendPairRequest = async (
  data: SendPairRequestData
): Promise<PairRequestResponse> => {
  try {
    const { requesterId, recipientId, seasonId, message } = data;

    // Validate: Cannot pair with yourself
    if (requesterId === recipientId) {
      return {
        success: false,
        message: 'Cannot send pair request to yourself',
      };
    }

    // Check if season exists and is open for registration
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        startDate: true,
        regiDeadline: true,
        status: true,
        category: {
          select: { game_type: true }
        }
      },
    });

    if (!season) {
      return {
        success: false,
        message: 'Season not found',
      };
    }

    const now = new Date();
    if (season.startDate > now || season.regiDeadline < now) {
      return {
        success: false,
        message: 'Season registration is not currently open',
      };
    }

    // Check if requester already has a pending request to this specific recipient for this season
    const existingRequesterRequest = await prisma.pairRequest.findFirst({
      where: {
        requesterId,
        recipientId,
        seasonId,
        status: PairRequestStatus.PENDING,
      },
    });

    if (existingRequesterRequest) {
      return {
        success: false,
        message: 'You already have a pending pair request to this player for this season',
      };
    }

    // Check if recipient already has a pending request from someone else
    const existingRecipientRequest = await prisma.pairRequest.findFirst({
      where: {
        recipientId,
        seasonId,
        status: PairRequestStatus.PENDING,
      },
    });

    if (existingRecipientRequest) {
      return {
        success: false,
        message: 'This player already has a pending pair request',
      };
    }

    // Check if either player is already in a partnership for this season
    const existingPartnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        OR: [
          { player1Id: requesterId },
          { player2Id: requesterId },
          { player1Id: recipientId },
          { player2Id: recipientId },
        ],
      },
    });

    if (existingPartnership) {
      return {
        success: false,
        message: 'One or both players are already paired for this season',
      };
    }

    // Check if either player is already registered individually
    const existingRegistration = await prisma.seasonRegistration.findFirst({
      where: {
        seasonId,
        registrationType: 'INDIVIDUAL',
        OR: [
          { playerId: requesterId },
          { playerId: recipientId },
        ],
      },
    });

    if (existingRegistration) {
      return {
        success: false,
        message: 'One or both players are already registered individually for this season',
      };
    }

    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create the pair request
    const pairRequest = await prisma.pairRequest.create({
      data: {
        requesterId,
        recipientId,
        seasonId,
        message,
        status: PairRequestStatus.PENDING,
        expiresAt,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // TODO: Send notification to recipient (email/push notification)
    console.log(`Pair request sent from ${requesterId} to ${recipientId} for season ${seasonId}`);

    return {
      success: true,
      message: 'Pair request sent successfully',
      data: pairRequest,
    };
  } catch (error) {
    console.error('Error sending pair request:', error);
    return {
      success: false,
      message: 'Failed to send pair request',
    };
  }
};

/**
 * Accept a pair request and create partnership
 */
export const acceptPairRequest = async (
  requestId: string,
  userId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the pair request
    const pairRequest = await prisma.pairRequest.findUnique({
      where: { id: requestId },
      include: {
        season: {
          include: {
            divisions: true,
          },
        },
      },
    });

    if (!pairRequest) {
      return {
        success: false,
        message: 'Pair request not found',
      };
    }

    // Validate: Only recipient can accept
    if (pairRequest.recipientId !== userId) {
      return {
        success: false,
        message: 'You are not authorized to accept this request',
      };
    }

    // Validate: Request must be pending
    if (pairRequest.status !== PairRequestStatus.PENDING) {
      return {
        success: false,
        message: 'This request is no longer pending',
      };
    }

    // Validate: Request not expired
    if (pairRequest.expiresAt < new Date()) {
      await prisma.pairRequest.update({
        where: { id: requestId },
        data: { status: PairRequestStatus.EXPIRED },
      });
      return {
        success: false,
        message: 'This request has expired',
      };
    }

    // Calculate pair rating
    const pairRating = await calculatePairRating(
      pairRequest.requesterId,
      pairRequest.recipientId,
      pairRequest.seasonId
    );

    // Check if requester has existing division assignment for this season
    // to preserve division when partner changes
    const existingRegistration = await prisma.seasonRegistration.findFirst({
      where: {
        playerId: pairRequest.requesterId,
        seasonId: pairRequest.seasonId,
        isActive: true,
      },
      select: { divisionId: true },
    });

    // Determine division: use existing division if available, otherwise assign based on divisions available
    const assignedDivisionId = existingRegistration?.divisionId || pairRequest.season.divisions[0]?.id;

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update pair request status
      const updatedRequest = await tx.pairRequest.update({
        where: { id: requestId },
        data: {
          status: PairRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // Create partnership
      const partnership = await tx.partnership.create({
        data: {
          player1Id: pairRequest.requesterId,
          player2Id: pairRequest.recipientId,
          seasonId: pairRequest.seasonId,
          divisionId: assignedDivisionId,
          pairRating,
        },
        include: {
          player1: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
          player2: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { updatedRequest, partnership };
    });

    // TODO: Send notification to requester
    console.log(`Pair request ${requestId} accepted, partnership created`);

    return {
      success: true,
      message: 'Pair request accepted successfully',
      data: result.partnership,
    };
  } catch (error) {
    console.error('Error accepting pair request:', error);
    return {
      success: false,
      message: 'Failed to accept pair request',
    };
  }
};

/**
 * Deny a pair request
 */
export const denyPairRequest = async (
  requestId: string,
  userId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the pair request
    const pairRequest = await prisma.pairRequest.findUnique({
      where: { id: requestId },
    });

    if (!pairRequest) {
      return {
        success: false,
        message: 'Pair request not found',
      };
    }

    // Validate: Only recipient can deny
    if (pairRequest.recipientId !== userId) {
      return {
        success: false,
        message: 'You are not authorized to deny this request',
      };
    }

    // Validate: Request must be pending
    if (pairRequest.status !== PairRequestStatus.PENDING) {
      return {
        success: false,
        message: 'This request is no longer pending',
      };
    }

    // Update pair request status
    const updatedRequest = await prisma.pairRequest.update({
      where: { id: requestId },
      data: {
        status: PairRequestStatus.DENIED,
        respondedAt: new Date(),
      },
    });

    // Note: Do NOT notify requester (per requirements)
    console.log(`Pair request ${requestId} denied`);

    return {
      success: true,
      message: 'Pair request denied',
      data: updatedRequest,
    };
  } catch (error) {
    console.error('Error denying pair request:', error);
    return {
      success: false,
      message: 'Failed to deny pair request',
    };
  }
};

/**
 * Cancel a pair request (by requester)
 */
export const cancelPairRequest = async (
  requestId: string,
  userId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the pair request
    const pairRequest = await prisma.pairRequest.findUnique({
      where: { id: requestId },
    });

    if (!pairRequest) {
      return {
        success: false,
        message: 'Pair request not found',
      };
    }

    // Validate: Only requester can cancel
    if (pairRequest.requesterId !== userId) {
      return {
        success: false,
        message: 'You are not authorized to cancel this request',
      };
    }

    // Validate: Request must be pending
    if (pairRequest.status !== PairRequestStatus.PENDING) {
      return {
        success: false,
        message: 'This request is no longer pending',
      };
    }

    // Update pair request status
    const updatedRequest = await prisma.pairRequest.update({
      where: { id: requestId },
      data: {
        status: PairRequestStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    console.log(`Pair request ${requestId} cancelled by requester`);

    return {
      success: true,
      message: 'Pair request cancelled',
      data: updatedRequest,
    };
  } catch (error) {
    console.error('Error cancelling pair request:', error);
    return {
      success: false,
      message: 'Failed to cancel pair request',
    };
  }
};

/**
 * Get all pair requests for a user (sent and received)
 */
export const getPairRequests = async (userId: string) => {
  try {
    const [sentRequests, receivedRequests] = await Promise.all([
      // Requests sent by user
      prisma.pairRequest.findMany({
        where: { requesterId: userId },
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
              startDate: true,
              regiDeadline: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Requests received by user
      prisma.pairRequest.findMany({
        where: { recipientId: userId },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
              startDate: true,
              regiDeadline: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      sent: sentRequests,
      received: receivedRequests,
    };
  } catch (error) {
    console.error('Error getting pair requests:', error);
    throw error;
  }
};

/**
 * Get partnerships for a user
 */
export const getUserPartnerships = async (userId: string) => {
  try {
    const partnerships = await prisma.partnership.findMany({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId },
        ],
      },
      include: {
        player1: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        player2: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
            level: true,
            gameType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return partnerships;
  } catch (error) {
    console.error('Error getting user partnerships:', error);
    throw error;
  }
};

/**
 * Dissolve a partnership
 * This marks a partnership as dissolved and allows partners to find new matches
 */
export const dissolvePartnership = async (
  partnershipId: string,
  dissolvingUserId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the partnership
    const partnership = await prisma.partnership.findUnique({
      where: { id: partnershipId },
      include: {
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        season: { select: { id: true, name: true, status: true } },
      },
    });

    if (!partnership) {
      return {
        success: false,
        message: 'Partnership not found',
      };
    }

    // Validate: Only partners can dissolve
    if (partnership.player1Id !== dissolvingUserId && partnership.player2Id !== dissolvingUserId) {
      return {
        success: false,
        message: 'You are not authorized to dissolve this partnership',
      };
    }

    // Validate: Cannot dissolve if season is completed
    if (partnership.season.status === 'COMPLETED') {
      return {
        success: false,
        message: 'Cannot dissolve partnership after season is completed',
      };
    }

    // Update partnership status to DISSOLVED
    const updatedPartnership = await prisma.partnership.update({
      where: { id: partnershipId },
      data: {
        status: 'DISSOLVED',
        dissolvedAt: new Date(),
      },
    });

    // TODO: Send notification to other partner
    const otherPartnerId = partnership.player1Id === dissolvingUserId
      ? partnership.player2Id
      : partnership.player1Id;

    console.log(`Partnership ${partnershipId} dissolved by ${dissolvingUserId}. Notify partner ${otherPartnerId}`);

    return {
      success: true,
      message: 'Partnership dissolved successfully',
      data: updatedPartnership,
    };
  } catch (error) {
    console.error('Error dissolving partnership:', error);
    return {
      success: false,
      message: 'Failed to dissolve partnership',
    };
  }
};

/**
 * Get active partnership for a user in a specific season
 * Returns null if no active partnership exists
 */
export const getActivePartnership = async (
  userId: string,
  seasonId: string
) => {
  try {
    const partnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        status: 'ACTIVE',
        OR: [
          { player1Id: userId },
          { player2Id: userId },
        ],
      },
      include: {
        player1: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        player2: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return partnership;
  } catch (error) {
    console.error('Error getting active partnership:', error);
    throw error;
  }
};

/**
 * Expire old pending requests (to be run as a scheduled job)
 */
export const expireOldRequests = async () => {
  try {
    const now = new Date();
    const result = await prisma.pairRequest.updateMany({
      where: {
        status: PairRequestStatus.PENDING,
        expiresAt: { lt: now },
      },
      data: {
        status: PairRequestStatus.EXPIRED,
        respondedAt: now,
      },
    });

    console.log(`Expired ${result.count} old pair requests`);
    return result;
  } catch (error) {
    console.error('Error expiring old requests:', error);
    throw error;
  }
};
