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
  validateWithdrawalRequestForProcessing
} from './seasonValidationService';
import { formatWithdrawalRequest } from './utils/formatters';

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
  processedByAdminId: string
): Promise<FormattedWithdrawalRequest> {
  // Validate withdrawal request exists and is pending
  const validation = await validateWithdrawalRequestForProcessing(requestId);

  if (!validation.isValid) {
    throw new Error(validation.error || "Withdrawal request validation failed");
  }

  const withdrawalRequest = validation.withdrawalRequest;

  // Process in transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Step 1: Update withdrawal request status
    const updatedRequest = await tx.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: status,
        processedByAdminId: processedByAdminId
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

    // Step 2: If approved and has partnership, dissolve it
    if (status === "APPROVED" && withdrawalRequest.partnershipId) {
      await tx.partnership.update({
        where: { id: withdrawalRequest.partnershipId },
        data: {
          status: "DISSOLVED",
          dissolvedAt: new Date()
        }
      });

      console.log(`✅ Partnership ${withdrawalRequest.partnershipId} dissolved due to approved withdrawal`);
    }

    return updatedRequest;
  });

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
