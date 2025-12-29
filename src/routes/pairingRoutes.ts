import { Router, RequestHandler } from 'express';
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
  getPartnershipStatus,
  inviteReplacementPartner,
  acceptReplacementInvite,
  getEligibleReplacementPartners,
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
pairingRouter.get('/partnership/:partnershipId/status', getPartnershipStatus);

// ==========================================
// PARTNER REPLACEMENT ROUTES (NEW)
// ==========================================
pairingRouter.post('/partnership/:partnershipId/invite-replacement', inviteReplacementPartner);
pairingRouter.post('/partnership/:partnershipId/accept-replacement/:requestId', acceptReplacementInvite);
pairingRouter.get('/partnership/:partnershipId/eligible-partners', getEligibleReplacementPartners);

// ==========================================
// FRIENDSHIP ROUTES (NEW)
// ==========================================
pairingRouter.post('/friendship/request', sendFriendRequestHandler as RequestHandler);
pairingRouter.get('/friendship/requests', getFriendRequestsHandler as RequestHandler);
pairingRouter.post('/friendship/:friendshipId/accept', acceptFriendRequestHandler as RequestHandler);
pairingRouter.post('/friendship/:friendshipId/reject', rejectFriendRequestHandler as RequestHandler);
pairingRouter.delete('/friendship/:friendshipId', removeFriendHandler as RequestHandler);
pairingRouter.get('/friends', getFriendsHandler as RequestHandler);

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
