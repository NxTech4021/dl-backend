/**
 * Admin Log Routes
 * Routes for admin action log operations
 */

import { Router } from 'express';
import {
  getLogs,
  getLogsForTarget,
  getActivitySummary,
  getActionTypes,
  getTargetTypes
} from '../../controllers/admin/adminLogController';

const router = Router();

// Get available filter options
// GET /api/admin/logs/action-types
router.get('/action-types', getActionTypes);

// GET /api/admin/logs/target-types
router.get('/target-types', getTargetTypes);

// Get activity summary for dashboard
// GET /api/admin/logs/summary
router.get('/summary', getActivitySummary);

// Get logs for a specific target
// GET /api/admin/logs/target/:targetType/:targetId
router.get('/target/:targetType/:targetId', getLogsForTarget);

// Get all admin logs with filtering
// GET /api/admin/logs?page=1&limit=50&actionType=PLAYER_BAN&startDate=2024-01-01
router.get('/', getLogs);

export default router;
