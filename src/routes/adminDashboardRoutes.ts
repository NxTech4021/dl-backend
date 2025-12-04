/**
 * Admin Dashboard Routes
 * API endpoints for admin dashboard statistics
 */

import { Router } from 'express';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';
import {
  getDashboardStats,
  getKPIStats,
  getSportsMetrics,
  getMatchActivity,
  getUserGrowth,
  getSportComparison,
} from '../controllers/adminDashboardController';

const router = Router();

// All routes require admin authentication
router.use(verifyAuth);
router.use(requireAdmin);

// All dashboard stats in one call
router.get('/stats', getDashboardStats);

// Individual endpoints for specific data
router.get('/kpi', getKPIStats);
router.get('/sports', getSportsMetrics);
router.get('/match-activity', getMatchActivity);
router.get('/user-growth', getUserGrowth);
router.get('/sport-comparison', getSportComparison);

export default router;
