/**
 * Season Validation Utilities
 * Pure validation functions - no database calls
 * Extracted from seasonController inline validation logic
 */

import { ValidationResult } from './types';

/**
 * Validate create season input
 * Extracted from: seasonController lines 35-56
 */
export function validateCreateSeasonInput(data: any): ValidationResult {
  // Check required fields
  if (!data.name || !data.startDate || !data.endDate || !data.entryFee) {
    return {
      isValid: false,
      error: "Missing required fields",
      code: "MISSING_FIELDS"
    };
  }

  // Validate leagueIds array
  if (!data.leagueIds || !Array.isArray(data.leagueIds) || data.leagueIds.length === 0) {
    return {
      isValid: false,
      error: "At least one league must be specified",
      code: "INVALID_LEAGUES"
    };
  }

  // Validate categoryId (controller converts single to array)
  if (!data.categoryId || typeof data.categoryId !== 'string') {
    return {
      isValid: false,
      error: "A category must be specified",
      code: "INVALID_CATEGORY"
    };
  }

  return { isValid: true };
}

/**
 * Validate update season input
 * Extracted from: seasonController lines 342-352
 */
export function validateUpdateSeasonInput(data: any): ValidationResult {
  // Validate leagueIds if provided
  if (data.leagueIds !== undefined) {
    if (!Array.isArray(data.leagueIds) || data.leagueIds.length === 0) {
      return {
        isValid: false,
        error: "leagueIds must be an array with at least one league",
        code: "INVALID_LEAGUES"
      };
    }
  }

  // Validate categoryIds if provided
  if (data.categoryIds !== undefined) {
    if (!Array.isArray(data.categoryIds) || data.categoryIds.length === 0) {
      return {
        isValid: false,
        error: "categoryIds must be an array with at least one category",
        code: "INVALID_CATEGORIES"
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate withdrawal status value
 * Extracted from: seasonController lines 533-535
 */
export function validateWithdrawalStatus(status: string): ValidationResult {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return {
      isValid: false,
      error: "Invalid status",
      code: "INVALID_STATUS"
    };
  }

  return { isValid: true };
}

/**
 * Validate partnership ownership
 * Extracted from: seasonController lines 486-492
 */
export function validatePartnershipOwnership(
  userId: string,
  partnership: any
): ValidationResult {
  if (!partnership) {
    return {
      isValid: false,
      error: "Partnership not found",
      code: "PARTNERSHIP_NOT_FOUND"
    };
  }

  if (partnership.captainId !== userId && partnership.partnerId !== userId) {
    return {
      isValid: false,
      error: "You are not part of this partnership",
      code: "UNAUTHORIZED"
    };
  }

  if (partnership.status !== "ACTIVE") {
    return {
      isValid: false,
      error: "Partnership is not active",
      code: "INACTIVE_PARTNERSHIP"
    };
  }

  return { isValid: true };
}

/**
 * Validate withdrawal request status for processing
 * Extracted from: seasonController lines 550-554
 */
export function validateWithdrawalRequestStatus(request: any): ValidationResult {
  if (!request) {
    return {
      isValid: false,
      error: "Withdrawal request not found",
      code: "NOT_FOUND"
    };
  }

  if (request.status !== "PENDING") {
    return {
      isValid: false,
      error: "This request has already been processed",
      code: "ALREADY_PROCESSED"
    };
  }

  return { isValid: true };
}

/**
 * Validate payment status enum
 */
export function validatePaymentStatus(paymentStatus: string, validStatuses: string[]): ValidationResult {
  if (!validStatuses.includes(paymentStatus)) {
    return {
      isValid: false,
      error: "Invalid paymentStatus value",
      code: "INVALID_PAYMENT_STATUS"
    };
  }

  return { isValid: true };
}
