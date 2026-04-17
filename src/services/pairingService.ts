import { prisma } from '../lib/prisma';
import { Prisma, PrismaClient, PairRequestStatus } from '@prisma/client';
import { enrichPlayerWithSkills } from './player/utils/playerTransformer';
import { notificationTemplates } from '../helpers/notifications';
import { notificationService } from './notificationService';
import { io } from '../app';
import { translateTransactionRaceError } from '../utils/prismaErrors';

/**
 * Pairing Service
 * Handles all business logic for team pairing requests and partnerships
 *
 * Real-time: mutations emit `partnership_updated` or `pair_request_updated`
 * socket events (fix for #103-2). Frontend screens listen for these in
 * ManagePartnershipScreen.tsx / DoublesTeamPairingScreen.tsx.
 *
 * Concurrency: state-changing partnership writes use atomic `updateMany`
 * status gates inside Serializable transactions (fix for #103-3, #103-8,
 * #103-10, #103-11). See helper `updatePartnershipStatusGated` below.
 */

// ==========================================
// #103 SHARED HELPERS
// ==========================================

type PartnershipAction =
  | 'created'
  | 'partner_joined'
  | 'dissolved'
  | 'incomplete_cancelled'
  | 'request_received'
  | 'request_resolved';

/**
 * Emit `partnership_updated` socket event to both captain and (optional) partner.
 * Used by every pairingService mutation that changes partnership state so that
 * frontend listeners (ManagePartnershipScreen, DoublesTeamPairingScreen) can
 * refresh without waiting for the 30-second poll.
 *
 * Fix for #103-2.
 */
function emitPartnershipUpdated(params: {
  captainId: string;
  partnerId?: string | null;
  partnershipId: string;
  seasonId: string;
  status: string;
  action: PartnershipAction;
}): void {
  try {
    const payload = {
      partnershipId: params.partnershipId,
      seasonId: params.seasonId,
      status: params.status,
      action: params.action,
    };
    io.to(params.captainId).emit('partnership_updated', payload);
    if (params.partnerId && params.partnerId !== params.captainId) {
      io.to(params.partnerId).emit('partnership_updated', payload);
    }
  } catch (socketError) {
    console.error('Error emitting partnership_updated socket event:', socketError);
  }
}

/**
 * Emit `pair_request_updated` socket event. Used for send/accept/deny/cancel
 * of legacy pair requests (not partnerships) so both requester and recipient
 * see real-time state changes.
 *
 * Fix for #103-2.
 */
function emitPairRequestUpdated(params: {
  requesterId: string;
  recipientId: string;
  pairRequestId: string;
  seasonId: string;
  status: string;
}): void {
  try {
    const payload = {
      pairRequestId: params.pairRequestId,
      seasonId: params.seasonId,
      status: params.status,
    };
    io.to(params.requesterId).emit('pair_request_updated', payload);
    io.to(params.recipientId).emit('pair_request_updated', payload);
  } catch (socketError) {
    console.error('Error emitting pair_request_updated socket event:', socketError);
  }
}

/**
 * Validate that two players satisfy the season category's gender restriction.
 * Backs #103-14 — no gender enforcement on the invite/accept endpoints.
 *
 * Returns `{ valid: false, reason }` if the category requires a gender mix the
 * two players don't satisfy. Returns `{ valid: true }` if the category has no
 * restriction, no category, or both players match.
 *
 * Also validates that the category is a DOUBLES game type — rejects attempts
 * to create partnerships in a singles category.
 *
 * Call from every path that creates/extends a partnership: send and accept
 * entry points for pair requests and season invitations.
 */
