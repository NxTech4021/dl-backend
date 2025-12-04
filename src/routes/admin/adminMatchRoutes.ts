/**
 * Admin Match Routes
 * Routes for admin match management (AS1-AS7)
 */

import { Router } from 'express';
import {
  getAdminMatches,
  getMatchStats,
  getDisputes,
  getDisputeById,
  resolveDispute,
  addDisputeNote,
  editMatchResult,
  voidMatch,
  getPendingCancellations,
  reviewCancellation,
  applyPenalty,
  getPlayerPenalties,
  messageParticipants,
  editMatchParticipants,
  validateMatchParticipants,
  getAvailablePlayers,
  hideMatch,
  unhideMatch,
  reportMatchAbuse,
  clearMatchReport
} from '../../controllers/admin/adminMatchController';

const router = Router();

// AS6: Matches Dashboard
router.get('/matches', getAdminMatches);
router.get('/matches/stats', getMatchStats);
router.post('/matches/:id/message', messageParticipants);

// AS4: Edit Match Results
router.put('/matches/:id/result', editMatchResult);
router.post('/matches/:id/void', voidMatch);

// AS7: Edit Match Participants
router.put('/matches/:id/participants', editMatchParticipants);
router.post('/matches/:id/participants/validate', validateMatchParticipants);
router.get('/divisions/:divisionId/available-players', getAvailablePlayers);

// AS5: Dispute Resolution
router.get('/disputes', getDisputes);
router.get('/disputes/:id', getDisputeById);
router.post('/disputes/:id/resolve', resolveDispute);
router.post('/disputes/:id/notes', addDisputeNote);

// AS3: Cancellation Enforcement
router.get('/cancellations/pending', getPendingCancellations);
router.post('/cancellations/:id/review', reviewCancellation);

// AS3: Penalties
router.post('/penalties/apply', applyPenalty);
router.get('/penalties/player/:userId', getPlayerPenalties);

// Friendly Match Moderation
router.post('/matches/:id/hide', hideMatch);
router.post('/matches/:id/unhide', unhideMatch);
router.post('/matches/:id/report', reportMatchAbuse);
router.post('/matches/:id/clear-report', clearMatchReport);

export default router;
