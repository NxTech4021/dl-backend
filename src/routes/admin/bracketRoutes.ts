/**
 * Bracket Routes
 * Admin routes for bracket management (AS2)
 */

import { Router } from 'express';
import {
  createBracket,
  seedBracket,
  publishBracket,
  updateBracketMatch,
  recordBracketMatchResult,
  getBracketById,
  getBracketsBySeason
} from '../../controllers/admin/bracketController';

const router = Router();

// Bracket CRUD
router.post('/brackets', createBracket);
router.get('/brackets/:id', getBracketById);
router.get('/brackets/season/:seasonId', getBracketsBySeason);

// Bracket management
router.post('/brackets/:id/seed', seedBracket);
router.post('/brackets/:id/publish', publishBracket);

// Bracket match management
router.put('/brackets/match/:id', updateBracketMatch);
router.post('/brackets/match/:id/result', recordBracketMatchResult);

export default router;
