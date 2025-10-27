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
  sendGeneralPairRequestHandler,
  acceptGeneralPairRequestHandler,
  denyGeneralPairRequestHandler,
  cancelGeneralPairRequestHandler,
  getGeneralPairRequestsHandler,
  getGeneralPartnershipsHandler,
  dissolveGeneralPartnershipHandler,
} from '../controllers/generalPairingController';
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
// GENERAL PAIRING ROUTES (NEW - PHASE 1)
// ==========================================
pairingRouter.post('/general/request', sendGeneralPairRequestHandler);
pairingRouter.get('/general/requests', getGeneralPairRequestsHandler);
pairingRouter.post('/general/request/:requestId/accept', acceptGeneralPairRequestHandler);
pairingRouter.post('/general/request/:requestId/deny', denyGeneralPairRequestHandler);
pairingRouter.delete('/general/request/:requestId', cancelGeneralPairRequestHandler);

// General partnership routes
pairingRouter.get('/general/partnerships', getGeneralPartnershipsHandler);
pairingRouter.post('/general/partnership/:partnershipId/dissolve', dissolveGeneralPartnershipHandler);

// ==========================================
// SEASON INVITATION ROUTES (NEW - PHASE 2)
// ==========================================
pairingRouter.post('/season/invitation', sendSeasonInvitationHandler);
pairingRouter.get('/season/invitations', getSeasonInvitationsHandler);
pairingRouter.post('/season/invitation/:invitationId/accept', acceptSeasonInvitationHandler);
pairingRouter.post('/season/invitation/:invitationId/deny', denySeasonInvitationHandler);
pairingRouter.delete('/season/invitation/:invitationId', cancelSeasonInvitationHandler);
pairingRouter.get('/season/invitation/pending/:seasonId', getPendingSeasonInvitationHandler);

export default pairingRouter;
