import { prisma } from '../lib/prisma';
import { PrismaClient, PairRequestStatus } from '@prisma/client';
import { enrichPlayerWithSkills } from './player/utils/playerTransformer';
import { notificationTemplates } from '../helpers/notifications';
import { notificationService } from './notificationService';

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
  seasonId: string,
  prismaClient: PrismaClient = prisma
): Promise<number> => {
  try {
    // Get season details to know which sport
    const season = await prismaClient.season.findUnique({
      where: { id: seasonId },
      select: {
        categoryId: true
      },
    });

    if (!season) {
      throw new Error('Season not found');
    }

    // Get category to find game type
    const category = season.categoryId ? await prismaClient.category.findUnique({
      where: { id: season.categoryId },
      select: { gameType: true }
    }) : null;

    const sport = category?.gameType?.toLowerCase() || '';

    // Get questionnaire responses for both players for this sport
    const [player1Response, player2Response] = await Promise.all([
      prismaClient.questionnaireResponse.findFirst({
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
      prismaClient.questionnaireResponse.findFirst({
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
        categoryId: true
      },
    });

    if (!season) {
      return {
        success: false,
        message: 'Season not found',
      };
    }

    // Allow pairing as long as registration deadline hasn't passed (even after season starts)
    const now = new Date();
    if (season.regiDeadline && now > season.regiDeadline) {
      return {
        success: false,
        message: 'Season registration deadline has passed',
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

    // Check if REQUESTER is already in an ACTIVE or INCOMPLETE partnership for this season
    // (they cannot send pair requests if they're already in a partnership)
    const requesterPartnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        status: { in: ['ACTIVE', 'INCOMPLETE'] },
        OR: [
          { captainId: requesterId },
          { partnerId: requesterId },
        ],
      },
    });

    if (requesterPartnership) {
      return {
        success: false,
        message: 'You are already in a partnership for this season',
      };
    }

    // Check if RECIPIENT has an ACTIVE partnership (block) or INCOMPLETE (allow)
    // Players with INCOMPLETE partnerships can receive pair requests
    const recipientPartnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        OR: [
          { captainId: recipientId },
          { partnerId: recipientId },
        ],
      },
    });

    if (recipientPartnership && recipientPartnership.status === 'ACTIVE') {
      return {
        success: false,
        message: 'This player already has an active partnership for this season',
      };
    }
    // INCOMPLETE partnerships are allowed - recipient can receive pair requests
    const recipientHasIncompletePartnership = recipientPartnership && recipientPartnership.status === 'INCOMPLETE';

    // Check if either player is already registered individually
    // BUT skip this check if recipient has an INCOMPLETE partnership (they need a partner)
    if (!recipientHasIncompletePartnership) {
      const existingMembership = await prisma.seasonMembership.findFirst({
        where: {
          seasonId: seasonId.toString(),
          userId: { in: [requesterId, recipientId] },
          status: 'ACTIVE',
        },
      });

      if (existingMembership) {
        return {
          success: false,
          message: 'One or both players are already registered individually for this season',
        };
      }
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
        message: message ?? null,
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

    // Send notifications: recipient (PUSH) and sender (IN-APP)
    try {
      const recipientNotif = notificationTemplates.doubles.partnerRequestReceived(
        pairRequest.requester.name || pairRequest.requester.username || 'Someone',
        pairRequest.season.name || 'this season'
      );

      await notificationService.createNotification({
        userIds: pairRequest.recipientId,
        ...recipientNotif,
        seasonId: pairRequest.season.id,
        pairRequestId: pairRequest.id,
      });

      const senderNotif = notificationTemplates.doubles.partnerRequestSent(
        pairRequest.recipient.name || pairRequest.recipient.username || 'Someone',
        pairRequest.season.name || 'this season'
      );

      await notificationService.createNotification({
        userIds: pairRequest.requesterId,
        ...senderNotif,
        seasonId: pairRequest.season.id,
        pairRequestId: pairRequest.id,
      });

      console.log('🔔 Pairing: created recipient PUSH and sender IN-APP notifications');
    } catch (notifErr) {
      console.error('❌ Failed to create pair request notifications:', notifErr);
    }

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

    // Check if recipient (the one accepting) has an INCOMPLETE partnership
    // If so, use special flow that updates their partnership instead of creating new
    const recipientIncompletePartnership = await prisma.partnership.findFirst({
      where: {
        seasonId: pairRequest.seasonId,
        captainId: pairRequest.recipientId, // Recipient is captain of INCOMPLETE partnership
        status: 'INCOMPLETE',
      },
      include: {
        captain: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
      },
    });

    if (recipientIncompletePartnership) {
      // Route to special handler that updates INCOMPLETE partnership
      // instead of creating a new one
      return await acceptPairRequestIntoIncomplete(
        requestId,
        userId,
        pairRequest,
        recipientIncompletePartnership
      );
    }

    // Normal flow: Calculate pair rating and create new partnership
    const pairRating = await calculatePairRating(
      pairRequest.requesterId,
      pairRequest.recipientId,
      pairRequest.seasonId
    );

    // Check if requester has existing division assignment for this season
    // to preserve division when partner changes
    const existingMembership = await prisma.seasonMembership.findFirst({
      where: {
        userId: pairRequest.requesterId,
        seasonId: pairRequest.seasonId.toString(),
        status: 'ACTIVE',
      },
      select: { divisionId: true },
    });

    // Determine division: use existing division if available, otherwise assign based on divisions available
    const assignedDivisionId = existingMembership?.divisionId || pairRequest.season.divisions[0]?.id.toString();

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
          captainId: pairRequest.requesterId,
          partnerId: pairRequest.recipientId,
          seasonId: pairRequest.seasonId,
          divisionId: assignedDivisionId ?? null,
          pairRating,
        },
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
          partner: {
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

      // Send notifications for partnership creation (both users) - PUSH
      try {
        const leagueName = result.partnership.season?.name || 'this season';

        const captainNotif = notificationTemplates.doubles.partnerRequestAcceptedCaptain(
          result.partnership.partner?.name || result.partnership.partner?.username || 'Partner',
          leagueName
        );

        await notificationService.createNotification({
          userIds: result.partnership.captain.id,
          ...captainNotif,
          seasonId: result.partnership.season.id,
          partnershipId: result.partnership.id,
        });

        const partnerNotif = notificationTemplates.doubles.partnerRequestAcceptedPartner(
          result.partnership.captain.name || result.partnership.captain.username || 'Captain',
          leagueName
        );

        if (result.partnership.partner) {
          await notificationService.createNotification({
            userIds: result.partnership.partner.id,
            ...partnerNotif,
            seasonId: result.partnership.season.id,
            partnershipId: result.partnership.id,
          });
        }

        console.log('🔔 Pairing: partnership accepted notifications sent (captain + partner)');
      } catch (notifErr) {
        console.error('❌ Failed to create partnership notifications:', notifErr);
      }

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
 * Accept a pair request where the recipient has an INCOMPLETE partnership
 * This updates the INCOMPLETE partnership instead of creating a new one
 * The recipient stays as captain, the requester (sender) becomes partner
 *
 * @param requestId - The pair request ID being accepted
 * @param acceptingUserId - The user accepting (recipient of the request)
 * @param pairRequest - The pair request with season data
 * @param incompletePartnership - The recipient's INCOMPLETE partnership
 */
async function acceptPairRequestIntoIncomplete(
  requestId: string,
  acceptingUserId: string,
  pairRequest: any,
  incompletePartnership: any
): Promise<PairRequestResponse> {
  try {
    // The requester (person who sent the pair request) becomes the new partner
    const newPartnerId = pairRequest.requesterId;

    // Calculate new pair rating based on both players
    const pairRating = await calculatePairRating(
      incompletePartnership.captainId,
      newPartnerId,
      pairRequest.seasonId
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the pair request to ACCEPTED
      await tx.pairRequest.update({
        where: { id: requestId },
        data: {
          status: PairRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 2. Update INCOMPLETE partnership: add partner, change status to ACTIVE
      const updatedPartnership = await tx.partnership.update({
        where: { id: incompletePartnership.id },
        data: {
          partnerId: newPartnerId,
          status: 'ACTIVE',
          pairRating,
        },
        include: {
          captain: { select: { id: true, name: true, username: true, image: true } },
          partner: { select: { id: true, name: true, username: true, image: true } },
          season: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      });

      // 3. Create/update season membership for new partner
      const existingMembership = await tx.seasonMembership.findFirst({
        where: {
          userId: newPartnerId,
          seasonId: pairRequest.seasonId,
        },
      });

      if (!existingMembership) {
        await tx.seasonMembership.create({
          data: {
            userId: newPartnerId,
            seasonId: pairRequest.seasonId,
            divisionId: incompletePartnership.divisionId,
            status: 'ACTIVE',
          },
        });
      } else if (existingMembership.status !== 'ACTIVE') {
        // Reactivate membership if it was REMOVED or other status
        await tx.seasonMembership.update({
          where: { id: existingMembership.id },
          data: { status: 'ACTIVE' },
        });
      }

      // 4. Auto-decline other pending pair requests:
      // - Other requests TO the captain (the recipient who accepted)
      // - All pending requests FROM the new partner (requester)
      // - All pending requests TO the new partner
      await tx.pairRequest.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: PairRequestStatus.PENDING,
          id: { not: requestId },
          OR: [
            { recipientId: acceptingUserId },  // Other requests to captain
            { requesterId: newPartnerId },     // Requests from new partner
            { recipientId: newPartnerId },     // Requests to new partner
          ],
        },
        data: {
          status: PairRequestStatus.AUTO_DENIED,
          respondedAt: new Date(),
        },
      });

      return updatedPartnership;
    });

    // Send notifications
    try {
      const leagueName = pairRequest.season?.name || 'this season';
      const captainName = result.captain?.name || result.captain?.username || 'Captain';
      const partnerName = result.partner?.name || result.partner?.username || 'Partner';

      // Notification to captain (the one who accepted) that partner joined
      const captainNotif = notificationTemplates.doubles.newPartnerJoined(
        partnerName,
        leagueName
      );
      await notificationService.createNotification({
        userIds: result.captain.id,
        ...captainNotif,
        seasonId: pairRequest.seasonId,
        partnershipId: result.id,
      });

      // Notification to new partner (the requester) that they joined the team
      const partnerNotif = notificationTemplates.doubles.partnerRequestAcceptedPartner(
        captainName,
        leagueName
      );
      if (result.partner) {
        await notificationService.createNotification({
          userIds: result.partner.id,
          ...partnerNotif,
          seasonId: pairRequest.seasonId,
          partnershipId: result.id,
        });
      }

      console.log(`🔔 Pair request ${requestId} accepted into INCOMPLETE partnership ${result.id}`);
    } catch (notifErr) {
      console.error('❌ Failed to send notifications for INCOMPLETE partnership acceptance:', notifErr);
    }

    console.log(`✅ Partnership ${result.id} transitioned from INCOMPLETE to ACTIVE. New partner: ${newPartnerId}`);

    return {
      success: true,
      message: 'Partner joined your team successfully!',
      data: result,
    };
  } catch (error) {
    console.error('Error accepting pair request into incomplete partnership:', error);
    return {
      success: false,
      message: 'Failed to accept pair request',
    };
  }
}

/**
 * Deny a pair request
 */
export const denyPairRequest = async (
  requestId: string,
  userId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the pair request (include related users and season for notifications)
    const pairRequest = await prisma.pairRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        recipient: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true } },
      },
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

    // Send PUSH notification to requester informing them their request was declined
    try {
      const leagueName = pairRequest.season?.name || 'this season';
      const partnerName = pairRequest.recipient?.name || pairRequest.recipient?.username || 'Someone';

      const declineNotif = notificationTemplates.doubles.partnerRequestDeclinedCaptain(
        partnerName,
        leagueName
      );

      await notificationService.createNotification({
        userIds: pairRequest.requesterId,
        ...declineNotif,
        seasonId: pairRequest.season?.id,
        pairRequestId: pairRequest.id,
      });

      console.log('🔔 Pairing: sent decline PUSH notification to requester');
    } catch (notifErr) {
      console.error('❌ Failed to send decline notification to requester:', notifErr);
    }

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
          { captainId: userId },
          { partnerId: userId },
        ],
      },
      include: {
        captain: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        partner: {
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
 * This marks a partnership as dissolved and creates an INCOMPLETE partnership
 * for the remaining player, preserving their standings
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
        captain: { select: { id: true, name: true, username: true } },
        partner: { select: { id: true, name: true, username: true } },
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
    if (partnership.captainId !== dissolvingUserId && partnership.partnerId !== dissolvingUserId) {
      return {
        success: false,
        message: 'You are not authorized to dissolve this partnership',
      };
    }

    // Validate: Cannot leave if there's a pending withdrawal request
    const pendingRequest = await prisma.withdrawalRequest.findFirst({
      where: {
        partnershipId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      return {
        success: false,
        message: 'Cannot leave partnership while there is a pending partner change request. Please wait for admin review.',
      };
    }

    // Validate: Cannot dissolve if season is completed
    if (partnership.season.status === 'FINISHED') {
      return {
        success: false,
        message: 'Cannot dissolve partnership after season is completed',
      };
    }

    // Determine remaining player (the one who is NOT dissolving)
    const remainingPlayerId = partnership.captainId === dissolvingUserId
      ? partnership.partnerId
      : partnership.captainId;

    const remainingPlayer = partnership.captainId === dissolvingUserId
      ? partnership.partner
      : partnership.captain;

    const leavingPlayer = partnership.captainId === dissolvingUserId
      ? partnership.captain
      : partnership.partner;

    // Check if remaining player exists (handle nullable partnerId)
    if (!remainingPlayerId || !remainingPlayer) {
      return {
        success: false,
        message: 'Cannot dissolve partnership - no remaining player found',
      };
    }

    // Update partnership status to DISSOLVED and create INCOMPLETE partnership for remaining player
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark old partnership as DISSOLVED
      const dissolved = await tx.partnership.update({
        where: { id: partnershipId },
        data: {
          status: 'DISSOLVED',
          dissolvedAt: new Date(),
        },
      });

      // 2. Create new INCOMPLETE partnership for remaining player
      const incompletePartnership = await tx.partnership.create({
        data: {
          captainId: remainingPlayerId,  // Remaining player becomes captain
          partnerId: null,                // No partner yet
          seasonId: partnership.seasonId,
          divisionId: partnership.divisionId,
          predecessorId: partnershipId,   // Link to dissolved partnership
          status: 'INCOMPLETE',
          pairRating: null,               // Will be recalculated when new partner joins
        },
        include: {
          captain: { select: { id: true, name: true, username: true } },
          season: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      });

      // 3. Transfer divisionStandings from old partnership to new incomplete partnership
      await tx.divisionStanding.updateMany({
        where: { partnershipId: partnershipId },
        data: { partnershipId: incompletePartnership.id },
      });

      // 4. Handle season memberships
      // Only remove the departing player's membership
      await tx.seasonMembership.updateMany({
        where: {
          userId: dissolvingUserId,
          seasonId: partnership.seasonId,
        },
        data: {
          status: 'REMOVED',
        },
      });

      // Keep remaining player's membership ACTIVE (if it exists)
      // No need to update since it should already be ACTIVE

      return { dissolved, incompletePartnership };
    });

    // Send notification to remaining player about partner leaving
    try {
      const leagueName = partnership.season?.name || 'this season';
      const leavingPlayerName = leavingPlayer?.name || leavingPlayer?.username || 'Your partner';

      const notification = notificationTemplates.doubles.partnerLeftPartnership(
        leavingPlayerName,
        leagueName
      );

      await notificationService.createNotification({
        userIds: remainingPlayerId,
        ...notification,
        seasonId: partnership.seasonId,
        partnershipId: result.incompletePartnership.id,
      });

      console.log(`🔔 Partner left notification sent to ${remainingPlayerId}`);
    } catch (notifErr) {
      console.error('❌ Failed to send partner left notification:', notifErr);
    }

    console.log(`Partnership ${partnershipId} dissolved by ${dissolvingUserId}. INCOMPLETE partnership ${result.incompletePartnership.id} created for ${remainingPlayerId}`);

    return {
      success: true,
      message: 'Partnership dissolved successfully. Your partner can now find a new teammate.',
      data: result.incompletePartnership,
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
 * Now returns captain and partner with transformed skillRatings for consistency with profile API
 * Includes both ACTIVE and INCOMPLETE partnerships
 */
export const getActivePartnership = async (
  userId: string,
  seasonId: string
) => {
  try {
    const partnership = await prisma.partnership.findFirst({
      where: {
        seasonId,
        status: { in: ['ACTIVE', 'INCOMPLETE'] },  // Include INCOMPLETE partnerships
        OR: [
          { captainId: userId },
          { partnerId: userId },
        ],
      },
      include: {
        captain: true,
        partner: true,
        season: {
          include: {
            category: {
              select: {
                gameType: true,
              },
            },
            leagues: {
              select: {
                sportType: true,
              },
              take: 1,
            },
          },
        },
        division: true,
        divisionStandings: {
          include: {
            division: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!partnership) {
      return null;
    }

    // Transform captain and partner to include skillRatings (same structure as profile API)
    // Handle nullable partner for INCOMPLETE partnerships
    let enrichedCaptain, enrichedPartner;
    try {
      enrichedCaptain = await enrichPlayerWithSkills(partnership.captain);
      // Only enrich partner if they exist (not null for INCOMPLETE partnerships)
      enrichedPartner = partnership.partner
        ? await enrichPlayerWithSkills(partnership.partner)
        : null;
    } catch (enrichError) {
      console.error('Error enriching players with skills:', enrichError);
      // Fallback: return players without enrichment if enrichment fails
      enrichedCaptain = partnership.captain;
      enrichedPartner = partnership.partner;
    }

    // Debug logging
    console.log('🔍 getActivePartnership - Captain skillRatings:', {
      captainId: enrichedCaptain.id,
      captainName: enrichedCaptain.name,
      hasSkillRatings: !!enrichedCaptain.skillRatings,
      skillRatingsKeys: enrichedCaptain.skillRatings ? Object.keys(enrichedCaptain.skillRatings) : [],
      skillRatings: enrichedCaptain.skillRatings,
      captainKeys: Object.keys(enrichedCaptain),
    });

    if (enrichedPartner) {
      console.log('🔍 getActivePartnership - Partner skillRatings:', {
        partnerId: enrichedPartner.id,
        partnerName: enrichedPartner.name,
        hasSkillRatings: !!enrichedPartner.skillRatings,
        skillRatingsKeys: enrichedPartner.skillRatings ? Object.keys(enrichedPartner.skillRatings) : [],
        skillRatings: enrichedPartner.skillRatings,
        partnerKeys: Object.keys(enrichedPartner),
      });
    } else {
      console.log('🔍 getActivePartnership - No partner (INCOMPLETE partnership)');
    }

    // Ensure skillRatings is always an object (not null) for consistency
    // If empty, return empty object instead of null
    // Remove questionnaireResponses to avoid confusion and reduce payload size
    const captainWithSkillRatings = {
      ...enrichedCaptain,
      skillRatings: enrichedCaptain.skillRatings || {},
      // Explicitly remove questionnaireResponses to avoid confusion
      questionnaireResponses: undefined,
    };
    delete captainWithSkillRatings.questionnaireResponses;

    // Handle nullable partner for INCOMPLETE partnerships
    const partnerWithSkillRatings = enrichedPartner ? {
      ...enrichedPartner,
      skillRatings: enrichedPartner.skillRatings || {},
      // Explicitly remove questionnaireResponses to avoid confusion
      questionnaireResponses: undefined,
    } : null;
    if (partnerWithSkillRatings) {
      delete partnerWithSkillRatings.questionnaireResponses;
    }

    // Use division from divisionStandings if partnership.division is null
    const resolvedDivision = partnership.division || partnership.divisionStandings?.[0]?.division || null;

    // Check registration status for both captain and partner
    const memberUserIds = [partnership.captainId];
    if (partnership.partnerId) {
      memberUserIds.push(partnership.partnerId);
    }

    const memberships = await prisma.seasonMembership.findMany({
      where: {
        seasonId,
        userId: { in: memberUserIds },
      },
      select: {
        userId: true,
        status: true,
        paymentStatus: true,
      },
    });

    const captainMembership = memberships.find(m => m.userId === partnership.captainId);
    const partnerMembership = partnership.partnerId
      ? memberships.find(m => m.userId === partnership.partnerId)
      : null;

    // Team is registered if both have ACTIVE memberships
    const isTeamRegistered = !!(
      captainMembership?.status === 'ACTIVE' &&
      (!partnership.partnerId || partnerMembership?.status === 'ACTIVE')
    );

    const result = {
      ...partnership,
      captain: captainWithSkillRatings,
      partner: partnerWithSkillRatings,
      division: resolvedDivision,
      // Registration status fields
      isTeamRegistered,
      captainMembership: captainMembership || null,
      partnerMembership: partnerMembership || null,
    };

    // Final debug log before returning
    console.log('🔍 getActivePartnership - Final result:', {
      hasCaptain: !!result.captain,
      hasPartner: !!result.partner,
      status: partnership.status,
      captainHasSkillRatings: !!result.captain?.skillRatings,
      partnerHasSkillRatings: !!result.partner?.skillRatings,
      captainSkillRatingsKeys: result.captain?.skillRatings ? Object.keys(result.captain.skillRatings) : [],
      partnerSkillRatingsKeys: result.partner?.skillRatings ? Object.keys(result.partner.skillRatings) : [],
      isTeamRegistered: result.isTeamRegistered,
      captainMembershipStatus: captainMembership?.status,
      partnerMembershipStatus: partnerMembership?.status,
    });

    return result;
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

/**
 * Get partnership status including pending withdrawal requests from both partners
 * Returns information about pending change requests from both the current user and their partner
 */
export const getPartnershipStatus = async (
  partnershipId: string,
  currentUserId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the partnership to validate access and get partner info
    const partnership = await prisma.partnership.findUnique({
      where: { id: partnershipId },
      select: {
        id: true,
        captainId: true,
        partnerId: true,
        status: true,
      },
    });

    if (!partnership) {
      return {
        success: false,
        message: 'Partnership not found',
      };
    }

    // Validate: Only partners can view status
    if (partnership.captainId !== currentUserId && partnership.partnerId !== currentUserId) {
      return {
        success: false,
        message: 'You are not authorized to view this partnership status',
      };
    }

    // Check if partnership is already dissolved
    const partnerHasLeft = partnership.status === 'DISSOLVED';

    // Get the partner's ID (the other person in the partnership)
    const partnerId = partnership.captainId === currentUserId
      ? partnership.partnerId
      : partnership.captainId;

    // Find all pending withdrawal requests for this partnership
    const pendingRequests = await prisma.withdrawalRequest.findMany({
      where: {
        partnershipId: partnershipId,
        status: 'PENDING',
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
      },
    });

    // Determine which user made each request
    const myRequest = pendingRequests.find(r => r.userId === currentUserId);
    const partnerRequest = pendingRequests.find(r => r.userId === partnerId);

    return {
      success: true,
      message: 'Partnership status retrieved successfully',
      data: {
        hasMyPendingRequest: !!myRequest,
        hasPartnerPendingRequest: !!partnerRequest,
        partnerHasLeft,
        myRequestedAt: myRequest?.createdAt?.toISOString() || null,
        partnerRequestedAt: partnerRequest?.createdAt?.toISOString() || null,
      },
    };
  } catch (error) {
    console.error('Error getting partnership status:', error);
    return {
      success: false,
      message: 'Failed to get partnership status',
    };
  }
};

// ============================================
// PARTNER REPLACEMENT FUNCTIONS
// ============================================

/**
 * Invite a replacement partner for an INCOMPLETE partnership
 * Used when a partner has left and the remaining player needs to find a new partner
 */
export const inviteReplacementPartner = async (
  partnershipId: string,
  captainId: string,
  recipientId: string,
  message?: string
): Promise<PairRequestResponse> => {
  try {
    // Find the INCOMPLETE partnership
    const partnership = await prisma.partnership.findUnique({
      where: { id: partnershipId },
      include: {
        captain: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true, status: true } },
      },
    });

    if (!partnership) {
      return {
        success: false,
        message: 'Partnership not found',
      };
    }

    // Validate: Partnership must be INCOMPLETE
    if (partnership.status !== 'INCOMPLETE') {
      return {
        success: false,
        message: 'Can only invite replacement partners for INCOMPLETE partnerships',
      };
    }

    // Validate: Only the captain can invite
    if (partnership.captainId !== captainId) {
      return {
        success: false,
        message: 'Only the team captain can invite a replacement partner',
      };
    }

    // Validate: Cannot invite yourself
    if (captainId === recipientId) {
      return {
        success: false,
        message: 'Cannot invite yourself as a partner',
      };
    }

    // Validate: Season must still allow changes (not finished)
    if (partnership.season.status === 'FINISHED') {
      return {
        success: false,
        message: 'Cannot invite partners after the season has finished',
      };
    }

    // Check if recipient already has an active partnership in this season
    const existingPartnership = await prisma.partnership.findFirst({
      where: {
        seasonId: partnership.seasonId,
        status: 'ACTIVE',
        OR: [
          { captainId: recipientId },
          { partnerId: recipientId },
        ],
      },
    });

    if (existingPartnership) {
      return {
        success: false,
        message: 'This player already has an active partnership in this season',
      };
    }

    // Check if there's already a pending invite to this recipient for this partnership
    const existingRequest = await prisma.pairRequest.findFirst({
      where: {
        requesterId: captainId,
        recipientId: recipientId,
        seasonId: partnership.seasonId,
        status: PairRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      return {
        success: false,
        message: 'You already have a pending invitation to this player',
      };
    }

    // Create the pair request with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const pairRequest = await prisma.pairRequest.create({
      data: {
        requesterId: captainId,
        recipientId: recipientId,
        seasonId: partnership.seasonId,
        message: message || null,
        status: PairRequestStatus.PENDING,
        expiresAt,
      },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        recipient: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true } },
      },
    });

    // Send notifications
    try {
      const leagueName = partnership.season?.name || 'this season';
      const captainName = partnership.captain?.name || partnership.captain?.username || 'A player';
      const recipientName = pairRequest.recipient?.name || pairRequest.recipient?.username || 'Partner';

      // Notification to recipient (push)
      const recipientNotif = notificationTemplates.doubles.replacementInviteReceived(
        captainName,
        leagueName
      );
      await notificationService.createNotification({
        userIds: recipientId,
        ...recipientNotif,
        seasonId: partnership.seasonId,
        pairRequestId: pairRequest.id,
      });

      // Notification to captain (in-app confirmation)
      const captainNotif = notificationTemplates.doubles.replacementInviteSent(
        recipientName,
        leagueName
      );
      await notificationService.createNotification({
        userIds: captainId,
        ...captainNotif,
        seasonId: partnership.seasonId,
        pairRequestId: pairRequest.id,
      });

      console.log(`🔔 Replacement partner invitation sent from ${captainId} to ${recipientId}`);
    } catch (notifErr) {
      console.error('❌ Failed to send replacement invite notifications:', notifErr);
    }

    return {
      success: true,
      message: 'Partner invitation sent successfully',
      data: {
        ...pairRequest,
        partnershipId: partnership.id,
      },
    };
  } catch (error) {
    console.error('Error inviting replacement partner:', error);
    return {
      success: false,
      message: 'Failed to send partner invitation',
    };
  }
};

/**
 * Accept a replacement partner invitation
 * Transitions the partnership from INCOMPLETE to ACTIVE
 */
export const acceptReplacementInvite = async (
  requestId: string,
  acceptingUserId: string
): Promise<PairRequestResponse> => {
  try {
    // Find the pair request
    const pairRequest = await prisma.pairRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        recipient: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true } },
      },
    });

    if (!pairRequest) {
      return {
        success: false,
        message: 'Invitation not found',
      };
    }

    // Validate: Only recipient can accept
    if (pairRequest.recipientId !== acceptingUserId) {
      return {
        success: false,
        message: 'You are not authorized to accept this invitation',
      };
    }

    // Validate: Request must be pending
    if (pairRequest.status !== PairRequestStatus.PENDING) {
      return {
        success: false,
        message: 'This invitation is no longer pending',
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
        message: 'This invitation has expired',
      };
    }

    // Find the INCOMPLETE partnership for the requester
    const incompletePartnership = await prisma.partnership.findFirst({
      where: {
        captainId: pairRequest.requesterId,
        seasonId: pairRequest.seasonId,
        status: 'INCOMPLETE',
      },
      include: {
        captain: { select: { id: true, name: true, username: true } },
        season: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
      },
    });

    if (!incompletePartnership) {
      return {
        success: false,
        message: 'No incomplete partnership found for this invitation',
      };
    }

    // Calculate new pair rating
    const pairRating = await calculatePairRating(
      pairRequest.requesterId,
      pairRequest.recipientId,
      pairRequest.seasonId
    );

    // Use a transaction to update everything atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the pair request to ACCEPTED
      await tx.pairRequest.update({
        where: { id: requestId },
        data: {
          status: PairRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 2. Update partnership: set partnerId, status to ACTIVE, recalculate pairRating
      const updatedPartnership = await tx.partnership.update({
        where: { id: incompletePartnership.id },
        data: {
          partnerId: acceptingUserId,
          status: 'ACTIVE',
          pairRating,
        },
        include: {
          captain: { select: { id: true, name: true, username: true, image: true } },
          partner: { select: { id: true, name: true, username: true, image: true } },
          season: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      });

      // 3. Create season membership for new partner (if not exists)
      const existingMembership = await tx.seasonMembership.findFirst({
        where: {
          userId: acceptingUserId,
          seasonId: pairRequest.seasonId,
        },
      });

      if (!existingMembership) {
        await tx.seasonMembership.create({
          data: {
            userId: acceptingUserId,
            seasonId: pairRequest.seasonId,
            divisionId: incompletePartnership.divisionId,
            status: 'ACTIVE',
          },
        });
      } else if (existingMembership.status !== 'ACTIVE') {
        await tx.seasonMembership.update({
          where: { id: existingMembership.id },
          data: { status: 'ACTIVE' },
        });
      }

      // 4. Auto-decline all other pending pair requests for this partnership's captain
      await tx.pairRequest.updateMany({
        where: {
          requesterId: pairRequest.requesterId,
          seasonId: pairRequest.seasonId,
          status: PairRequestStatus.PENDING,
          id: { not: requestId },
        },
        data: {
          status: PairRequestStatus.AUTO_DENIED,
          respondedAt: new Date(),
        },
      });

      return updatedPartnership;
    });

    // Send notifications
    try {
      const leagueName = pairRequest.season?.name || 'this season';
      const newPartnerName = pairRequest.recipient?.name || pairRequest.recipient?.username || 'Your new partner';

      // Notification to captain that new partner joined
      const captainNotif = notificationTemplates.doubles.newPartnerJoined(
        newPartnerName,
        leagueName
      );
      await notificationService.createNotification({
        userIds: pairRequest.requesterId,
        ...captainNotif,
        seasonId: pairRequest.seasonId,
        partnershipId: result.id,
      });

      console.log(`🔔 New partner joined notification sent to captain ${pairRequest.requesterId}`);
    } catch (notifErr) {
      console.error('❌ Failed to send new partner joined notification:', notifErr);
    }

    console.log(`Partnership ${result.id} transitioned from INCOMPLETE to ACTIVE. New partner: ${acceptingUserId}`);

    return {
      success: true,
      message: 'You have joined the team successfully!',
      data: result,
    };
  } catch (error) {
    console.error('Error accepting replacement invite:', error);
    return {
      success: false,
      message: 'Failed to accept invitation',
    };
  }
};

/**
 * Get eligible replacement partners for an INCOMPLETE partnership
 * Returns friends first, then other eligible players via search
 */
export const getEligibleReplacementPartners = async (
  userId: string,
  partnershipId: string,
  searchQuery?: string
): Promise<PairRequestResponse> => {
  try {
    // Find the INCOMPLETE partnership
    const partnership = await prisma.partnership.findUnique({
      where: { id: partnershipId },
      include: {
        season: { select: { id: true, name: true } },
      },
    });

    if (!partnership) {
      return {
        success: false,
        message: 'Partnership not found',
      };
    }

    // Validate: Only captain can get eligible partners
    if (partnership.captainId !== userId) {
      return {
        success: false,
        message: 'Only the team captain can view eligible partners',
      };
    }

    // Get user IDs who already have active partnerships in this season
    const usersWithPartnerships = await prisma.partnership.findMany({
      where: {
        seasonId: partnership.seasonId,
        status: 'ACTIVE',
      },
      select: {
        captainId: true,
        partnerId: true,
      },
    });

    const excludedUserIds = new Set<string>();
    excludedUserIds.add(userId); // Exclude self
    usersWithPartnerships.forEach(p => {
      excludedUserIds.add(p.captainId);
      if (p.partnerId) excludedUserIds.add(p.partnerId);
    });

    // Get friends first
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId },
          { recipientId: userId },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
            area: true,
            gender: true,
          },
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
          },
        },
      },
    });

    // Extract friend users (the other person in each friendship)
    const friendUsers = friendships.map(f =>
      f.requesterId === userId ? f.recipient : f.requester
    ).filter(friend => !excludedUserIds.has(friend.id));

    // If search query provided, search all users
    let searchResults: any[] = [];
    if (searchQuery && searchQuery.trim()) {
      const searchUsers = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(excludedUserIds) },
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { username: { contains: searchQuery, mode: 'insensitive' } },
            { displayUsername: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          displayUsername: true,
          image: true,
          area: true,
          gender: true,
        },
        take: 20,
      });
      searchResults = searchUsers;
    }

    // Enrich players with skill ratings
    const enrichedFriends = await Promise.all(
      friendUsers.map(friend => enrichPlayerWithSkills(friend))
    );
    const enrichedSearchResults = await Promise.all(
      searchResults.map(user => enrichPlayerWithSkills(user))
    );

    // Combine: friends first, then search results (excluding duplicates)
    const friendIds = new Set(enrichedFriends.map(f => f.id));
    const combinedPlayers = [
      ...enrichedFriends,
      ...enrichedSearchResults.filter(u => !friendIds.has(u.id)),
    ];

    return {
      success: true,
      message: 'Eligible partners retrieved successfully',
      data: {
        players: combinedPlayers,
        friendsCount: enrichedFriends.length,
        totalCount: combinedPlayers.length,
        usedFallback: enrichedFriends.length === 0 && combinedPlayers.length > 0,
      },
    };
  } catch (error) {
    console.error('Error getting eligible replacement partners:', error);
    return {
      success: false,
      message: 'Failed to get eligible partners',
    };
  }
};
