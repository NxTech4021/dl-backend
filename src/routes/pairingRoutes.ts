import { Router } from 'express';
import { verifyAuth } from '../middlewares/auth.middleware';
import {
  sendPairRequest,
  acceptPairRequest,
  denyPairRequest,
  cancelPairRequest,
  getPairRequests,
  getUserPartnerships,
} from '../controllers/pairingController';

const pairingRouter = Router();

// All routes require authentication
pairingRouter.use(verifyAuth);

// Pair request routes
pairingRouter.post('/request', sendPairRequest);
pairingRouter.get('/requests', getPairRequests);
pairingRouter.post('/request/:requestId/accept', acceptPairRequest);
pairingRouter.post('/request/:requestId/deny', denyPairRequest);
pairingRouter.delete('/request/:requestId', cancelPairRequest);

// Partnership routes
pairingRouter.get('/partnerships', getUserPartnerships);

export default pairingRouter;