export async function validateCategoryGenderMatch(
  seasonId: string,
  userAId: string,
  userBId: string,
  prismaClient: Prisma.TransactionClient | PrismaClient = prisma as PrismaClient,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const season = await prismaClient.season.findUnique({
      where: { id: seasonId },
      select: {
        category: {
          select: {
            genderCategory: true,
            genderRestriction: true,
            gameType: true,
          },
        },
      },
    });

    const category = season?.category;
    if (!category) {
      // No category configured — skip gender validation (backward compat).
      return { valid: true };
    }

    // The category must be a DOUBLES game type.
    if (category.gameType && category.gameType !== 'DOUBLES') {
      return {
        valid: false,
        reason: 'This season is not a doubles category',
      };
    }

    const restriction = category.genderCategory ?? category.genderRestriction;
    if (!restriction || restriction === 'OPEN') {
      return { valid: true };
    }

    const [userA, userB] = await Promise.all([
      prismaClient.user.findUnique({ where: { id: userAId }, select: { gender: true } }),
      prismaClient.user.findUnique({ where: { id: userBId }, select: { gender: true } }),
    ]);

    const ag = userA?.gender?.toLowerCase();
    const bg = userB?.gender?.toLowerCase();

    if (restriction === 'MIXED') {
      if (!ag || !bg || ag === bg) {
        return {
          valid: false,
          reason: 'Mixed doubles requires one male and one female player',
        };
      }
      return { valid: true };
    }

    if (restriction === 'MALE') {
      if (ag !== 'male' || bg !== 'male') {
        return {
          valid: false,
          reason: "This is a men's doubles category — both players must be male",
        };
      }
      return { valid: true };
    }

    if (restriction === 'FEMALE') {
      if (ag !== 'female' || bg !== 'female') {
        return {
          valid: false,
          reason: "This is a women's doubles category — both players must be female",
        };
      }
      return { valid: true };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating category gender match:', error);
    // Fail-open: if the validation itself errors, do not block the action.
    // We prefer a rare false-negative over blocking legitimate pairings.
    return { valid: true };
  }
}

/**
 * Check that a user has completed the season's sport questionnaire.
 *
 * Backs #103-15 — sendSeasonInvitation only checks the recipient, not the
 * sender. This helper is called from every invite entry point to check both
 * players before the partnership is created.
 */
export async function hasCompletedQuestionnaireForSeason(
  userId: string,
  seasonSport: string,
  prismaClient: Prisma.TransactionClient | PrismaClient = prisma as PrismaClient,
): Promise<boolean> {
  const response = await prismaClient.questionnaireResponse.findFirst({
    where: {
      userId,
      sport: { equals: seasonSport, mode: 'insensitive' },
      completedAt: { not: null },
    },
    select: { id: true },
  });
  return !!response;
}

// `translateTransactionRaceError` was moved to src/utils/prismaErrors.ts in
// #103 Part 5.2 so other services (match submission, chat, notifications)
// can reuse it without importing from pairingService. The re-export below
// preserves the historical import path for existing callers like
// seasonWithdrawalService.ts.
export { translateTransactionRaceError } from '../utils/prismaErrors';

/**
 * Best-effort helper to derive the season's sport from its league.
 * Falls back to 'pickleball' to match the existing `seasonInvitationService`
 * default at line ~55.
 */
