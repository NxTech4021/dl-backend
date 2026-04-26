/**
 * Season Withdrawal Service
 * Handles withdrawal request lifecycle with transaction safety
 * Extracted from: seasonController lines 461-601
 */

import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  SubmitWithdrawalInput,
  FormattedWithdrawalRequest
} from './utils/types';
import {
  validatePartnershipForWithdrawal,
  validateWithdrawalRequestForProcessing,
  validateNoPartnerPendingRequest
} from './seasonValidationService';
import { formatWithdrawalRequest } from './utils/formatters';
import { translateTransactionRaceError } from '../../utils/prismaErrors';

/**
 * Submit a withdrawal request
 * Extracted from: seasonController lines 476-512
 *
 * @param data - Withdrawal request data
 * @returns Formatted withdrawal request
 * @throws Error if validation fails or creation fails
 */
export async function submitWithdrawalRequest(
  data: SubmitWithdrawalInput
): Promise<FormattedWithdrawalRequest> {
  const { userId, seasonId, reason, partnershipId } = data;

  // Validate required fields
  if (!seasonId || !reason) {
    throw new Error("Missing required fields: seasonId and reason");
  }

  // Validate partnership if provided
  if (partnershipId) {
    const partnershipValidation = await validatePartnershipForWithdrawal(
      partnershipId,
      userId
    );

    if (!partnershipValidation.isValid) {
      throw new Error(partnershipValidation.error || "Partnership validation failed");
    }

    // Check if partner already has a pending request
    const partnerPendingCheck = await validateNoPartnerPendingRequest(
      partnershipId,
      userId
    );

    if (!partnerPendingCheck.isValid) {
      throw new Error(partnerPendingCheck.error || "Partner has pending request");
    }
  }

  // Create withdrawal request with relations
  const newRequest = await prisma.withdrawalRequest.create({
    data: {
      seasonId,
      userId,
      reason,
      partnershipId: partnershipId || null,
      status: "PENDING"
    },
    include: {
      season: {
        select: { id: true, name: true }
      },
      partnership: {
        include: {
          captain: {
            select: { id: true, name: true }
          },
          partner: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  console.log(`✅ Withdrawal request ${newRequest.id} created for user ${userId}`);

  return formatWithdrawalRequest(newRequest);
}

/**
 * Process a withdrawal request (APPROVE or REJECT)
 * Extracted from: seasonController lines 538-587
 *
 * TRANSACTION SAFETY:
 * - Updates withdrawalRequest status atomically
 * - Conditionally dissolves partnership if approved
 * - Rollback occurs automatically on any error
 * - Both operations succeed or both fail
 *
 * FUTURE CONSIDERATION:
 * If partnership logic becomes complex, consider:
 * 1. Creating partnershipService
 * 2. Passing `tx` parameter to service methods
 * 3. Example: await updatePartnershipStatus(tx, partnershipId, 'DISSOLVED')
 *
 * @param requestId - Withdrawal request ID
 * @param status - APPROVED or REJECTED
 * @param processedByAdminId - Admin ID processing the request
 * @returns Formatted withdrawal request with updated status
 * @throws Error if request not found, already processed, or transaction fails
 */
export async function processWithdrawalRequest(
  requestId: string,
  status: "APPROVED" | "REJECTED",
  processedByAdminId: string,
  adminNotes?: string
): Promise<FormattedWithdrawalRequest> {
  // Validate withdrawal request exists and is pending
  const validation = await validateWithdrawalRequestForProcessing(requestId);

  if (!validation.isValid) {
    throw new Error(validation.error || "Withdrawal request validation failed");
  }

  const withdrawalRequest = validation.withdrawalRequest;

  // Process in transaction to ensure atomicity. We catch Prisma race errors
  // (P2034 serialization failure from Serializable isolation) and translate
  // them into a friendly "Partnership is no longer active" message via the
  // shared helper. Verified by #103 Part 5 Scenario 12.
  let result: any;
  try {
    result = await prisma.$transaction(async (tx) => {
    // Step 1: Update withdrawal request status.
    // #103 Part 5.1 finding: the previous code passed `processedByAdminId: id`
    // directly, which failed at runtime because the deployed Prisma client
    // was stale (the fields had been added to the schema but `prisma generate`
    // was never re-run). Fix shipped in two parts:
    //   1. `npm run dev` now runs `npx prisma generate` on startup
    //      (package.json scripts) so the dev container always has a fresh client.
    //   2. This code uses the relation-connect form for the admin FK which
    //      works in both checked and unchecked Prisma input variants.
    // Verified by `test-103.ts` Scenario 12 (idempotent race) + 12b (happy path).
    const updatedRequest = await tx.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: status,
        processedByAdmin: { connect: { id: processedByAdminId } },
        adminNotes: adminNotes || null,
        processedAt: new Date(),
      },
      include: {
        processedByAdmin: {
          select: {
            name: true,
            role: true
          }
        },
        partnership: {
          include: {
            captain: {
              select: { id: true, name: true }
            },
            partner: {
              select: { id: true, name: true }
            }
          }
        },
        season: {
          select: { id: true, name: true }
        }
      }
    });

    // Step 2: If approved and has partnership, create INCOMPLETE partnership for remaining player
    if (status === "APPROVED" && withdrawalRequest.partnershipId) {
      // Fetch the partnership to identify remaining player
      const partnership = await tx.partnership.findUnique({
        where: { id: withdrawalRequest.partnershipId },
        include: { division: true }
      });

      if (partnership) {
        // 1. Mark old partnership as DISSOLVED using an atomic status gate.
        //    Fix for #103-11: prevents creating a phantom INCOMPLETE when the
        //    partnership has already been dissolved by another path (e.g. one of
        //    the players hit "Leave" before admin approval processed).
        const gated = await tx.partnership.updateMany({
          where: { id: withdrawalRequest.partnershipId, status: 'ACTIVE' },
          data: {
            status: 'DISSOLVED',
            dissolvedAt: new Date(),
          },
        });
        if (gated.count === 0) {
          throw new Error('Partnership is no longer active — cannot process withdrawal');
        }

        console.log(`✅ Partnership ${withdrawalRequest.partnershipId} dissolved due to approved withdrawal`);

        // 2. Determine remaining player (not the withdrawing user)
        const remainingPlayerId = partnership.captainId === withdrawalRequest.userId
          ? partnership.partnerId
          : partnership.captainId;

        if (remainingPlayerId) {
          // 3. Create new INCOMPLETE partnership for remaining player
          const incompletePartnership = await tx.partnership.create({
            data: {
              captainId: remainingPlayerId,
              partnerId: null,
              seasonId: partnership.seasonId,
              divisionId: partnership.divisionId,
              predecessorId: withdrawalRequest.partnershipId,
              status: 'INCOMPLETE',
              pairRating: null,
            }
          });

          console.log(`✅ Created INCOMPLETE partnership ${incompletePartnership.id} for remaining player ${remainingPlayerId}`);

          // 4. Transfer divisionStandings from old to new partnership
          await tx.divisionStanding.updateMany({
            where: { partnershipId: withdrawalRequest.partnershipId },
            data: { partnershipId: incompletePartnership.id }
          });

          console.log(`✅ Transferred division standings to new partnership`);

          // NOTE: DivisionAssignment is intentionally NOT deleted on withdrawal —
          // the row is kept as audit history (standings, rankings, and admin
          // views depend on it). The 6 engagement/inactivity crons
          // (NOTIF-036/037/040/042/043/044) filter via
          // `user: { seasonMemberships: { some: { seasonId, status: 'ACTIVE' } } }`
          // so withdrawn members are skipped from nag notifications.
          // Resolved in U2 (2026-04-24) — see docs/issues/backlog/
          // notification-audit-consolidated-bugs-2026-04-22.md#13-u2.
          // 5. Only remove withdrawing player's membership
          await tx.seasonMembership.updateMany({
            where: {
              userId: withdrawalRequest.userId,
              seasonId: partnership.seasonId
            },
            data: { status: 'REMOVED' }
          });

          console.log(`✅ Removed withdrawing player's membership`);
        }
      }
    }

      return updatedRequest;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    const translated = translateTransactionRaceError(err);
    if (translated) {
      throw new Error(translated);
    }
    throw err;
  }

  console.log(`✅ Withdrawal request ${requestId} ${status} by admin ${processedByAdminId}`);

  return formatWithdrawalRequest(result);
}

/**
 * Get all withdrawal requests for a season
 *
 * @param seasonId - Season ID
 * @returns Array of formatted withdrawal requests
 */
export async function getWithdrawalRequestsBySeasonId(
  seasonId: string
): Promise<FormattedWithdrawalRequest[]> {
  const requests = await prisma.withdrawalRequest.findMany({
    where: { seasonId },
    include: {
      partnership: {
        include: {
          captain: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } }
        }
      },
      processedByAdmin: {
        select: { id: true, name: true, role: true }
      },
      season: {
        select: { id: true, name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return requests.map(formatWithdrawalRequest);
}

/**
 * Get withdrawal request by ID
 *
 * @param requestId - Withdrawal request ID
 * @returns Formatted withdrawal request or null
 */
export async function getWithdrawalRequestById(
  requestId: string
): Promise<FormattedWithdrawalRequest | null> {
  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: requestId },
    include: {
      partnership: {
        include: {
          captain: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } }
        }
      },
      processedByAdmin: {
        select: { id: true, name: true, role: true }
      },
      season: {
        select: { id: true, name: true }
      }
    }
  });

  return request ? formatWithdrawalRequest(request) : null;
}
