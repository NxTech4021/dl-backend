/**
 * Rating Services - Barrel Export
 */

export * from './standingsCalculationService';
export * from './playerRatingService';
export * from './adminRatingService';

// DMR (Glicko-2 based) rating service - preferred for new code
export {
  DMRRatingService,
  getDMRRatingService,
  DMRError,
  InvalidMatchDataError,
  PlayerNotFoundError
} from './dmrRatingService';

export type {
  RatingEntry,
  DMRConfig,
  SetScore,
  SinglesMatchInput,
  DoublesMatchInput,
  RatingUpdate,
  MatchRatingResult,
  DoublesRatingResult
} from './dmrRatingService';

export { getStandingsCalculationService } from './standingsCalculationService';
export { getPlayerRatingService } from './playerRatingService';
export { getAdminRatingService } from './adminRatingService';