async function getSeasonSport(
  seasonId: string,
  prismaClient: Prisma.TransactionClient | PrismaClient = prisma as PrismaClient,
): Promise<string> {
  const season = await prismaClient.season.findUnique({
    where: { id: seasonId },
    select: {
      leagues: { select: { sportType: true }, take: 1 },
    },
  });
  return season?.leagues[0]?.sportType?.toLowerCase() ?? 'pickleball';
}

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

    // Check season exists and is open for registration.
    // Fixes #103-13: previously the select fetched `startDate`, `status`,
    // `categoryId` but never validated them. The function accepted pair
    // requests for CANCELLED / FINISHED / singles seasons.
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        regiDeadline: true,
        status: true,
        leagues: { select: { sportType: true }, take: 1 },
      },
    });

    if (!season) {
      return {
        success: false,
        message: 'Season not found',
      };
    }

    if (season.status !== 'UPCOMING' && season.status !== 'ACTIVE') {
      return {
        success: false,
        message: 'This season is not accepting registrations',
      };
    }

    const now = new Date();
    if (season.regiDeadline && now > season.regiDeadline) {
      return {
        success: false,
        message: 'Season registration deadline has passed',
      };
    }

    // #103-14: enforce category gender restriction + doubles-only.
    const genderCheck = await validateCategoryGenderMatch(seasonId, requesterId, recipientId);
    if (!genderCheck.valid) {
      return { success: false, message: genderCheck.reason || 'Players do not match the season category' };
    }

    // #103-15: both players must have completed the season sport questionnaire
    // BEFORE a pair request can be sent. Previously only recipient was checked
    // (and only at accept time, too late for the sender to back out).
    const seasonSport = season.leagues[0]?.sportType?.toLowerCase() ?? 'pickleball';
    const [requesterDone, recipientDone] = await Promise.all([
      hasCompletedQuestionnaireForSeason(requesterId, seasonSport),
      hasCompletedQuestionnaireForSeason(recipientId, seasonSport),
    ]);
    if (!requesterDone) {
      return {
        success: false,
        message: 'Complete your questionnaire for this sport before inviting a partner',
      };
    }
    if (!recipientDone) {
      return {
        success: false,
        message: 'This player has not completed their questionnaire for this sport',
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

    // Send notifications: recipient gets BOTH push + in-app (NOTIF-021)
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

      // partnerRequestSent removed — sender confirmation not used
      // const senderNotif = notificationTemplates.doubles.partnerRequestSent(
      //   pairRequest.recipient.name || pairRequest.recipient.username || 'Someone',
      //   pairRequest.season.name || 'this season'
      // );
      // await notificationService.createNotification({
      //   userIds: pairRequest.requesterId,
      //   ...senderNotif,
      //   seasonId: pairRequest.season.id,
      //   pairRequestId: pairRequest.id,
      // });

      console.log('🔔 Pairing: created recipient PUSH notification');
    } catch (notifErr) {
      console.error('❌ Failed to create pair request notifications:', notifErr);
    }

    console.log(`Pair request sent from ${requesterId} to ${recipientId} for season ${seasonId}`);

    // #103-2: notify both parties in real-time.
    emitPairRequestUpdated({
      requesterId,
      recipientId,
      pairRequestId: pairRequest.id,
      seasonId,
      status: 'PENDING',
    });

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
 * Accept a pair request and create partnership.
 *
 * Fixes #103-8: The transaction now re-checks, under Serializable isolation,
 * that neither player is in another ACTIVE/INCOMPLETE partnership for this
 * season. Also auto-declines other pending pair requests from/to either
 * player so the player's inbox is clean after accepting.
 *
 * Future: a filtered partial unique index on `(captainId, seasonId)` /
 * `(partnerId, seasonId)` where status IN ('ACTIVE','INCOMPLETE') would make
 * this impossible at the database layer. That requires a raw SQL migration
 * (Prisma doesn't support partial uniqueness natively) — tracked as a
 * follow-up in docs/issues/dissections/103-partnership-invite-edge-cases.md.
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

    // #103 Part 5 finding: season must still be accepting registrations at
    // accept time. Otherwise an invite sent before admin cancelled a season
    // could still create a partnership in a CANCELLED / FINISHED season.
    const seasonForCheck: any = pairRequest.season;
    if (seasonForCheck.status !== 'UPCOMING' && seasonForCheck.status !== 'ACTIVE') {
      return {
        success: false,
        message: 'This season is no longer accepting registrations',
      };
    }
    if (seasonForCheck.regiDeadline && new Date(seasonForCheck.regiDeadline) < new Date()) {
      return {
        success: false,
        message: 'Registration deadline has passed',
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

    // #103-8: Serializable transaction with re-checks inside the txn.
    // Protects against: (a) state drift between send and accept, (b) two
    // concurrent accepts by different recipients on requests from the same
    // requester, (c) the requester having independently formed another
    // partnership since the request was sent.
    const result = await prisma.$transaction(async (tx) => {
      // #103-8 conflict check: neither player may be in another partnership.
      const conflict = await tx.partnership.findFirst({
        where: {
          seasonId: pairRequest.seasonId,
          status: { in: ['ACTIVE', 'INCOMPLETE'] },
          OR: [
            { captainId: pairRequest.requesterId },
            { partnerId: pairRequest.requesterId },
            { captainId: pairRequest.recipientId },
            { partnerId: pairRequest.recipientId },
          ],
        },
        select: { id: true, captainId: true, partnerId: true },
      });
      if (conflict) {
        throw new Error('One or both players are already in a partnership for this season');
      }

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

      // #103-8: auto-decline every other pending pair request from/to either
      // player for this season so their inboxes are clean.
      await tx.pairRequest.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: PairRequestStatus.PENDING,
          id: { not: requestId },
          OR: [
            { requesterId: pairRequest.requesterId },
            { recipientId: pairRequest.requesterId },
            { requesterId: pairRequest.recipientId },
            { recipientId: pairRequest.recipientId },
          ],
        },
        data: { status: PairRequestStatus.AUTO_DENIED, respondedAt: new Date() },
      });

      // #103-18 scoped cleanup: auto-cancel any overlapping season invitations
      // for either player so the two flows don't compete.
      await tx.seasonInvitation.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: 'PENDING',
          OR: [
            { senderId: pairRequest.requesterId },
            { recipientId: pairRequest.requesterId },
            { senderId: pairRequest.recipientId },
            { recipientId: pairRequest.recipientId },
          ],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return { updatedRequest, partnership };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

        // partnerRequestAcceptedPartner removed — partner confirmation not used
        // const partnerNotif = notificationTemplates.doubles.partnerRequestAcceptedPartner(...)
        // await notificationService.createNotification({ userIds: result.partnership.partner.id, ... });

        console.log('🔔 Pairing: partnership accepted notification sent (captain only)');
      } catch (notifErr) {
        console.error('❌ Failed to create partnership notifications:', notifErr);
      }

      console.log(`Pair request ${requestId} accepted, partnership created`);

    // #103-2: emit real-time event so both parties see the transition.
    emitPartnershipUpdated({
      captainId: result.partnership.captainId,
      partnerId: result.partnership.partnerId,
      partnershipId: result.partnership.id,
      seasonId: result.partnership.seasonId,
      status: result.partnership.status,
      action: 'created',
    });
    emitPairRequestUpdated({
      requesterId: pairRequest.requesterId,
      recipientId: pairRequest.recipientId,
      pairRequestId: requestId,
      seasonId: pairRequest.seasonId,
      status: 'ACCEPTED',
    });

    return {
      success: true,
      message: 'Pair request accepted successfully',
      data: result.partnership,
    };
  } catch (error) {
    console.error('Error accepting pair request:', error);
    // Propagate the specific transaction error message (conflict / state drift)
    const message = translateTransactionRaceError(error) ?? (error instanceof Error ? error.message : 'Failed to accept pair request');
    return {
      success: false,
      message,
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
      // #103-8: conflict check — the requester (incoming new partner) must
      // not already be in another partnership. The captain-side is inherently
      // safe because we atomically gate the INCOMPLETE update below.
      const requesterConflict = await tx.partnership.findFirst({
        where: {
          seasonId: pairRequest.seasonId,
          status: { in: ['ACTIVE', 'INCOMPLETE'] },
          id: { not: incompletePartnership.id },
          OR: [
            { captainId: newPartnerId },
            { partnerId: newPartnerId },
          ],
        },
        select: { id: true },
      });
      if (requesterConflict) {
        throw new Error('This player is already in a partnership for this season');
      }

      // 1. Update the pair request to ACCEPTED
      await tx.pairRequest.update({
        where: { id: requestId },
        data: {
          status: PairRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 2. Update INCOMPLETE partnership: add partner, change status to ACTIVE.
      //    #103-3/#103-10: use an atomic status gate — if the partnership has
      //    been dissolved or completed by another path since we read it, this
      //    updateMany returns count=0 and we abort.
      const gatedUpdate = await tx.partnership.updateMany({
        where: { id: incompletePartnership.id, status: 'INCOMPLETE' },
        data: {
          partnerId: newPartnerId,
          status: 'ACTIVE',
          pairRating,
        },
      });
      if (gatedUpdate.count === 0) {
        throw new Error('Partnership is no longer accepting new partners');
      }
      const updatedPartnership = await tx.partnership.findUnique({
        where: { id: incompletePartnership.id },
        include: {
          captain: { select: { id: true, name: true, username: true, image: true } },
          partner: { select: { id: true, name: true, username: true, image: true } },
          season: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      });
      if (!updatedPartnership) {
        throw new Error('Partnership disappeared after update');
      }

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

      // #103-18: also cancel any overlapping season invitations for either player.
      await tx.seasonInvitation.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: 'PENDING',
          OR: [
            { senderId: acceptingUserId },
            { recipientId: acceptingUserId },
            { senderId: newPartnerId },
            { recipientId: newPartnerId },
          ],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return updatedPartnership;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

      // Notification to new partner removed — partnerRequestAcceptedPartner not used
      // const partnerNotif = notificationTemplates.doubles.partnerRequestAcceptedPartner(captainName, leagueName);
      // if (result.partner) { await notificationService.createNotification({ userIds: result.partner.id, ... }); }

      console.log(`🔔 Pair request ${requestId} accepted into INCOMPLETE partnership ${result.id}`);
    } catch (notifErr) {
      console.error('❌ Failed to send notifications for INCOMPLETE partnership acceptance:', notifErr);
    }

    console.log(`✅ Partnership ${result.id} transitioned from INCOMPLETE to ACTIVE. New partner: ${newPartnerId}`);

    // #103-2: notify both players in real-time.
    emitPartnershipUpdated({
      captainId: result.captainId,
      partnerId: result.partnerId,
      partnershipId: result.id,
      seasonId: result.seasonId,
      status: result.status,
      action: 'partner_joined',
    });
    emitPairRequestUpdated({
      requesterId: pairRequest.requesterId,
      recipientId: pairRequest.recipientId,
      pairRequestId: requestId,
      seasonId: pairRequest.seasonId,
      status: 'ACCEPTED',
    });

    return {
      success: true,
      message: 'Partner joined your team successfully!',
      data: result,
    };
  } catch (error) {
    console.error('Error accepting pair request into incomplete partnership:', error);
    const message = translateTransactionRaceError(error) ?? (error instanceof Error ? error.message : 'Failed to accept pair request');
    return {
      success: false,
      message,
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

    // #103-2: emit socket event so the requester's UI (e.g. pending_sent state)
    // transitions out immediately, not after the 30-second poll.
    emitPairRequestUpdated({
      requesterId: pairRequest.requesterId,
      recipientId: pairRequest.recipientId,
      pairRequestId: requestId,
      seasonId: pairRequest.seasonId,
      status: 'DENIED',
    });

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

    // #103-2: emit socket event so the recipient's UI reflects the cancellation.
    emitPairRequestUpdated({
      requesterId: pairRequest.requesterId,
      recipientId: pairRequest.recipientId,
      pairRequestId: requestId,
      seasonId: pairRequest.seasonId,
      status: 'CANCELLED',
    });

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

    // TODO(dissolution-matches): No check for scheduled/pending matches before dissolution.
    // If the team has upcoming matches, dissolution proceeds and those matches stay SCHEDULED
    // with the departing player still listed as a participant. The remaining player (INCOMPLETE
    // partnership) can't play those matches without a new partner. Options if stricter control needed:
    //   1. Block dissolution if active matches exist (could trap players in unwanted partnerships)
    //   2. Auto-cancel the affected matches and notify opponents
    //   3. Warn the user but allow dissolution (current behavior, matches handled by admin)
    // Current approach: admin handles orphaned matches separately via match management dashboard.

    // Validate: Cannot dissolve if season is completed
    if (partnership.season.status === 'FINISHED') {
      return {
        success: false,
        message: 'Cannot dissolve partnership after season is completed',
      };
    }

    // #103-9: if this is an INCOMPLETE partnership, there is no "remaining player"
    // to inherit. Treat the dissolve as a full cancellation for the captain: mark
    // DISSOLVED, remove captain's membership, clean up their pending invitations.
    // This is what gives INCOMPLETE captains a path to escape the season.
    if (partnership.status === 'INCOMPLETE') {
      if (partnership.captainId !== dissolvingUserId) {
        return {
          success: false,
          message: 'Only the team captain can cancel an incomplete partnership',
        };
      }

      const incompleteResult = await prisma.$transaction(async (tx) => {
        // #103-3/#103-10: atomic status gate.
        const gated = await tx.partnership.updateMany({
          where: { id: partnershipId, status: 'INCOMPLETE' },
          data: { status: 'DISSOLVED', dissolvedAt: new Date() },
        });
        if (gated.count === 0) {
          throw new Error('Partnership is no longer active');
        }

        // Remove captain's membership so they can re-enter / be re-invited.
        await tx.seasonMembership.updateMany({
          where: {
            userId: dissolvingUserId,
            seasonId: partnership.seasonId,
          },
          data: { status: 'REMOVED' },
        });

        // #103-18: auto-cancel this player's pending pair requests and
        // season invitations for the season.
        await tx.pairRequest.updateMany({
          where: {
            seasonId: partnership.seasonId,
            status: 'PENDING',
            OR: [
              { requesterId: dissolvingUserId },
              { recipientId: dissolvingUserId },
            ],
          },
          data: { status: PairRequestStatus.AUTO_DENIED, respondedAt: new Date() },
        });

        await tx.seasonInvitation.updateMany({
          where: {
            seasonId: partnership.seasonId,
            status: 'PENDING',
            OR: [
              { senderId: dissolvingUserId },
              { recipientId: dissolvingUserId },
            ],
          },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        });

        return partnership;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // #103-2: emit real-time event.
      emitPartnershipUpdated({
        captainId: dissolvingUserId,
        partnerId: null,
        partnershipId: incompleteResult.id,
        seasonId: incompleteResult.seasonId,
        status: 'DISSOLVED',
        action: 'incomplete_cancelled',
      });

      console.log(`Incomplete partnership ${partnershipId} cancelled by captain ${dissolvingUserId}`);

      return {
        success: true,
        message: 'You have left the season. Your team slot is now released.',
        data: { id: partnershipId, status: 'DISSOLVED' },
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

    // Defensive — this should never trigger for ACTIVE partnerships because
    // partnerId is required when status=ACTIVE, but we keep the guard for
    // schema-integrity anomalies.
    if (!remainingPlayerId || !remainingPlayer) {
      return {
        success: false,
        message: 'Cannot dissolve partnership - no remaining player found',
      };
    }

    // #103-3/#103-10/#103-18: atomic status-gated dissolve + cleanup sweep for
    // the dissolving player's pending requests & invitations. Wrapped in
    // Serializable isolation to defeat the concurrent-dissolve race AND the
    // sequential stale-UI race (where a player taps Leave on a partnership
    // that was already dissolved by the other player's tap).
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomic gate: only proceed if partnership is still ACTIVE.
      const gated = await tx.partnership.updateMany({
        where: { id: partnershipId, status: 'ACTIVE' },
        data: { status: 'DISSOLVED', dissolvedAt: new Date() },
      });
      if (gated.count === 0) {
        throw new Error('Partnership is no longer active');
      }

      // 2. Create new INCOMPLETE partnership for remaining player.
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

      // 4. Only remove the departing player's membership
      await tx.seasonMembership.updateMany({
        where: {
          userId: dissolvingUserId,
          seasonId: partnership.seasonId,
        },
        data: {
          status: 'REMOVED',
        },
      });

      // 5. #103-18: auto-cancel the dissolving player's pending pair requests
      // and season invitations for this season. We intentionally do NOT sweep
      // the remaining player's pending rows — those may be their path to a
      // new partner.
      await tx.pairRequest.updateMany({
        where: {
          seasonId: partnership.seasonId,
          status: 'PENDING',
          OR: [
            { requesterId: dissolvingUserId },
            { recipientId: dissolvingUserId },
          ],
        },
        data: { status: PairRequestStatus.AUTO_DENIED, respondedAt: new Date() },
      });

      await tx.seasonInvitation.updateMany({
        where: {
          seasonId: partnership.seasonId,
          status: 'PENDING',
          OR: [
            { senderId: dissolvingUserId },
            { recipientId: dissolvingUserId },
          ],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return { incompletePartnership };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

    // #103-2: notify both players in real-time.
    // - The dissolving player needs to clear their active partnership state.
    // - The remaining player needs to see their new INCOMPLETE partnership.
    emitPartnershipUpdated({
      captainId: partnership.captainId,
      partnerId: partnership.partnerId,
      partnershipId,
      seasonId: partnership.seasonId,
      status: 'DISSOLVED',
      action: 'dissolved',
    });
    emitPartnershipUpdated({
      captainId: remainingPlayerId,
      partnerId: null,
      partnershipId: result.incompletePartnership.id,
      seasonId: partnership.seasonId,
      status: 'INCOMPLETE',
      action: 'created',
    });

    return {
      success: true,
      message: 'Partnership dissolved successfully. Your partner can now find a new teammate.',
      data: result.incompletePartnership,
    };
  } catch (error) {
    console.error('Error dissolving partnership:', error);
    const message = translateTransactionRaceError(error) ?? (error instanceof Error ? error.message : 'Failed to dissolve partnership');
    return {
      success: false,
      message,
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
    // console.log('🔍 getActivePartnership - Captain skillRatings:', {
    //   captainId: enrichedCaptain.id,
    //   captainName: enrichedCaptain.name,
    //   hasSkillRatings: !!enrichedCaptain.skillRatings,
    //   skillRatingsKeys: enrichedCaptain.skillRatings ? Object.keys(enrichedCaptain.skillRatings) : [],
    //   skillRatings: enrichedCaptain.skillRatings,
    //   captainKeys: Object.keys(enrichedCaptain),
    // });

    if (enrichedPartner) {
      // console.log('🔍 getActivePartnership - Partner skillRatings:', {
      //   partnerId: enrichedPartner.id,
      //   partnerName: enrichedPartner.name,
      //   hasSkillRatings: !!enrichedPartner.skillRatings,
      //   skillRatingsKeys: enrichedPartner.skillRatings ? Object.keys(enrichedPartner.skillRatings) : [],
      //   skillRatings: enrichedPartner.skillRatings,
      //   partnerKeys: Object.keys(enrichedPartner),
      // });
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
 * Expire old pending requests (to be run as a scheduled job).
 *
 * #103-1/#103-12: fan out `pair_request_updated` events after the bulk
 * expire so any connected clients see their pending requests disappear
 * immediately instead of on next poll.
 */
export const expireOldRequests = async () => {
  try {
    const now = new Date();

    const affected = await prisma.pairRequest.findMany({
      where: {
        status: PairRequestStatus.PENDING,
        expiresAt: { lt: now },
      },
      select: { id: true, requesterId: true, recipientId: true, seasonId: true },
    });

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

    for (const row of affected) {
      emitPairRequestUpdated({
        requesterId: row.requesterId,
        recipientId: row.recipientId,
        pairRequestId: row.id,
        seasonId: row.seasonId,
        status: 'EXPIRED',
      });
    }

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
    if (partnership.season.status === 'FINISHED' || partnership.season.status === 'CANCELLED') {
      return {
        success: false,
        message: 'Cannot invite partners in a finished or cancelled season',
      };
    }

    // #103-14: enforce category gender restriction + doubles-only.
    const genderCheck = await validateCategoryGenderMatch(partnership.seasonId, captainId, recipientId);
    if (!genderCheck.valid) {
      return { success: false, message: genderCheck.reason || 'Players do not match the season category' };
    }

    // #103-15: both captain and recipient must have completed the sport questionnaire.
    const seasonSport = await getSeasonSport(partnership.seasonId);
    const [captainDone, recipientDone] = await Promise.all([
      hasCompletedQuestionnaireForSeason(captainId, seasonSport),
      hasCompletedQuestionnaireForSeason(recipientId, seasonSport),
    ]);
    if (!captainDone) {
      return {
        success: false,
        message: 'Complete your questionnaire for this sport before inviting a partner',
      };
    }
    if (!recipientDone) {
      return {
        success: false,
        message: 'This player has not completed their questionnaire for this sport',
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

      // replacementInviteReceived / replacementInviteSent removed — not used
      // const recipientNotif = notificationTemplates.doubles.replacementInviteReceived(captainName, leagueName);
      // await notificationService.createNotification({ userIds: recipientId, ... });
      // const captainNotif = notificationTemplates.doubles.replacementInviteSent(recipientName, leagueName);
      // await notificationService.createNotification({ userIds: captainId, ... });

      console.log(`🔔 Replacement partner invitation sent from ${captainId} to ${recipientId}`);
    } catch (notifErr) {
      console.error('❌ Failed to send replacement invite notifications:', notifErr);
    }

    // #103-2: notify both captain and recipient of the new pending request.
    emitPairRequestUpdated({
      requesterId: captainId,
      recipientId,
      pairRequestId: pairRequest.id,
      seasonId: partnership.seasonId,
      status: 'PENDING',
    });

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

    // Serializable transaction + atomic status gate (fix for #103-3/#103-8/#103-10).
    const result = await prisma.$transaction(async (tx) => {
      // Conflict check: the accepting user must not already be in another partnership.
      const conflict = await tx.partnership.findFirst({
        where: {
          seasonId: pairRequest.seasonId,
          status: { in: ['ACTIVE', 'INCOMPLETE'] },
          id: { not: incompletePartnership.id },
          OR: [
            { captainId: acceptingUserId },
            { partnerId: acceptingUserId },
          ],
        },
        select: { id: true },
      });
      if (conflict) {
        throw new Error('You are already in a partnership for this season');
      }

      // 1. Update the pair request to ACCEPTED
      await tx.pairRequest.update({
        where: { id: requestId },
        data: {
          status: PairRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 2. Atomic gate on partnership transition: INCOMPLETE -> ACTIVE
      const gated = await tx.partnership.updateMany({
        where: { id: incompletePartnership.id, status: 'INCOMPLETE' },
        data: {
          partnerId: acceptingUserId,
          status: 'ACTIVE',
          pairRating,
        },
      });
      if (gated.count === 0) {
        throw new Error('Partnership is no longer accepting new partners');
      }
      const updatedPartnership = await tx.partnership.findUnique({
        where: { id: incompletePartnership.id },
        include: {
          captain: { select: { id: true, name: true, username: true, image: true } },
          partner: { select: { id: true, name: true, username: true, image: true } },
          season: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      });
      if (!updatedPartnership) {
        throw new Error('Partnership disappeared after update');
      }

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

      // 4. Auto-decline other pending pair requests for BOTH the captain and
      // the new partner so their inboxes are clean.
      await tx.pairRequest.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: PairRequestStatus.PENDING,
          id: { not: requestId },
          OR: [
            { requesterId: pairRequest.requesterId },
            { recipientId: pairRequest.requesterId },
            { requesterId: acceptingUserId },
            { recipientId: acceptingUserId },
          ],
        },
        data: {
          status: PairRequestStatus.AUTO_DENIED,
          respondedAt: new Date(),
        },
      });

      // #103-18: also cancel overlapping season invitations.
      await tx.seasonInvitation.updateMany({
        where: {
          seasonId: pairRequest.seasonId,
          status: 'PENDING',
          OR: [
            { senderId: pairRequest.requesterId },
            { recipientId: pairRequest.requesterId },
            { senderId: acceptingUserId },
            { recipientId: acceptingUserId },
          ],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return updatedPartnership;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

    // #103-2: notify both parties of the transition.
    emitPartnershipUpdated({
      captainId: result.captainId,
      partnerId: result.partnerId,
      partnershipId: result.id,
      seasonId: result.seasonId,
      status: result.status,
      action: 'partner_joined',
    });
    emitPairRequestUpdated({
      requesterId: pairRequest.requesterId,
      recipientId: pairRequest.recipientId,
      pairRequestId: requestId,
      seasonId: pairRequest.seasonId,
      status: 'ACCEPTED',
    });

    return {
      success: true,
      message: 'You have joined the team successfully!',
      data: result,
    };
  } catch (error) {
    console.error('Error accepting replacement invite:', error);
    const message = translateTransactionRaceError(error) ?? (error instanceof Error ? error.message : 'Failed to accept invitation');
    return {
      success: false,
      message,
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
