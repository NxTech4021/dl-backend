/**
 * Notification Preference Routes
 */

import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';
import {
  getPreferences,
  updatePreferences,
  resetPreferences
} from '../controllers/notificationPreferenceController';

const router = Router();

// All routes require authentication
router.use(verifyAuth);

// Get current user's preferences
router.get('/', getPreferences);

// Update preferences
router.put('/', updatePreferences);
router.patch('/', updatePreferences);

// Reset to defaults
router.post('/reset', resetPreferences);

export default router;
