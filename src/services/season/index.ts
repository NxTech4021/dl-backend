/**
 * Season Services - Central Export File
 *
 * Clean service-based architecture for season management
 * Refactored from 701-line controller + 419-line service into organized modules
 */

// ============================================================================
// CRUD Operations
// ============================================================================
export {
  createSeason,
  updateSeason,
  updateSeasonStatus,
  deleteSeason
} from './seasonCrudService';

// ============================================================================
// Query Operations
// ============================================================================
export {
  getAllSeasons,
  getSeasonById,
  getActiveSeason,
  seasonExists,
  getSeasonsByStatus,
  getSeasonsByLeagueId,
  getUserSeasons
} from './seasonQueryService';

// ============================================================================
// Membership Operations
// ============================================================================
export {
  registerMembership,
  updatePaymentStatus,
  assignDivision,
  getMembershipById,
  getMembershipsBySeasonId,
  getMembershipsByUserId
} from './seasonMembershipService';

// ============================================================================
// Withdrawal Operations
// ============================================================================
export {
  submitWithdrawalRequest,
  processWithdrawalRequest,
  getWithdrawalRequestsBySeasonId,
  getWithdrawalRequestById
} from './seasonWithdrawalService';

// ============================================================================
// Validation Services
// ============================================================================
export {
  validateSeasonExists,
  validatePartnershipForWithdrawal,
  validateWithdrawalRequestForProcessing,
  validateRegistrationEligibility,
  validateMembershipExists,
  validateDivisionExists
} from './seasonValidationService';

// ============================================================================
// Utility Exports
// ============================================================================
export {
  formatSeasonWithRelations,
  formatMembershipResponse,
  formatWithdrawalRequest,
  formatLeaguesList,
  formatCategory as formatCategoriesList
} from './utils/formatters';

export {
  validateCreateSeasonInput,
  validateUpdateSeasonInput,
  validateWithdrawalStatus,
  validatePartnershipOwnership,
  validateWithdrawalRequestStatus,
  validatePaymentStatus
} from './utils/validators';

export {
  toISODateString,
  toISODateStringOrNull,
  isRegistrationOpen,
  isSeasonActive,
  isDateInPast,
  isDateInFuture
} from './utils/dateHelpers';

// ============================================================================
// Type Exports
// ============================================================================
export type {
  CreateSeasonInput,
  UpdateSeasonInput,
  UpdateSeasonStatusInput,
  RegisterMembershipInput,
  UpdatePaymentStatusInput,
  AssignDivisionInput,
  SubmitWithdrawalInput,
  FormattedSeason,
  FormattedMembership,
  FormattedMembershipResponse,
  FormattedWithdrawalRequest,
  FormattedLeague,
  FormattedCategory,
  FormattedUser,
  ValidationResult,
  PartnershipValidation,
  WithdrawalValidation
} from './utils/types';
