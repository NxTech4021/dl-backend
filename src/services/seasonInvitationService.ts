import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { io } from '../app';
import {
  validateCategoryGenderMatch,
  hasCompletedQuestionnaireForSeason,
} from './pairingService';

// #103-1 shared emit helper for season invitation state changes.
function emitSeasonInvitationUpdated(params: {
  senderId: string;
  recipientId: string;
  invitationId: string;
  seasonId: string;
  status: string;
}): void {
  try {
    const payload = {
      invitationId: params.invitationId,
      seasonId: params.seasonId,
      status: params.status,
    };
    io.to(params.senderId).emit('season_invitation_updated', payload);
    io.to(params.recipientId).emit('season_invitation_updated', payload);
  } catch (socketError) {
    console.error('Error emitting season_invitation_updated:', socketError);
  }
}

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
        startDate: true,
        leagues: {
          select: {
            id: true,
            sportType: true
          }
        }
      }
    });

    if (!season) {
      return { success: false, message: 'Season not found' };
    }

    // Get season sport type (from league sportType or infer from categories)
    const seasonSport = season.leagues[0]?.sportType?.toLowerCase() || 'pickleball';

    // #103-14: enforce category gender restriction + doubles-only.
    const genderCheck = await validateCategoryGenderMatch(seasonId, senderId, recipientId);
    if (!genderCheck.valid) {
      return { success: false, message: genderCheck.reason || 'Players do not match the season category' };
    }

    // #103-15: both sender and recipient must have completed the sport questionnaire.
    const [senderDone, recipientDone] = await Promise.all([
      hasCompletedQuestionnaireForSeason(senderId, seasonSport),
      hasCompletedQuestionnaireForSeason(recipientId, seasonSport),
    ]);
    if (!senderDone) {
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

    // Validate: Registration is still open
    // Players can register after season starts as long as registration deadline hasn't passed
    const now = new Date();

    if (season.status !== 'UPCOMING' && season.status !== 'ACTIVE') {
      // Commented out: 'ONGOING' doesn't exist in SeasonStatus enum (only UPCOMING, ACTIVE, FINISHED, CANCELLED)
      return { success: false, message: 'This season is not accepting registrations' };
    }

    if (season.regiDeadline && now > season.regiDeadline) {
      return { success: false, message: 'Registration deadline has passed' };
    }

    // #103-4: sender must not be in ACTIVE *or* INCOMPLETE partnership.
    // Previously the send-path only blocked ACTIVE, which meant senders with an
    // orphaned INCOMPLETE could create invitations that always failed at accept
    // time — leaving both sides stuck in a PENDING state.
    const senderExistingPartnership = await prisma.partnership.findFirst({
      where: {
        OR: [
          { captainId: senderId, seasonId },
          { partnerId: senderId, seasonId }
        ],
        status: { in: ['ACTIVE', 'INCOMPLETE'] }
      }
    });

    if (senderExistingPartnership) {
      const msg = senderExistingPartnership.status === 'INCOMPLETE'
        ? 'You have an incomplete partnership for this season — open Manage Partnership to find a replacement.'
        : 'You already have a partnership in this season';
      return { success: false, message: msg };
    }

    // Recipient may be in INCOMPLETE (the flow intentionally supports completing
    // an INCOMPLETE partnership via acceptSeasonInvitation), but not ACTIVE.
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

    // #103-17 lazy expiry-on-read: flip any stale PENDING rows between these
    // two users to EXPIRED before checking for duplicates. This works together
    // with the fix for #103-12 (re-enabled cron) and ensures that even if the
    // cron is paused (e.g. right after a server restart), users can still
    // re-invite after an abandoned invitation is past its 7-day expiry.
    await prisma.seasonInvitation.updateMany({
      where: {
        seasonId,
        status: 'PENDING',
        expiresAt: { lt: now },
        OR: [
          { senderId, recipientId },
          { senderId: recipientId, recipientId: senderId },
        ],
      },
      data: { status: 'EXPIRED', respondedAt: now },
    });

    // Duplicate check: only block if an UNEXPIRED pending invitation exists.
    const existingPendingInvitation = await prisma.seasonInvitation.findFirst({
      where: {
        OR: [
          { senderId, recipientId, seasonId, status: 'PENDING', expiresAt: { gt: now } },
          { senderId: recipientId, recipientId: senderId, seasonId, status: 'PENDING', expiresAt: { gt: now } }
        ]
      }
    });

    if (existingPendingInvitation) {
      return { success: false, message: 'A pending invitation already exists for this season' };
    }

    // Check for existing non-PENDING invitations (ACCEPTED, DENIED, CANCELLED, EXPIRED)
    // and delete them to allow re-inviting after partnership dissolution
    // Use deleteMany to safely delete old invitations (won't error if already deleted)
    const deleteResult = await prisma.seasonInvitation.deleteMany({
      where: {
        senderId,
        recipientId,
        seasonId,
        status: { in: ['ACCEPTED', 'DENIED', 'CANCELLED', 'EXPIRED'] }
      }
    });

    if (deleteResult.count > 0) {
      console.log(`🗑️ Deleted ${deleteResult.count} old invitation(s) to allow new invitation`);
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let invitation: Prisma.SeasonInvitationGetPayload<{
      include: {
        sender: { select: { id: true; name: true; username: true; displayUsername: true; image: true } };
        recipient: { select: { id: true; name: true; username: true; displayUsername: true; image: true } };
        season: { select: { id: true; name: true } };
      };
    }>;
    try {
      invitation = await prisma.seasonInvitation.create({
        data: {
          senderId,
          recipientId,
          seasonId,
          message: message ?? null, // Convert undefined to null for exactOptionalPropertyTypes
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
        sender: invitation.sender, // TypeScript should infer this from the include above
        season: invitation.season, // TypeScript should infer this from the include above
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
 *
 * IMPORTANT: If the recipient (accepting user) has an INCOMPLETE partnership,
 * we complete that partnership instead of creating a new one.
 * This preserves the recipient's captain status and standings.
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

      // Transaction with Serializable isolation: Update invitation + Create/Complete partnership
      // Note: Season memberships are NOT created here - they are created when the team captain registers the team.
      // Fix for #103-3/#103-8: previously this block claimed Serializable isolation
      // in the comment but actually passed no second argument (defaulting to
      // READ COMMITTED). Now explicitly using Serializable.
      const result = await prisma.$transaction(async (tx) => {
        // Check expiry inside transaction
        if (invitation.expiresAt < new Date()) {
          await tx.seasonInvitation.update({
            where: { id: invitationId },
            data: { status: 'EXPIRED', respondedAt: new Date() }
          });
          throw new Error('Invitation has expired');
        }

        // #103 Part 5 finding: previously `acceptSeasonInvitation` did not
        // re-check season status at accept time, so an invite sent before
        // admin cancelled a season could still be accepted and create a
        // partnership in a CANCELLED / FINISHED season. Verified via Scenario
        // 22 which observed success=true on a CANCELLED-season accept.
        const currentSeason = await tx.season.findUnique({
          where: { id: invitation.seasonId },
          select: { status: true, regiDeadline: true },
        });
        if (!currentSeason) {
          throw new Error('Season not found');
        }
        if (currentSeason.status !== 'UPCOMING' && currentSeason.status !== 'ACTIVE') {
          throw new Error('This season is no longer accepting registrations');
        }
        if (currentSeason.regiDeadline && currentSeason.regiDeadline < new Date()) {
          throw new Error('Registration deadline has passed');
        }

        // Check if sender still doesn't have a partnership (INSIDE transaction to prevent race condition)
        const senderExistingPartnership = await tx.partnership.findFirst({
          where: {
            OR: [
              { captainId: invitation.senderId, seasonId: invitation.seasonId },
              { partnerId: invitation.senderId, seasonId: invitation.seasonId }
            ],
            status: { in: ['ACTIVE', 'INCOMPLETE'] }
          }
        });

        if (senderExistingPartnership) {
          throw new Error('Sender already has a partnership in this season');
        }

        // Check if recipient has an INCOMPLETE partnership (they need a new partner)
        const recipientIncompletePartnership = await tx.partnership.findFirst({
          where: {
            captainId: userId,  // Recipient must be captain of INCOMPLETE partnership
            seasonId: invitation.seasonId,
            status: 'INCOMPLETE'
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

        if (recipientIncompletePartnership) {
          // Complete the existing INCOMPLETE partnership
          // Recipient stays captain, sender becomes their partner
          console.log(`🔄 Completing INCOMPLETE partnership ${recipientIncompletePartnership.id} with sender as partner`);

          // #103-3/#103-10: atomic status gate on the INCOMPLETE -> ACTIVE transition.
          const gated = await tx.partnership.updateMany({
            where: { id: recipientIncompletePartnership.id, status: 'INCOMPLETE' },
            data: {
              partnerId: invitation.senderId,
              status: 'ACTIVE',
            },
          });
          if (gated.count === 0) {
            throw new Error('Partnership is no longer accepting new partners');
          }
          const updatedPartnership = await tx.partnership.findUnique({
            where: { id: recipientIncompletePartnership.id },
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
          if (!updatedPartnership) {
            throw new Error('Partnership disappeared after update');
          }

          // Create or update season membership for the new partner (sender)
          // Note: SeasonMembership unique constraint is (userId, seasonId, divisionId)
          const existingMembership = await tx.seasonMembership.findFirst({
            where: {
              userId: invitation.senderId,
              seasonId: invitation.seasonId
            }
          });

          if (existingMembership) {
            await tx.seasonMembership.update({
              where: { id: existingMembership.id },
              data: { status: 'ACTIVE' }
            });
          } else {
            // #103-16: propagate the INCOMPLETE partnership's divisionId so the
            // new partner's membership is not stranded with divisionId=null.
            await tx.seasonMembership.create({
              data: {
                userId: invitation.senderId,
                seasonId: invitation.seasonId,
                divisionId: recipientIncompletePartnership.divisionId,
                status: 'ACTIVE',
              }
            });
          }

          // Update invitation status
          await tx.seasonInvitation.update({
            where: { id: invitationId },
            data: {
              status: 'ACCEPTED',
              respondedAt: new Date()
            }
          });

          // #103-18: auto-cancel overlapping pending invitations / pair requests
          // for both players so their inboxes are clean.
          await tx.seasonInvitation.updateMany({
            where: {
              seasonId: invitation.seasonId,
              status: 'PENDING',
              id: { not: invitationId },
              OR: [
                { senderId: invitation.senderId },
                { recipientId: invitation.senderId },
                { senderId: invitation.recipientId },
                { recipientId: invitation.recipientId },
              ],
            },
            data: { status: 'CANCELLED', respondedAt: new Date() },
          });
          await tx.pairRequest.updateMany({
            where: {
              seasonId: invitation.seasonId,
              status: 'PENDING',
              OR: [
                { requesterId: invitation.senderId },
                { recipientId: invitation.senderId },
                { requesterId: invitation.recipientId },
                { recipientId: invitation.recipientId },
              ],
            },
            data: { status: 'AUTO_DENIED', respondedAt: new Date() },
          });

          return updatedPartnership;
        }

        // Check if recipient has an ACTIVE partnership
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

        // Note: We keep DISSOLVED partnerships for historical purposes
        // The old partnership remains with DISSOLVED status
        // A new partnership with a new ID will be created with ACTIVE status

        // Update invitation status
        await tx.seasonInvitation.update({
          where: { id: invitationId },
          data: {
            status: 'ACCEPTED',
            respondedAt: new Date()
          }
        });

        // #103-18: auto-cancel overlapping pending invitations / pair requests for both players.
        await tx.seasonInvitation.updateMany({
          where: {
            seasonId: invitation.seasonId,
            status: 'PENDING',
            id: { not: invitationId },
            OR: [
              { senderId: invitation.senderId },
              { recipientId: invitation.senderId },
              { senderId: invitation.recipientId },
              { recipientId: invitation.recipientId },
            ],
          },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        });
        await tx.pairRequest.updateMany({
          where: {
            seasonId: invitation.seasonId,
            status: 'PENDING',
            OR: [
              { requesterId: invitation.senderId },
              { recipientId: invitation.senderId },
              { requesterId: invitation.recipientId },
              { recipientId: invitation.recipientId },
            ],
          },
          data: { status: 'AUTO_DENIED', respondedAt: new Date() },
        });

        // Create partnership (sender becomes captain, recipient becomes partner)
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

        // Season memberships will be created when the team captain registers the team
        return partnership;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
 *
 * Fix for #103-1: emits `season_invitation_updated` so the sender's UI
 * transitions out of `pending_sent` state immediately instead of waiting
 * for the next poll.
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

    // #103-1: real-time notification so sender's UI transitions out of pending.
    emitSeasonInvitationUpdated({
      senderId: invitation.senderId,
      recipientId: invitation.recipientId,
      invitationId,
      seasonId: invitation.seasonId,
      status: 'DENIED',
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

    // #103-1: real-time notification so recipient's UI removes the cancelled invite.
    emitSeasonInvitationUpdated({
      senderId: invitation.senderId,
      recipientId: invitation.recipientId,
      invitationId,
      seasonId: invitation.seasonId,
      status: 'CANCELLED',
    });

    return { success: true, message: 'Season invitation cancelled' };
  } catch (error) {
    console.error('Error cancelling season invitation:', error);
    return { success: false, message: 'Failed to cancel invitation' };
  }
};

/**
 * Get all season invitations for a user.
 *
 * Fix for #103-12/#103-17: performs a lazy expiry-on-read pass so that
 * stale PENDING rows (past their 7-day window) are flipped to EXPIRED
 * before we list, even if the daily cron is paused or hasn't run yet.
 */
export const getSeasonInvitations = async (userId: string) => {
  try {
    // Lazy expiry-on-read.
    const now = new Date();
    await prisma.seasonInvitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      data: { status: 'EXPIRED', respondedAt: now },
    });

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
 * Get pending season invitation for a specific season and user.
 *
 * Fix for #103-5: deterministic ordering — sent invitations (user is sender)
 * take priority over received, then by createdAt desc. This matches the
 * expectation in DoublesTeamPairingScreen that a "pending_sent" state
 * shadows a newer incoming invite (which the user can still find in the
 * incoming-invitations tab).
 *
 * Fix for #103-17: lazy-expire any stale PENDING rows before returning, and
 * filter out expired rows from the result. Combined with the re-enabled cron
 * (#103-12), stale PENDING rows never silently block the UI.
 *
 * NOTE: if the frontend needs to display BOTH directions simultaneously in
 * the future, refactor this to return an array. For now, single-result +
 * deterministic tiebreaker is non-breaking.
 */
export const getPendingSeasonInvitation = async (
  userId: string,
  seasonId: string
) => {
  try {
    const now = new Date();

    // #103-17 lazy expiry-on-read: flip stale PENDING rows before we read.
    await prisma.seasonInvitation.updateMany({
      where: {
        seasonId,
        status: 'PENDING',
        expiresAt: { lt: now },
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      data: { status: 'EXPIRED', respondedAt: now },
    });

    // #103-5: two deterministic queries — prefer sent, fall back to received,
    // newest first in each direction. This eliminates the prior findFirst
    // non-determinism.
    const invitation =
      (await prisma.seasonInvitation.findFirst({
        where: {
          senderId: userId,
          seasonId,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        include: _pendingInvitationInclude,
        orderBy: { createdAt: 'desc' },
      })) ||
      (await prisma.seasonInvitation.findFirst({
        where: {
          recipientId: userId,
          seasonId,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        include: _pendingInvitationInclude,
        orderBy: { createdAt: 'desc' },
      }));

    if (invitation) {
      return {
        ...invitation,
        direction: invitation.senderId === userId ? 'sent' : 'received',
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting pending season invitation:', error);
    throw error;
  }
};

// Shared include for getPendingSeasonInvitation. Extracted so the two
// direction queries stay in sync.
const _pendingInvitationInclude = {
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
        include: { result: true },
      },
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
      questionnaireResponses: {
        where: { completedAt: { not: null } },
        include: { result: true },
      },
    },
  },
  season: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

// ==========================================
// SCHEDULED TASKS
// ==========================================

/**
 * Expire old season invitations (run daily via cron job).
 * Updates all PENDING invitations that have passed their expiresAt date
 * to EXPIRED.
 *
 * #103-1: after the bulk update, fan out `season_invitation_updated`
 * events so any connected users see their pending invites disappear in
 * real time. We read the affected rows BEFORE updating to capture their
 * sender/recipient IDs.
 */
export const expireOldSeasonInvitations = async (): Promise<number> => {
  try {
    const now = new Date();

    // Read affected rows first so we can emit socket events after the update.
    const affected = await prisma.seasonInvitation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      select: { id: true, senderId: true, recipientId: true, seasonId: true },
    });

    const result = await prisma.seasonInvitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: now,
      },
    });

    // Fire-and-forget socket emits. Errors logged, not propagated.
    for (const row of affected) {
      try {
        io.to(row.senderId).emit('season_invitation_updated', {
          invitationId: row.id,
          seasonId: row.seasonId,
          status: 'EXPIRED',
        });
        io.to(row.recipientId).emit('season_invitation_updated', {
          invitationId: row.id,
          seasonId: row.seasonId,
          status: 'EXPIRED',
        });
      } catch (socketError) {
        console.error('Error emitting expire socket event:', socketError);
      }
    }

    console.log(`✅ Expired ${result.count} season invitations`);
    return result.count;
  } catch (error) {
    console.error('❌ Error expiring season invitations:', error);
    throw error;
  }
};
