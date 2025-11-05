/**
 * Season Formatting Service
 * Pure formatting functions - Zero side effects, Zero database calls
 * Eliminates 172 lines of code duplication from controller
 */

import {
  FormattedLeague,
  FormattedCategory,
  FormattedQuestionnaireResponse,
  FormattedQuestionnaireResult,
  FormattedMembership,
  FormattedSeason,
  FormattedMembershipResponse,
  FormattedWithdrawalRequest,
  LeagueFormatInput,
  CategoryFormatInput
} from './types';

// ============================================================================
// ATOMIC FORMATTERS (Building Blocks)
// ============================================================================

/**
 * Format league list
 * Extracted from: seasonController lines 125-130, 239-244
 */
export function formatLeaguesList(leagues: any[]): FormattedLeague[] {
  if (!leagues) return [];

  return leagues.map(league => ({
    id: league.id,
    name: league.name,
    sportType: league.sportType,
    gameType: league.gameType
  }));
}

/**
 * Format category list
 * Extracted from: seasonController lines 188-193, 302-307
 */
export function formatCategory(category: any): FormattedCategory | null {
  if (!category) return null;

  return {
    id: category.id,
    name: category.name,
    genderRestriction: category.genderRestriction,
    gender_category: category.gender_category ?? null,
    game_type: category.game_type ?? null,
    matchFormat: category.matchFormat,
    isActive: category.isActive ?? true,
    categoryOrder: category.categoryOrder ?? 0
  };
}
/**
 * Format questionnaire result
 * Extracted from: seasonController nested mapping lines 149-156, 176-183
 */
export function formatQuestionnaireResult(result: any): FormattedQuestionnaireResult | null {
  if (!result) return null;

  return {
    id: result.id,
    singles: result.singles ?? null,
    doubles: result.doubles ?? null,
    rd: result.rd ?? null,
    confidence: result.confidence ?? null,
    source: result.source ?? null
  };
}

/**
 * Format questionnaire response
 * Extracted from: seasonController lines 145-157, 172-184
 */
export function formatQuestionnaireResponse(response: any): FormattedQuestionnaireResponse {
  return {
    id: response.id,
    sport: response.sport,
    completedAt: response.completedAt ?? null,
    result: formatQuestionnaireResult(response.result)
  };
}

// ============================================================================
// MEMBERSHIP FORMATTERS
// ============================================================================

/**
 * Format SeasonMembership with user and questionnaire data
 * Extracted from: seasonController lines 134-159, 248-273 (52 lines duplicated!)
 */
export function formatMembershipWithUser(membership: any): FormattedMembership {
  // Get the most recent questionnaire response result for initialRatingResult
  const mostRecentResponse = membership.user?.questionnaireResponses?.[0];
  const initialRatingResult = mostRecentResponse?.result ? {
    singles: mostRecentResponse.result.singles ?? null,
    doubles: mostRecentResponse.result.doubles ?? null,
    rd: mostRecentResponse.result.rd ?? null,
    confidence: mostRecentResponse.result.confidence ?? null,
    source: mostRecentResponse.result.source ?? null
  } : null;

  return {
    id: membership.id,
    userId: membership.userId,
    seasonId: membership.seasonId,
    divisionId: membership.divisionId ?? null,
    status: membership.status,
    joinedAt: membership.joinedAt,
    withdrawalReason: membership.withdrawalReason ?? null,
    paymentStatus: membership.paymentStatus,
    user: membership.user ? {
      id: membership.user.id,
      name: membership.user.name ?? null,
      email: membership.user.email,
      image: membership.user.image ?? null,
      username: membership.user.username,
      initialRatingResult: initialRatingResult,
      questionnaireResponses: membership.user.questionnaireResponses
        ?.map(formatQuestionnaireResponse) || []
    } : null
  };
}

/**
 * Format SeasonRegistration as unified membership format
 * Extracted from: seasonController lines 161-186, 275-300 (52 lines duplicated!)
 */
export function formatRegistrationAsMembership(registration: any): FormattedMembership {
  // Get the most recent questionnaire response result for initialRatingResult
  const mostRecentResponse = registration.player?.questionnaireResponses?.[0];
  const initialRatingResult = mostRecentResponse?.result ? {
    singles: mostRecentResponse.result.singles ?? null,
    doubles: mostRecentResponse.result.doubles ?? null,
    rd: mostRecentResponse.result.rd ?? null,
    confidence: mostRecentResponse.result.confidence ?? null,
    source: mostRecentResponse.result.source ?? null
  } : null;

  return {
    id: `reg_${registration.id}`, // Prefix to avoid ID conflicts with SeasonMembership
    userId: registration.playerId,
    seasonId: registration.seasonId.toString(),
    divisionId: registration.divisionId?.toString() || null,
    status: 'ACTIVE', // SeasonRegistration is always active
    joinedAt: registration.registeredAt,
    withdrawalReason: null,
    paymentStatus: 'PENDING', // Default for registrations
    user: registration.player ? {
      id: registration.player.id,
      name: registration.player.name ?? null,
      email: registration.player.email,
      image: registration.player.image ?? null,
      username: registration.player.username,
      initialRatingResult: initialRatingResult,
      questionnaireResponses: registration.player.questionnaireResponses
        ?.map(formatQuestionnaireResponse) || []
    } : null
  };
}

