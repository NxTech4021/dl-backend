/**
 * Admin Rating Routes
 * API endpoints for admin rating operations
 */

import { Router } from 'express';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';
import {
  getAdminDivisionRatings,
  getAdminDivisionSummary,
  adjustRating,
  previewRecalc,
  recalculateMatch,
  recalculatePlayer,
  recalculateDivision,
  recalculateRatings,
  getParameters,
  updateParameters,
  lockSeason,
  unlockSeason,
  getLockStatus,
  getSeasonExport
} from '../controllers/adminRatingController';

const router = Router();

// All routes require admin authentication
router.use(verifyAuth);
router.use(requireAdmin);

// Division ratings
router.get('/division/:divisionId', getAdminDivisionRatings);
router.get('/division/:divisionId/summary', getAdminDivisionSummary);

// Manual adjustment
router.post('/adjust', adjustRating);

// Recalculation - granular scopes
router.post('/recalculate/preview', previewRecalc);
router.post('/recalculate/match/:matchId', recalculateMatch);
router.post('/recalculate/player/:userId', recalculatePlayer);
router.post('/recalculate/division/:divisionId', recalculateDivision);
router.post('/recalculate/:seasonId', recalculateRatings);

// Parameters
router.get('/parameters/:seasonId', getParameters);
router.put('/parameters/:seasonId', updateParameters);

// Season lock
router.get('/lock-status/:seasonId', getLockStatus);
router.post('/lock/:seasonId', lockSeason);
router.post('/unlock/:seasonId', unlockSeason);

// Export
router.get('/export/:seasonId', getSeasonExport);

export default router;
