/**
 * Admin Best 6 Routes
 * API endpoints for Best 6 and standings management
 *
 * SECURITY: All routes require admin authentication
 */

import { Router } from 'express';
import { verifyAuth, requireAdmin } from '../../middlewares/auth.middleware';
import {
  recalculatePlayerBest6,
  recalculateDivisionBest6,
  recalculateDivisionStandings,
  getPlayerBest6,
  getDivisionStandings
} from '../../controllers/admin/adminBest6Controller';

const router = Router();

// Apply authentication and admin check to all routes
router.use(verifyAuth);
router.use(requireAdmin);

// Best 6 Recalculation
router.post('/best6/player/:userId/recalculate', recalculatePlayerBest6);
router.post('/best6/division/:divisionId/recalculate', recalculateDivisionBest6);

// Standings Recalculation
router.post('/standings/division/:divisionId/recalculate', recalculateDivisionStandings);

// Best 6 Composition
router.get('/best6/player/:userId', getPlayerBest6);

// Standings Display
router.get('/standings/division/:divisionId', getDivisionStandings);

export default router;