/**
 * Merge SeasonMembership and SeasonRegistration into unified format
 * Helper to eliminate duplicate merging logic
 */
export function formatMembershipsList(
  memberships: any[],
  registrations: any[]
): FormattedMembership[] {
  const formattedMemberships = memberships?.map(formatMembershipWithUser) || [];
  const formattedRegistrations = registrations?.map(formatRegistrationAsMembership) || [];

  return [...formattedMemberships, ...formattedRegistrations];
}

/**
 * Format membership response for API endpoints
 * Extracted from: seasonController lines 616-623, 642-656, 681-695 (44 lines duplicated!)
 */
export function formatMembershipResponse(membership: any): FormattedMembershipResponse {
  return {
    id: membership.id,
    userId: membership.userId,
    seasonId: membership.seasonId,
    divisionId: membership.divisionId ?? null,
    status: membership.status,
    joinedAt: membership.joinedAt,
    withdrawalReason: membership.withdrawalReason ?? null,
    paymentStatus: membership.paymentStatus,
    user: {
      id: membership.user.id,
      name: membership.user.name ?? null
    },
    season: {
      id: membership.season.id,
      name: membership.season.name
    },
    division: membership.division ? {
      id: membership.division.id,
      name: membership.division.name
    } : null
  };
}

// ============================================================================
// SEASON FORMATTERS
// ============================================================================

/**
 * Format complete season with all relations
 * Combines all above formatters - eliminates 144 lines of duplication!
 * Used by: getSeasons (lines 123-194), getSeasonById (lines 237-308)
 */
export function formatSeasonWithRelations(season: any): FormattedSeason {
  return {
    id: season.id,
    name: season.name,
    startDate: season.startDate ?? null,
    endDate: season.endDate ?? null,
    regiDeadline: season.regiDeadline ?? null,
    entryFee: Number(season.entryFee),
    description: season.description ?? null,
    registeredUserCount: season.registeredUserCount ?? 0,
    status: season.status,
    isActive: season.isActive,
    paymentRequired: season.paymentRequired,
    promoCodeSupported: season.promoCodeSupported,
    withdrawalEnabled: season.withdrawalEnabled,
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
    leagues: formatLeaguesList(season.leagues),
    category: formatCategory(season.category),
    memberships: formatMembershipsList(season.memberships, []),
    divisions: season.divisions,
    promoCodes: season.promoCodes,
    withdrawalRequests: season.withdrawalRequests,
    waitlist: season.waitlist,
    partnerships: season.partnerships || []
  };
}

/**
 * Format season with minimal relations (for list views)
 */
export function formatSeasonBasic(season: any): Partial<FormattedSeason> {
  return {
    id: season.id,
    name: season.name,
    startDate: season.startDate ?? null,
    endDate: season.endDate ?? null,
    regiDeadline: season.regiDeadline ?? null,
    entryFee: Number(season.entryFee),
    description: season.description ?? null,
    registeredUserCount: season.registeredUserCount ?? 0,
    status: season.status,
    isActive: season.isActive,
    paymentRequired: season.paymentRequired,
    promoCodeSupported: season.promoCodeSupported,
    withdrawalEnabled: season.withdrawalEnabled,
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
    leagues: formatLeaguesList(season.leagues),
    category: formatCategory(season.category),
  };
}

// ============================================================================
// WITHDRAWAL FORMATTERS
// ============================================================================

/**
 * Format withdrawal request with relations
 */
export function formatWithdrawalRequest(request: any): FormattedWithdrawalRequest {
  const formatted: FormattedWithdrawalRequest = {
    id: request.id,
    seasonId: request.seasonId,
    userId: request.userId,
    reason: request.reason,
    partnershipId: request.partnershipId ?? null,
    status: request.status,
    processedByAdminId: request.processedByAdminId ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    partnership: request.partnership ? {
      id: request.partnership.id,
      player1: {
        id: request.partnership.player1.id,
        name: request.partnership.player1.name ?? null
      },
      player2: {
        id: request.partnership.player2.id,
        name: request.partnership.player2.name ?? null
      }
    } : null,
    processedByAdmin: request.processedByAdmin ? {
      name: request.processedByAdmin.name ?? null,
      role: request.processedByAdmin.role
    } : null
  };

  if (request.season) {
    formatted.season = {
      id: request.season.id,
      name: request.season.name
    };
  }

  return formatted;
}
