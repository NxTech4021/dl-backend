/**
 * Match Invitation Routes
 * Routes for match creation, invitations, and scheduling
 */

import { Router } from 'express';
import {
  createMatch,
  getMatches,
  getMatchById,
  getAvailableMatches,
  getMyMatches,
  joinMatch,
  respondToInvitation,
  proposeTimeSlot,
  voteForTimeSlot,
  confirmTimeSlot
} from '../../controllers/match/matchInvitationController';

const router = Router();

// Match CRUD
router.post('/create', createMatch);
router.get('/', getMatches);
router.get('/my', getMyMatches);
router.get('/available/:divisionId', getAvailableMatches);
router.get('/:id', getMatchById);

// Join match
router.post('/:id/join', joinMatch);

// Time slots
router.post('/:id/timeslots', proposeTimeSlot);
router.post('/timeslots/:id/vote', voteForTimeSlot);
router.post('/timeslots/:id/confirm', confirmTimeSlot);

// Invitations
router.post('/invitations/:id/respond', respondToInvitation);

export default router;
