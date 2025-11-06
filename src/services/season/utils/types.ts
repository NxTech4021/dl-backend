/**
 * Season Service Type Definitions
 * All TypeScript interfaces for season operations
 * Enhanced with Prisma types for maximum type safety
 */

import { Prisma, PaymentStatus, SeasonStatus } from "@prisma/client";

// ============================================================================
// PRISMA-BASED INPUT TYPES (For Type Safety)
// ============================================================================

export type LeagueFormatInput = Prisma.LeagueGetPayload<{
  select: { id: true; name: true; sportType: true; gameType: true };
}>;

export type CategoryFormatInput = Prisma.CategoryGetPayload<{
  select: { id: true; name: true; genderRestriction: true; matchFormat: true };
}>;

export type SeasonWithFullRelations = Prisma.SeasonGetPayload<{
  include: {
    leagues: {
      select: {
        id: true;
        name: true;
        sportType: true;
        gameType: true;
      };
    };
    category: {
      select: {
        id: true;
        name: true;
        genderRestriction: true;
        matchFormat: true;
      };
    };
    memberships: {
      include: {
        user: {
          include: {
            questionnaireResponses: {
              include: { result: true };
            };
          };
        };
      };
    };
    registrations: {
      include: {
        player: {
          include: {
            questionnaireResponses: {
              include: { result: true };
            };
          };
        };
        division: true;
      };
    };
    divisions: true;
    promoCodes: true;
    withdrawalRequests: {
      include: {
        processedByAdmin: true;
      };
    };
    waitlist: {
      include: {
        waitlistedUsers: true;
      };
    };
  };
}>;

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateSeasonInput {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  regiDeadline?: string | Date;
  description?: string;
  entryFee: string | number;
  leagueIds: string[];
  categoryIds: string[]; // Converted from single categoryId in controller
  isActive?: boolean;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

export interface UpdateSeasonInput {
  name?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  regiDeadline?: string | Date;
  entryFee?: number;
  description?: string;
  leagueIds?: string[];
  categoryIds?: string[];
  isActive?: boolean;
  status?: SeasonStatus;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

export interface UpdateSeasonStatusInput {
  status?: SeasonStatus;
  isActive?: boolean;
}

export interface SubmitWithdrawalInput {
  userId: string;
  seasonId: string;
  reason: string;
  partnershipId?: string;
}

export interface ProcessWithdrawalInput {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  processedByAdminId: string;
}

export interface RegisterMembershipInput {
  userId: string;
  seasonId: string;
  divisionId?: string;
}

export interface UpdatePaymentStatusInput {
  membershipId: string;
  paymentStatus: PaymentStatus;
}

export interface AssignDivisionInput {
  membershipId: string;
  divisionId: string;
}

// ============================================================================
// OUTPUT TYPES (Formatted Responses)
// ============================================================================

export interface FormattedLeague {
  id: string;
  name: string;
  sportType: string;
  gameType: string;
}

export interface FormattedCategory {
  id: string;
  name: string;
  genderRestriction: string | null;
  gender_category?: string | null;
  game_type?: string | null;
  matchFormat: string | null;
  isActive?: boolean;
  categoryOrder?: number;
}

export interface FormattedQuestionnaireResult {
  id: string;
  singles: number | null;
  doubles: number | null;
  rd: number | null;
  confidence: number | null;
  source: string | null;
}

export interface FormattedQuestionnaireResponse {
  id: string;
  sport: string;
  completedAt: Date | null;
  result: FormattedQuestionnaireResult | null;
}

export interface FormattedUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  username: string;
  initialRatingResult?: {
    singles: number | null;
    doubles: number | null;
    rd: number | null;
    confidence: string | null;
    source: string;
  } | null;
  questionnaireResponses?: FormattedQuestionnaireResponse[];
}

export interface FormattedMembership {
  id: string;
  userId: string;
  seasonId: string;
  divisionId: string | null;
  status: string;
  joinedAt: Date;
  withdrawalReason: string | null;
  paymentStatus: string;
  user: FormattedUser | null;
}

export interface FormattedMembershipResponse {
  id: string;
  userId: string;
  seasonId: string;
  divisionId: string | null;
  status: string;
  joinedAt: Date;
  withdrawalReason: string | null;
  paymentStatus: string;
  user: {
    id: string;
    name: string | null;
  };
  season: {
    id: string;
    name: string;
  };
  division: {
    id: string;
    name: string;
  } | null;
}

export interface FormattedSeason {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  regiDeadline: Date | null;
  entryFee: number;
  description: string | null;
  registeredUserCount: number;
  status: SeasonStatus;
  isActive: boolean;
  paymentRequired: boolean;
  promoCodeSupported: boolean;
  withdrawalEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  leagues: FormattedLeague[];
  category: FormattedCategory | null; 
  memberships: FormattedMembership[];
  divisions?: any[];
  promoCodes?: any[];
  withdrawalRequests?: any[];
  waitlist?: any;
  partnerships?: any[];
}

export interface FormattedWithdrawalRequest {
  id: string;
  seasonId: string;
  userId: string;
  reason: string;
  partnershipId: string | null;
  status: string;
  processedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
  season?: {
    id: string;
    name: string;
  };
  partnership?: {
    id: string;
    player1: {
      id: string;
      name: string | null;
    };
    player2: {
      id: string;
      name: string | null;
    };
  } | null;
  processedByAdmin?: {
    name: string | null;
    role: string;
  } | null;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: string;
  data?: any;
}

export interface PartnershipValidation extends ValidationResult {
  partnership?: any;
}

export interface WithdrawalValidation extends ValidationResult {
  withdrawalRequest?: any;
}

export interface MembershipValidation extends ValidationResult {
  membership?: any;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface SeasonQueryParams {
  id?: string;
  active?: boolean;
  status?: SeasonStatus;
}

export interface SeasonFilters {
  active?: boolean;
  status?: SeasonStatus;
}
