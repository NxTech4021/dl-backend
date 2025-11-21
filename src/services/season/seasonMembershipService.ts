/**
 * Season Membership Service
 * Handles membership registration, division assignment, and payment status updates
 * Extracted from: seasonService.ts lines 347-420
 */

import { prisma } from '../../lib/prisma';
import { Prisma, PaymentStatus } from '@prisma/client';
import {
  RegisterMembershipInput,
  UpdatePaymentStatusInput,
  AssignDivisionInput,
  FormattedMembershipResponse
} from './utils/types';
import {
  validateRegistrationEligibility,
  validateMembershipExists,
  validateDivisionExists
} from './seasonValidationService';
import { formatMembershipResponse } from './utils/formatters';

/**
 * Register a new membership for a season
 * Extracted from: seasonService.ts lines 347-392
 *
 * TRANSACTION SAFETY:
 * - Creates membership record
 * - Increments season's registeredUserCount atomically
 * - Uses transaction to ensure both operations succeed or both fail
 *
 * @param data - Registration data
 * @returns Formatted membership
 * @throws Error if validation fails or creation fails
 */
export async function registerMembership(
  data: RegisterMembershipInput
): Promise<FormattedMembershipResponse> {
  const { userId, seasonId, divisionId } = data;

  // Validate registration eligibility
  const validation = await validateRegistrationEligibility(userId, seasonId);

  if (!validation.isValid) {
    throw new Error(validation.error || "Registration eligibility validation failed");
  }

  const season = validation.data;

  // Execute in transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Step 1: Determine payment and membership status
    const paymentStatus = season.paymentRequired ? PaymentStatus.PENDING : PaymentStatus.COMPLETED;
    // If payment is completed, membership should be ACTIVE; otherwise PENDING
    const membershipStatus = paymentStatus === PaymentStatus.COMPLETED ? "ACTIVE" : "PENDING";
    
    // Step 2: Create membership
    const membershipData: Prisma.SeasonMembershipCreateInput = {
      status: membershipStatus,
      paymentStatus,
      user: {
        connect: { id: userId }
      },
      season: {
        connect: { id: seasonId }
      }
    };

    const membership = await tx.seasonMembership.create({
      data: membershipData,
      include: {
        user: true,
        season: true,
        division: true
      }
    });

    // Step 2: Increment registered user count
    await tx.season.update({
      where: { id: seasonId },
      data: { registeredUserCount: { increment: 1 } }
    });

    return membership;
  });

  console.log(`✅ Membership ${result.id} created for user ${userId} in season ${seasonId}`);

  return formatMembershipResponse(result);
}

/**
 * Update payment status for a membership
 * Extracted from: seasonService.ts lines 394-408
 *
 * @param data - Payment status update data
 * @returns Formatted membership
 * @throws Error if membership not found or update fails
 */
export async function updatePaymentStatus(
  data: UpdatePaymentStatusInput
): Promise<FormattedMembershipResponse> {
  const { membershipId, paymentStatus } = data;

  // Validate membership exists
  const validation = await validateMembershipExists(membershipId);

  if (!validation.isValid) {
    throw new Error(validation.error || "Membership validation failed");
  }

  // Update both payment status and membership status
  // If payment is COMPLETED, membership should be ACTIVE
  const updateData: any = { paymentStatus };
  if (paymentStatus === PaymentStatus.COMPLETED) {
    updateData.status = "ACTIVE";
  }

  const membership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: updateData,
    include: {
      user: true,
      season: true,
      division: true
    }
  });

  console.log(`✅ Payment status updated to ${paymentStatus} for membership ${membershipId}`);
  if (paymentStatus === PaymentStatus.COMPLETED) {
    console.log(`✅ Membership status updated to ACTIVE for membership ${membershipId}`);
  }

  return formatMembershipResponse(membership);
}

/**
 * Assign a division to a membership
 * Extracted from: seasonService.ts lines 410-420
 *
 * @param data - Division assignment data
 * @returns Formatted membership
 * @throws Error if membership or division not found
 */
export async function assignDivision(
  data: AssignDivisionInput
): Promise<FormattedMembershipResponse> {
  const { membershipId, divisionId } = data;

  // Validate membership exists
  const membershipValidation = await validateMembershipExists(membershipId);
  if (!membershipValidation.isValid) {
    throw new Error(membershipValidation.error || "Membership validation failed");
  }

  // Validate division exists
  const divisionValidation = await validateDivisionExists(divisionId);
  if (!divisionValidation.isValid) {
    throw new Error(divisionValidation.error || "Division validation failed");
  }

  const membership = await prisma.seasonMembership.update({
    where: { id: membershipId },
    data: { divisionId },
    include: {
      user: true,
      season: true,
      division: true
    }
  });

  console.log(`✅ Division ${divisionId} assigned to membership ${membershipId}`);

  return formatMembershipResponse(membership);
}

/**
 * Get membership by ID
 *
 * @param membershipId - Membership ID
 * @returns Formatted membership or null
 */
export async function getMembershipById(
  membershipId: string
): Promise<FormattedMembershipResponse | null> {
  const membership = await prisma.seasonMembership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
      season: true,
      division: true
    }
  });

  return membership ? formatMembershipResponse(membership) : null;
}

/**
 * Get all memberships for a season
 *
 * @param seasonId - Season ID
 * @returns Array of formatted memberships
 */
export async function getMembershipsBySeasonId(
  seasonId: string
): Promise<FormattedMembershipResponse[]> {
  const memberships = await prisma.seasonMembership.findMany({
    where: { seasonId },
    include: {
      user: true,
      season: true,
      division: true
    },
    orderBy: { joinedAt: 'desc' }
  });

  return memberships.map(formatMembershipResponse);
}

/**
 * Get all memberships for a user
 *
 * @param userId - User ID
 * @returns Array of formatted memberships
 */
export async function getMembershipsByUserId(
  userId: string
): Promise<FormattedMembershipResponse[]> {
  const memberships = await prisma.seasonMembership.findMany({
    where: { userId },
    include: {
      user: true,
      season: true,
      division: true
    },
    orderBy: { joinedAt: 'desc' }
  });

  return memberships.map(formatMembershipResponse);
}
