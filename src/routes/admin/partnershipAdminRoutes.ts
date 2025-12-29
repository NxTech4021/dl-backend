/**
 * Admin Partnership Routes
 * Routes for managing partnership changes, withdrawal requests, and dissolved partnerships
 */

import { Router } from "express";
import {
  getWithdrawalRequestsHandler,
  getWithdrawalRequestStatsHandler,
  getDissolvedPartnershipsHandler,
  getDissolvedPartnershipByIdHandler,
} from "../../controllers/admin/partnershipAdminController";

const router = Router();

// Get all withdrawal requests with optional filters
// GET /api/admin/partnerships/withdrawal-requests?status=PENDING&seasonId=xxx&search=xxx
router.get("/withdrawal-requests", getWithdrawalRequestsHandler);

// Get withdrawal request statistics
// GET /api/admin/partnerships/withdrawal-requests/stats
router.get("/withdrawal-requests/stats", getWithdrawalRequestStatsHandler);

// Get all dissolved partnerships with lifecycle info
// GET /api/admin/partnerships/dissolved?seasonId=xxx&search=xxx
router.get("/dissolved", getDissolvedPartnershipsHandler);

// Get a single dissolved partnership by ID
// GET /api/admin/partnerships/dissolved/:id
router.get("/dissolved/:id", getDissolvedPartnershipByIdHandler);

export default router;
