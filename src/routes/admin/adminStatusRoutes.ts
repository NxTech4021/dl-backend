/**
 * Admin Status Management Routes
 * Routes for admin suspend, activate, and status history operations
 */

import { Router } from 'express';
import { requireSuperAdmin } from '../../middlewares/auth.middleware';
import {
  suspendAdmin,
  activateAdmin,
  getAdminStatusHistory,
  getAdminDetail
} from '../../controllers/admin/adminStatusController';

const router = Router();

// Get admin detail for profile view (any admin can view)
// GET /api/admin/admins/:id
router.get('/:id', getAdminDetail);

// Get admin status history (any admin can view)
// GET /api/admin/admins/:id/status-history
router.get('/:id/status-history', getAdminStatusHistory);

// Suspend an admin (SUPERADMIN only)
// POST /api/admin/admins/:id/suspend
// Body: { reason: string, notes?: string }
router.post('/:id/suspend', requireSuperAdmin, suspendAdmin);

// Activate a suspended admin (SUPERADMIN only)
// POST /api/admin/admins/:id/activate
// Body: { notes?: string }
router.post('/:id/activate', requireSuperAdmin, activateAdmin);

export default router;
