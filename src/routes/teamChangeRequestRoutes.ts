/**
 * Team Change Request Routes
 * API endpoints for team change request operations
 */

import { Router } from 'express';
import {
  createRequest,
  processRequest,
  getRequests,
  getRequestById,
  cancelRequest,
  getPendingCount
} from '../controllers/teamChangeRequestController';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const teamChangeRequestRoutes = Router();

// Get pending count (before :id route to avoid conflict) - Admin only
teamChangeRequestRoutes.get('/count/pending', verifyAuth, requireAdmin, getPendingCount);

// Get all requests with optional filters - Admin only (users should use filtered endpoint)
teamChangeRequestRoutes.get('/', verifyAuth, requireAdmin, getRequests);

// Get single request by ID - Authenticated users
teamChangeRequestRoutes.get('/:id', verifyAuth, getRequestById);

// Create a new request - Authenticated users
teamChangeRequestRoutes.post('/', verifyAuth, createRequest);

// Process a request (approve/deny) - Admin only
teamChangeRequestRoutes.patch('/:id/process', verifyAuth, requireAdmin, processRequest);

// Cancel a request - User can cancel own request, admin can cancel any
teamChangeRequestRoutes.patch('/:id/cancel', verifyAuth, cancelRequest);

export default teamChangeRequestRoutes;
