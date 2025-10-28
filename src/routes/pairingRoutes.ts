import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';
import {
  sendPairRequest,
  acceptPairRequest,
  denyPairRequest,
  cancelPairRequest,
  getPairRequests,
  getUserPartnerships,
  dissolvePartnership,
  getActivePartnership,
} from '../controllers/pairingController';
import {
  sendFriendRequestHandler,
  acceptFriendRequestHandler,
  rejectFriendRequestHandler,
  removeFriendHandler,
  getFriendRequestsHandler,
  getFriendsHandler,
} from '../controllers/friendshipController';
import {
  sendSeasonInvitationHandler,
  acceptSeasonInvitationHandler,
  denySeasonInvitationHandler,
  cancelSeasonInvitationHandler,
  getSeasonInvitationsHandler,
  getPendingSeasonInvitationHandler,
} from '../controllers/seasonInvitationController';

const pairingRouter = Router();

// All routes require authentication
pairingRouter.use(verifyAuth);

// ==========================================
// SEASON-SPECIFIC PAIR REQUEST ROUTES (LEGACY)
// ==========================================
pairingRouter.post('/request', sendPairRequest);
pairingRouter.get('/requests', getPairRequests);
pairingRouter.post('/request/:requestId/accept', acceptPairRequest);
pairingRouter.post('/request/:requestId/deny', denyPairRequest);
pairingRouter.delete('/request/:requestId', cancelPairRequest);

// Partnership routes (season-specific)
pairingRouter.get('/partnerships', getUserPartnerships);
pairingRouter.post('/partnership/:partnershipId/dissolve', dissolvePartnership);
pairingRouter.get('/partnership/active/:seasonId', getActivePartnership);

// ==========================================
// FRIENDSHIP ROUTES (NEW)
// ==========================================
pairingRouter.post('/friendship/request', sendFriendRequestHandler);
pairingRouter.get('/friendship/requests', getFriendRequestsHandler);
pairingRouter.post('/friendship/:friendshipId/accept', acceptFriendRequestHandler);
pairingRouter.post('/friendship/:friendshipId/reject', rejectFriendRequestHandler);
pairingRouter.delete('/friendship/:friendshipId', removeFriendHandler);
pairingRouter.get('/friends', getFriendsHandler);

// ==========================================
// SEASON INVITATION ROUTES (NEW)
// ==========================================
pairingRouter.post('/season/invitation', sendSeasonInvitationHandler);
pairingRouter.get('/season/invitations', getSeasonInvitationsHandler);
pairingRouter.post('/season/invitation/:invitationId/accept', acceptSeasonInvitationHandler);
pairingRouter.post('/season/invitation/:invitationId/deny', denySeasonInvitationHandler);
pairingRouter.delete('/season/invitation/:invitationId', cancelSeasonInvitationHandler);
pairingRouter.get('/season/invitation/pending/:seasonId', getPendingSeasonInvitationHandler);

export default pairingRouter;
