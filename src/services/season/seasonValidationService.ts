/**
 * Season Validation Service
 * All database-backed validation logic
 * ISOLATED - No dependencies on other season services
 */

import { prisma } from '../../lib/prisma';
import {
  ValidationResult,
  PartnershipValidation,
  WithdrawalValidation
} from './utils/types';
import {
  validatePartnershipOwnership,
  validateWithdrawalRequestStatus
} from './utils/validators';
import { isRegistrationOpen } from './utils/dateHelpers';

/**
 * Validate season exists in database
 * @param seasonId - Season ID to validate
 * @returns Validation result with season data if found
 */
export async function validateSeasonExists(seasonId: string): Promise<ValidationResult> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId }
  });

  if (!season) {
    return {
      isValid: false,
      error: "Season not found",
      code: "SEASON_NOT_FOUND"
    };
  }

  return {
    isValid: true,
    data: season
  };
}

/**
 * Validate partnership for withdrawal request
 * Extracted from: seasonController lines 477-493
 *
 * @param partnershipId - Partnership ID to validate
 * @param userId - User ID requesting withdrawal
 * @returns Validation result with partnership data if valid
 */
export async function validatePartnershipForWithdrawal(
  partnershipId: string,
  userId: string
): Promise<PartnershipValidation> {
  const partnership = await prisma.partnership.findUnique({
    where: { id: partnershipId }
  });

  if (!partnership) {
    return {
      isValid: false,
      error: "Partnership not found",
      code: "PARTNERSHIP_NOT_FOUND"
    };
  }

  // Use pure validator for ownership check
  const ownershipCheck = validatePartnershipOwnership(userId, partnership);
  if (!ownershipCheck.isValid) {
    return ownershipCheck;
  }

  return {
    isValid: true,
    partnership
  };
}

/**
 * Validate withdrawal request for processing
 * Extracted from: seasonController lines 538-554
 *
 * @param requestId - Withdrawal request ID
 * @returns Validation result with request data if valid
 */
export async function validateWithdrawalRequestForProcessing(
  requestId: string
): Promise<WithdrawalValidation> {
  const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
    where: { id: requestId },
    include: {
      partnership: true,
      season: {
        select: { id: true, name: true }
      }
    }
  });

  // Use pure validator for status check
  const statusCheck = validateWithdrawalRequestStatus(withdrawalRequest);
  if (!statusCheck.isValid) {
    return statusCheck;
  }

  return {
    isValid: true,
    data: withdrawalRequest,
    withdrawalRequest
  };
}

/**
 * Validate registration eligibility for a season
 * Extracted from: seasonService.ts lines 350-362
 *
 * Checks:
 * - Season exists
 * - Season is active
 * - Registration period is open
 * - User not already registered
 *
 * @param userId - User ID attempting to register
 * @param seasonId - Season ID to register for
 * @returns Validation result with season data if eligible
 */
export async function validateRegistrationEligibility(
  userId: string,
  seasonId: string
): Promise<ValidationResult> {
  // Check if season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId }
  });

  if (!season) {
    return {
      isValid: false,
      error: "Season not found",
      code: "SEASON_NOT_FOUND"
    };
  }

  // Check if season is active
  if (!season.isActive) {
    return {
      isValid: false,
      error: "Season is not active for registration",
      code: "SEASON_NOT_ACTIVE"
    };
  }

  // Check if registration period is open
  if (!isRegistrationOpen(season)) {
    return {
      isValid: false,
      error: "Season registration is not currently open",
      code: "REGISTRATION_CLOSED"
    };
  }

  // Check for existing membership
  const existingMembership = await prisma.seasonMembership.findFirst({
    where: { userId, seasonId }
  });

  if (existingMembership) {
    return {
      isValid: false,
      error: "User already registered for this season",
      code: "ALREADY_REGISTERED"
    };
  }

  return {
    isValid: true,
    data: season
  };
}

/**
 * Validate membership exists
 * @param membershipId - Membership ID to validate
 * @returns Validation result with membership data if found
 */
export async function validateMembershipExists(membershipId: string): Promise<ValidationResult> {
  const membership = await prisma.seasonMembership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
      season: true,
      division: true
    }
  });

  if (!membership) {
    return {
      isValid: false,
      error: "Membership not found",
      code: "MEMBERSHIP_NOT_FOUND"
    };
  }

  return {
    isValid: true,
    data: membership
  };
}

/**
 * Validate division exists
 * @param divisionId - Division ID to validate
 * @returns Validation result with division data if found
 */
export async function validateDivisionExists(divisionId: string): Promise<ValidationResult> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, seasonId: true }
  });

  if (!division) {
    return {
      isValid: false,
      error: "Division not found",
      code: "DIVISION_NOT_FOUND"
    };
  }

  return {
    isValid: true,
    data: division
  };
}

/**
 * Validate no pending withdrawal request exists from partner
 * Prevents user from submitting a request when partner already has one pending
 *
 * @param partnershipId - Partnership ID to check
 * @param userId - Current user ID requesting action
 * @returns Validation result
 */
export async function validateNoPartnerPendingRequest(
  partnershipId: string,
  userId: string
): Promise<ValidationResult> {
  // Get partnership to find partner
  const partnership = await prisma.partnership.findUnique({
    where: { id: partnershipId },
    select: { captainId: true, partnerId: true }
  });

  if (!partnership) {
    return { isValid: true }; // If no partnership, no partner request possible
  }

  const partnerId = partnership.captainId === userId
    ? partnership.partnerId
    : partnership.captainId;

  // If no partner, no partner request possible
  if (!partnerId) {
    return { isValid: true };
  }

  // Check for partner's pending withdrawal request
  const partnerPendingRequest = await prisma.withdrawalRequest.findFirst({
    where: {
      partnershipId,
      userId: partnerId,
      status: 'PENDING',
    },
  });

  if (partnerPendingRequest) {
    return {
      isValid: false,
      error: "Your partner has already submitted a pending partner change request. Please wait for admin review before taking action.",
      code: "PARTNER_HAS_PENDING_REQUEST"
    };
  }

  return { isValid: true };
}
