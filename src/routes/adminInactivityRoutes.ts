/**
 * Admin Inactivity Routes
 * API endpoints for inactivity threshold configuration
 */

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth';
import {
  getSettings,
  getAllSettings,
  updateSettings,
  removeSettings,
  triggerInactivityCheck,
  getInactivityStats
} from '../controllers/adminInactivityController';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

// Settings
router.get('/settings', getSettings);
router.get('/settings/all', getAllSettings);
router.put('/settings', updateSettings);
router.delete('/settings/:settingsId', removeSettings);

// Actions
router.post('/check', triggerInactivityCheck);

// Stats
router.get('/stats', getInactivityStats);

export default router;
