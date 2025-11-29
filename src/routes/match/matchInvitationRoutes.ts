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
  confirmTimeSlot,
  editMatch,
  postMatchToChat,
  requestToJoinMatch,
  respondToJoinRequest,
  getInvitationById,
  getPendingInvitations
} from '../../controllers/match/matchInvitationController';

const router = Router();

// Match CRUD
router.post('/create', createMatch);
router.get('/', getMatches);
router.get('/my', getMyMatches);
router.get('/available/:divisionId', getAvailableMatches);
router.get('/:id', getMatchById);
router.put('/:id/edit', editMatch);

// Join match
router.post('/:id/join', joinMatch);

// Division chat match posting
router.post('/:id/post-to-chat', postMatchToChat);
router.post('/:id/join-request', requestToJoinMatch);
router.post('/join-requests/:requestId/respond', respondToJoinRequest);

// Time slots
router.post('/:id/timeslots', proposeTimeSlot);
router.post('/timeslots/:id/vote', voteForTimeSlot);
router.post('/timeslots/:id/confirm', confirmTimeSlot);

// Invitations
router.get('/invitations/pending', getPendingInvitations);
router.get('/invitations/:id', getInvitationById);
router.post('/invitations/:id/respond', respondToInvitation);

export default router;
