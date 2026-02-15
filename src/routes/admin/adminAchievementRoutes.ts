/**
 * Admin Achievement Routes
 * CRUD for achievement definitions + manual grant + season finalization.
 */

import { Router } from 'express';
import {
  getAchievements,
  getEvaluators,
  getAchievementDetail,
  createAchievementHandler,
  updateAchievementHandler,
  deleteAchievementHandler,
  grantAchievementHandler,
  finalizeSeasonAchievementsHandler,
} from '../../controllers/admin/adminAchievementController';

const router = Router();

// List & lookup
router.get('/', getAchievements);
router.get('/evaluators', getEvaluators);
router.get('/:id', getAchievementDetail);

// CRUD
router.post('/', createAchievementHandler);
router.put('/:id', updateAchievementHandler);
router.delete('/:id', deleteAchievementHandler);

// Manual grant
router.post('/:id/grant', grantAchievementHandler);

// Season finalization
router.post('/finalize-season/:seasonId', finalizeSeasonAchievementsHandler);

export default router;
