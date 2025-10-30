/**
 * Division Services Index
 * Central export point for all division services
 */

// CRUD operations
export {
  createDivisionWithThread,
  getAllDivisions,
  getDivisionById,
  updateDivision,
  deleteDivision
} from './divisionCrudService';

// Query operations
export {
  getDivisionsBySeasonId,
  getDivisionSummaryBySeasonId
} from './divisionQueryService';

// Assignment operations
export {
  assignPlayerToDivision,
  removePlayerFromDivision,
  getDivisionAssignments,
  getUserDivisionAssignments,
  autoAssignPlayersToDivisions,
  transferPlayerBetweenDivisions
} from './divisionAssignmentService';

// Capacity operations
export {
  checkDivisionCapacity,
  updateDivisionCounts,
  updateDivisionCountsInTransaction,
  getDivisionCapacityInfo
} from './divisionCapacityService';

// Validation operations
export {
  getAdminIdFromUserId,
  validateUserExists,
  validateDivisionExists,
  validatePlayerRatingForDivision,
  checkAssignmentExists,
  checkSeasonMembershipExists
} from './divisionValidationService';

// Utility exports
export * from './utils/types';
export { formatDivision, formatSeason } from './utils/formatters';
export { toEnum } from './utils/enums';
export { toISODateString, toISODateStringOrNull } from './utils/dateHelpers';
