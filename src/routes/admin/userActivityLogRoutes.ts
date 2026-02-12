/**
 * User Activity Log Routes
 * Routes for user activity log operations (admin-facing)
 */

import { Router } from 'express';
import {
  getActivityLogs,
  getActivityForUser,
  getActivityForTarget,
} from '../../controllers/admin/userActivityLogController';

const router = Router();

// Get activity logs for a specific user
// GET /api/admin/user-activity/user/:userId
router.get('/user/:userId', getActivityForUser);

// Get activity logs for a specific target
// GET /api/admin/user-activity/target/:targetType/:targetId
router.get('/target/:targetType/:targetId', getActivityForTarget);

// Get all user activity logs with filtering
// GET /api/admin/user-activity?page=1&limit=50&actionType=SCORE_SUBMIT
router.get('/', getActivityLogs);

export default router;
