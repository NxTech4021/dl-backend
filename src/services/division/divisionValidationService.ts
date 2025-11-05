/**
 * Division Validation Service
 * Handles all validation logic for divisions
 * ISOLATED - No dependencies on other services
 */

import { prisma } from '../../lib/prisma';
import { GameType } from "@prisma/client";

/**
 * Player rating validation result
 */
export interface PlayerRatingValidation {
  isValid: boolean;
  error?: string;
  playerRating?: number;
  divisionThreshold?: number;
}

/**
 * Admin ID lookup result
 */
export interface AdminLookupResult {
  adminId: string | null;
  found: boolean;
}

/**
 * Division validation result
 */
export interface DivisionValidationResult {
  isValid: boolean;
  error?: string;
  division?: any;
}

/**
 * User existence validation result
 */
export interface UserValidationResult {
  isValid: boolean;
  error?: string;
  user?: {
    id: string;
    name: string | null;
    username: string;
  };
}

/**
 * Get admin ID from user ID
 * @param userId - User ID to look up
 * @returns Admin ID if found, null otherwise
 */
export async function getAdminIdFromUserId(
  userId: string
): Promise<AdminLookupResult> {
  const adminRecord = await prisma.admin.findUnique({
    where: { userId },
    select: { id: true },
  });

  return {
    adminId: adminRecord?.id ?? null,
    found: !!adminRecord
  };
}

/**
 * Validate user exists
 * @param userId - User ID to validate
 * @returns Validation result with user data if found
 */
export async function validateUserExists(
  userId: string
): Promise<UserValidationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true }
  });

  if (!user) {
    return {
      isValid: false,
      error: "User not found"
    };
  }

  return {
    isValid: true,
    user
  };
}

/**
 * Validate division exists and is active
 * @param divisionId - Division ID to validate
 * @param seasonId - Expected season ID (optional)
 * @returns Validation result with division data if valid
 */
export async function validateDivisionExists(
  divisionId: string,
  seasonId?: string
): Promise<DivisionValidationResult> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      season: { select: { id: true, name: true, isActive: true } }
    }
  });

  if (!division) {
    return {
      isValid: false,
      error: "Division not found"
    };
  }

  // Verify division belongs to the specified season if provided
  if (seasonId && division.seasonId !== seasonId) {
    return {
      isValid: false,
      error: "Division does not belong to the specified season"
    };
  }

  // Check if division is active
  if (!division.isActiveDivision) {
    return {
      isValid: false,
      error: "Cannot assign to inactive division"
    };
  }

  return {
    isValid: true,
    division
  };
}

/**
 * Validate player rating against division threshold
 * @param userId - User ID to validate
 * @param divisionId - Division ID
 * @param divisionThreshold - Division points threshold (null means no threshold)
 * @param gameType - Game type (SINGLES or DOUBLES)
 * @param seasonId - Season ID
 * @returns Validation result
 */
export async function validatePlayerRatingForDivision(
  userId: string,
  divisionId: string,
  divisionThreshold: number | null,
  gameType: GameType,
  seasonId: string
): Promise<PlayerRatingValidation> {
  // If no threshold, player is valid
  if (!divisionThreshold) {
    return { isValid: true };
  }

  // Get the season's league to determine sport type
  const seasonWithLeague = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      leagues: {
        select: { sportType: true }
      }
    }
  });

  if (!seasonWithLeague?.leagues?.[0]?.sportType) {
    return {
      isValid: false,
      error: "Unable to determine sport type for season"
    };
  }

  const sportType = seasonWithLeague.leagues[0].sportType.toLowerCase();

  // Get player's questionnaire response for this sport
  const questionnaireResponse = await prisma.questionnaireResponse.findFirst({
    where: {
      userId: userId,
      sport: sportType,
      completedAt: { not: null }
    },
    include: {
      result: true
    }
  });

  if (!questionnaireResponse?.result) {
    return {
      isValid: false,
      error: "Player has not completed the skill assessment questionnaire for this sport"
    };
  }

  // Determine the appropriate rating based on game type
  const playerRating = gameType === GameType.DOUBLES
    ? questionnaireResponse.result.doubles
    : questionnaireResponse.result.singles;

  if (playerRating && playerRating > divisionThreshold) {
    return {
      isValid: false,
      error: `Player rating (${playerRating}) exceeds division threshold (${divisionThreshold}). Player is too advanced for this division.`,
      playerRating,
      divisionThreshold
    };
  }

  return {
    isValid: true,
    ...(playerRating !== null && playerRating !== undefined && { playerRating }),
    divisionThreshold
  };
}

/**
 * Validate assignment already exists
 * @param userId - User ID
 * @param divisionId - Division ID
 * @returns True if assignment exists, false otherwise
 */
export async function checkAssignmentExists(
  userId: string,
  divisionId: string
): Promise<boolean> {
  const existing = await prisma.divisionAssignment.findFirst({
    where: {
      userId,
      divisionId
    }
  });

  return !!existing;
}

/**
 * Validate season membership exists
 * @param userId - User ID
 * @param seasonId - Season ID
 * @returns True if membership exists, false otherwise
 */
export async function checkSeasonMembershipExists(
  userId: string,
  seasonId: string
): Promise<boolean> {
  const membership = await prisma.seasonMembership.findFirst({
    where: {
      userId,
      seasonId,
      status: { not: 'WITHDRAWN' }
    }
  });

  return !!membership;
}
