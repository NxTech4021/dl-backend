/**
 * Admin Report Routes
 * Routes for admin report endpoints
 */

import { Router } from 'express';
import {
  getPlayerRegistrationStats,
  getPlayerRetentionStats,
  getSeasonPerformanceStats,
  getDisputeAnalysisStats,
  getRevenueStats,
  getMembershipStats
} from '../../controllers/admin/adminReportController';

const router = Router();

// Player Reports
router.get('/player-registration', getPlayerRegistrationStats);
router.get('/player-retention', getPlayerRetentionStats);

// Match & Competition Reports
router.get('/season-performance', getSeasonPerformanceStats);
router.get('/dispute-analysis', getDisputeAnalysisStats);

// Financial Reports
router.get('/revenue', getRevenueStats);
router.get('/membership', getMembershipStats);

export default router;
