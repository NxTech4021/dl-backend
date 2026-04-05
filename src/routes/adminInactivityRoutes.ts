/**
 * Admin Inactivity Routes
 * API endpoints for inactivity threshold configuration
 */

import { Router } from 'express';
// Auth middleware already applied by parent adminRoutes.ts (verifyAuth + requireAdmin)
import {
  getSettings,
  getAllSettings,
  updateSettings,
  removeSettings,
  triggerInactivityCheck,
  getInactivityStats,
  toggleInactivityExempt
} from '../controllers/adminInactivityController';

const router = Router();

// Settings
router.get('/settings', getSettings);
router.get('/settings/all', getAllSettings);
router.put('/settings', updateSettings);
router.delete('/settings/:settingsId', removeSettings);

// Actions
router.post('/check', triggerInactivityCheck);
router.put('/exempt/:userId', toggleInactivityExempt);

// Stats
router.get('/stats', getInactivityStats);

export default router;
