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

const teamChangeRequestRoutes = Router();

// Get pending count (before :id route to avoid conflict)
teamChangeRequestRoutes.get('/count/pending', getPendingCount);

// Get all requests with optional filters
teamChangeRequestRoutes.get('/', getRequests);

// Get single request by ID
teamChangeRequestRoutes.get('/:id', getRequestById);

// Create a new request
teamChangeRequestRoutes.post('/', createRequest);

// Process a request (approve/deny) - Admin only
teamChangeRequestRoutes.patch('/:id/process', processRequest);

// Cancel a request - User only
teamChangeRequestRoutes.patch('/:id/cancel', cancelRequest);

export default teamChangeRequestRoutes;
